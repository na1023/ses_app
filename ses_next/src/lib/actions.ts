"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import {
  DailyReport,
  WorkSession,
  WORK_TYPES,
  LATE_EARLY_TYPES,
  sessionsHours,
  countsAsWork,
  hhmmToMin,
} from "./constants";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 現在のログインユーザー（未ログインなら null） */
export async function getCurrentUser() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user ? { id: user.id, email: user.email ?? "" } : null;
}

/** サインアウト */
export async function signOut() {
  const sb = createClient();
  await sb.auth.signOut();
  revalidatePath("/", "layout");
}

/** 直近の日報を取得（RLS により自分の分のみ） */
export async function listRecentDaily(limit = 60): Promise<DailyReport[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from("daily_reports")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyReport[];
}

export async function listCompanies(): Promise<string[]> {
  const sb = createClient();
  const { data } = await sb.from("projects").select("company");
  const set = new Set<string>();
  (data ?? []).forEach((r: { company?: string }) => {
    if (r.company && r.company.trim()) set.add(r.company.trim());
  });
  return Array.from(set).sort();
}

export type DailyInput = {
  id?: string;
  date: string;
  company: string;
  project_name: string;
  attendance_type: string;
  sessions: WorkSession[]; // 出勤・退勤（複数可）
  break_time: string; // 休憩(HH:MM)
  late_early_time: string;
  return_office_hours: string;
  work_content: string;
  remarks: string;
};

function buildRow(input: DailyInput, userId: string) {
  const needsTime = countsAsWork(input.attendance_type);
  const validSessions = (input.sessions || []).filter((s) => s.start && s.end);
  const breakH = (hhmmToMin(input.break_time || "") ?? 0) / 60;
  const wh = needsTime
    ? Math.max(0, Math.round((sessionsHours(validSessions) - breakH) * 100) / 100)
    : 0;
  const lateEarly =
    LATE_EARLY_TYPES.has(input.attendance_type) && input.late_early_time
      ? String(parseFloat(input.late_early_time) || 0)
      : "0";
  const returnOffice =
    needsTime && input.return_office_hours
      ? String(parseFloat(input.return_office_hours) || 0)
      : "0";
  const first = validSessions[0];
  const last = validSessions[validSessions.length - 1];
  return {
    user_id: userId,
    date: input.date,
    company: input.company || "",
    project_name: input.project_name || "",
    attendance_type: input.attendance_type,
    start_time: needsTime && first ? first.start : "",
    end_time: needsTime && last ? last.end : "",
    break_time: needsTime ? input.break_time || "" : "",
    work_hours: wh,
    late_early_time: lateEarly,
    return_office_hours: returnOffice,
    work_sessions: needsTime ? JSON.stringify(validSessions) : "",
    work_content: needsTime ? input.work_content.trim() : "",
    remarks: input.remarks.trim(),
    _wh: wh,
  };
}

function validate(input: DailyInput): string | null {
  if (!input.date) return "日付を入力してください。";
  if (WORK_TYPES.has(input.attendance_type)) {
    if (!input.company) return "会社名を選択してください。";
    const valid = (input.sessions || []).filter((s) => s.start && s.end);
    if (valid.length === 0) return "出勤・退勤の時刻を入力してください。";
    if (sessionsHours(valid) <= 0) return "退勤は出勤より後の時刻にしてください。";
    if (!input.work_content.trim()) return "業務内容を入力してください。";
  }
  return null;
}

/** 日報を登録 */
export async function createDaily(
  input: DailyInput
): Promise<{ ok: boolean; message: string; row?: DailyReport }> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };

  const err = validate(input);
  if (err) return { ok: false, message: err };

  const { _wh, ...row } = buildRow(input, user.id);
  const { data, error } = await sb
    .from("daily_reports")
    .insert({ id: genId(), created_at: new Date().toISOString().slice(0, 16).replace("T", " "), ...row })
    .select()
    .single();
  if (error) return { ok: false, message: `保存に失敗しました: ${error.message}` };

  revalidatePath("/");
  const extra = _wh > 0 ? `（実働 ${_wh.toFixed(2)}h）` : "";
  return { ok: true, message: `${input.date} の日報を登録しました${extra}`, row: data as DailyReport };
}

/** 日報を更新 */
export async function updateDaily(
  id: string,
  input: DailyInput
): Promise<{ ok: boolean; message: string; row?: DailyReport }> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };

  const err = validate(input);
  if (err) return { ok: false, message: err };

  const { _wh: _u, ...row } = buildRow(input, user.id);
  void _u;
  const { data, error } = await sb
    .from("daily_reports")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, message: `更新に失敗しました: ${error.message}` };

  revalidatePath("/");
  return { ok: true, message: "日報を更新しました", row: data as DailyReport };
}

/** 日報を削除 */
export async function deleteDaily(id: string): Promise<{ ok: boolean }> {
  const sb = createClient();
  const { error } = await sb.from("daily_reports").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return { ok: true };
}
