import { getCurrentUser } from "@/lib/actions";
import { listSalary, listAllDaily } from "@/lib/domain-actions";
import { getSettings } from "@/lib/settings-actions";
import { hourlyWage } from "@/lib/settings";
import { periodOf, inPeriod } from "@/lib/period";
import { computeDayPay, emptyTotals, addDayToTotals } from "@/lib/payroll";
import { countsAsWork, parseSessions } from "@/lib/constants";
import { SalaryRecord } from "@/lib/salary";
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
    const wage = hourlyWage(settings);
    // 給与レコードのある月ごとに、予想給与（総支給）を算出
    const months = Array.from(new Set(recs.map((r) => r.year_month)));
    months.forEach((ym) => {
      const p = periodOf(ym, settings);
      let t = emptyTotals();
      daily.forEach((d) => {
        if (inPeriod(String(d.date), p) && countsAsWork(d.attendance_type)) {
          const sess = parseSessions(d.work_sessions);
          if (sess.length && wage > 0) t = addDayToTotals(t, computeDayPay(sess, d.break_time || "", settings.standard_minutes, wage));
        }
      });
      predicted[ym] = {
        base: settings.base_salary,
        allow: settings.fixed_allowance,
        inner: Math.round(t.innerPay),
        outer: Math.round(t.outerPay),
        night: Math.round(t.nightPay),
        ot: Math.round(t.total),
        gross: Math.round(settings.base_salary + settings.fixed_allowance + t.total),
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
