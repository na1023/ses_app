/** ページローディング。ヒーロー演出 + スケルトンリスト。 */
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

      {/* ヒーロー：色付きリング + 中央 emoji + オーロラ */}
      <div className="pl-hero">
        <div className="pl-aurora pl-aurora-a" />
        <div className="pl-aurora pl-aurora-b" />
        <div className="pl-core">
          <div className="pl-ring pl-r1" />
          <div className="pl-ring pl-r2" />
          <div className="pl-ring pl-r3" />
          <div className="pl-orbit pl-o1"><span /></div>
          <div className="pl-orbit pl-o2"><span /></div>
          <div className="pl-orbit pl-o3"><span /></div>
          <div className="pl-inner-glow" />
          <div className="pl-emoji">⚡</div>
        </div>
        <div className="pl-caption">
          <span className="pl-caption-text">読み込み中</span>
          <span className="pl-caption-dots">
            <i /><i /><i />
          </span>
        </div>
      </div>

      {/* スケルトン */}
      <div className="space-y-3 px-4 pt-1">
        <div className="card">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="mt-3 flex items-baseline gap-1">
            <div className="skeleton h-8 w-20 rounded" />
            <div className="skeleton h-4 w-6 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[0,1,2,3].map((i) => (
            <div key={i} className="metric" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="skeleton h-3 w-16 rounded" />
              <div className="mt-2 skeleton h-6 w-14 rounded" />
            </div>
          ))}
        </div>
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
      </div>

      <style>{`
        .pl-hero {
          position: relative;
          height: 200px;
          margin: 12px 16px 8px;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          border-radius: 20px;
          overflow: hidden;
          background: radial-gradient(circle at 50% 40%, rgba(59,130,246,0.16), rgba(30,41,59,0.08));
          border: 1px solid var(--border);
        }
        .pl-aurora {
          position: absolute; inset: -30%;
          border-radius: 50%;
          filter: blur(50px);
          opacity: 0.55;
          mix-blend-mode: screen;
          pointer-events: none;
        }
        .pl-aurora-a { background: radial-gradient(circle, #6366f1 0%, transparent 60%); animation: pl-drift-a 9s ease-in-out infinite; }
        .pl-aurora-b { background: radial-gradient(circle, #a855f7 0%, transparent 60%); animation: pl-drift-b 11s ease-in-out infinite; }
        @keyframes pl-drift-a {
          0%, 100% { transform: translate(-12%, -8%); }
          50% { transform: translate(15%, 15%); }
        }
        @keyframes pl-drift-b {
          0%, 100% { transform: translate(10%, 15%); }
          50% { transform: translate(-15%, -10%); }
        }
        .pl-core {
          position: relative;
          width: 128px; height: 128px;
          display: flex; align-items: center; justify-content: center;
        }
        .pl-ring {
          position: absolute; inset: 0;
          border-radius: 50%;
          border: 2px solid transparent;
        }
        .pl-r1 { inset: 0;    animation: pl-spin 1.4s linear infinite;         border-top-color: #60a5fa; border-right-color: rgba(96,165,250,0.3); }
        .pl-r2 { inset: 14px; animation: pl-spin 2.0s linear infinite reverse; border-top-color: #a78bfa; border-right-color: rgba(167,139,250,0.3); }
        .pl-r3 { inset: 28px; animation: pl-spin 2.8s linear infinite;         border-top-color: #34d399; border-right-color: rgba(52,211,153,0.3); }
        @keyframes pl-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .pl-orbit { position: absolute; inset: 0; }
        .pl-orbit > span {
          position: absolute; left: 50%; top: 0;
          transform: translate(-50%, -50%);
          width: 10px; height: 10px; border-radius: 50%;
        }
        .pl-o1 { animation: pl-spin 1.6s linear infinite; }
        .pl-o1 > span { background: radial-gradient(circle at 30% 30%, #fef08a, #f59e0b); box-shadow: 0 0 14px #f59e0b; }
        .pl-o2 { animation: pl-spin 2.4s linear infinite reverse; }
        .pl-o2 > span { background: radial-gradient(circle at 30% 30%, #a5f3fc, #06b6d4); box-shadow: 0 0 14px #06b6d4; }
        .pl-o3 { animation: pl-spin 3.0s linear infinite; }
        .pl-o3 > span { background: radial-gradient(circle at 30% 30%, #fbcfe8, #ec4899); box-shadow: 0 0 14px #ec4899; }
        .pl-inner-glow {
          position: absolute; inset: 34px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(139,92,246,0.5), transparent 65%);
          filter: blur(4px);
          animation: pl-pulse 1.4s ease-in-out infinite;
        }
        @keyframes pl-pulse {
          0%, 100% { transform: scale(0.8); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        .pl-emoji {
          position: relative; z-index: 2;
          font-size: 36px;
          filter: drop-shadow(0 0 10px rgba(139,92,246,0.6));
          animation: pl-bob 1.4s ease-in-out infinite;
        }
        @keyframes pl-bob {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.08); }
        }

        .pl-caption {
          margin-top: 14px;
          display: flex; align-items: center; gap: 6px;
          font-size: 0.82rem;
          font-weight: 700;
          background: linear-gradient(90deg, #60a5fa, #a78bfa, #ec4899, #60a5fa);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: pl-caption-flow 3s linear infinite;
          letter-spacing: 0.08em;
        }
        @keyframes pl-caption-flow {
          0%   { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }
        .pl-caption-dots {
          display: inline-flex; gap: 3px; align-items: center;
        }
        .pl-caption-dots > i {
          width: 4px; height: 4px; border-radius: 50%;
          background: #a78bfa;
          animation: pl-dot 1.2s ease-in-out infinite;
        }
        .pl-caption-dots > i:nth-child(2) { animation-delay: 0.15s; }
        .pl-caption-dots > i:nth-child(3) { animation-delay: 0.30s; }
        @keyframes pl-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.6); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
