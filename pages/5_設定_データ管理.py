"""
pages/5_設定_データ管理.py
CSVインポート・エクスポート・バックアップ・データリセットを管理するページ
"""

import streamlit as st
import pandas as pd
import io, os, shutil
from datetime import datetime
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import (
    load, save, backup_data, init_all,
    DATA_DIR, BACKUP_DIR, PATHS, SCHEMAS,
    _use_supabase,
)
from utils.styles import THEME_CSS, render_sidebar, set_flash, show_flash
from utils.diagnostics import run_diagnostics, summarize, DATASET_LABELS

st.set_page_config(page_title="設定・データ管理 | SES業務管理", layout="wide")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()
show_flash()

st.markdown(
    """
    <div class="page-header">
        <h1>設定・データ管理</h1>
        <p>CSV のインポート・エクスポート、バックアップを管理します</p>
    </div>
    """,
    unsafe_allow_html=True,
)

# ================================================================
# Supabase 接続状態
# ================================================================
if _use_supabase():
    st.success("Supabase に接続済みです。データはクラウドに自動保存されます。")
else:
    st.warning(
        "現在ローカル CSV モードで動作中です。"
        "Streamlit Cloud では再起動するとデータが消えます。  \n"
        "永続化するには Supabase を設定してください（下の「Supabase 設定手順」タブを参照）。"
    )

KEY_LABELS = {
    "projects":   "案件マスタ",
    "interviews": "面談データ",
    "todos":      "ToDo データ",
    "daily":      "日報データ",
    "salary":     "給与データ",
}

tab_check, tab_export, tab_import, tab_backup, tab_reset, tab_supabase = st.tabs(
    ["エラー自動検出", "エクスポート", "インポート", "バックアップ", "データリセット", "Supabase 設定手順"]
)

# ================================================================
# エラー自動検出タブ
# ================================================================
with tab_check:
    st.markdown("#### データ整合性の自動チェック")
    st.caption(
        "全データ（案件・面談・ToDo・日報・給与）を横断し、"
        "ID重複・日付/時刻の矛盾・実働時間のズレ・数値異常・範囲外の値などを検査します。"
    )

    SEV_META = {
        "error":   ("エラー",   "#ef4444", "🛑"),
        "warning": ("警告",     "#f59e0b", "⚠️"),
        "info":    ("情報",     "#3b82f6", "ℹ️"),
    }

    auto_run = st.session_state.pop("_diag_autorun", False)
    if st.button("チェックを実行する", key="run_diag", use_container_width=True, type="primary") or auto_run:
        with st.spinner("データを検査しています..."):
            findings = run_diagnostics()
        st.session_state["_diag_result"] = findings

    findings = st.session_state.get("_diag_result")
    if findings is not None:
        summary = summarize(findings)
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("検出総数", summary["total"])
        m2.metric("🛑 エラー", summary["error"])
        m3.metric("⚠️ 警告",  summary["warning"])
        m4.metric("ℹ️ 情報",  summary["info"])

        if summary["total"] == 0:
            st.success("問題は検出されませんでした。データは健全です。")
        else:
            # 重大度フィルタ
            sev_choice = st.multiselect(
                "表示する重大度",
                ["error", "warning", "info"],
                default=["error", "warning", "info"],
                format_func=lambda s: SEV_META[s][0],
                key="diag_sev_filter",
            )
            ds_choice = st.multiselect(
                "対象データ",
                sorted({f["dataset"] for f in findings}),
                default=sorted({f["dataset"] for f in findings}),
                key="diag_ds_filter",
            )

            shown = [
                f for f in findings
                if f["severity"] in sev_choice and f["dataset"] in ds_choice
            ]
            # 重大度順（error→warning→info）にソート
            order = {"error": 0, "warning": 1, "info": 2}
            shown.sort(key=lambda f: (order[f["severity"]], f["dataset"]))

            st.caption(f"表示 {len(shown)} 件 / 全 {summary['total']} 件")

            rows_html = ""
            for f in shown:
                label, color, icon = SEV_META[f["severity"]]
                rid = f"<code>{f['row_id'][:8]}</code>" if f["row_id"] else "—"
                field = f"<code>{f['field']}</code>" if f["field"] else "—"
                hint = f"<div style='color:#64748b;font-size:0.75rem;margin-top:2px;'>💡 {f['hint']}</div>" if f["hint"] else ""
                rows_html += (
                    f"<tr>"
                    f"<td style='white-space:nowrap;color:{color};font-weight:600;'>{icon} {label}</td>"
                    f"<td style='white-space:nowrap;'>{f['dataset']}</td>"
                    f"<td>{f['message']}{hint}</td>"
                    f"<td style='white-space:nowrap;'>{field}</td>"
                    f"<td style='white-space:nowrap;'>{rid}</td>"
                    f"</tr>"
                )
            st.markdown(
                f"""<div class="table-wrap"><table class="styled-table">
                <thead><tr><th>重大度</th><th>データ</th><th>内容</th><th>項目</th><th>ID</th></tr></thead>
                <tbody>{rows_html}</tbody></table></div>""",
                unsafe_allow_html=True,
            )

            # CSV ダウンロード
            import pandas as _pd
            df_find = _pd.DataFrame(shown)[["severity", "dataset", "message", "field", "row_id", "hint"]]
            df_find["severity"] = df_find["severity"].map(lambda s: SEV_META[s][0])
            df_find.columns = ["重大度", "データ", "内容", "項目", "ID", "対処のヒント"]
            st.download_button(
                "検出結果を CSV でダウンロード",
                data=df_find.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig"),
                file_name=f"data_diagnostics_{datetime.now().strftime('%Y%m%d_%H%M')}.csv",
                mime="text/csv",
            )
    else:
        st.info("「チェックを実行する」を押すと検査を開始します。")

