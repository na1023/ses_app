"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import {
  Project,
  DailyReport,
  countsAsWork,
  parseNum,
  effectiveStatus,
  scheduledHours,
  projectWorkDays,
  worksOnHolidays,
  parseSessions,
  sessionsMinutes,
  hhmmToMin,
  OVERTIME_BASE_HOURS,
} from "./constants";
import { getSettings, getAutoBaseSalary } from "./settings-actions";
import { hourlyWageOf, standardMinutesOf } from "./settings";
import { periodOf, inPeriod, ymdOf } from "./period";
import { computeDayPay, emptyTotals, addDayToTotals, PayTotals } from "./payroll";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function listProjects(): Promise<Project[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from("projects")
    .select("*")
    .order("status", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
}

export type ProjectInput = {
  id?: string;
  company: string;
  project_name: string;
  status: string;
  start_date: string;
  end_date: string;
  min_hours: string;
  max_hours: string;
  standard_hours: string;
  work_start: string;
  work_end: string;
  work_break: string;
  work_days: string;
  work_holidays: string;
  memo: string;
};

export async function saveProject(
  input: ProjectInput
): Promise<{ ok: boolean; message: string }> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };

  if (!input.company.trim() || !input.project_name.trim())
    return { ok: false, message: "会社名と案件名は必須です。" };

  const row = {
    company: input.company.trim(),
    project_name: input.project_name.trim(),
    status: input.status,
    start_date: input.start_date,
    end_date: input.end_date,
    min_hours: input.min_hours,
    max_hours: input.max_hours,
    standard_hours: input.standard_hours,
    work_start: input.work_start,
    work_end: input.work_end,
    work_break: input.work_break,
    work_days: input.work_days,
    work_holidays: input.work_holidays,
    memo: input.memo,
    user_id: user.id,
  };

  if (input.id) {
    const { error } = await sb.from("projects").update(row).eq("id", input.id);
    if (error) return { ok: false, message: `更新に失敗: ${error.message}` };
  } else {
    const { error } = await sb.from("projects").insert({ id: genId(), ...row });
    if (error) return { ok: false, message: `保存に失敗: ${error.message}` };
  }
  revalidatePath("/projects");
  revalidatePath("/settlement");
  return { ok: true, message: input.id ? "更新しました" : "案件を登録しました" };
}

export async function deleteProject(id: string): Promise<{ ok: boolean }> {
  const sb = createClient();
  const { error } = await sb.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
  revalidatePath("/settlement");
  return { ok: true };
}

// ============================================================
// 精算（案件ごとの月間 稼働時間・過不足）
// ============================================================
export type SettlementRow = {
  project_id: string;
  company: string;
  project_name: string;
  status: string;
  worked: number; // 当月の現場実働合計
  min: number | null;
  max: number | null;
  shortage: number; // 下限に対する不足（0以上）
  excess: number; // 上限に対する超過（0以上）
  state: "ok" | "short" | "over" | "none"; // 精算判定（確定ベース）
  scheduled: number | null; // 就業時間（定時/日）
  overtime: number; // 残業（8h超）当該案件分
  scheduleOver: number; // 就業時間超過（定時超）当該案件分
  projected: number | null; // 月末見込み稼働（現在ペース）
  pace: "ontrack" | "behind" | "overpace" | "done" | "none"; // 現在ペース判定
  reason: string; // 下限割れ/上限超過などの理由メモ
};

export type LawWarning = { level: "danger" | "warn" | "info"; text: string };

export type WeekSummary = { start: string; end: string; hours: number; ot: number; days: number };
export type DayEntry = { date: string; company: string; project: string; att: string; site: number; office: number; total: number; ot: number };

export type SettlementResult = {
  ym: string;
  rows: SettlementRow[];
  totalWorked: number;
  workDays: number;
  overtime: number;
  scheduleOver: number;
  annualOvertime: number; // 当年の残業累計（1〜当月）
  monthComplete: boolean; // 当月がすでに終了しているか
  warnings: LawWarning[];
  weeks: WeekSummary[]; // 週別（月曜始まり）
  periodLabel: string; // 集計期間の表示（締め日対応）
  pay: PayTotals; // 残業代（法定内/法定外/深夜）
  hourly: number; // 時給（円/時）
  closingType: "month_end" | "day_15";
  baseSalary: number;
  days: DayEntry[];
};

