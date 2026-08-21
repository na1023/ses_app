"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "@/lib/settings-actions";

export default function ClosingSwitch({ current }: { current: "month_end" | "day_15" }) {
  const router = useRouter();
  const [busy, start] = useTransition();

  function toggle(next: "month_end" | "day_15") {
    if (next === current) return;
    start(async () => {
      await saveSettings({ closing_type: next });
      router.refresh();
    });
  }

  return (
    <div className="seg" style={{ maxWidth: 260, margin: "0 auto" }}>
      <button data-active={current === "month_end"} onClick={() => toggle("month_end")} disabled={busy}>月末締め</button>
      <button data-active={current === "day_15"} onClick={() => toggle("day_15")} disabled={busy}>15日締め</button>
    </div>
  );
}
