"use client";

import AccountMenu from "@/components/AccountMenu";

export default function AppHeader({
  title,
  subtitle,
  email,
}: {
  title: string;
  subtitle?: string;
  email?: string;
}) {
  return (
    <header className="app-header px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold leading-tight">{title}</h1>
          {subtitle ? (
            <p className="text-xs" style={{ color: "var(--subtle)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {email ? <AccountMenu email={email} /> : null}
      </div>
    </header>
  );
}
