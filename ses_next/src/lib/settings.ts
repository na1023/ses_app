// 自社の定時（何時〜何時＋休憩）と締め日の設定
import { hhmmToMin } from "./constants";

export type ClosingType = "month_end" | "day_15";

export type AppSettings = {
  closing_type: ClosingType;
  work_start: string; // "09:00"
  work_end: string; // "18:00"
  work_break: string; // "01:00"
  annual_work_days: number; // 内部計算用（既定240）
};

export const DEFAULT_SETTINGS: AppSettings = {
  closing_type: "month_end",
  work_start: "09:00",
  work_end: "18:00",
  work_break: "01:00",
  annual_work_days: 240,
};

/** 自社の定時（分/日）＝ 終了−開始−休憩 */
export function standardMinutesOf(s: AppSettings): number {
  const a = hhmmToMin(s.work_start);
  const b = hhmmToMin(s.work_end);
  const br = hhmmToMin(s.work_break) ?? 0;
  if (a == null || b == null || b <= a) return 480;
  return Math.max(0, b - a - br);
}

/** 月平均所定労働時間（分）＝ 定時×年間所定日数÷12 */
export function monthlyAvgStandardMinutes(s: AppSettings): number {
  return (standardMinutesOf(s) * s.annual_work_days) / 12;
}

/** 時給（円/時）＝ 基本給 ÷ 月平均所定労働時間 */
export function hourlyWageOf(s: AppSettings, baseSalary: number): number {
  const mins = monthlyAvgStandardMinutes(s);
  if (mins <= 0 || baseSalary <= 0) return 0;
  return baseSalary / (mins / 60);
}

export function minutesLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}
