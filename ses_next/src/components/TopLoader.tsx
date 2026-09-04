"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** 遷移中に上部に虹色プログレスバーを表示。 */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [visible, setVisible] = useState(false);
  const [w, setW] = useState(0);

  useEffect(() => {
    setVisible(true);
    setW(15);
    const t1 = setTimeout(() => setW(55), 60);
    const t2 = setTimeout(() => setW(85), 260);
    const t3 = setTimeout(() => setW(100), 620);
    const t4 = setTimeout(() => setVisible(false), 820);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [pathname, search]);

  if (!visible) return null;
  return (
    <div className="tl-wrap">
      <div className="tl-bar" style={{ width: `${w}%` }} />
      <div className="tl-shine" style={{ left: `${w}%` }} />
      <style>{`
        .tl-wrap {
          position: fixed; top: 0; left: 0; right: 0;
          height: 3px; z-index: 100; pointer-events: none;
          background: rgba(148,163,184,0.08);
        }
        .tl-bar {
          height: 100%;
          background: linear-gradient(90deg, #60a5fa, #a78bfa, #ec4899, #f59e0b, #10b981, #60a5fa);
          background-size: 200% 100%;
          transition: width 0.25s ease-out;
          box-shadow: 0 0 10px rgba(139,92,246,0.7);
          animation: tl-flow 1.4s linear infinite;
        }
        @keyframes tl-flow {
          0% { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }
        .tl-shine {
          position: absolute; top: 0; height: 100%;
          width: 30px;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent);
          transition: left 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}

export default function TopLoader() {
  return <Suspense fallback={null}><Bar /></Suspense>;
}
