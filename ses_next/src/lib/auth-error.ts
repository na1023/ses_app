/** JWT/認証系エラーかどうか判定 */
export function isAuthClockError(msg: string): boolean {
  const m = (msg || "").toLowerCase();
  return (
    m.includes("jwt") ||
    m.includes("issued at future") ||
    m.includes("iat") ||
    m.includes("token") && (m.includes("expire") || m.includes("invalid"))
  );
}
