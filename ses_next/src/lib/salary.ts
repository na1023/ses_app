export type SalaryRecord = {
  id: string;
  year_month: string;
  salary_type: string;
  basic_salary: string;
  skill_allowance: string;
  qualification_allowance: string;
  commute_allowance: string;
  expense_reimbursement: string;
  other_expense: string;
  transport_allowance: string;
  overtime_pay: string; // 旧・一括残業代（後方互換のため残す）
  overtime_inner_pay: string; // 法定内残業(100%)
  overtime_outer_pay: string; // 法定外残業(125%)
  overtime_night_pay: string; // 深夜割増(+25%)
  health_insurance: string;
  nursing_insurance: string;
  pension: string;
  employment_insurance: string;
  income_tax: string;
  resident_tax: string;
  deduction_amount: string;
  tax_adjustment: string;
  memo: string;
  created_at: string;
};

// 表示・入力に使う支給項目（法律区分で残業を分割）
export const INCOME_FIELDS: [keyof SalaryRecord, string][] = [
  ["basic_salary", "基本給"],
  ["skill_allowance", "職能手当"],
  ["qualification_allowance", "資格手当"],
  ["commute_allowance", "通勤手当"],
  ["transport_allowance", "交通費・立替"],
  ["expense_reimbursement", "通勤交通費"],
  ["overtime_inner_pay", "法定内残業代（100%）"],
  ["overtime_outer_pay", "法定外残業代（125%）"],
  ["overtime_night_pay", "深夜残業代（+25%）"],
  ["other_expense", "その他"],
];

// 旧レコードの一括残業代（overtime_pay）は表示専用（サマリ計算に足す）
export const LEGACY_OVERTIME_FIELD: keyof SalaryRecord = "overtime_pay";

export const DEDUCTION_FIELDS: [keyof SalaryRecord, string][] = [
  ["health_insurance", "健康保険"],
  ["nursing_insurance", "介護保険"],
  ["pension", "厚生年金"],
  ["employment_insurance", "雇用保険"],
  ["income_tax", "所得税"],
  ["resident_tax", "住民税"],
  ["deduction_amount", "減額金"],
];

// 手取り計算から除外（非課税・実費）
export const NON_TAXABLE = new Set<keyof SalaryRecord>([
  "commute_allowance",
  "expense_reimbursement",
  "transport_allowance",
]);

export function toInt(v: unknown): number {
  const n = parseInt(String(v ?? "").replace(/,/g, "").trim() || "0", 10);
  return Number.isNaN(n) ? 0 : n;
}

export function salarySummary(r: Partial<SalaryRecord>) {
  const incomeTotal =
    INCOME_FIELDS.reduce((s, [k]) => s + toInt(r[k]), 0) + toInt(r[LEGACY_OVERTIME_FIELD]);
  const taxable =
    INCOME_FIELDS.reduce((s, [k]) => s + (NON_TAXABLE.has(k) ? 0 : toInt(r[k])), 0) +
    toInt(r[LEGACY_OVERTIME_FIELD]);
  const deductionTotal = DEDUCTION_FIELDS.reduce((s, [k]) => s + toInt(r[k]), 0);
  const taxAdj = toInt(r.tax_adjustment);
  const takeHome = taxable - deductionTotal + taxAdj;
  return { incomeTotal, taxable, deductionTotal, taxAdj, takeHome };
}

export function yen(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}