# ================================================================
# エクスポートタブ
# ================================================================
with tab_export:
    st.markdown("#### データを CSV でダウンロードする")
    st.info("各データ種別ごとに CSV をダウンロードできます。")

    for key, label in KEY_LABELS.items():
        df = load(key)
        csv_bytes = df.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
        col_a, col_b = st.columns([3, 1])
        col_a.markdown(f"**{label}**  `{len(df)} 件`")
        col_b.download_button(
            label="ダウンロード",
            data=csv_bytes,
            file_name=f"{key}_{datetime.now().strftime('%Y%m%d')}.csv",
            mime="text/csv",
            key=f"export_{key}",
        )

    st.markdown("---")
    st.markdown("#### 全データを ZIP でまとめてダウンロード")

    import zipfile, tempfile
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp_path = tmp.name

    with zipfile.ZipFile(tmp_path, "w") as zf:
        for key in PATHS:
            if os.path.exists(PATHS[key]):
                zf.write(PATHS[key], arcname=os.path.basename(PATHS[key]))

    with open(tmp_path, "rb") as f:
        zip_bytes = f.read()
    os.unlink(tmp_path)

    st.download_button(
        "全データ ZIP をダウンロード",
        data=zip_bytes,
        file_name=f"ses_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
        mime="application/zip",
    )

# ================================================================
# インポートタブ
# ================================================================
with tab_import:
    st.markdown("#### CSV ファイルをアップロードしてインポートする")
    st.warning(
        "インポートすると既存データに追記されます。"
        "上書きしたい場合は先にデータリセットを行ってください。"
    )

    target = st.selectbox(
        "インポート先データ種別",
        list(KEY_LABELS.keys()),
        format_func=lambda k: KEY_LABELS[k],
        key="import_target",
    )

    st.caption(
        f"必要カラム: `{'`, `'.join(SCHEMAS[target]['columns'])}`"
    )

    uploaded = st.file_uploader(
        "CSV ファイルを選択",
        type=["csv"],
        key="import_file",
    )

    if uploaded:
        try:
            df_upload = pd.read_csv(uploaded, dtype=str, encoding="utf-8-sig").fillna("")
        except Exception:
            uploaded.seek(0)
            df_upload = pd.read_csv(uploaded, dtype=str, encoding="utf-8").fillna("")

        st.write("プレビュー（先頭5行）")
        st.dataframe(df_upload.head(5), use_container_width=True)

        # カラム整合チェック
        required = set(SCHEMAS[target]["columns"])
        actual   = set(df_upload.columns)
        missing  = required - actual
        if missing:
            st.error(f"不足カラム: {missing}")
        else:
            if st.button("インポートを実行する", key="import_exec"):
                df_exist = load(target)
                df_merged = pd.concat([df_exist, df_upload], ignore_index=True)
                # 重複 ID を除去
                if "id" in df_merged.columns:
                    df_merged = df_merged.drop_duplicates(subset=["id"]).reset_index(drop=True)
                save(target, df_merged)
                st.success(f"{len(df_upload)} 件をインポートしました。（合計 {len(df_merged)} 件）")
                st.rerun()

