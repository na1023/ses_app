import { AppSettings } from "./settings";

// ============================================================
// 締め日ベースの集計期間
// month_end: 当月1日〜末日
// day_15   : 前月16日〜当月15日（境界は常に固定）
//           ※ 15日が土日でも「集計期間」は 16→15 のまま。
//             土日補正は「支払日/締め日ラベル」の表示にのみ適用する。
// ============================================================

/** 15日が土日なら直前の平日へ補正した日付を返す（元は変更しない） */
function shiftedClosingDay(d: Date): Date {
  const x = new Date(d);
  const w = x.getDay();
  if (w === 6) x.setDate(x.getDate() - 1); // 土→金
  else if (w === 0) x.setDate(x.getDate() - 2); // 日→金
  return x;
}

export function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type Period = { start: Date; end: Date; startStr: string; endStr: string; label: string };

/** ym（"YYYY-MM"）と設定から、その期の開始/終了日を返す */
export function periodOf(ym: string, s: AppSettings): Period {
  const [y, m] = ym.split("-").map(Number);
  if (s.closing_type === "day_15") {
    // 集計期間は「前月16日 → 当月15日」で固定（月をまたぐズレを防ぐ）
    const start = new Date(y, m - 2, 16);
    const end = new Date(y, m - 1, 15);
    const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    const shifted = shiftedClosingDay(end);
    const shiftNote = shifted.getDate() !== end.getDate() ? `（15日は${md(shifted)}に補正）` : "";
    return {
      start, end, startStr: ymdOf(start), endStr: ymdOf(end),
      label: `${md(start)}〜${md(end)}（15日締め）${shiftNote}`,
    };
  }
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { start, end, startStr: ymdOf(start), endStr: ymdOf(end), label: `${m}月（月末締め）` };
}

/** 日付文字列(YYYY-MM-DD)が期間内か */
export function inPeriod(dateStr: string, p: Period): boolean {
  return dateStr >= p.startStr && dateStr <= p.endStr;
}
