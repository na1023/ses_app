"""
pages/1_案件管理.py
案件の登録・編集・削除・一覧表示を管理するページ
"""

import pandas as pd
import streamlit as st
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import load, save, generate_id, init_all
from utils.styles import THEME_CSS, render_sidebar

st.set_page_config(page_title="案件管理 | SES業務管理", layout="wide")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()

st.markdown(
    """
    <div class="page-header">
        <h1>案件管理</h1>
        <p>参画中・営業中の案件を登録・管理します</p>
    </div>
    """,
    unsafe_allow_html=True,
)

# ===== 新規登録フォーム =====
with st.expander("新規案件を登録", expanded=False):
    with st.form("add_project_form", clear_on_submit=True):
        c1, c2 = st.columns(2)
        company      = c1.text_input("会社名 *", placeholder="株式会社〇〇")
        project_name = c2.text_input("案件名 *", placeholder="〇〇システム開発")
        c3, c4 = st.columns(2)
        start_date = c3.date_input("開始日")
        end_date   = c4.date_input("終了日")
        memo       = st.text_area("メモ", height=80)
        submitted  = st.form_submit_button("登録する", use_container_width=True)

    if submitted:
        if not company or not project_name:
            st.error("会社名と案件名は必須です。")
        else:
            df = load("projects")
            df = pd.concat([df, pd.DataFrame([{
                "id":           generate_id(),
                "company":      company,
                "project_name": project_name,
                "start_date":   str(start_date),
                "end_date":     str(end_date),
                "memo":         memo,
            }])], ignore_index=True)
            save("projects", df)
            st.success(f"案件「{project_name}」を登録しました。")
            st.rerun()

# ===== 案件一覧 =====
st.markdown("### 登録済み案件一覧")
df = load("projects")

if df.empty:
    st.info("案件がまだ登録されていません。上のフォームから追加してください。")
    st.stop()

search = st.text_input("会社名・案件名で絞り込み", placeholder="キーワードを入力")
if search:
    mask = (
        df["company"].str.contains(search, na=False, case=False) |
        df["project_name"].str.contains(search, na=False, case=False)
    )
    df_view = df[mask].reset_index(drop=True)
else:
    df_view = df.copy()

st.caption(f"全 {len(df)} 件 / 表示 {len(df_view)} 件")

for _, row in df_view.iterrows():
    rid = row["id"]
    edit_key = f"proj_edit_{rid}"
    del_key  = f"proj_del_{rid}"

    with st.container():
        st.markdown('<div class="section-card">', unsafe_allow_html=True)

        info_col, btn_col = st.columns([6, 2])
        with info_col:
            st.markdown(
                f"**{row['company']}** / {row['project_name']}  \n"
                f"<span style='color:#64748b; font-size:0.82rem;'>"
                f"{row.get('start_date','—')} 〜 {row.get('end_date','—')}"
                f"</span>",
                unsafe_allow_html=True,
            )
            if row.get("memo"):
                st.caption(row["memo"])

        with btn_col:
            bc1, bc2 = st.columns(2)
            if bc1.button("編集", key=f"ebtn_{rid}", use_container_width=True):
                st.session_state[edit_key] = not st.session_state.get(edit_key, False)
                st.session_state[del_key]  = False
            if bc2.button("削除", key=f"dbtn_{rid}", use_container_width=True):
                st.session_state[del_key]  = not st.session_state.get(del_key, False)
                st.session_state[edit_key] = False

        # 編集フォーム
        if st.session_state.get(edit_key):
            with st.form(f"edit_form_{rid}"):
                ec1, ec2 = st.columns(2)
                new_company = ec1.text_input("会社名", value=row["company"])
                new_proj    = ec2.text_input("案件名", value=row["project_name"])
                ec3, ec4 = st.columns(2)
                new_start = ec3.text_input("開始日 (YYYY-MM-DD)", value=row.get("start_date", ""))
                new_end   = ec4.text_input("終了日 (YYYY-MM-DD)", value=row.get("end_date", ""))
                new_memo  = st.text_area("メモ", value=row.get("memo", ""), height=80)
                save_btn, cancel_btn = st.columns(2)
                do_save   = save_btn.form_submit_button("保存する", use_container_width=True)
                do_cancel = cancel_btn.form_submit_button("キャンセル", use_container_width=True)

            if do_save:
                df_all = load("projects")
                m = df_all["id"] == rid
                df_all.loc[m, "company"]      = new_company
                df_all.loc[m, "project_name"] = new_proj
                df_all.loc[m, "start_date"]   = new_start
                df_all.loc[m, "end_date"]     = new_end
                df_all.loc[m, "memo"]         = new_memo
                save("projects", df_all)
                st.session_state[edit_key] = False
                st.success("更新しました。")
                st.rerun()
            if do_cancel:
                st.session_state[edit_key] = False
                st.rerun()

        # 削除確認
        if st.session_state.get(del_key):
            st.warning(f"「{row['project_name']}」を削除しますか？この操作は元に戻せません。")
            cc1, cc2, _ = st.columns([1, 1, 3])
            if cc1.button("削除する", key=f"del_ok_{rid}", use_container_width=True):
                df_all = load("projects")
                df_all = df_all[df_all["id"] != rid].reset_index(drop=True)
                save("projects", df_all)
                st.session_state[del_key] = False
                st.success("削除しました。")
                st.rerun()
            if cc2.button("やめる", key=f"del_no_{rid}", use_container_width=True):
                st.session_state[del_key] = False
                st.rerun()

        st.markdown("</div>", unsafe_allow_html=True)
