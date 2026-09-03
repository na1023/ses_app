"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshed = false;
    // 新しい SW が activate して controller が切り替わったら即リロード
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshed) return;
      refreshed = true;
      window.location.reload();
    });

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });

        // 待機中の SW があれば即切替
        if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");

        // 新しい SW を検知したら install 完了時に skipWaiting させる
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              sw.postMessage("SKIP_WAITING");
            }
          });
        });

        // タブが可視化されるたびに update をチェック（PWA を再フォーカスした時など）
        const onVisible = () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        };
        document.addEventListener("visibilitychange", onVisible);
        // 起動直後にも1回チェック
        reg.update().catch(() => {});
      } catch {
        /* ignore */
      }
    })();
  }, []);
  return null;
}
