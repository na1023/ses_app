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
)
from utils.styles import THEME_CSS, render_sidebar

st.set_page_config(page_title="設定・データ管理 | SES業務管理", layout="wide")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()

st.markdown(
    """
    <div class="page-header">
        <h1>設定・データ管理</h1>
        <p>CSV のインポート・エクスポート、バックアップを管理します</p>
    </div>
    """,
    unsafe_allow_html=True,
)

KEY_LABELS = {
    "projects":   "案件マスタ",
    "interviews": "面談データ",
    "todos":      "ToDo データ",
    "daily":      "日報データ",
}

tab_export, tab_import, tab_backup, tab_reset = st.tabs(
    ["エクスポート", "インポート", "バックアップ", "データリセット"]
)

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
            st.success(f"{KEY_LABELS[target_reset]} を初期化しました。")
            st.rerun()
