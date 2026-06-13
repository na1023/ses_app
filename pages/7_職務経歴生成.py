"""
pages/7_職務経歴生成.py
日報データから期間・案件を指定して職務経歴の実績を自動生成するページ
"""

import streamlit as st
import pandas as pd
from datetime import date, timedelta
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import load, init_all, get_company_list
from utils.styles import THEME_CSS, render_sidebar
from utils.summarizer import extract_period, generate_career_markdown, generate_career_text

st.set_page_config(page_title="職務経歴生成 | SES業務管理", layout="wide")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()

st.markdown(
    """
    <div class="page-header">
        <h1>職務経歴生成</h1>
        <p>日報データから期間・案件を指定して職務経歴の実績を自動生成します</p>
    </div>
    """,
    unsafe_allow_html=True,
)

df_daily = load("daily")

if df_daily.empty:
    st.info("日報データがありません。先に日報を登録してください。")
    st.stop()

# ---- 設定パネル ----
st.markdown("### 抽出条件")
col1, col2, col3 = st.columns(3)

# 日付範囲（テキスト入力）
start_str = col1.text_input("開始日 (YYYY-MM-DD)", value=(date.today().replace(day=1) - timedelta(days=90)).strftime("%Y-%m-%d"))
end_str   = col2.text_input("終了日 (YYYY-MM-DD)", value=date.today().strftime("%Y-%m-%d"))

# 案件フィルター
companies = ["すべて"] + get_company_list()
sel_company = col3.selectbox("会社名で絞り込み", companies, key="career_company")

max_tech = st.slider("抽出する技術キーワードの上限", 3, 20, 10)

if st.button("職務経歴を生成する", use_container_width=True, type="primary"):
    try:
        df_period = extract_period(df_daily, start_str, end_str)
    except Exception as e:
        st.error(f"日付の形式を確認してください: {e}")
        st.stop()

    if sel_company != "すべて":
        df_period = df_period[df_period["company"] == sel_company].reset_index(drop=True)

    if df_period.empty:
        st.warning("条件に一致する日報データがありません。")
        st.stop()

    st.info(f"対象: {len(df_period)} 件の日報")

    tab_md, tab_txt, tab_data = st.tabs(["Markdown形式", "テキスト形式（職務経歴書向け）", "元データ確認"])

    with tab_md:
        md_out = generate_career_markdown(df_period, start_str, end_str, max_tech=max_tech)
        st.markdown(md_out)
        st.download_button(
            "Markdown をダウンロード",
            data=md_out.encode("utf-8"),
            file_name=f"career_{start_str}_{end_str}.md",
            mime="text/markdown",
        )

    with tab_txt:
        txt_out = generate_career_text(df_period, start_str, end_str)
        st.text_area("テキスト出力", value=txt_out, height=400)
        st.download_button(
            "テキストをダウンロード",
            data=txt_out.encode("utf-8"),
            file_name=f"career_{start_str}_{end_str}.txt",
            mime="text/plain",
        )

    with tab_data:
        st.caption(f"{len(df_period)} 件")
        cols_show = [c for c in ["date","company","project_name","attendance_type","work_hours","work_content"] if c in df_period.columns]
        st.dataframe(df_period[cols_show].sort_values("date"), use_container_width=True, hide_index=True)
