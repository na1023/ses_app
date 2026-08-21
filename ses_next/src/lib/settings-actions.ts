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
  try {
    const { data } = await sb.from("user_settings").select("*").maybeSingle();
    if (!data) return { ...DEFAULT_SETTINGS };
    return {
      closing_type: (data.closing_type === "day_15" ? "day_15" : "month_end") as ClosingType,
      work_start: data.work_start || DEFAULT_SETTINGS.work_start,
      work_end: data.work_end || DEFAULT_SETTINGS.work_end,
      work_break: data.work_break || DEFAULT_SETTINGS.work_break,
      annual_work_days: num(data.annual_work_days, DEFAULT_SETTINGS.annual_work_days),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(s: Partial<AppSettings>): Promise<{ ok: boolean; message: string }> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };

  const cur = await getSettings();
  const merged = { ...cur, ...s };

  const { error } = await sb.from("user_settings").upsert({
    user_id: user.id,
    closing_type: merged.closing_type,
    work_start: merged.work_start,
    work_end: merged.work_end,
    work_break: merged.work_break,
    annual_work_days: String(Math.round(merged.annual_work_days)),
    updated_at: new Date().toISOString().slice(0, 16).replace("T", " "),
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "設定を保存しました" };
}

/** 給与管理の直近から「基本給」を自動取得 */
export async function getAutoBaseSalary(): Promise<number> {
  const sb = createClient();
  try {
    const { data } = await sb
      .from("salary_records")
      .select("basic_salary, year_month, salary_type")
      .order("year_month", { ascending: false })
      .limit(20);
    if (!data) return 0;
    // 直近の「給与」レコードの基本給
    for (const r of data as Array<{ basic_salary?: string; salary_type?: string }>) {
      if ((r.salary_type ?? "給与") !== "賞与") {
        const v = parseFloat(String(r.basic_salary ?? "0").replace(/,/g, "")) || 0;
        if (v > 0) return v;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}
