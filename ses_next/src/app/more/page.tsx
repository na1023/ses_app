const LINKS = [
  { label: "面談・ToDo", note: "Phase 2" },
  { label: "有給・残業管理", note: "Phase 3" },
  { label: "レポート", note: "Phase 3" },
  { label: "職務経歴生成", note: "Phase 4" },
  { label: "設定・データ管理", note: "Phase 4" },
];

export default function MorePage() {
  return (
    <div className="px-4 pt-5">
      <h1 className="text-xl font-bold">その他</h1>
      <ul className="mt-4 space-y-2">
        {LINKS.map((l) => (
          <li key={l.label} className="card flex items-center justify-between">
            <span>{l.label}</span>
            <span className="text-xs" style={{ color: "var(--subtle)" }}>
              {l.note}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
