"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** アカウントメニュー内で使う「全更新」ボタン。押すと躍動感のあるオーバーレイを出し、
 *  Service Worker のキャッシュを更新→ router.refresh → 最後にハードリロード。 */
export default function FullRefresh({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");

  useEffect(() => {
    if (!busy) return;
    const phases = ["キャッシュを更新中", "データを取得中", "画面を再構築中", "仕上げ中"];
    let i = 0;
    setPhase(phases[0]);
    const t = setInterval(() => {
      i = (i + 1) % phases.length;
      setPhase(phases[i]);
    }, 700);
    let p = 0;
    const pt = setInterval(() => {
      p = Math.min(95, p + Math.random() * 12 + 4);
      setProgress(p);
    }, 220);
    return () => { clearInterval(t); clearInterval(pt); };
  }, [busy]);

  async function full() {
    setBusy(true);
    setProgress(0);
    onDone?.();
    try {
      // SW キャッシュ更新
      if ("serviceWorker" in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.update()));
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
        } catch { /* ignore */ }
      }
      // Server component の再取得
      router.refresh();
      // 少なくとも 1.4s は演出を見せる
      await new Promise((r) => setTimeout(r, 1400));
    } finally {
      setProgress(100);
      // 完了演出を少し
      await new Promise((r) => setTimeout(r, 300));
      // 確実に反映させるためハードリロード
      window.location.reload();
    }
  }

  return (
    <>
      <button className="btn-ghost w-full" onClick={full} disabled={busy}>
        🔄 全更新（キャッシュ再取得）
      </button>
      {busy ? <RefreshOverlay progress={progress} phase={phase} /> : null}
    </>
  );
}

