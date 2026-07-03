"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { SalaryRecord } from "./salary";
import { DailyReport } from "./constants";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function sbUser() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return { sb, user };
}

// ============================================================
// 給与
// ============================================================
export async function listSalary(): Promise<SalaryRecord[]> {
  const { sb } = await sbUser();
  const { data, error } = await sb
    .from("salary_records")
    .select("*")
    .order("year_month", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SalaryRecord[];
}

export async function saveSalary(
  rec: Partial<SalaryRecord> & { id?: string }
): Promise<{ ok: boolean; message: string }> {
  const { sb, user } = await sbUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };
  if (!rec.year_month) return { ok: false, message: "対象月を選択してください。" };
  const row = { ...rec, user_id: user.id };
  delete (row as { id?: string }).id;
  if (rec.id) {
    const { error } = await sb.from("salary_records").update(row).eq("id", rec.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await sb
      .from("salary_records")
      .insert({ id: genId(), created_at: new Date().toISOString().slice(0, 16).replace("T", " "), ...row });
    if (error) return { ok: false, message: error.message };
  }
  revalidatePath("/salary");
  return { ok: true, message: rec.id ? "更新しました" : "登録しました" };
}

export async function deleteSalary(id: string) {
  const { sb } = await sbUser();
  await sb.from("salary_records").delete().eq("id", id);
  revalidatePath("/salary");
  return { ok: true };
}

// ============================================================
// 面談
// ============================================================
export type Interview = {
  id: string;
  company: string;
  project_name: string;
  work_content: string;
  attendance_content: string;
  status: string;
  interview_date: string;
  memo: string;
};

export async function listInterviews(): Promise<Interview[]> {
  const { sb } = await sbUser();
  const { data, error } = await sb
    .from("interviews")
    .select("*")
    .order("interview_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Interview[];
}

export async function saveInterview(rec: Partial<Interview> & { id?: string }) {
  const { sb, user } = await sbUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };
  if (!rec.company?.trim()) return { ok: false, message: "会社名を入力してください。" };
  const row = { ...rec, user_id: user.id };
  delete (row as { id?: string }).id;
  if (rec.id) {
    const { error } = await sb.from("interviews").update(row).eq("id", rec.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await sb.from("interviews").insert({ id: genId(), ...row });
    if (error) return { ok: false, message: error.message };
  }
  revalidatePath("/interviews");
  return { ok: true, message: rec.id ? "更新しました" : "登録しました" };
}

export async function deleteInterview(id: string) {
  const { sb } = await sbUser();
  await sb.from("interviews").delete().eq("id", id);
  revalidatePath("/interviews");
  return { ok: true };
}

// ============================================================
// ToDo
// ============================================================
export type Todo = {
  id: string;
  company: string;
  project_name: string;
  task: string;
  due_date: string;
  progress: string;
  created_at: string;
};

export async function listTodos(): Promise<Todo[]> {
  const { sb } = await sbUser();
  const { data, error } = await sb
    .from("todos")
    .select("*")
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Todo[];
}

export async function saveTodo(rec: Partial<Todo> & { id?: string }) {
  const { sb, user } = await sbUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };
  if (!rec.task?.trim()) return { ok: false, message: "タスク内容を入力してください。" };
  const row = { ...rec, user_id: user.id };
  delete (row as { id?: string }).id;
  if (rec.id) {
    const { error } = await sb.from("todos").update(row).eq("id", rec.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await sb
      .from("todos")
      .insert({ id: genId(), created_at: new Date().toISOString().slice(0, 16).replace("T", " "), ...row });
    if (error) return { ok: false, message: error.message };
  }
  revalidatePath("/interviews");
  return { ok: true, message: rec.id ? "更新しました" : "登録しました" };
}

export async function setTodoProgress(id: string, progress: string) {
  const { sb } = await sbUser();
  await sb.from("todos").update({ progress }).eq("id", id);
  revalidatePath("/interviews");
  return { ok: true };
}

export async function deleteTodo(id: string) {
  const { sb } = await sbUser();
  await sb.from("todos").delete().eq("id", id);
  revalidatePath("/interviews");
  return { ok: true };
}

// ============================================================
// 有給付与
// ============================================================
export type LeaveGrant = {
  id: string;
  grant_date: string;
  days: string;
  memo: string;
  created_at: string;
};

export async function listGrants(): Promise<LeaveGrant[]> {
  const { sb } = await sbUser();
  const { data, error } = await sb
    .from("leave_grants")
    .select("*")
    .order("grant_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaveGrant[];
}

export async function saveGrant(rec: { grant_date: string; days: string; memo: string }) {
  const { sb, user } = await sbUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };
  if (!rec.grant_date) return { ok: false, message: "付与日を入力してください。" };
  const { error } = await sb.from("leave_grants").insert({
    id: genId(),
    grant_date: rec.grant_date,
    days: rec.days,
    memo: rec.memo,
    user_id: user.id,
    created_at: new Date().toISOString().slice(0, 16).replace("T", " "),
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/leave");
  return { ok: true, message: "付与を登録しました" };
}

export async function deleteGrant(id: string) {
  const { sb } = await sbUser();
  await sb.from("leave_grants").delete().eq("id", id);
  revalidatePath("/leave");
  return { ok: true };
}

// ============================================================
// 全日報（有給消化・レポート・職務経歴で使用）
// ============================================================
export async function listAllDaily(): Promise<DailyReport[]> {
  const { sb } = await sbUser();
  const { data, error } = await sb
    .from("daily_reports")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyReport[];
}
