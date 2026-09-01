export default function PageLoading({ title = "読み込み中" }: { title?: string }) {
  return (
    <div>
      <header className="app-header px-4 py-3">
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--subtle)" }}>
          <span className="dot-load" style={{ width: 6, height: 6 }} />
          データを取得しています…
        </p>
      </header>
      <div className="space-y-3 px-4 pt-4">
        {/* サマリカード */}
        <div className="card">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="mt-3 flex items-baseline gap-1">
            <div className="skeleton h-8 w-20 rounded" />
            <div className="skeleton h-4 w-6 rounded" />
          </div>
        </div>

        {/* メトリクス4つ */}
        <div className="grid grid-cols-2 gap-2">
          {[0,1,2,3].map((i) => (
            <div key={i} className="metric" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="skeleton h-3 w-16 rounded" />
              <div className="mt-2 skeleton h-6 w-14 rounded" />
            </div>
          ))}
        </div>

        {/* リスト行 */}
        <div className="space-y-2">
          {[0,1,2].map((i) => (
            <div key={i} className="card" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-center justify-between">
                <div className="skeleton h-3 w-32 rounded" />
                <div className="skeleton h-4 w-10 rounded-full" />
              </div>
              <div className="mt-2 skeleton h-3 w-full rounded" />
              <div className="mt-1.5 skeleton h-3 w-4/5 rounded" />
            </div>
          ))}
        </div>

        {/* 中央のスピナー */}
        <div className="flex flex-col items-center gap-2 py-6">
          <div className="loading-ring">
            <div /><div /><div /><div />
          </div>
          <div className="text-xs" style={{ color: "var(--subtle)" }}>読み込み中…</div>
        </div>
      </div>
    </div>
  );
}
