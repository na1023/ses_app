import { getCurrentUser } from "@/lib/actions";
import { listProjects } from "@/lib/projects-actions";
import { Project } from "@/lib/constants";
import AppHeader from "@/components/AppHeader";
import ProjectsClient from "./ProjectsClient";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  let projects: Project[] = [];
  let loadError = "";
  try {
    projects = await listProjects();
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      <AppHeader title="案件管理" subtitle="参画案件と精算幅を管理" email={user?.email} />
      {loadError ? (
        <div className="mx-4 mt-4 card text-sm" style={{ color: "#f87171" }}>
          読み込みエラー: {loadError}
        </div>
      ) : (
        <ProjectsClient projects={projects} />
      )}
    </div>
  );
}
