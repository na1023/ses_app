const CACHE = "ses-cache-v1";
const CORE = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
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

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return; // Server Actions(POST)等はそのまま
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // 静的アセット: キャッシュ優先
  if (url.pathname.startsWith("/_next/static") || url.pathname === "/icon.svg") {
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

  // ページ遷移: ネットワーク優先 → オフライン時はキャッシュ
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const cp = res.clone();
          caches.open(CACHE).then((c) => c.put(request, cp));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
  }
});
