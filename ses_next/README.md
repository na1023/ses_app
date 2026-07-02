# SES業務管理 — Next.js PWA 版

スマホ・PC 両対応の業務管理アプリ（Streamlit 版のデータ＝Supabase をそのまま利用）。
ホーム画面に「インストール」してネイティブアプリのように使えます（PWA）。

## セットアップ

```bash
cd ses_next
npm install
cp .env.local.example .env.local   # 値を編集
npm run dev                        # http://localhost:3000
```

`.env.local` には既存 Streamlit と同じ Supabase 情報を設定します：

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=（service_role キー）
```

> キーはサーバー側（Server Actions）でのみ使用し、ブラウザには露出しません。

## アカウント連携（データの個人所有）の有効化

データはクラウド（Supabase）に保存され、全端末で同期されます。さらにアカウント単位で
隔離するには、以下を一度だけ実施してください。

1. **RLS 設定 SQL を実行**
   Supabase → SQL Editor で、リポジトリ直下の `supabase_auth_setup.sql` を貼り付けて実行。
   （各テーブルに `user_id` を追加し、行レベルセキュリティで自分の行だけに制限します）
2. **メール認証を有効化**
   Supabase → Authentication → Providers → **Email** を有効化。
   すぐ使いたい場合は「**Confirm email**（メール確認）」をオフにすると即ログインできます。
3. **環境変数を設定**（`.env.local` / Vercel）
   `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY`（公開キー）を追加。
4. アプリで新規登録 → 以後、日報はそのアカウントに紐づいて保存され、他人からは見えません。

> 既存データを自分のアカウントに引き継ぐ手順は `supabase_auth_setup.sql` の末尾コメント参照。

## 実装状況（段階リリース）

- [x] **Phase 1**：スマホ最優先の日報入力・一覧（ネイティブ日付/時刻ピッカー、勤怠区分チップ、
      実働時間の自動計算、有給/欠勤は備考のみで登録）
- [x] **アカウント連携**：メール+パスワードのログイン、RLS による個人データ隔離、
      未ログインは自動でログイン画面へ、セッションは Cookie で永続
- [ ] Phase 2：案件・面談・ToDo・カレンダー
- [ ] Phase 3：給与・有給・残業・レポート（グラフ）
- [ ] Phase 4：職務経歴生成・データ診断

## デプロイ（推奨: Vercel）

1. GitHub リポジトリを Vercel に連携（Root Directory を `ses_next` に設定）
2. Environment Variables に `SUPABASE_URL` / `SUPABASE_KEY` を登録
3. デプロイ後、スマホでURLを開き「ホーム画面に追加」でアプリ化

## 技術構成

- Next.js 14（App Router / Server Actions）
- Supabase（既存テーブルを流用）
- Tailwind CSS（ダークテーマ・モバイルファースト）
- PWA（manifest / standalone 表示）
