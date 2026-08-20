import { getCurrentUser } from "@/lib/actions";
import { listInterviews, Interview } from "@/lib/domain-actions";
import AppHeader from "@/components/AppHeader";
import InterviewsClient from "./InterviewsClient";

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const user = await getCurrentUser();
  let interviews: Interview[] = [];
  let err = "";
  try {
    interviews = await listInterviews();
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  return (
    <div>
      <AppHeader title="面談管理" subtitle="選考の記録・進捗" email={user?.email} />
      {err ? (
        <div className="mx-4 mt-4 card text-sm" style={{ color: "#f87171" }}>読み込みエラー: {err}</div>
      ) : (
        <InterviewsClient interviews={interviews} />
      )}
    </div>
  );
}
