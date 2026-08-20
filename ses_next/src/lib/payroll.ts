import { WorkSession, hhmmToMin } from "./constants";

// ============================================================
// 残業代の計算（1分単位・割増賃金）
// ------------------------------------------------------------
// 用語
//   所定労働時間: 自社の定時（例 7h20m = 440分）… settings.standard_minutes
//   法定労働時間: 8時間 = 480分
//   深夜時間帯  : 22:00〜翌5:00
//
// 割増（労基法に基づく加算方式・正確な分解）
//   法定内残業（所定超〜法定内）: 時給 × 100%（法定の割増なし・実働分を支給）
//   法定外残業（法定8h超）      : 時給 × 125%（+25%）
//   深夜割増（22:00〜5:00の労働）: 時給 × +25% を上記に加算
//     → 法定外かつ深夜 = 125% + 25% = 150%
//     → 法定内かつ深夜 = 100% + 25% = 125%
//   （ユーザー指定「深夜150%」は “法定外×深夜” のケースと一致）
//
// すべて 1分単位で計算する。
// ============================================================

const LEGAL_MINUTES = 480; // 8時間
const NIGHT_START = 22 * 60; // 1320
const NIGHT_END = 5 * 60; // 300（翌日側）

/** 1セッション [start,end] が深夜帯(22:00-24:00 / 0:00-5:00)に重なる分数 */
function nightMinutesOfSession(startMin: number, endMin: number): number {
  let n = 0;
  // 0:00〜5:00
  n += Math.max(0, Math.min(endMin, NIGHT_END) - Math.max(startMin, 0));
  // 22:00〜24:00
  n += Math.max(0, Math.min(endMin, 24 * 60) - Math.max(startMin, NIGHT_START));
  return n;
}

export type DayPay = {
  actualMin: number; // 実働（分）＝ セッション合計 − 休憩
  innerOtMin: number; // 法定内残業（分）
  outerOtMin: number; // 法定外残業（分）
  nightMin: number; // 深夜労働（分）
  innerPay: number; // 法定内残業代（円）
  outerPay: number; // 法定外残業代（円）
  nightPay: number; // 深夜割増（円）
  total: number; // 残業代合計（円）
};

/**
 * その日の残業代を計算する。
 * @param sessions 出勤/退勤（複数可）
 * @param breakTime 休憩(HH:MM)
 * @param stdMinutes 所定労働時間（分/日）= 自社定時
 * @param wage 時給（円/時）
 */
export function computeDayPay(
  sessions: WorkSession[],
  breakTime: string,
  stdMinutes: number,
  wage: number
): DayPay {
  const valid = (sessions || []).filter((s) => s.start && s.end);
  let sessionMin = 0;
  let nightMin = 0;
  for (const s of valid) {
    const a = hhmmToMin(s.start);
    const b = hhmmToMin(s.end);
    if (a == null || b == null || b <= a) continue;
    sessionMin += b - a;
    nightMin += nightMinutesOfSession(a, b);
  }
  const brk = hhmmToMin(breakTime || "") ?? 0;
  const actualMin = Math.max(0, sessionMin - brk);

  // 残業分（所定超）を 法定内 / 法定外 に分解
  const outerOtMin = Math.max(0, actualMin - LEGAL_MINUTES); // 8h超
  const overStd = Math.max(0, actualMin - stdMinutes); // 所定超
  const innerOtMin = Math.max(0, overStd - outerOtMin); // 所定〜法定内

  const perMin = wage / 60; // 1分あたり時給
  const innerPay = innerOtMin * perMin * 1.0;
  const outerPay = outerOtMin * perMin * 1.25;
  const nightPay = nightMin * perMin * 0.25; // 深夜は +25% を全深夜労働に加算

  const total = innerPay + outerPay + nightPay;
  return { actualMin, innerOtMin, outerOtMin, nightMin, innerPay, outerPay, nightPay, total };
}

export type PayTotals = {
  innerOtMin: number;
  outerOtMin: number;
  nightMin: number;
  innerPay: number;
  outerPay: number;
  nightPay: number;
  total: number;
};

export function emptyTotals(): PayTotals {
  return { innerOtMin: 0, outerOtMin: 0, nightMin: 0, innerPay: 0, outerPay: 0, nightPay: 0, total: 0 };
}

export function addDayToTotals(t: PayTotals, d: DayPay): PayTotals {
  return {
    innerOtMin: t.innerOtMin + d.innerOtMin,
    outerOtMin: t.outerOtMin + d.outerOtMin,
    nightMin: t.nightMin + d.nightMin,
    innerPay: t.innerPay + d.innerPay,
    outerPay: t.outerPay + d.outerPay,
    nightPay: t.nightPay + d.nightPay,
    total: t.total + d.total,
  };
}
