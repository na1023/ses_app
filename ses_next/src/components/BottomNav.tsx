"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const ITEMS = [
  { href: "/", label: "ホーム", icon: "🏠" },
  { href: "/nippo", label: "日報", icon: "📝" },
  { href: "/projects", label: "案件", icon: "📁" },
  { href: "/settlement", label: "精算", icon: "📊" },
  { href: "/more", label: "その他", icon: "⋯" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [kb, setKb] = useState(false);

  // 入力（キーボード）表示中はフッターを隠して被りを防ぐ
  useEffect(() => {
    const onIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) {
        const type = (t as HTMLInputElement).type;
        if (type !== "checkbox" && type !== "radio" && type !== "date") setKb(true);
      }
    };
    const onOut = () => setKb(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  if (pathname.startsWith("/login")) return null;
  if (kb) return null;

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-xl -translate-x-1/2 border-t"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <ul className="flex">
        {ITEMS.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className="flex flex-col items-center gap-1 py-3.5 text-xs font-semibold"
                style={{ color: active ? "var(--accent)" : "var(--subtle)" }}
              >
                <span className="text-lg leading-none">{it.icon}</span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