# ================================================================
# バックアップタブ
# ================================================================
with tab_backup:
    st.markdown("#### 手動バックアップを実行する")
    st.info("data/ 配下のすべての CSV を backup/ ディレクトリへコピーします。")

    if st.button("今すぐバックアップする", key="manual_backup"):
        path = backup_data()
        if path:
            st.success(f"バックアップ完了: {path}")
        else:
            st.warning("バックアップするデータがありません。")

    st.markdown("---")
    st.markdown("#### バックアップ一覧")

    if os.path.exists(BACKUP_DIR):
        backups = sorted(os.listdir(BACKUP_DIR), reverse=True)
        if backups:
            for b in backups[:10]:
                b_path = os.path.join(BACKUP_DIR, b)
                files  = os.listdir(b_path) if os.path.isdir(b_path) else []
                st.markdown(
                    f"`{b}` — {len(files)} ファイル "
                    f"({', '.join(files)})"
                )
        else:
            st.info("バックアップはまだありません。")
    else:
        st.info("backup/ ディレクトリが存在しません。")

# ================================================================
# データリセットタブ
# ================================================================
with tab_reset:
    st.markdown("#### データを削除・初期化する")
    st.error(
        "この操作は元に戻せません。実行前にバックアップを取ることを強くお勧めします。"
    )

    target_reset = st.selectbox(
        "リセット対象",
        list(KEY_LABELS.keys()),
        format_func=lambda k: KEY_LABELS[k],
        key="reset_target",
    )

    confirm_text = st.text_input(
        f'「{KEY_LABELS[target_reset]}」を削除する場合は「DELETE」と入力してください',
        key="reset_confirm",
    )

    if confirm_text == "DELETE":
        if st.button("データを初期化する", key="reset_exec"):
            df_empty = pd.DataFrame(columns=SCHEMAS[target_reset]["columns"])
            save(target_reset, df_empty)
            set_flash("success", f"{KEY_LABELS[target_reset]} を初期化しました。")
            st.rerun()

# ================================================================
# Supabase 設定手順タブ
# ================================================================
with tab_supabase:
    st.markdown("#### Supabase でデータを永続化する手順")
    st.markdown("""
**ステップ 1 — Supabase のプロジェクトを作成する**
1. [supabase.com](https://supabase.com) にアクセスしてアカウント作成（無料）
2. 「New Project」でプロジェクトを作成する（リージョン: `Northeast Asia (Tokyo)` 推奨）

**ステップ 2 — テーブルを作成する**
1. 左メニューの「SQL Editor」を開く
2. プロジェクト内の `supabase_setup.sql` の内容をコピーして貼り付け、「Run」を実行

**ステップ 3 — API キーを取得する**
1. 左メニューの「Settings > API」を開く
2. `Project URL` と `anon public` キーをコピーする

**ステップ 4 — Streamlit Cloud にキーを登録する**
1. Streamlit Cloud のアプリページを開き、右上の「︙」→「Settings」→「Secrets」を開く
2. 以下の内容を貼り付けて保存する

```toml
SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

3. アプリを再起動するとクラウドDBに接続され、以後データは永続保存される

**ステップ 5 — 既存データを移行する（オプション）**
設定後に下のボタンでローカル CSV のデータを Supabase へ一括移行できます。
""")

    if _use_supabase():
        st.success("Supabase は接続済みです。")
        st.markdown("#### ローカル CSV → Supabase へ一括移行")
        st.caption("CSV ファイルに残っているデータを Supabase へコピーします（既存データと重複IDは除外）。")
        if st.button("CSV データを Supabase へ移行する", key="migrate_to_supabase"):
            total = 0
            for key, label in KEY_LABELS.items():
                try:
                    df_csv = pd.read_csv(PATHS[key], dtype=str, encoding="utf-8-sig").fillna("")
                    if not df_csv.empty:
                        df_cloud = load(key)
                        existing_ids = set(df_cloud["id"].tolist()) if not df_cloud.empty else set()
                        df_new = df_csv[~df_csv["id"].isin(existing_ids)]
                        if not df_new.empty:
                            from utils.data_manager import _get_supabase, _TABLE_MAP
                            client = _get_supabase()
                            records = df_new.fillna("").to_dict("records")
                            client.table(_TABLE_MAP[key]).upsert(records).execute()
                            st.write(f"{label}: {len(df_new)} 件を移行")
                            total += len(df_new)
                except FileNotFoundError:
                    pass
                except Exception as e:
                    st.warning(f"{label} の移行中にエラー: {e}")
            if total:
                st.success(f"合計 {total} 件を移行しました。")
            else:
                st.info("移行すべき新規データがありませんでした。")
    else:
        st.info("Supabase に接続するとここで移行ツールが利用できます。")
