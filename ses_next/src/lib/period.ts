import { AppSettings } from "./settings";

// ============================================================
// 締め日ベースの集計期間
// month_end: 当月1日〜末日
// day_15   : 前月16日〜当月15日（15日が土日なら直前の平日に補正）
// ============================================================

/** 15日が土日なら直前の平日へ補正 */
function adjustClosing(d: Date): Date {
  const w = d.getDay();
  if (w === 6) d.setDate(d.getDate() - 1); // 土→金
  else if (w === 0) d.setDate(d.getDate() - 2); // 日→金
  return d;
}

export function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type Period = { start: Date; end: Date; startStr: string; endStr: string; label: string };

/** ym（"YYYY-MM"）と設定から、その期の開始/終了日を返す */
export function periodOf(ym: string, s: AppSettings): Period {
  const [y, m] = ym.split("-").map(Number);
  if (s.closing_type === "day_15") {
    const end = adjustClosing(new Date(y, m - 1, 15));
    const prevEnd = adjustClosing(new Date(y, m - 2, 15));
    const start = new Date(prevEnd);
    start.setDate(start.getDate() + 1);
    const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    return { start, end, startStr: ymdOf(start), endStr: ymdOf(end), label: `${md(start)}〜${md(end)}（15日締め）` };
  }
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { start, end, startStr: ymdOf(start), endStr: ymdOf(end), label: `${m}月（月末締め）` };
}

/** 日付文字列(YYYY-MM-DD)が期間内か */
export function inPeriod(dateStr: string, p: Period): boolean {
  return dateStr >= p.startStr && dateStr <= p.endStr;
}
