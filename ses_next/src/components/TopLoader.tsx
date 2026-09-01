"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * ページ遷移中に上部にプログレスバーを表示する。
 * pathname/searchParams が変化する度にアニメーション表示。
 */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [visible, setVisible] = useState(false);
  const [w, setW] = useState(0);

  useEffect(() => {
    setVisible(true);
    setW(20);
    const t1 = setTimeout(() => setW(65), 60);
    const t2 = setTimeout(() => setW(90), 300);
    const t3 = setTimeout(() => setW(100), 700);
    const t4 = setTimeout(() => setVisible(false), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [pathname, search]);

  if (!visible) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 100, pointerEvents: "none" }}>
      <div style={{ width: `${w}%`, height: "100%", background: "var(--accent)", transition: "width 0.25s ease-out", boxShadow: "0 0 8px var(--accent)" }} />
    </div>
  );
}

export default function TopLoader() {
  return <Suspense fallback={null}><Bar /></Suspense>;
}
