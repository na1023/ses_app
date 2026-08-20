"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { AppSettings, DEFAULT_SETTINGS, ClosingType } from "./settings";

function num(v: unknown, d: number): number {
  const n = parseFloat(String(v ?? "").replace(/,/g, "").trim());
  return Number.isNaN(n) ? d : n;
}

/** ユーザー設定を取得（未設定なら既定値） */
export async function getSettings(): Promise<AppSettings> {
  const sb = createClient();
  const { data } = await sb.from("user_settings").select("*").maybeSingle();
  if (!data) return { ...DEFAULT_SETTINGS };
  return {
    closing_type: (data.closing_type === "day_15" ? "day_15" : "month_end") as ClosingType,
    standard_minutes: num(data.standard_minutes, DEFAULT_SETTINGS.standard_minutes),
    annual_work_days: num(data.annual_work_days, DEFAULT_SETTINGS.annual_work_days),
    base_salary: num(data.base_salary, 0),
    fixed_allowance: num(data.fixed_allowance, 0),
  };
}

export async function saveSettings(s: AppSettings): Promise<{ ok: boolean; message: string }> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };

  const { error } = await sb.from("user_settings").upsert({
    user_id: user.id,
    closing_type: s.closing_type,
    standard_minutes: String(Math.round(s.standard_minutes)),
    annual_work_days: String(Math.round(s.annual_work_days)),
    base_salary: String(Math.round(s.base_salary)),
    fixed_allowance: String(Math.round(s.fixed_allowance)),
    updated_at: new Date().toISOString().slice(0, 16).replace("T", " "),
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "設定を保存しました" };
}
