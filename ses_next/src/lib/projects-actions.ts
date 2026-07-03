"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import {
  Project,
  DailyReport,
  WORK_TYPES,
  parseNum,
  effectiveStatus,
  DEFAULT_STANDARD_HOURS,
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
  worked: number; // 当月の実働合計
  min: number | null;
  max: number | null;
  shortage: number; // 下限に対する不足（0以上）
  excess: number; // 上限に対する超過（0以上）
  state: "ok" | "short" | "over" | "none"; // 判定
};

export type SettlementResult = {
  ym: string;
  rows: SettlementRow[];
  totalWorked: number; // 当月の総勤務時間（現場＋帰社・全案件）
  workDays: number;
  overtime: number; // 当月の残業時間合計（日ごと 定時超過分）
};

export async function getSettlement(ym: string): Promise<SettlementResult> {
  const sb = createClient();
  const [{ data: projData }, { data: dailyData }] = await Promise.all([
    sb.from("projects").select("*"),
    sb.from("daily_reports").select("*"),
  ]);
  const projects = (projData ?? []) as Project[];
  const daily = (dailyData ?? []) as DailyReport[];

  const monthDaily = daily.filter(
    (d) => String(d.date).startsWith(ym) && WORK_TYPES.has(d.attendance_type)
  );

  // 案件ごとの定時（就業時間）マップ
  const stdByProject = new Map<string, number>();
  projects.forEach((p) => {
    const std = parseNum(p.standard_hours);
    stdByProject.set(
      `${p.company}||${p.project_name}`,
      std ?? DEFAULT_STANDARD_HOURS
    );
  });

  // 総勤務時間 = 現場稼働 + 帰社時間。残業 = 日ごと (現場+帰社) が定時超過した分。
  let totalWorked = 0;
  let overtime = 0;
  monthDaily.forEach((d) => {
    const site = Number(d.work_hours) || 0;
    const office = parseNum(d.return_office_hours) ?? 0;
    const dayTotal = site + office;
    totalWorked += dayTotal;
    const std =
      stdByProject.get(`${d.company}||${d.project_name}`) ??
      DEFAULT_STANDARD_HOURS;
    if (dayTotal > std) overtime += dayTotal - std;
  });
  const workDays = new Set(monthDaily.map((d) => d.date)).size;

  const rows: SettlementRow[] = projects.map((p) => {
    // 現場の精算には帰社時間は含めない（現場稼働 work_hours のみ）
    const worked = monthDaily
      .filter((d) => d.company === p.company && d.project_name === p.project_name)
      .reduce((s, d) => s + (Number(d.work_hours) || 0), 0);
    const min = parseNum(p.min_hours);
    const max = parseNum(p.max_hours);
    let shortage = 0;
    let excess = 0;
    let state: SettlementRow["state"] = "none";
    if (min !== null && worked < min) {
      shortage = min - worked;
      state = "short";
    } else if (max !== null && worked > max) {
      excess = worked - max;
      state = "over";
    } else if (min !== null || max !== null) {
      state = "ok";
    }
    return {
      project_id: p.id,
      company: p.company,
      project_name: p.project_name,
      status: effectiveStatus(p.status, p.end_date),
      worked,
      min,
      max,
      shortage,
      excess,
      state,
    };
  });

  // 稼働のある案件・精算幅が設定された案件を優先表示
  rows.sort((a, b) => {
    const aw = a.worked > 0 || a.min !== null || a.max !== null ? 0 : 1;
    const bw = b.worked > 0 || b.min !== null || b.max !== null ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return b.worked - a.worked;
  });

  return { ym, rows, totalWorked, workDays, overtime };
}