function parseDate(s: string): Date | null {
  const t = (s ?? "").trim();
  if (!t || t === "現在" || t === "継続中" || t === "継続") return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function getHolidaySet(): Promise<Set<string>> {
  try {
    const res = await fetch("https://holidays-jp.github.io/api/v1/date.json", {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return new Set();
    const j = (await res.json()) as Record<string, string>;
    return new Set(Object.keys(j));
  } catch {
    return new Set();
  }
}

export async function getSettlement(ym: string, override?: { closing_type?: "month_end" | "day_15"; customStart?: string; customEnd?: string }): Promise<SettlementResult> {
  const sb = createClient();
  const [{ data: projData }, { data: dailyData }, { data: noteData }, holidays, settingsRaw, baseSalary] = await Promise.all([
    sb.from("projects").select("*"),
    sb.from("daily_reports").select("*"),
    sb.from("settlement_notes").select("project_id, reason").eq("year_month", ym),
    getHolidaySet(),
    getSettings(),
    getAutoBaseSalary(),
  ]);
  const projects = (projData ?? []) as Project[];
  const daily = (dailyData ?? []) as DailyReport[];
  const noteMap = new Map<string, string>();
  (noteData ?? []).forEach((n: { project_id?: string; reason?: string }) => {
    if (n.project_id) noteMap.set(n.project_id, n.reason ?? "");
  });

  const [yy] = ym.split("-").map(Number);
  // 締め日ベースの集計期間（override で一時切替）
  const settings = override?.closing_type ? { ...settingsRaw, closing_type: override.closing_type } : settingsRaw;
  let period = periodOf(ym, settings);
  if (override?.customStart && override?.customEnd) {
    const s = new Date(override.customStart);
    const e = new Date(override.customEnd);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
      const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
      period = { start: s, end: e, startStr: override.customStart, endStr: override.customEnd, label: `${md(s)}〜${md(e)}（カスタム期間）` };
    }
  }
  const monthStart = period.start;
  const monthEnd = period.end;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthComplete = today > monthEnd;
  const wage = hourlyWageOf(settings, baseSalary);
  const stdMin = standardMinutesOf(settings);

  const ymdStr = (d: Date) => ymdOf(d);

  const monthDaily = daily.filter(
    (d) => inPeriod(String(d.date), period) && countsAsWork(d.attendance_type)
  );

  const schedByProject = new Map<string, number | null>();
  projects.forEach((p) =>
    schedByProject.set(`${p.company}||${p.project_name}`, scheduledHours(p))
  );

  // すべて「分」で集計して端数(1分ズレ)を防ぐ
  const toMin = (h: number) => Math.round(h * 60);
  const LEGAL_MIN = OVERTIME_BASE_HOURS * 60; // 480

  /**
   * 1日の実働分数を「時刻データから正確に再計算」する。
   * これにより DB の小数(float)誤差の累積を防ぐ。
   * work_sessions/return_office_start/end が無い旧データは work_hours にフォールバック。
   */
  function siteMinOf(d: DailyReport): number {
    const sess = parseSessions(d.work_sessions);
    if (sess.length > 0) {
      const brk = hhmmToMin(d.break_time || "") ?? 0;
      return Math.max(0, sessionsMinutes(sess) - brk);
    }
    return toMin(Number(d.work_hours) || 0);
  }
  function officeMinOf(d: DailyReport): number {
    const s = hhmmToMin(d.return_office_start || "");
    const e = hhmmToMin(d.return_office_end || "");
    if (s !== null && e !== null && e > s) return e - s;
    return toMin(parseNum(d.return_office_hours) ?? 0);
  }
  function dayTotalMin(d: DailyReport): number {
    return siteMinOf(d) + officeMinOf(d);
  }

  // 月間集計（実績）＋ 残業代
  let totalMin = 0;
  let overtimeMin = 0;
  let scheduleOverMin = 0;
  let pay: PayTotals = emptyTotals();
  const days: DayEntry[] = [];
  monthDaily.forEach((d) => {
    const siteMin = siteMinOf(d);
    const officeMin = officeMinOf(d);
    const dayMin = siteMin + officeMin;
    const dayOt = dayMin > LEGAL_MIN ? dayMin - LEGAL_MIN : 0;
    days.push({ date: String(d.date), company: d.company || "", project: d.project_name || "", att: d.attendance_type || "", site: siteMin / 60, office: officeMin / 60, total: dayMin / 60, ot: dayOt / 60 });
    totalMin += dayMin;
    if (dayMin > LEGAL_MIN) overtimeMin += dayMin - LEGAL_MIN;
    const sched = schedByProject.get(`${d.company}||${d.project_name}`) ?? null;
    if (sched !== null) {
      const schedMin = toMin(sched);
      if (dayMin > schedMin) scheduleOverMin += dayMin - schedMin;
    }
    // 残業代（自社定時＝所定として法定内/法定外/深夜を1分単位で算出）
    const sess = parseSessions(d.work_sessions);
    if (sess.length && wage > 0) {
      pay = addDayToTotals(pay, computeDayPay(sess, d.break_time || "", stdMin, wage));
    }
  });
  const totalWorked = totalMin / 60;
  const overtime = overtimeMin / 60;
  const scheduleOver = scheduleOverMin / 60;
  const workDays = new Set(monthDaily.map((d) => d.date)).size;

  // 年間残業累計（当年1月〜当月まで・分で集計）
  let annualOtMin = 0;
  daily.forEach((d) => {
    if (!countsAsWork(d.attendance_type)) return;
    const ds = String(d.date);
    if (ds.slice(0, 4) !== String(yy)) return;
    if (ds.slice(0, 7) > ym) return; // 当月より後は除外
    const dayMin = dayTotalMin(d);
    if (dayMin > LEGAL_MIN) annualOtMin += dayMin - LEGAL_MIN;
  });
  const annualOvertime = annualOtMin / 60;

  const rows: SettlementRow[] = [];
  projects.forEach((p) => {
    const est = effectiveStatus(p.status, p.end_date);
    const end = parseDate(p.end_date);
    const startD = parseDate(p.start_date);
    // 当月開始より前に終了した案件は、この月以降 表示しない
    if (end && end < monthStart) return;
    // 当月末より後に開始する案件（＝開始前の月）は表示しない
    if (startD && startD > monthEnd) return;

    // 終了案件は終了日以降の日を含めない
    const days = monthDaily.filter(
      (d) =>
        d.company === p.company &&
        d.project_name === p.project_name &&
        (!end || new Date(d.date) <= end)
    );
    const worked = days.reduce((s, d) => s + siteMinOf(d), 0) / 60;
    const sched = scheduledHours(p);
    const schedMinP = sched !== null ? toMin(sched) : null;
    let projOtMin = 0;
    let projSchedMin = 0;
    days.forEach((d) => {
      const dayMin = dayTotalMin(d);
      if (dayMin > LEGAL_MIN) projOtMin += dayMin - LEGAL_MIN;
      if (schedMinP !== null && dayMin > schedMinP) projSchedMin += dayMin - schedMinP;
    });
    const projOt = projOtMin / 60;
    const projSched = projSchedMin / 60;

    const min = parseNum(p.min_hours);
    const max = parseNum(p.max_hours);
    let shortage = 0;
    let excess = 0;
    let state: SettlementRow["state"] = "none";
    if (min !== null && worked < min) { shortage = min - worked; state = "short"; }
    else if (max !== null && worked > max) { excess = worked - max; state = "over"; }
    else if (min !== null || max !== null) state = "ok";

    // 現在ペースの月末見込み
    //   仕組み: 「これまでに実際働いた日の平均時間」を「残りの稼働予定日」に掛けて加算
    //   → 休んだ日があっても、実働日ペースで残日数分を予測できる
    const wdset = projectWorkDays(p);
    const holWork = worksOnHolidays(p);
    let remainWorkdays = 0; // 今日より後の稼働予定日数（案件の稼働曜日ベース）
    for (let dt = new Date(monthStart); dt <= monthEnd; dt.setDate(dt.getDate() + 1)) {
      if (end && dt > end) break; // 案件終了日以降は数えない
      if (dt <= today) continue; // 今日以前は「実績」があるので予測不要
      const wd = dt.getDay();
      const isWorkday = wdset.has(wd) && (holWork || !holidays.has(ymdStr(dt)));
      if (isWorkday) remainWorkdays++;
    }
    const workedDays = days.length; // 実際に働いた日数（この案件で日報がある日）
    const avgHours = workedDays > 0 ? worked / workedDays : 0;

    const projectComplete = monthComplete || (end !== null && end <= today);
    let projected: number | null = null;
    let pace: SettlementRow["pace"] = "none";
    if (min !== null || max !== null) {
      if (projectComplete) {
        projected = worked;
        pace = "done";
      } else {
        // 月末見込み ＝ 実績 ＋ 残り稼働日 × 1日平均
        projected = worked + remainWorkdays * avgHours;
        if (max !== null && projected > max) pace = "overpace";
        else if (min !== null && projected < min) pace = "behind";
        else pace = "ontrack";
      }
    }

    rows.push({
      project_id: p.id, company: p.company, project_name: p.project_name,
      status: est, worked, min, max, shortage, excess, state,
      scheduled: sched, overtime: projOt, scheduleOver: projSched,
      projected, pace, reason: noteMap.get(p.id) ?? "",
    });
  });

  rows.sort((a, b) => {
    const aw = a.worked > 0 || a.min !== null || a.max !== null ? 0 : 1;
    const bw = b.worked > 0 || b.min !== null || b.max !== null ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return b.worked - a.worked;
  });

  // ===== 労働基準法チェック =====
  const warnings: LawWarning[] = [];
  if (overtime > 80)
    warnings.push({ level: "danger", text: `当月の残業が${overtime.toFixed(0)}hです。過労死ライン(月80h)を超えています。労働時間の削減が必要です。` });
  else if (overtime > 45)
    warnings.push({ level: "warn", text: `当月の残業が${overtime.toFixed(0)}hです。36協定の原則上限(月45h)を超えています。` });
  if (annualOvertime > 360)
    warnings.push({ level: "danger", text: `当年の残業累計が${annualOvertime.toFixed(0)}hです。年間上限(360h)を超えています。` });
  else if (annualOvertime > 288)
    warnings.push({ level: "info", text: `当年の残業累計が${annualOvertime.toFixed(0)}hです。年間上限(360h)の8割を超えています。` });

  // 1日の勤務が長すぎる日（休憩後の実働が長い）
  const longDay = monthDaily.find((d) => dayTotalMin(d) > 13 * 60);
  if (longDay)
    warnings.push({ level: "warn", text: `1日の勤務が13時間を超える日があります（${longDay.date}）。休憩・健康管理にご注意ください。` });

  // 連続勤務日数（当月内）
  const dset = Array.from(new Set(monthDaily.map((d) => d.date))).sort();
  let run = 0, maxRun = 0;
  let prev: Date | null = null;
  dset.forEach((ds) => {
    const cur = new Date(ds);
    if (prev && (cur.getTime() - prev.getTime()) === 86400000) run += 1;
    else run = 1;
    maxRun = Math.max(maxRun, run);
    prev = cur;
  });
  if (maxRun >= 7)
    warnings.push({ level: "warn", text: `${maxRun}日連続勤務があります。労基法は週1日以上の休日を求めています。` });

  // ===== 週別集計（月曜始まり・分で集計） =====
  const weekMap = new Map<string, { start: string; hoursMin: number; otMin: number; days: Set<string> }>();
  monthDaily.forEach((d) => {
    const dt = new Date(d.date);
    const monday = new Date(dt);
    monday.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const key = ymdStr(monday);
    const dayMin = dayTotalMin(d);
    const w = weekMap.get(key) ?? { start: key, hoursMin: 0, otMin: 0, days: new Set<string>() };
    w.hoursMin += dayMin;
    if (dayMin > LEGAL_MIN) w.otMin += dayMin - LEGAL_MIN;
    w.days.add(d.date);
    weekMap.set(key, w);
  });
  const weeks: WeekSummary[] = Array.from(weekMap.values())
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .map((w) => {
      const sun = new Date(w.start);
      sun.setDate(sun.getDate() + 6);
      return { start: w.start, end: ymdStr(sun), hours: w.hoursMin / 60, ot: w.otMin / 60, days: w.days.size };
    });

  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { ym, rows, totalWorked, workDays, overtime, scheduleOver, annualOvertime, monthComplete, warnings, weeks, periodLabel: period.label, pay, hourly: wage, closingType: settings.closing_type, baseSalary, days };
}

/** 精算の理由メモを保存（月×案件ごと） */
export async function saveSettlementNote(
  projectId: string,
  ym: string,
  reason: string
): Promise<{ ok: boolean; message: string }> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };

  const { error } = await sb.from("settlement_notes").upsert({
    id: `${projectId}_${ym}`,
    project_id: projectId,
    year_month: ym,
    reason: reason.trim(),
    user_id: user.id,
    created_at: new Date().toISOString().slice(0, 16).replace("T", " "),
  });
  if (error) return { ok: false, message: `保存に失敗: ${error.message}` };

  revalidatePath("/settlement");
  return { ok: true, message: "理由を保存しました" };
}
