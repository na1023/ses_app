import { getCurrentUser } from "@/lib/actions";
import { listSalary, listAllDaily } from "@/lib/domain-actions";
import { getSettings } from "@/lib/settings-actions";
import { hourlyWageOf, standardMinutesOf } from "@/lib/settings";
import { periodOf, inPeriod } from "@/lib/period";
import { computeDayPay, emptyTotals, addDayToTotals } from "@/lib/payroll";
import { countsAsWork, parseSessions } from "@/lib/constants";
import { SalaryRecord, toInt } from "@/lib/salary";
import AppHeader from "@/components/AppHeader";
import SalaryClient, { Predicted } from "./SalaryClient";

export const dynamic = "force-dynamic";

export default async function SalaryPage() {
  const user = await getCurrentUser();
  let records: SalaryRecord[] = [];
  const predicted: Record<string, Predicted> = {};
  let err = "";
  try {
    const [recs, settings, daily] = await Promise.all([listSalary(), getSettings(), listAllDaily()]);
    records = recs;
    const stdMin = standardMinutesOf(settings);
    // 月ごとに、その月の基本給を使って予想総支給を算出
    const months = Array.from(new Set(recs.map((r) => r.year_month)));
    months.forEach((ym) => {
      const rec = recs.find((r) => r.year_month === ym && (r.salary_type ?? "給与") !== "賞与");
      const base = toInt(rec?.basic_salary ?? 0);
      const wage = hourlyWageOf(settings, base);
      const p = periodOf(ym, settings);
      let t = emptyTotals();
      daily.forEach((d) => {
        if (inPeriod(String(d.date), p) && countsAsWork(d.attendance_type)) {
          const sess = parseSessions(d.work_sessions);
          if (sess.length && wage > 0) t = addDayToTotals(t, computeDayPay(sess, d.break_time || "", stdMin, wage));
        }
      });
      predicted[ym] = {
        base,
        allow: 0,
        inner: Math.round(t.innerPay),
        outer: Math.round(t.outerPay),
        night: Math.round(t.nightPay),
        ot: Math.round(t.total),
        gross: Math.round(base + t.total),
        hasWage: wage > 0,
      };
    });
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  return (
    <div>
      <AppHeader title="給与管理" subtitle="月収・手取り・予想比較" email={user?.email} />
      {err ? (
        <div className="mx-4 mt-4 card text-sm" style={{ color: "#f87171" }}>
          読み込みエラー: {err}
        </div>
      ) : (
        <SalaryClient records={records} predicted={predicted} />
      )}
    </div>
  );
}
