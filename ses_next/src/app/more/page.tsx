import Link from "next/link";
import { getCurrentUser } from "@/lib/actions";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

const READY = [
  { href: "/salary", label: "給与管理", note: "月収・手取り" },
  { href: "/interviews", label: "面談・ToDo管理", note: "選考・タスク" },
  { href: "/leave", label: "有給休暇", note: "残日数・付与" },
  { href: "/report", label: "レポート", note: "月次集計" },
  { href: "/career", label: "職務経歴生成", note: "経歴の自動作成" },
];
const SOON: { label: string; note: string }[] = [];

export default async function MorePage() {
  const user = await getCurrentUser();
  return (
    <div>
      <AppHeader title="その他" subtitle="各種メニュー" email={user?.email} />
      <div className="px-4 pt-4">
        <ul className="space-y-2">
          {READY.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="card card-hover flex items-center justify-between">
                <span className="font-semibold">{l.label}</span>
                <span className="text-xs" style={{ color: "var(--subtle)" }}>
                  {l.note} ›
                </span>
              </Link>
            </li>
          ))}
          {SOON.map((l) => (
            <li key={l.label} className="card flex items-center justify-between opacity-60">
              <span>{l.label}</span>
              <span className="text-xs" style={{ color: "var(--subtle)" }}>
                {l.note}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
