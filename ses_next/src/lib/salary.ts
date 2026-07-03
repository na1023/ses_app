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
  overtime_pay: string;
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

export const INCOME_FIELDS: [keyof SalaryRecord, string][] = [
  ["basic_salary", "基本給"],
  ["skill_allowance", "職能手当"],
  ["qualification_allowance", "資格手当"],
  ["commute_allowance", "通勤手当"],
  ["transport_allowance", "交通費・立替"],
  ["expense_reimbursement", "通勤交通費"],
  ["overtime_pay", "残業代"],
  ["other_expense", "その他"],
];

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
  const incomeTotal = INCOME_FIELDS.reduce((s, [k]) => s + toInt(r[k]), 0);
  const taxable = INCOME_FIELDS.reduce(
    (s, [k]) => s + (NON_TAXABLE.has(k) ? 0 : toInt(r[k])),
    0
  );
  const deductionTotal = DEDUCTION_FIELDS.reduce((s, [k]) => s + toInt(r[k]), 0);
  const taxAdj = toInt(r.tax_adjustment);
  const takeHome = taxable - deductionTotal + taxAdj;
  return { incomeTotal, taxable, deductionTotal, taxAdj, takeHome };
}

export function yen(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}
