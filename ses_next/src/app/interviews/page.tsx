import { getCurrentUser } from "@/lib/actions";
import { listInterviews, listTodos, Interview, Todo } from "@/lib/domain-actions";
import AppHeader from "@/components/AppHeader";
import InterviewsClient from "./InterviewsClient";

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const user = await getCurrentUser();
  let interviews: Interview[] = [];
  let todos: Todo[] = [];
  let err = "";
  try {
    [interviews, todos] = await Promise.all([listInterviews(), listTodos()]);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  return (
    <div>
      <AppHeader title="面談・ToDo" subtitle="選考と案件タスクの管理" email={user?.email} />
      {err ? (
        <div className="mx-4 mt-4 card text-sm" style={{ color: "#f87171" }}>読み込みエラー: {err}</div>
      ) : (
        <InterviewsClient interviews={interviews} todos={todos} />
      )}
    </div>
  );
}
