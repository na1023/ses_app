import { getCurrentUser } from "@/lib/actions";
import { listAllDaily } from "@/lib/domain-actions";
import { DailyReport } from "@/lib/constants";
import AppHeader from "@/components/AppHeader";
import CareerClient from "./CareerClient";

export const dynamic = "force-dynamic";

export default async function CareerPage() {
  const user = await getCurrentUser();
  let daily: DailyReport[] = [];
  let err = "";
  try {
    daily = await listAllDaily();
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  const companies = Array.from(new Set(daily.map((d) => d.company).filter(Boolean))).sort();

  return (
    <div>
      <AppHeader title="職務経歴生成" subtitle="日報から経歴を自動作成" email={user?.email} />
      {err ? (
        <div className="mx-4 mt-4 card text-sm" style={{ color: "#f87171" }}>読み込みエラー: {err}</div>
      ) : (
        <CareerClient daily={daily} companies={companies} />
      )}
    </div>
  );
}
