// バージョンを上げるたびに古いキャッシュは全削除される。デプロイの度に日付を更新。
const CACHE = "ses-cache-2026-09-04-a";
const OFFLINE = ["/"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(OFFLINE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// クライアントからのメッセージで skipWaiting できるようにしておく（強制更新用）。
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // ハッシュ付き静的アセット: 中身が変わらないのでキャッシュ優先で OK。
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(request).then(
        (r) =>
          r ||
          fetch(request).then((res) => {
            const cp = res.clone();
            caches.open(CACHE).then((c) => c.put(request, cp));
            return res;
          })
      )
    );
    return;
  }

  // その他（HTML/APIレスポンス）は常にネットワーク優先。オフライン時のみキャッシュを返す。
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (request.mode === "navigate") {
          const cp = res.clone();
          caches.open(CACHE).then((c) => c.put(request, cp));
        }
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match("/")))
  );
});
