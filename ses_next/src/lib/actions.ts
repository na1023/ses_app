"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import {
  DailyReport,
  WORK_TYPES,
  LATE_EARLY_TYPES,
  calcWorkHours,
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
export async function listRecentDaily(limit = 30): Promise<DailyReport[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from("daily_reports")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyReport[];
}

/** 会社一覧（案件マスタから・自分の分のみ） */
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
  date: string;
  company: string;
  project_name: string;
  attendance_type: string;
  start_time: string;
  end_time: string;
  break_time: string;
  late_early_time: string;
  return_office_hours: string;
  work_content: string;
  remarks: string;
};

/** 日報を登録（user_id を紐づけて保存） */
export async function createDaily(
  input: DailyInput
): Promise<{ ok: boolean; message: string }> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };

  const isWork = WORK_TYPES.has(input.attendance_type);
  if (!input.date) return { ok: false, message: "日付を入力してください。" };
  if (isWork) {
    if (!input.company) return { ok: false, message: "会社名を入力してください。" };
    if (!input.work_content.trim())
      return { ok: false, message: "業務内容を入力してください。" };
  }

  const wh = isWork
    ? Math.round(
        calcWorkHours(input.start_time, input.end_time, input.break_time) * 100
      ) / 100
    : 0;
  const lateEarly =
    LATE_EARLY_TYPES.has(input.attendance_type) && input.late_early_time
      ? String(parseFloat(input.late_early_time) || 0)
      : "0";
  const returnOffice =
    isWork && input.return_office_hours
      ? String(parseFloat(input.return_office_hours) || 0)
      : "0";

  const row = {
    id: genId(),
    user_id: user.id,
    date: input.date,
    company: isWork ? input.company : input.company || "",
    project_name: isWork ? input.project_name : input.project_name || "",
    attendance_type: input.attendance_type,
    start_time: isWork ? input.start_time : "",
    end_time: isWork ? input.end_time : "",
    break_time: isWork ? input.break_time : "",
    work_hours: wh,
    late_early_time: lateEarly,
    return_office_hours: returnOffice,
    work_content: isWork ? input.work_content.trim() : "",
    remarks: input.remarks.trim(),
    created_at: new Date().toISOString().slice(0, 16).replace("T", " "),
  };

  const { error } = await sb.from("daily_reports").insert(row);
  if (error) return { ok: false, message: `保存に失敗しました: ${error.message}` };

  revalidatePath("/");
  const extra = wh > 0 ? `（実働 ${wh.toFixed(2)}h）` : "";
  return { ok: true, message: `${input.date} の日報を登録しました${extra}` };
}

/** 日報を削除 */
export async function deleteDaily(id: string): Promise<{ ok: boolean }> {
  const sb = createClient();
  const { error } = await sb.from("daily_reports").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return { ok: true };
}
