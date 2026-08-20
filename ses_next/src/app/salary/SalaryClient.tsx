"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SalaryRecord,
  INCOME_FIELDS,
  DEDUCTION_FIELDS,
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

export default function SalaryClient({ records, predicted }: { records: SalaryRecord[]; predicted: Record<string, Predicted> }) {
  const router = useRouter();
  const [tab, setTab] = useState<"list" | "form" | "year" | "compare">("list");
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

  // 年収サマリー
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

  return (
    <div className="px-4 pt-4">
      <div className="seg mb-4">
        <button data-active={tab === "list"} onClick={() => setTab("list")}>月別一覧</button>
        <button data-active={tab === "form"} onClick={newRec}>登録</button>
        <button data-active={tab === "year"} onClick={() => setTab("year")}>年収</button>
        <button data-active={tab === "compare"} onClick={() => setTab("compare")}>予想比較</button>
      </div>

      {/* ===== 予想 vs 実際（総支給ベース） ===== */}
      {tab === "compare" ? (
        records.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--subtle)" }}>給与データがありません。</p>
        ) : (
          <ul className="space-y-3">
            {records.map((r) => {
              const p = predicted[r.year_month];
              const actual = INCOME_FIELDS.reduce((s, [k]) => s + toInt(r[k]), 0); // 実際の総支給
              const pred = p?.gross ?? 0;
              const diff = actual - pred;
              return (
                <li key={r.id} className="card">
                  <div className="mb-1 font-bold">{r.year_month}{r.salary_type === "賞与" ? "（賞与）" : ""}</div>
                  {!p?.hasWage ? (
                    <p className="text-xs" style={{ color: "var(--subtle)" }}>予想には「設定」で月額基本給・自社定時・年間所定労働日数の入力が必要です。</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div><div className="text-xs" style={{ color: "var(--subtle)" }}>予想総支給</div><div className="font-bold">{yen(pred)}</div></div>
                        <div><div className="text-xs" style={{ color: "var(--subtle)" }}>実際総支給</div><div className="font-bold">{yen(actual)}</div></div>
                        <div><div className="text-xs" style={{ color: "var(--subtle)" }}>差額</div><div className="font-bold" style={{ color: diff >= 0 ? "#10b981" : "#ef4444" }}>{diff >= 0 ? "+" : ""}{yen(diff)}</div></div>
                      </div>
                      <div className="mt-2 space-y-0.5 border-t pt-2 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                        <div className="flex justify-between"><span>基本給</span><span>{yen(p.base)}</span></div>
                        {p.allow > 0 ? <div className="flex justify-between"><span>固定手当</span><span>{yen(p.allow)}</span></div> : null}
                        <div className="flex justify-between"><span>法定内残業(100%)</span><span>{yen(p.inner)}</span></div>
                        <div className="flex justify-between"><span>法定外残業(125%)</span><span style={{ color: "#f59e0b" }}>{yen(p.outer)}</span></div>
                        <div className="flex justify-between"><span>深夜割増(+25%)</span><span style={{ color: "#6366f1" }}>{yen(p.night)}</span></div>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      {/* ===== 月別一覧 ===== */}
      {tab === "list" ? (
        records.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--subtle)" }}>
            まだ登録がありません。「登録」から追加してください。
          </p>
        ) : (
          <ul className="space-y-2">
            {records.map((r) => {
              const s = salarySummary(r);
              return (
                <li key={r.id} className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold">{r.year_month}</span>
                      {r.salary_type === "賞与" ? (
                        <span className="badge ml-2" style={{ background: "#f59e0b22", color: "#f59e0b" }}>賞与</span>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      <button className="btn-ghost" onClick={() => edit(r)}>編集</button>
                      <button className="btn-ghost" style={{ color: "var(--red)" }} onClick={() => remove(r.id)}>削除</button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs" style={{ color: "var(--subtle)" }}>総支給</div>
                      <div className="font-bold">{yen(s.incomeTotal)}</div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: "var(--subtle)" }}>控除</div>
                      <div className="font-bold">{yen(s.deductionTotal)}</div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: "var(--subtle)" }}>手取り</div>
                      <div className="font-bold" style={{ color: "var(--green)" }}>{yen(s.takeHome)}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      {/* ===== 登録・編集 ===== */}
      {tab === "form" ? (
        <div className="space-y-4">
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

          <div className="card">
            <div className="mb-2 text-sm font-bold" style={{ color: "var(--muted)" }}>支給（円）</div>
            <div className="grid grid-cols-2 gap-3">
              {INCOME_FIELDS.map(([k, label]) => (
                <div key={k}>
                  <label className="label">{label}</label>
                  <input type="number" inputMode="numeric" className="field"
                    value={(form[k] as string) ?? ""} onChange={(e) => setF(k, e.target.value)} placeholder="0" />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="mb-2 text-sm font-bold" style={{ color: "var(--muted)" }}>控除（円）</div>
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

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="metric"><div className="metric-label">総支給</div><div className="text-lg font-bold">{yen(preview.incomeTotal)}</div></div>
            <div className="metric"><div className="metric-label">控除</div><div className="text-lg font-bold">{yen(preview.deductionTotal)}</div></div>
            <div className="metric"><div className="metric-label">手取り</div><div className="text-lg font-bold" style={{ color: "var(--green)" }}>{yen(preview.takeHome)}</div></div>
          </div>
          <p className="text-xs" style={{ color: "var(--subtle)" }}>
            ※通勤手当・交通費・立替は手取りに含めません。
          </p>

          <div>
            <label className="label">メモ</label>
            <input className="field" value={(form.memo as string) ?? ""} onChange={(e) => setF("memo", e.target.value)} />
          </div>

          {msg ? (
            <div className="rounded-xl px-3 py-2 text-sm" style={msg.ok ? { background: "#052e16", color: "#4ade80" } : { background: "#2d0707", color: "#f87171" }}>{msg.text}</div>
          ) : null}

          <button className="btn-primary" disabled={busy} onClick={submit}>
            {busy ? "保存中…" : form.id ? "更新する" : "登録する"}
          </button>
        </div>
      ) : null}

      {/* ===== 年収 ===== */}
      {tab === "year" ? (
        <div className="space-y-4">
          <div>
            <label className="label">対象年</label>
            <select className="field" value={selYear} onChange={(e) => setSelYear(e.target.value)}>
              {(years.length ? years : [selYear]).map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="metric"><div className="metric-label">年間総支給</div><div className="text-lg font-bold">{yen(annual.income)}</div></div>
            <div className="metric"><div className="metric-label">年間控除</div><div className="text-lg font-bold">{yen(annual.deduction)}</div></div>
            <div className="metric"><div className="metric-label">年間手取り</div><div className="text-lg font-bold" style={{ color: "var(--green)" }}>{yen(annual.take)}</div></div>
          </div>
          <ul className="space-y-1.5">
            {yearRecs.map((r) => {
              const s = salarySummary(r);
              return (
                <li key={r.id} className="card flex items-center justify-between py-2.5">
                  <span className="text-sm">{r.year_month}{r.salary_type === "賞与" ? "（賞与）" : ""}</span>
                  <span className="text-sm font-bold" style={{ color: "var(--green)" }}>{yen(s.takeHome)}</span>
                </li>
              );
            })}
            {yearRecs.length === 0 ? <p className="text-sm" style={{ color: "var(--subtle)" }}>データなし</p> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
