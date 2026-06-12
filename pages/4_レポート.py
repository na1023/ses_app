"""
pages/4_レポート.py
日報データを基に週報・月報を自動生成し、グラフで可視化するページ
"""

import streamlit as st
import pandas as pd
from datetime import datetime, date, timedelta
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import load, init_all
from utils.styles import THEME_CSS, render_sidebar

st.set_page_config(page_title="レポート | SES業務管理", layout="wide")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()

st.markdown(
    """
    <div class="page-header">
        <h1>レポート</h1>
        <p>日報データを基に週報・月報を自動集計・可視化します</p>
    </div>
    """,
    unsafe_allow_html=True,
)

df_raw = load("daily")

if df_raw.empty:
    st.info("日報データがありません。先に日報を登録してください。")
    st.stop()

# 型変換
df_raw["date"]       = pd.to_datetime(df_raw["date"], errors="coerce")
df_raw["work_hours"] = pd.to_numeric(df_raw["work_hours"], errors="coerce").fillna(0)
df_raw = df_raw.dropna(subset=["date"])
df_raw["year_month"] = df_raw["date"].dt.strftime("%Y-%m")
df_raw["year_week"]  = df_raw["date"].dt.strftime("%Y-W%U")
df_raw["weekday"]    = df_raw["date"].dt.day_name()

tab_monthly, tab_weekly, tab_chart = st.tabs(["月報", "週報", "グラフ"])

# ================================================================
# 月報タブ
# ================================================================
with tab_monthly:
    month_list = sorted(df_raw["year_month"].unique().tolist(), reverse=True)
    sel_month  = st.selectbox("対象月を選択", month_list, key="rep_month")

    df_m = df_raw[df_raw["year_month"] == sel_month]

    col1, col2, col3 = st.columns(3)
    total_h   = df_m["work_hours"].sum()
    work_days = df_m[df_m["attendance_type"].isin(
        ["出社", "在宅", "出社+在宅"])]["date"].nunique()
    leave_days = df_m[df_m["attendance_type"].isin(
        ["有給", "午前半休", "午後半休", "欠勤", "特別休暇"])]["date"].nunique()

    col1.metric("合計稼働時間", f"{total_h:.1f} h")
    col2.metric("稼働日数",    f"{work_days} 日")
    col3.metric("休暇日数",    f"{leave_days} 日")

    # 勤怠区分集計
    st.markdown("#### 勤怠区分別集計")
    att_summary = (
        df_m.groupby("attendance_type")["work_hours"]
        .agg(["count", "sum"])
        .rename(columns={"count": "日数", "sum": "合計時間"})
        .reset_index()
        .rename(columns={"attendance_type": "勤怠区分"})
    )
    att_summary["合計時間"] = att_summary["合計時間"].map(lambda x: f"{x:.1f} h")
    st.dataframe(att_summary, use_container_width=True, hide_index=True)

    # 業務内容まとめ
    st.markdown("#### 業務内容まとめ")
    df_m_sorted = df_m.sort_values("date")
    rows = ""
    for _, r in df_m_sorted.iterrows():
        rows += f"""
        <tr>
            <td>{r['date'].strftime('%m/%d')}</td>
            <td>{r.get('company','')}</td>
            <td>{r.get('attendance_type','')}</td>
            <td>{r.get('work_hours',0):.1f}</td>
            <td>{r.get('work_content','')}</td>
        </tr>"""
    st.markdown(
        f"""
        <div class="table-wrap">
        <table class="styled-table">
            <thead>
                <tr>
                    <th>日付</th><th>会社名</th><th>勤怠</th>
                    <th>時間(h)</th><th>業務内容</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # CSV ダウンロード
    csv_data = df_m.sort_values("date").to_csv(index=False, encoding="utf-8-sig")
    st.download_button(
        "月報 CSV をダウンロード",
        data=csv_data.encode("utf-8-sig"),
        file_name=f"monthly_report_{sel_month}.csv",
        mime="text/csv",
    )

# ================================================================
# 週報タブ
# ================================================================
with tab_weekly:
    week_list = sorted(df_raw["year_week"].unique().tolist(), reverse=True)
    sel_week  = st.selectbox("対象週を選択", week_list, key="rep_week")

    df_w = df_raw[df_raw["year_week"] == sel_week]

    wc1, wc2 = st.columns(2)
    wc1.metric("週合計稼働時間", f"{df_w['work_hours'].sum():.1f} h")
    wc2.metric("稼働日数",       f"{df_w['date'].nunique()} 日")

    st.markdown("#### 日別サマリー")
    day_summary = (
        df_w.groupby(df_w["date"].dt.strftime("%m/%d (%a)"))["work_hours"]
        .sum()
        .reset_index()
        .rename(columns={"date": "日付", "work_hours": "稼働時間 (h)"})
    )
    day_summary["稼働時間 (h)"] = day_summary["稼働時間 (h)"].map(lambda x: f"{x:.1f}")
    st.dataframe(day_summary, use_container_width=True, hide_index=True)

    st.markdown("#### 業務内容")
    df_w_sorted = df_w.sort_values("date")
    rows = ""
    for _, r in df_w_sorted.iterrows():
        rows += f"""
        <tr>
            <td>{r['date'].strftime('%m/%d (%a)')}</td>
            <td>{r.get('attendance_type','')}</td>
            <td>{r.get('work_hours',0):.1f}</td>
            <td>{r.get('work_content','')}</td>
            <td>{r.get('remarks','')}</td>
        </tr>"""
    st.markdown(
        f"""
        <div class="table-wrap">
        <table class="styled-table">
            <thead>
                <tr>
                    <th>日付</th><th>勤怠</th><th>時間(h)</th>
                    <th>業務内容</th><th>備考</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
        </div>
        """,
        unsafe_allow_html=True,
    )

    csv_data_w = df_w.sort_values("date").to_csv(index=False, encoding="utf-8-sig")
    st.download_button(
        "週報 CSV をダウンロード",
        data=csv_data_w.encode("utf-8-sig"),
        file_name=f"weekly_report_{sel_week}.csv",
        mime="text/csv",
    )

# ================================================================
# グラフタブ
# ================================================================
with tab_chart:
    st.markdown("#### 月別稼働時間推移")
    monthly_summary = (
        df_raw.groupby("year_month")["work_hours"]
        .sum()
        .reset_index()
        .sort_values("year_month")
    )
    monthly_summary.columns = ["月", "稼働時間 (h)"]
    st.bar_chart(monthly_summary.set_index("月"))

    st.markdown("#### 勤怠区分の分布（全期間）")
    att_dist = df_raw["attendance_type"].value_counts().reset_index()
    att_dist.columns = ["勤怠区分", "件数"]
    st.bar_chart(att_dist.set_index("勤怠区分"))

    st.markdown("#### 週別稼働時間推移")
    weekly_summary = (
        df_raw.groupby("year_week")["work_hours"]
        .sum()
        .reset_index()
        .sort_values("year_week")
        .tail(12)  # 直近12週
    )
    weekly_summary.columns = ["週", "稼働時間 (h)"]
    st.line_chart(weekly_summary.set_index("週"))

    st.markdown("#### 会社別稼働時間")
    company_summary = (
        df_raw.groupby("company")["work_hours"]
        .sum()
        .reset_index()
        .sort_values("work_hours", ascending=False)
    )
    company_summary.columns = ["会社名", "稼働時間 (h)"]
    st.bar_chart(company_summary.set_index("会社名"))