function RefreshOverlay({ progress, phase }: { progress: number; phase: string }) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden"
      style={{
        background: "radial-gradient(circle at 50% 50%, rgba(15,23,42,0.92), rgba(2,6,23,0.98))",
        backdropFilter: "blur(6px)",
      }}
      aria-label="更新中"
      role="alert"
    >
      {/* 背面：走る星屑 */}
      <div className="rf-stars" />

      {/* コア：多重リング + オービット球 + 中央エンブレム */}
      <div className="rf-core">
        <div className="rf-ring rf-ring-1" />
        <div className="rf-ring rf-ring-2" />
        <div className="rf-ring rf-ring-3" />
        <div className="rf-orbit rf-orbit-1"><span /></div>
        <div className="rf-orbit rf-orbit-2"><span /></div>
        <div className="rf-orbit rf-orbit-3"><span /></div>
        <div className="rf-glow" />
        <div className="rf-emoji">🚀</div>
      </div>

      {/* テキスト + プログレス */}
      <div style={{ position: "absolute", bottom: "18%", left: 0, right: 0, textAlign: "center" }}>
        <div className="rf-title">アプリを更新中</div>
        <div className="rf-phase">{phase}<span className="rf-dots">…</span></div>
        <div className="rf-bar-wrap">
          <div className="rf-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="rf-percent">{Math.floor(progress)}%</div>
      </div>

      <style jsx>{`
        .rf-stars {
          position: absolute; inset: -20%;
          background:
            radial-gradient(2px 2px at 12% 20%, #93c5fd 40%, transparent 41%),
            radial-gradient(1.5px 1.5px at 78% 30%, #a5b4fc 40%, transparent 41%),
            radial-gradient(2px 2px at 30% 70%, #f0abfc 40%, transparent 41%),
            radial-gradient(1.5px 1.5px at 60% 85%, #67e8f9 40%, transparent 41%),
            radial-gradient(2px 2px at 85% 65%, #fde68a 40%, transparent 41%),
            radial-gradient(1px 1px at 45% 40%, #fca5a5 40%, transparent 41%),
            radial-gradient(1.5px 1.5px at 20% 50%, #86efac 40%, transparent 41%);
          filter: blur(0.3px);
          animation: rf-star-drift 6s linear infinite, rf-star-fade 2.4s ease-in-out infinite;
          opacity: 0.85;
        }
        @keyframes rf-star-drift {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); }
          100% { transform: translate3d(0, -6%, 0) rotate(3deg); }
        }
        @keyframes rf-star-fade {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .rf-core {
          position: relative;
          width: 220px; height: 220px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 6%;
        }
        .rf-ring {
          position: absolute; inset: 0;
          border-radius: 50%;
          border: 2px solid transparent;
          border-top-color: #60a5fa;
          border-right-color: rgba(96,165,250,0.4);
        }
        .rf-ring-1 { inset: 0; animation: rf-spin 1.6s linear infinite; border-top-color: #60a5fa; border-right-color: rgba(96,165,250,0.35); }
        .rf-ring-2 { inset: 22px; animation: rf-spin 2.4s linear infinite reverse; border-top-color: #a78bfa; border-right-color: rgba(167,139,250,0.35); }
        .rf-ring-3 { inset: 44px; animation: rf-spin 3.2s linear infinite; border-top-color: #34d399; border-right-color: rgba(52,211,153,0.35); }
        @keyframes rf-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .rf-orbit {
          position: absolute; inset: 0;
          animation: rf-spin 2.6s linear infinite;
        }
        .rf-orbit > span {
          position: absolute; left: 50%; top: 0;
          transform: translate(-50%, -50%);
          width: 12px; height: 12px; border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #fef08a, #f59e0b);
          box-shadow: 0 0 20px rgba(250,204,21,0.9), 0 0 40px rgba(250,204,21,0.5);
        }
        .rf-orbit-1 { animation-duration: 1.9s; }
        .rf-orbit-2 { animation-duration: 2.7s; animation-direction: reverse; }
        .rf-orbit-2 > span { background: radial-gradient(circle at 30% 30%, #a5f3fc, #06b6d4); box-shadow: 0 0 20px rgba(6,182,212,0.9), 0 0 40px rgba(6,182,212,0.5); }
        .rf-orbit-3 { animation-duration: 3.4s; }
        .rf-orbit-3 > span { background: radial-gradient(circle at 30% 30%, #fbcfe8, #ec4899); box-shadow: 0 0 20px rgba(236,72,153,0.9), 0 0 40px rgba(236,72,153,0.5); }

        .rf-glow {
          position: absolute; inset: 58px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(59,130,246,0.55), rgba(59,130,246,0) 70%);
          filter: blur(4px);
          animation: rf-glow 1.4s ease-in-out infinite;
        }
        @keyframes rf-glow {
          0%, 100% { transform: scale(0.85); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        .rf-emoji {
          position: relative; z-index: 2;
          font-size: 56px;
          filter: drop-shadow(0 0 12px rgba(59,130,246,0.65));
          animation: rf-bob 1.4s ease-in-out infinite;
        }
        @keyframes rf-bob {
          0%, 100% { transform: translateY(0) rotate(-4deg) scale(1); }
          50% { transform: translateY(-6px) rotate(6deg) scale(1.08); }
        }

        .rf-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: #e6edf6;
          letter-spacing: 0.06em;
          margin-bottom: 4px;
          text-shadow: 0 0 12px rgba(59,130,246,0.5);
          animation: rf-title-glow 1.6s ease-in-out infinite alternate;
        }
        @keyframes rf-title-glow {
          from { text-shadow: 0 0 8px rgba(59,130,246,0.4); }
          to   { text-shadow: 0 0 20px rgba(167,139,250,0.75); }
        }
        .rf-phase {
          font-size: 0.85rem;
          color: #94a3b8;
          margin-bottom: 12px;
          min-height: 1.2em;
        }
        .rf-dots {
          display: inline-block;
          animation: rf-dots 1s steps(4, end) infinite;
          width: 1.2em; text-align: left;
        }
        @keyframes rf-dots {
          0%   { content: ""; opacity: 0.6; }
          100% { opacity: 1; }
        }
        .rf-bar-wrap {
          width: min(72vw, 320px);
          height: 6px;
          margin: 0 auto;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.18);
          overflow: hidden;
          position: relative;
        }
        .rf-bar {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6, #34d399, #60a5fa);
          background-size: 200% 100%;
          transition: width 0.35s ease-out;
          animation: rf-bar-flow 1.6s linear infinite;
          box-shadow: 0 0 12px rgba(96,165,250,0.7);
        }
        @keyframes rf-bar-flow {
          0%   { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }
        .rf-percent {
          margin-top: 6px;
          font-size: 0.72rem;
          color: #64748b;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.04em;
        }
      `}</style>
    </div>
  );
}
