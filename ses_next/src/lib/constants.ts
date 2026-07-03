export type DailyReport = {
  id: string;
  date: string;
  company: string;
  project_name: string;
  attendance_type: string;
  start_time: string;
  end_time: string;
  break_time: string;
  work_hours: number | string;
  late_early_time: string;
  return_office_hours: string;
  work_content: string;
  remarks: string;
  created_at: string;
};

export type Project = {
  id: string;
  company: string;
  project_name: string;
  status: string;
  start_date: string;
  end_date: string;
  min_hours: string;
  max_hours: string;
  standard_hours: string;
  work_start: string;
  work_end: string;
  work_break: string;
  memo: string;
};

export const PROJECT_STATUSES = ["参画前", "参画中", "終了"] as const;

// 残業（法定）の基準時間／日
export const OVERTIME_BASE_HOURS = 8;

/** 案件の定時（就業時間）を h で返す。start/end 未設定なら null */
export function scheduledHours(p: {
  work_start: string;
  work_end: string;
  work_break: string;
}): number | null {
  if (!p.work_start || !p.work_end) return null;
  return calcWorkHours(p.work_start, p.work_end, p.work_break || "00:00");
}

/** end_date が過去日なら true（"現在"/"継続中"/空 は継続とみなす） */
export function isEndPassed(endDate: string): boolean {
  const s = (endDate ?? "").trim();
  if (!s || s === "現在" || s === "継続中" || s === "継続") return false;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

/** 終了日を過ぎていれば自動的に「終了」を返す実効ステータス */
export function effectiveStatus(status: string, endDate: string): string {
  if (isEndPassed(endDate)) return "終了";
  return status || "参画中";
}

export const STATUS_COLOR: Record<string, string> = {
  参画前: "#f59e0b",
  参画中: "#10b981",
  終了: "#64748b",
};

export function parseNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = parseFloat(String(v).replace(",", ""));
  return Number.isNaN(n) ? null : n;
}

export const ATTENDANCE_OPTIONS = [
  "出社",
  "在宅",
  "出社+在宅",
  "遅刻",
  "早退",
  "遅刻+早退",
  "有給",
  "午前半休",
  "午後半休",
  "特別休暇",
  "欠勤",
  "振替休日",
  "その他",
] as const;

// 勤務系（時刻・業務内容を入力する区分）。これ以外は備考のみで登録可。
export const WORK_TYPES = new Set([
  "出社",
  "在宅",
  "出社+在宅",
  "遅刻",
  "早退",
  "遅刻+早退",
]);

export const LATE_EARLY_TYPES = new Set(["遅刻", "早退", "遅刻+早退"]);

export const ATT_COLOR: Record<string, string> = {
  出社: "#3b82f6",
  在宅: "#6366f1",
  "出社+在宅": "#8b5cf6",
  遅刻: "#fb923c",
  早退: "#fb923c",
  "遅刻+早退": "#f97316",
  有給: "#f59e0b",
  午前半休: "#fbbf24",
  午後半休: "#fbbf24",
  特別休暇: "#10b981",
  欠勤: "#ef4444",
  振替休日: "#14b8a6",
  その他: "#64748b",
};

/** HH:MM 文字列を分に変換（不正なら null） */
export function hhmmToMin(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t ?? "").trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

/** 実働時間（h）を計算 */
export function calcWorkHours(start: string, end: string, brk: string): number {
  const s = hhmmToMin(start);
  const e = hhmmToMin(end);
  const b = hhmmToMin(brk) ?? 0;
  if (s == null || e == null) return 0;
  return Math.max(0, (e - s - b) / 60);
}
