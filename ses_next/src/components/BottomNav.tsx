"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ITEMS = [
  { href: "/", label: "ホーム", icon: "🏠" },
  { href: "/nippo", label: "日報", icon: "📝" },
  { href: "/projects", label: "案件", icon: "📁" },
  { href: "/settlement", label: "精算", icon: "📊" },
  { href: "/more", label: "その他", icon: "⋯" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [kb, setKb] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);

  // 入力（キーボード）表示中はフッターを隠して被りを防ぐ
  // 全タブを事前プリフェッチ（遷移即時化）
  useEffect(() => {
    ITEMS.forEach((it) => router.prefetch(it.href));
  }, [router]);

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
          const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href + "/")) || (it.href === "/nippo" && pathname === "/nippo") || (it.href === "/" && pathname === "/");
          const isPressed = pressed === it.href;
          const highlight = active || isPressed;
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                prefetch
                onPointerDown={() => { setPressed(it.href); navigator.vibrate?.(15); }}
                onPointerUp={() => setPressed(null)}
                onPointerLeave={() => setPressed(null)}
                onPointerCancel={() => setPressed(null)}
                className="nav-tap flex flex-col items-center gap-1 py-3.5 text-xs font-semibold"
                style={{
                  color: highlight ? "var(--accent)" : "var(--subtle)",
                  background: isPressed ? "rgba(59,130,246,0.14)" : "transparent",
                }}
              >
                <span
                  className="text-lg leading-none"
                  style={{
                    transform: isPressed ? "scale(1.3)" : active ? "scale(1.15)" : "scale(1)",
                    transition: "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                >{it.icon}</span>
                {it.label}
                {highlight ? (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 4,
                      width: isPressed ? 32 : 24,
                      height: 3,
                      background: "var(--accent)",
                      borderRadius: 2,
                      transition: "width 0.15s",
                      boxShadow: isPressed ? "0 0 8px var(--accent)" : undefined,
                    }}
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
