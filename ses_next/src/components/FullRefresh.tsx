"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** アカウントメニュー内の「全更新」ボタン。押すと躍動オーバーレイ + キャッシュ全消し + ハードリロード。 */
export default function FullRefresh({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const router = useRouter();

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
    // メニューは閉じない（このコンポーネント自身が unmount されるとオーバーレイが消えるため）
    try {
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
      try { router.refresh(); } catch { /* ignore */ }
      // 演出を最低限確保
      await new Promise((r) => setTimeout(r, 1600));
    } finally {
      setProgress(100);
      await new Promise((r) => setTimeout(r, 400));
      onDone?.();
      window.location.reload();
    }
  }

  return (
    <>
      <button className="btn-ghost w-full" onClick={full} disabled={busy}>
        🔄 全更新（キャッシュ再取得）
      </button>
      {busy ? <PortalOverlay progress={progress} phase={phase} /> : null}
    </>
  );
}

function PortalOverlay(props: { progress: number; phase: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(<RefreshOverlay {...props} />, document.body);
}

function RefreshOverlay({ progress, phase }: { progress: number; phase: string }) {
  // ランダムに散る小粒（初回のみ生成）
  const [particles] = useState(() =>
    Array.from({ length: 26 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      d: 6 + Math.random() * 6,
      delay: Math.random() * 2.4,
      dur: 2 + Math.random() * 3,
      hue: [200, 260, 310, 40, 160][i % 5],
    }))
  );

  return (
    <div
      className="rf-root"
      aria-label="更新中"
      role="alert"
    >
      {/* 背面：グラデーション + 動くオーロラ */}
      <div className="rf-aurora rf-aurora-1" />
      <div className="rf-aurora rf-aurora-2" />
      <div className="rf-aurora rf-aurora-3" />

      {/* 散らばる光の粒 */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="rf-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.d,
            height: p.d,
            background: `radial-gradient(circle, hsl(${p.hue}, 90%, 75%) 0%, hsl(${p.hue}, 90%, 55%) 60%, transparent 70%)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            boxShadow: `0 0 ${p.d * 2}px hsl(${p.hue}, 90%, 65%)`,
          }}
        />
      ))}

      {/* コア */}
      <div className="rf-core">
        <div className="rf-ring rf-ring-1" />
        <div className="rf-ring rf-ring-2" />
        <div className="rf-ring rf-ring-3" />
        <div className="rf-orbit rf-orbit-1"><span /></div>
        <div className="rf-orbit rf-orbit-2"><span /></div>
        <div className="rf-orbit rf-orbit-3"><span /></div>
        <div className="rf-orbit rf-orbit-4"><span /></div>
        <div className="rf-glow" />
        <div className="rf-emoji">🚀</div>
      </div>

      {/* テキスト + プログレス */}
      <div className="rf-bottom">
        <div className="rf-title">アプリを更新中</div>
        <div className="rf-phase">{phase}<span className="rf-dots">…</span></div>
        <div className="rf-bar-wrap">
          <div className="rf-bar" style={{ width: `${progress}%` }} />
          <div className="rf-bar-shine" style={{ left: `${progress}%` }} />
        </div>
        <div className="rf-percent">{Math.floor(progress)}%</div>
      </div>

      <style jsx>{`
        .rf-root {
          position: fixed; inset: 0;
          z-index: 100000;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          background: radial-gradient(circle at 50% 40%, rgba(30,41,59,0.94), rgba(2,6,23,0.99));
          backdrop-filter: blur(8px);
          animation: rf-in 0.35s ease-out both;
        }
        @keyframes rf-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .rf-aurora {
          position: absolute; inset: -30%;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.55;
          mix-blend-mode: screen;
          pointer-events: none;
        }
        .rf-aurora-1 { background: radial-gradient(circle, #3b82f6 0%, transparent 60%); animation: rf-drift-a 12s ease-in-out infinite; }
        .rf-aurora-2 { background: radial-gradient(circle, #a855f7 0%, transparent 60%); animation: rf-drift-b 14s ease-in-out infinite; }
        .rf-aurora-3 { background: radial-gradient(circle, #ec4899 0%, transparent 60%); animation: rf-drift-c 10s ease-in-out infinite; }
        @keyframes rf-drift-a {
          0%, 100% { transform: translate(-10%, -10%); }
          50%      { transform: translate(15%, 20%); }
        }
        @keyframes rf-drift-b {
          0%, 100% { transform: translate(10%, 20%); }
          50%      { transform: translate(-15%, -10%); }
        }
        @keyframes rf-drift-c {
          0%, 100% { transform: translate(0%, 15%); }
          50%      { transform: translate(-10%, -20%); }
        }

        .rf-particle {
          position: absolute;
          border-radius: 50%;
          animation-name: rf-particle-float;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          pointer-events: none;
        }
        @keyframes rf-particle-float {
          0%   { transform: translate(0, 0) scale(0.6); opacity: 0.2; }
          50%  { transform: translate(20px, -30px) scale(1.3); opacity: 1; }
          100% { transform: translate(-15px, 25px) scale(0.6); opacity: 0.2; }
        }

        .rf-core {
          position: relative;
          width: 240px; height: 240px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 4%;
          animation: rf-core-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes rf-core-in {
          from { transform: scale(0.4) rotate(-90deg); opacity: 0; }
          to   { transform: scale(1) rotate(0); opacity: 1; }
        }
        .rf-ring {
          position: absolute; inset: 0;
          border-radius: 50%;
          border: 2px solid transparent;
        }
        .rf-ring-1 { inset: 0;   animation: rf-spin 1.6s linear infinite;         border-top-color: #60a5fa; border-right-color: rgba(96,165,250,0.35); }
        .rf-ring-2 { inset: 24px; animation: rf-spin 2.4s linear infinite reverse; border-top-color: #a78bfa; border-right-color: rgba(167,139,250,0.35); }
        .rf-ring-3 { inset: 48px; animation: rf-spin 3.2s linear infinite;         border-top-color: #34d399; border-right-color: rgba(52,211,153,0.35); }
        @keyframes rf-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .rf-orbit {
          position: absolute; inset: 0;
        }
        .rf-orbit > span {
          position: absolute; left: 50%; top: 0;
          transform: translate(-50%, -50%);
          width: 14px; height: 14px; border-radius: 50%;
        }
        .rf-orbit-1 { animation: rf-spin 1.9s linear infinite; }
        .rf-orbit-1 > span { background: radial-gradient(circle at 30% 30%, #fef08a, #f59e0b); box-shadow: 0 0 22px #f59e0b, 0 0 44px rgba(245,158,11,0.5); }
        .rf-orbit-2 { animation: rf-spin 2.7s linear infinite reverse; }
        .rf-orbit-2 > span { background: radial-gradient(circle at 30% 30%, #a5f3fc, #06b6d4); box-shadow: 0 0 22px #06b6d4, 0 0 44px rgba(6,182,212,0.5); }
        .rf-orbit-3 { animation: rf-spin 3.4s linear infinite; }
        .rf-orbit-3 > span { background: radial-gradient(circle at 30% 30%, #fbcfe8, #ec4899); box-shadow: 0 0 22px #ec4899, 0 0 44px rgba(236,72,153,0.5); }
        .rf-orbit-4 { animation: rf-spin 2.2s linear infinite reverse; }
        .rf-orbit-4 > span { background: radial-gradient(circle at 30% 30%, #bbf7d0, #10b981); box-shadow: 0 0 22px #10b981, 0 0 44px rgba(16,185,129,0.5); left: auto; right: 0; top: 50%; }

        .rf-glow {
          position: absolute; inset: 64px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(139,92,246,0.6), rgba(59,130,246,0) 70%);
          filter: blur(6px);
          animation: rf-glow 1.4s ease-in-out infinite;
        }
        @keyframes rf-glow {
          0%, 100% { transform: scale(0.85); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        .rf-emoji {
          position: relative; z-index: 2;
          font-size: 64px;
          filter: drop-shadow(0 0 16px rgba(139,92,246,0.75));
          animation: rf-bob 1.4s ease-in-out infinite;
        }
        @keyframes rf-bob {
          0%, 100% { transform: translateY(0) rotate(-4deg) scale(1); }
          50% { transform: translateY(-8px) rotate(6deg) scale(1.1); }
        }

        .rf-bottom {
          position: absolute; bottom: 14%; left: 0; right: 0;
          text-align: center;
          animation: rf-bottom-in 0.6s ease-out 0.15s both;
        }
        @keyframes rf-bottom-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rf-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: #f1f5f9;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
          background: linear-gradient(90deg, #60a5fa, #a78bfa, #ec4899, #60a5fa);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: rf-title-flow 3s linear infinite;
        }
        @keyframes rf-title-flow {
          0%   { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }
        .rf-phase {
          font-size: 0.88rem;
          color: #cbd5e1;
          margin-bottom: 14px;
          min-height: 1.2em;
        }
        .rf-dots {
          display: inline-block;
          animation: rf-blink 1s infinite;
        }
        @keyframes rf-blink {
          50% { opacity: 0.3; }
        }
        .rf-bar-wrap {
          width: min(72vw, 320px);
          height: 8px;
          margin: 0 auto;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.18);
          overflow: hidden;
          position: relative;
        }
        .rf-bar {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #60a5fa, #a78bfa, #ec4899, #f59e0b, #10b981, #60a5fa);
          background-size: 200% 100%;
          transition: width 0.4s ease-out;
          animation: rf-bar-flow 1.8s linear infinite;
          box-shadow: 0 0 14px rgba(96,165,250,0.7);
        }
        @keyframes rf-bar-flow {
          0%   { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }
        .rf-bar-shine {
          position: absolute; top: 0; height: 100%;
          width: 40px;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
          animation: rf-shine 1.4s ease-in-out infinite;
        }
        @keyframes rf-shine {
          0%   { left: -10%; }
          100% { left: 110%; }
        }
        .rf-percent {
          margin-top: 8px;
          font-size: 0.78rem;
          color: #94a3b8;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.06em;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
