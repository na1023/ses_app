import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * サーバー用 Supabase クライアント（ユーザーセッションを Cookie から復元）。
 * anon(公開)キー + ログインユーザーの JWT を使うため、RLS がアカウント単位で効く。
 */
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component からの呼び出しでは set 不可。middleware が更新するため無視。
          }
        },
      },
    }
  );
}
