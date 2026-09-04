"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SalaryRecord,
  DEDUCTION_FIELDS,
  LEGACY_OVERTIME_FIELD,
  salarySummary,
  toInt,
  yen,
} from "@/lib/salary";
import { saveSalary, deleteSalary } from "@/lib/domain-actions";

export type Predicted = {
  base: number; allow: number; inner: number; outer: number; night: number; ot: number; gross: number; hasWage: boolean;
};

function currentYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type FormState = Partial<SalaryRecord> & { id?: string; year_month: string };

// 入力フィールドをグループ化して見やすく
const INCOME_GROUPS: { title: string; icon: string; fields: [keyof SalaryRecord, string][] }[] = [
  {
    title: "基本給・手当",
    icon: "💴",
    fields: [
      ["basic_salary", "基本給"],
      ["skill_allowance", "職能手当"],
      ["qualification_allowance", "資格手当"],
      ["other_expense", "その他手当"],
    ],
  },
  {
    title: "残業（法律区分）",
    icon: "⏰",
    fields: [
      ["overtime_inner_pay", "法定内(100%)"],
      ["overtime_outer_pay", "法定外(125%)"],
      ["overtime_night_pay", "深夜(+25%)"],
    ],
  },
  {
    title: "実費・非課税",
    icon: "🚃",
    fields: [
      ["commute_allowance", "通勤手当"],
      ["expense_reimbursement", "通勤交通費"],
      ["transport_allowance", "交通費・立替"],
    ],
  },
];

const DEDUCTION_COLORS: Record<string, string> = {
  health_insurance: "#60a5fa",
  nursing_insurance: "#a78bfa",
  pension: "#818cf8",
  employment_insurance: "#22d3ee",
  income_tax: "#f472b6",
  resident_tax: "#fb923c",
  deduction_amount: "#f87171",
};

