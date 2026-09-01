"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "@/lib/settings-actions";

export default function ClosingSwitch({ current }: { current: "month_end" | "day_15" }) {
  const router = useRouter();
  const [busy, start] = useTransition();

  function toggle(next: "month_end" | "day_15") {
    if (next === current || busy) return;
    start(async () => {
      await saveSettings({ closing_type: next });
      router.refresh();
    });
  }

  return (
    <div className="seg" style={{ maxWidth: 300, margin: "0 auto" }}>
      <button
        data-active={current === "month_end"}
        onClick={() => toggle("month_end")}
        disabled={busy}
        style={busy && current !== "month_end" ? { opacity: 0.5 } : undefined}
      >
        {busy && current !== "month_end" ? "切替中…" : "月末締め"}
      </button>
      <button
        data-active={current === "day_15"}
        onClick={() => toggle("day_15")}
        disabled={busy}
        style={busy && current !== "day_15" ? { opacity: 0.5 } : undefined}
      >
        {busy && current !== "day_15" ? "切替中…" : "15日締め"}
      </button>
    </div>
  );
}
