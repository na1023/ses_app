export default function PageLoading({ title = "読み込み中" }: { title?: string }) {
  return (
    <div>
      <header className="app-header px-4 py-3">
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="text-xs" style={{ color: "var(--subtle)" }}>データを取得しています…</p>
      </header>
      <div className="space-y-3 px-4 pt-4">
        <div className="card" style={{ height: 72 }}>
          <div className="skeleton h-4 w-32 rounded" />
          <div className="mt-3 skeleton h-8 w-24 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="metric skeleton" style={{ height: 84 }} />
          <div className="metric skeleton" style={{ height: 84 }} />
        </div>
        <div className="card" style={{ height: 120 }}>
          <div className="skeleton h-3 w-20 rounded" />
          <div className="mt-3 skeleton h-3 w-full rounded" />
          <div className="mt-2 skeleton h-3 w-4/5 rounded" />
          <div className="mt-2 skeleton h-3 w-2/3 rounded" />
        </div>
        <div className="flex items-center justify-center py-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
        </div>
      </div>
    </div>
  );
}