export default function SalaryClient({ records }: { records: SalaryRecord[]; predicted?: Record<string, Predicted> }) {
  const router = useRouter();
  const [tab, setTab] = useState<"list" | "form" | "year">("list");
  const [form, setForm] = useState<FormState>({ year_month: currentYm(), salary_type: "給与" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  const preview = salarySummary(form);

  const years = useMemo(
    () => Array.from(new Set(records.map((r) => r.year_month.slice(0, 4)))).sort().reverse(),
    [records]
  );
  const [selYear, setSelYear] = useState(years[0] ?? String(new Date().getFullYear()));

  function edit(r: SalaryRecord) {
    setForm({ ...r });
    setTab("form");
    setMsg(null);
  }
  function newRec() {
    setForm({ year_month: currentYm(), salary_type: "給与" });
    setTab("form");
    setMsg(null);
  }
  function submit() {
    start(async () => {
      const res = await saveSalary(form);
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) {
        setTab("list");
        router.refresh();
      }
    });
  }
  function remove(id: string) {
    if (!confirm("削除しますか？")) return;
    start(async () => {
      await deleteSalary(id);
      router.refresh();
    });
  }

  const setF = (k: keyof SalaryRecord, v: string) => setForm({ ...form, [k]: v });

  // ---- 一覧タブ用：直近12ヶ月グラフ ----
  const monthly = useMemo(() => {
    const sorted = [...records].sort((a, b) => a.year_month.localeCompare(b.year_month));
    const last = sorted.slice(-12);
    return last.map((r) => ({
      ym: r.year_month,
      short: r.year_month.slice(5),
      isBonus: r.salary_type === "賞与",
      s: salarySummary(r),
      raw: r,
    }));
  }, [records]);
  const maxTake = Math.max(1, ...monthly.map((m) => m.s.takeHome));
  const avgTake = monthly.length ? Math.round(monthly.reduce((s, m) => s + m.s.takeHome, 0) / monthly.length) : 0;

  // ---- 年収タブ ----
  const yearRecs = records.filter((r) => r.year_month.startsWith(selYear));
  const annual = yearRecs.reduce(
    (acc, r) => {
      const s = salarySummary(r);
      acc.income += s.incomeTotal;
      acc.deduction += s.deductionTotal;
      acc.take += s.takeHome;
      return acc;
    },
    { income: 0, deduction: 0, take: 0 }
  );
  const deductionBreakdown = useMemo(() => {
    const acc: Record<string, number> = {};
    yearRecs.forEach((r) => {
      DEDUCTION_FIELDS.forEach(([k]) => {
        acc[k] = (acc[k] ?? 0) + toInt(r[k]);
      });
    });
    return DEDUCTION_FIELDS.map(([k, label]) => ({ key: k as string, label, val: acc[k] ?? 0 })).filter((x) => x.val > 0);
  }, [yearRecs]);
  const deductionTotal = deductionBreakdown.reduce((s, x) => s + x.val, 0);

  return (
    <div className="px-4 pt-4">
      <div className="seg mb-4">
        <button data-active={tab === "list"} onClick={() => setTab("list")}>📅 月別</button>
        <button data-active={tab === "form"} onClick={newRec}>✍️ 登録</button>
        <button data-active={tab === "year"} onClick={() => setTab("year")}>📊 年収</button>
      </div>

      {/* ===== 月別（グラフ + 一覧） ===== */}
      {tab === "list" ? (
        records.length === 0 ? (
          <div className="card text-center" style={{ padding: "2rem 1rem" }}>
            <div className="text-4xl mb-2">💰</div>
            <p className="text-sm" style={{ color: "var(--subtle)" }}>まだ登録がありません。</p>
            <button className="btn-primary mt-4" onClick={newRec}>＋ 最初の給与を登録</button>
          </div>
        ) : (
          <>
            {/* 手取り推移グラフ（直近12ヶ月） */}
            <div className="card mb-3">
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-sm font-bold">手取り推移（直近{monthly.length}ヶ月）</div>
                <div className="text-xs" style={{ color: "var(--subtle)" }}>平均 {yen(avgTake)}</div>
              </div>
              <div className="flex items-end gap-1.5" style={{ height: 140 }}>
                {monthly.map((m) => {
                  const h = Math.max(4, Math.round((m.s.takeHome / maxTake) * 120));
                  const c = m.isBonus ? "#f59e0b" : "#10b981";
                  return (
                    <div key={m.ym} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        title={`${m.ym} ${yen(m.s.takeHome)}`}
                        style={{
                          height: h,
                          width: "100%",
                          background: `linear-gradient(180deg, ${c}, ${c}90)`,
                          borderRadius: "6px 6px 2px 2px",
                          minHeight: 4,
                        }}
                      />
                      <span className="text-[10px]" style={{ color: "var(--subtle)" }}>{m.short}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-3 text-xs" style={{ color: "var(--subtle)" }}>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded" style={{ background: "#10b981" }} />給与</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded" style={{ background: "#f59e0b" }} />賞与</span>
              </div>
            </div>

            {/* 月別カード（新しい順） */}
            <ul className="space-y-2">
              {[...records].sort((a, b) => b.year_month.localeCompare(a.year_month)).map((r) => {
                const s = salarySummary(r);
                const rate = s.incomeTotal > 0 ? Math.round((s.takeHome / s.incomeTotal) * 100) : 0;
                return (
                  <li key={r.id} className="card" style={{ padding: "0.85rem" }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base">{r.year_month}</span>
                        {r.salary_type === "賞与" ? (
                          <span className="badge" style={{ background: "#f59e0b22", color: "#f59e0b" }}>🎁 賞与</span>
                        ) : null}
                      </div>
                      <div className="flex gap-1">
                        <button className="btn-ghost" onClick={() => edit(r)}>編集</button>
                        <button className="btn-ghost" style={{ color: "var(--red)" }} onClick={() => remove(r.id)}>削除</button>
                      </div>
                    </div>
                    {/* 手取り強調 + 支給/控除サブ */}
                    <div className="mt-2 flex items-baseline gap-3">
                      <div>
                        <div className="text-xs" style={{ color: "var(--subtle)" }}>手取り</div>
                        <div className="text-xl font-extrabold" style={{ color: "var(--green)" }}>{yen(s.takeHome)}</div>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-[11px]" style={{ color: "var(--subtle)" }}>総支給 {yen(s.incomeTotal)}</div>
                        <div className="text-[11px]" style={{ color: "var(--subtle)" }}>控除 −{yen(s.deductionTotal)}（{rate}%）</div>
                      </div>
                    </div>
                    {/* 支給 vs 控除の割合バー */}
                    <div className="mt-2 flex overflow-hidden rounded-full" style={{ height: 6, background: "var(--surface-2)" }}>
                      <div style={{ width: `${rate}%`, background: "#10b981" }} />
                      <div style={{ width: `${100 - rate}%`, background: "#f87171" }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )
      ) : null}

      {/* ===== 登録・編集 ===== */}
      {tab === "form" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">対象月</label>
              <input type="month" className="field" value={form.year_month}
                onChange={(e) => setF("year_month", e.target.value)} />
            </div>
            <div>
              <label className="label">種別</label>
              <div className="seg">
                <button data-active={form.salary_type !== "賞与"} onClick={() => setF("salary_type", "給与")}>給与</button>
                <button data-active={form.salary_type === "賞与"} onClick={() => setF("salary_type", "賞与")}>賞与</button>
              </div>
            </div>
          </div>

          {/* 手取りサマリー（追従表示） */}
          <div className="card" style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.10))",
            borderColor: "var(--green)",
          }}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[11px]" style={{ color: "var(--subtle)" }}>総支給</div>
                <div className="text-sm font-bold">{yen(preview.incomeTotal)}</div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: "var(--subtle)" }}>控除</div>
                <div className="text-sm font-bold" style={{ color: "#f87171" }}>−{yen(preview.deductionTotal)}</div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: "var(--subtle)" }}>手取り</div>
                <div className="text-base font-extrabold" style={{ color: "var(--green)" }}>{yen(preview.takeHome)}</div>
              </div>
            </div>
          </div>

          {/* 支給グループ */}
          {INCOME_GROUPS.map((g) => (
            <div key={g.title} className="card">
              <div className="mb-2 text-sm font-bold">{g.icon} {g.title}</div>
              <div className="grid grid-cols-2 gap-3">
                {g.fields.map(([k, label]) => (
                  <div key={k}>
                    <label className="label">{label}</label>
                    <input type="number" inputMode="numeric" className="field"
                      value={(form[k] as string) ?? ""} onChange={(e) => setF(k, e.target.value)} placeholder="0" />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* 旧レコードの一括残業代フィールド（値がある場合のみ表示） */}
          {toInt(form[LEGACY_OVERTIME_FIELD]) > 0 ? (
            <div className="card" style={{ borderColor: "#fbbf24" }}>
              <div className="mb-2 text-sm font-bold" style={{ color: "#fbbf24" }}>⚠️ 旧・一括残業代（互換）</div>
              <input type="number" inputMode="numeric" className="field"
                value={(form[LEGACY_OVERTIME_FIELD] as string) ?? ""}
                onChange={(e) => setF(LEGACY_OVERTIME_FIELD, e.target.value)} />
              <p className="mt-1 text-[11px]" style={{ color: "var(--subtle)" }}>
                法定内/外/深夜に振り分け直すか、0にしてください。
              </p>
            </div>
          ) : null}

          {/* 控除グループ */}
          <div className="card">
            <div className="mb-2 text-sm font-bold">📉 控除</div>
            <div className="grid grid-cols-2 gap-3">
              {DEDUCTION_FIELDS.map(([k, label]) => (
                <div key={k}>
                  <label className="label">{label}</label>
                  <input type="number" inputMode="numeric" className="field"
                    value={(form[k] as string) ?? ""} onChange={(e) => setF(k, e.target.value)} placeholder="0" />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="label">過不足税額（還付+ / 追徴−）</label>
              <input type="number" inputMode="numeric" className="field"
                value={(form.tax_adjustment as string) ?? ""} onChange={(e) => setF("tax_adjustment", e.target.value)} placeholder="0" />
            </div>
          </div>

          <div>
            <label className="label">メモ</label>
            <input className="field" value={(form.memo as string) ?? ""} onChange={(e) => setF("memo", e.target.value)} />
          </div>

          <p className="text-xs" style={{ color: "var(--subtle)" }}>
            ※通勤手当・交通費・立替は手取りに含めません。
          </p>

          {msg ? (
            <div className="rounded-xl px-3 py-2 text-sm" style={msg.ok ? { background: "#052e16", color: "#4ade80" } : { background: "#2d0707", color: "#f87171" }}>{msg.text}</div>
          ) : null}

          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setTab("list")}>キャンセル</button>
            <button className="btn-primary flex-[2]" disabled={busy} onClick={submit}>
              {busy ? "保存中…" : form.id ? "更新する" : "登録する"}
            </button>
          </div>
        </div>
      ) : null}

      {/* ===== 年収 ===== */}
      {tab === "year" ? (
        <div className="space-y-3">
          <div>
            <label className="label">対象年</label>
            <select className="field" value={selYear} onChange={(e) => setSelYear(e.target.value)}>
              {(years.length ? years : [selYear]).map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          </div>

          {/* サマリーカード */}
          <div className="card" style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.14), rgba(99,102,241,0.10))",
            borderColor: "var(--accent)",
          }}>
            <div className="text-xs" style={{ color: "var(--subtle)" }}>{selYear}年の年間手取り</div>
            <div className="text-3xl font-extrabold" style={{ color: "var(--green)" }}>{yen(annual.take)}</div>
            <div className="mt-1 text-xs" style={{ color: "var(--subtle)" }}>
              総支給 {yen(annual.income)} ／ 控除 −{yen(annual.deduction)}
            </div>
          </div>

          {/* 控除内訳（横積みバー） */}
          {deductionBreakdown.length > 0 ? (
            <div className="card">
              <div className="mb-2 text-sm font-bold">控除の内訳</div>
              <div className="flex overflow-hidden rounded-full" style={{ height: 14 }}>
                {deductionBreakdown.map((d) => (
                  <div
                    key={d.key}
                    title={`${d.label} ${yen(d.val)}`}
                    style={{
                      width: `${(d.val / deductionTotal) * 100}%`,
                      background: DEDUCTION_COLORS[d.key] ?? "#94a3b8",
                    }}
                  />
                ))}
              </div>
              <ul className="mt-3 space-y-1.5 text-xs">
                {deductionBreakdown.map((d) => (
                  <li key={d.key} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: DEDUCTION_COLORS[d.key] ?? "#94a3b8" }} />
                      {d.label}
                    </span>
                    <span className="font-semibold">{yen(d.val)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* 月別リスト */}
          <div>
            <div className="mb-2 text-sm font-bold">月別</div>
            <ul className="space-y-1.5">
              {[...yearRecs].sort((a, b) => a.year_month.localeCompare(b.year_month)).map((r) => {
                const s = salarySummary(r);
                return (
                  <li key={r.id} className="card flex items-center justify-between" style={{ padding: "0.7rem 0.9rem" }}>
                    <span className="text-sm">
                      {r.year_month}
                      {r.salary_type === "賞与" ? <span className="ml-1.5 text-xs" style={{ color: "#f59e0b" }}>🎁</span> : null}
                    </span>
                    <span className="text-sm font-bold" style={{ color: "var(--green)" }}>{yen(s.takeHome)}</span>
                  </li>
                );
              })}
              {yearRecs.length === 0 ? <p className="text-sm" style={{ color: "var(--subtle)" }}>データなし</p> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
