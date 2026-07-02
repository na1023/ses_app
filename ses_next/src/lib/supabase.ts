import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * サーバー専用の Supabase クライアント。
 * キーはサーバー環境変数からのみ読み込み、ブラウザには一切露出しない。
 * 既存の Streamlit アプリと同じ SUPABASE_URL / SUPABASE_KEY を使用する。
 */
let _client: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_KEY が設定されていません（.env.local を確認してください）。"
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
