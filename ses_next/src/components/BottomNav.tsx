"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "日報", icon: "📝" },
  { href: "/projects", label: "案件", icon: "📁" },
  { href: "/salary", label: "給与", icon: "💰" },
  { href: "/more", label: "その他", icon: "⋯" },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return null;
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
                className="flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold"
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
