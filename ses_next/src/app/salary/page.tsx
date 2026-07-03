import { getCurrentUser } from "@/lib/actions";
import { listSalary } from "@/lib/domain-actions";
import { SalaryRecord } from "@/lib/salary";
import AppHeader from "@/components/AppHeader";
import SalaryClient from "./SalaryClient";

export const dynamic = "force-dynamic";

export default async function SalaryPage() {
  const user = await getCurrentUser();
  let records: SalaryRecord[] = [];
  let err = "";
  try {
    records = await listSalary();
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  return (
    <div>
      <AppHeader title="給与管理" subtitle="月収・手取り・年収サマリー" email={user?.email} />
      {err ? (
        <div className="mx-4 mt-4 card text-sm" style={{ color: "#f87171" }}>
          読み込みエラー: {err}
        </div>
      ) : (
        <SalaryClient records={records} />
      )}
    </div>
  );
}
