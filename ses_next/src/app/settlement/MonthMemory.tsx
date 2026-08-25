"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * 精算ページ用：URLに ym パラメータが無ければ、直近の選択月(localStorage)へ遷移。
 * ym が変わったら localStorage に保存する。
 * カスタム期間(start/end)が入っている時は保存しない。
 */
const KEY = "settlement_last_ym";

export default function MonthMemory({ ym }: { ym: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const paramYm = params.get("ym");
  const hasCustom = !!(params.get("start") && params.get("end"));

  useEffect(() => {
    // URL に ym 未指定 → 保存済みへリダイレクト
    if (!paramYm && !hasCustom) {
      try {
        const saved = localStorage.getItem(KEY);
        if (saved && /^\d{4}-\d{2}$/.test(saved) && saved !== ym) {
          const p = new URLSearchParams(params.toString());
          p.set("ym", saved);
          router.replace(`/settlement?${p.toString()}`);
          return;
        }
      } catch {}
    }
    // 選択中の月を保存
    try {
      if (paramYm && !hasCustom) localStorage.setItem(KEY, paramYm);
    } catch {}
  }, [paramYm, hasCustom, ym, router, params]);

  return null;
}
