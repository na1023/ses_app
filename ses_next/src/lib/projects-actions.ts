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
  OVERTIME_BASE_HOURS,
} from "./constants";

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
};

export type LawWarning = { level: "danger" | "warn" | "info"; text: string };

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
};

function parseDate(s: string): Date | null {
  const t = (s ?? "").trim();
  if (!t || t === "現在" || t === "継続中" || t === "継続") return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getSettlement(ym: string): Promise<SettlementResult> {
  const sb = createClient();
  const [{ data: projData }, { data: dailyData }] = await Promise.all([
    sb.from("projects").select("*"),
    sb.from("daily_reports").select("*"),
  ]);
  const projects = (projData ?? []) as Project[];
  const daily = (dailyData ?? []) as DailyReport[];

  const [yy, mm] = ym.split("-").map(Number);
  const monthStart = new Date(yy, mm - 1, 1);
  const monthEnd = new Date(yy, mm, 0); // 当月末日
  const daysInMonth = monthEnd.getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthComplete = today > monthEnd;
  // 経過割合（当月内で今日までに経過した日数の割合）
  let elapsed = 1;
  if (today < monthStart) elapsed = 0;
  else if (!monthComplete)
    elapsed = Math.min(1, (today.getDate()) / daysInMonth);

  const monthDaily = daily.filter(
    (d) => String(d.date).startsWith(ym) && countsAsWork(d.attendance_type)
  );

  const schedByProject = new Map<string, number | null>();
  projects.forEach((p) =>
    schedByProject.set(`${p.company}||${p.project_name}`, scheduledHours(p))
  );

  // 月間集計（実績）
  let totalWorked = 0;
  let overtime = 0;
  let scheduleOver = 0;
  monthDaily.forEach((d) => {
    const dayTotal = (Number(d.work_hours) || 0) + (parseNum(d.return_office_hours) ?? 0);
    totalWorked += dayTotal;
    if (dayTotal > OVERTIME_BASE_HOURS) overtime += dayTotal - OVERTIME_BASE_HOURS;
    const sched = schedByProject.get(`${d.company}||${d.project_name}`) ?? null;
    if (sched !== null && dayTotal > sched) scheduleOver += dayTotal - sched;
  });
  const workDays = new Set(monthDaily.map((d) => d.date)).size;

  // 年間残業累計（当年1月〜当月まで）
  let annualOvertime = 0;
  daily.forEach((d) => {
    if (!countsAsWork(d.attendance_type)) return;
    const ds = String(d.date);
    if (ds.slice(0, 4) !== String(yy)) return;
    if (ds.slice(0, 7) > ym) return; // 当月より後は除外
    const dayTotal = (Number(d.work_hours) || 0) + (parseNum(d.return_office_hours) ?? 0);
    if (dayTotal > OVERTIME_BASE_HOURS) annualOvertime += dayTotal - OVERTIME_BASE_HOURS;
  });

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
    const worked = days.reduce((s, d) => s + (Number(d.work_hours) || 0), 0);
    const sched = scheduledHours(p);
    let projOt = 0;
    let projSched = 0;
    days.forEach((d) => {
      const dayTotal = (Number(d.work_hours) || 0) + (parseNum(d.return_office_hours) ?? 0);
      if (dayTotal > OVERTIME_BASE_HOURS) projOt += dayTotal - OVERTIME_BASE_HOURS;
      if (sched !== null && dayTotal > sched) projSched += dayTotal - sched;
    });

    const min = parseNum(p.min_hours);
    const max = parseNum(p.max_hours);
    let shortage = 0;
    let excess = 0;
    let state: SettlementRow["state"] = "none";
    if (min !== null && worked < min) { shortage = min - worked; state = "short"; }
    else if (max !== null && worked > max) { excess = worked - max; state = "over"; }
    else if (min !== null || max !== null) state = "ok";

    // 現在ペースの月末見込み
    const projectComplete = monthComplete || (end !== null && end <= today);
    let projected: number | null = null;
    let pace: SettlementRow["pace"] = "none";
    if (min !== null || max !== null) {
      if (projectComplete) {
        projected = worked;
        pace = "done";
      } else if (elapsed > 0) {
        projected = worked / elapsed;
        if (max !== null && projected > max) pace = "overpace";
        else if (min !== null && projected < min) pace = "behind";
        else pace = "ontrack";
      }
    }

    rows.push({
      project_id: p.id, company: p.company, project_name: p.project_name,
      status: est, worked, min, max, shortage, excess, state,
      scheduled: sched, overtime: projOt, scheduleOver: projSched,
      projected, pace,
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
  const longDay = monthDaily.find(
    (d) => (Number(d.work_hours) || 0) + (parseNum(d.return_office_hours) ?? 0) > 13
  );
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

  return { ym, rows, totalWorked, workDays, overtime, scheduleOver, annualOvertime, monthComplete, warnings };
}
