"""
app.py
SES業務管理アプリケーション - エントリーポイント
起動時にデータ初期化・自動バックアップを実行し、ダッシュボードを表示する
"""

import streamlit as st
import pandas as pd
from datetime import datetime, date
import sys, os

# パス解決
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.data_manager import init_all, backup_data, load
from utils.styles import THEME_CSS, status_badge, render_sidebar

# ===== ページ設定 =====
st.set_page_config(
    page_title="SES業務管理",
    page_icon=None,
    layout="wide",
    initial_sidebar_state="expanded",
)
st.markdown(THEME_CSS, unsafe_allow_html=True)

# ===== 初期化（初回のみ） =====
if "initialized" not in st.session_state:
    init_all()
    backup_path = backup_data()
    st.session_state["initialized"] = True
    st.session_state["backup_path"] = backup_path

# ===== サイドバー =====
render_sidebar()

# ===== ダッシュボード =====
st.markdown(
    """
    <div class="page-header">
        <h1>ダッシュボード</h1>
        <p>今月のサマリーと未完了タスクを確認できます</p>
    </div>
    """,
    unsafe_allow_html=True,
)

# --- データ読み込み ---
df_daily      = load("daily")
df_interviews = load("interviews")
df_todos      = load("todos")
df_projects   = load("projects")

today      = date.today()
this_month = today.strftime("%Y-%m")

# --- 今月の稼働時間合計 ---
monthly_hours = 0.0
if not df_daily.empty and "date" in df_daily.columns:
    mask = df_daily["date"].str.startswith(this_month, na=False)
    hours_col = pd.to_numeric(df_daily.loc[mask, "work_hours"], errors="coerce")
    monthly_hours = hours_col.sum()

# --- 今月の面談件数 ---
monthly_interviews = 0
if not df_interviews.empty and "interview_date" in df_interviews.columns:
    mask = df_interviews["interview_date"].str.startswith(this_month, na=False)
    monthly_interviews = int(mask.sum())

# --- 未完了 ToDo ---
open_todos = 0
if not df_todos.empty and "progress" in df_todos.columns:
    open_todos = int((df_todos["progress"] != "完了").sum())

# ===== KPI カード =====
col1, col2, col3, col4 = st.columns(4)

with col1:
    st.markdown(
        f"""
        <div class="kpi-card">
            <div class="kpi-label">今月の稼働時間</div>
            <div class="kpi-value">{monthly_hours:.2f}<span class="kpi-unit">h</span></div>
        </div>
        """,
        unsafe_allow_html=True,
    )
with col2:
    st.markdown(
        f"""
        <div class="kpi-card">
            <div class="kpi-label">今月の面談件数</div>
            <div class="kpi-value">{monthly_interviews}<span class="kpi-unit">件</span></div>
        </div>
        """,
        unsafe_allow_html=True,
    )
with col3:
    st.markdown(
        f"""
        <div class="kpi-card">
            <div class="kpi-label">未完了 ToDo</div>
            <div class="kpi-value">{open_todos}<span class="kpi-unit">件</span></div>
        </div>
        """,
        unsafe_allow_html=True,
    )
with col4:
    st.markdown(
        f"""
        <div class="kpi-card">
            <div class="kpi-label">登録案件数</div>
            <div class="kpi-value">{len(df_projects)}<span class="kpi-unit">件</span></div>
        </div>
        """,
        unsafe_allow_html=True,
    )

st.markdown("<br>", unsafe_allow_html=True)

# ===== 下段 2カラム =====
left, right = st.columns([1, 1], gap="medium")

# --- 直近日報 ---
with left:
    st.markdown("#### 直近の日報（5件）")
    if df_daily.empty:
        st.info("日報がまだ登録されていません。")
    else:
        recent = df_daily.sort_values("date", ascending=False).head(5)
        rows = ""
        for _, r in recent.iterrows():
            try:
                wh = f"{float(r.get('work_hours', 0)):.2f}"
            except (ValueError, TypeError):
                wh = r.get('work_hours', '')
            rows += f"""
            <tr>
                <td>{r.get('date','')}</td>
                <td>{r.get('company','')}</td>
                <td>{r.get('attendance_type','')}</td>
                <td>{wh}</td>
            </tr>"""
        st.markdown(
            f"""
            <div class="table-wrap">
            <table class="styled-table">
                <thead><tr><th>日付</th><th>会社</th><th>勤怠</th><th>時間</th></tr></thead>
                <tbody>{rows}</tbody>
            </table>
            </div>
            """,
            unsafe_allow_html=True,
        )

# --- 未完了 ToDo 一覧 ---
with right:
    st.markdown("#### 未完了 ToDo")
    if df_todos.empty or open_todos == 0:
        st.success("すべての ToDo が完了しています！")
    else:
        pending = df_todos[df_todos["progress"] != "完了"].head(8)
        rows = ""
        for _, r in pending.iterrows():
            badge = status_badge(r.get("progress", ""))
            rows += f"""
            <tr>
                <td>{r.get('due_date','')}</td>
                <td>{r.get('task','')}</td>
                <td>{badge}</td>
            </tr>"""
        st.markdown(
            f"""
            <div class="table-wrap">
            <table class="styled-table">
                <thead><tr><th>期限</th><th>タスク</th><th>状態</th></tr></thead>
                <tbody>{rows}</tbody>
            </table>
            </div>
            """,
            unsafe_allow_html=True,
        )

# --- 最近の面談 ---
st.markdown("#### 直近の面談（5件）")
if df_interviews.empty:
    st.info("面談がまだ登録されていません。")
else:
    recent_iv = df_interviews.sort_values("interview_date", ascending=False).head(5)
    rows = ""
    for _, r in recent_iv.iterrows():
        badge = status_badge(r.get("status", ""))
        rows += f"""
        <tr>
            <td>{r.get('interview_date','')}</td>
            <td>{r.get('company','')}</td>
            <td>{r.get('project_name','')}</td>
            <td>{badge}</td>
        </tr>"""
    st.markdown(
        f"""
        <div class="table-wrap">
        <table class="styled-table">
            <thead><tr><th>日付</th><th>会社名</th><th>案件名</th><th>ステータス</th></tr></thead>
            <tbody>{rows}</tbody>
        </table>
        </div>
        """,
        unsafe_allow_html=True,
    )
