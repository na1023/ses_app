// ============================================================
// アプリ設定（自社の定時・締め日・時給の基礎）
// ============================================================
export type ClosingType = "month_end" | "day_15";

export type AppSettings = {
  closing_type: ClosingType;
  standard_minutes: number; // 自社の定時（分/日）例: 7h20m = 440
  annual_work_days: number; // 年間所定労働日数（月平均所定の算出用）
  base_salary: number; // 月額基本給（時給算出の基礎賃金）
  fixed_allowance: number; // 予想給与に加える固定手当
};

export const DEFAULT_SETTINGS: AppSettings = {
  closing_type: "month_end",
  standard_minutes: 480,
  annual_work_days: 240,
  base_salary: 0,
  fixed_allowance: 0,
};

/** 月平均所定労働時間（分）＝ 自社定時(分/日) × 年間所定労働日数 ÷ 12 */
export function monthlyAvgStandardMinutes(s: AppSettings): number {
  return (s.standard_minutes * s.annual_work_days) / 12;
}

/**
 * 時給（円/時）＝ 月額基本給 ÷ 月平均所定労働時間
 * （労基法の割増賃金の基礎。月平均所定労働時間で正確に算出）
 */
export function hourlyWage(s: AppSettings): number {
  const mins = monthlyAvgStandardMinutes(s);
  if (mins <= 0) return 0;
  return s.base_salary / (mins / 60);
}

/** 分→「7時間20分」表記 */
export function minutesLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}
