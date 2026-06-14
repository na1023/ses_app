"""
pages/4_レポート.py
日報データを基に週報・月報を自動生成し、Plotlyグラフで可視化するページ
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, date, timedelta
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import load, init_all
from utils.styles import THEME_CSS, render_sidebar
from utils.ui import persist_selectbox

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

# ===== Plotly 共通テーマ =====
PLOT_BG    = "#0f1117"
PAPER_BG   = "#161b27"
GRID_COLOR = "#1e2a3a"
TEXT_COLOR = "#94a3b8"
ACCENT     = "#3b82f6"
PALETTE    = ["#3b82f6","#6366f1","#8b5cf6","#10b981","#f59e0b","#f97316","#ef4444","#64748b"]

def base_layout(title: str = "") -> dict:
    return dict(
        title=dict(text=title, font=dict(color="#e2e8f0", size=14), x=0),
        paper_bgcolor=PAPER_BG,
        plot_bgcolor=PLOT_BG,
        font=dict(color=TEXT_COLOR, size=12),
        margin=dict(l=16, r=16, t=40 if title else 16, b=40),
        xaxis=dict(gridcolor=GRID_COLOR, linecolor=GRID_COLOR, tickcolor=GRID_COLOR),
        yaxis=dict(gridcolor=GRID_COLOR, linecolor=GRID_COLOR, tickcolor=GRID_COLOR),
        legend=dict(bgcolor="rgba(0,0,0,0)", font=dict(color=TEXT_COLOR)),
    )

# ===== データ読み込み =====
df_raw = load("daily")

if df_raw.empty:
    st.info("日報データがありません。先に日報を登録してください。")
    st.stop()

df_raw["date"]       = pd.to_datetime(df_raw["date"], errors="coerce")
df_raw["work_hours"] = pd.to_numeric(df_raw["work_hours"], errors="coerce").fillna(0)
df_raw = df_raw.dropna(subset=["date"])
df_raw["year_month"] = df_raw["date"].dt.strftime("%Y-%m")
df_raw["year_week"]  = df_raw["date"].dt.strftime("%Y-W%U")

# 今月まで全月リスト生成
today = date.today()
min_ym = df_raw["year_month"].min()
all_months = []
y, m = int(min_ym[:4]), int(min_ym[5:])
while (y, m) <= (today.year, today.month):
    all_months.append(f"{y}-{m:02d}")
    m += 1
    if m > 12: m = 1; y += 1

tab_monthly, tab_weekly, tab_chart = st.tabs(["月報", "週報", "グラフ"])

# ================================================================
# 月報タブ
# ================================================================
with tab_monthly:
    sel_month = persist_selectbox("対象月を選択", list(reversed(all_months)), "rep_month")
    df_m = df_raw[df_raw["year_month"] == sel_month]

    col1, col2, col3, col4 = st.columns(4)
    total_h    = df_m["work_hours"].sum()
    work_days  = df_m[df_m["attendance_type"].isin(["出社","在宅","出社+在宅","遅刻","早退","遅刻+早退"])]["date"].nunique()
    leave_days = df_m[df_m["attendance_type"].isin(["有給","午前半休","午後半休","特別休暇","振替休日","欠勤"])]["date"].nunique()
    avg_h      = total_h / work_days if work_days > 0 else 0

    col1.metric("合計稼働時間", f"{total_h:.2f} h")
    col2.metric("稼働日数",    f"{work_days} 日")
    col3.metric("平均稼働時間/日", f"{avg_h:.2f} h")
    col4.metric("休暇日数",    f"{leave_days} 日")

    st.markdown("#### 勤怠区分別集計")
    LATE_EARLY_TYPES = {"遅刻", "早退", "遅刻+早退"}
    df_m2 = df_m.copy()
    if "late_early_time" not in df_m2.columns:
        df_m2["late_early_time"] = 0.0
    df_m2["late_early_time"] = pd.to_numeric(df_m2["late_early_time"], errors="coerce").fillna(0)
    att_grp = df_m2.groupby("attendance_type")
    att_rows = []
    for att, grp in att_grp:
        days = len(grp)
        if att in LATE_EARLY_TYPES:
            h = grp["late_early_time"].sum()
            col_label = "遅刻/早退時間計(h)"
        else:
            h = grp["work_hours"].sum()
            col_label = "合計時間(h)"
        att_rows.append({"勤怠区分": att, "日数": days, "合計時間(h)": f"{h:.2f}",
                         "備考": "遅刻/早退時間" if att in LATE_EARLY_TYPES else "稼働時間"})
    att_summary = pd.DataFrame(att_rows)
    st.dataframe(att_summary, use_container_width=True, hide_index=True)

    st.markdown("#### 業務内容まとめ")
    df_m_sorted = df_m.sort_values("date")
    rows = ""
    for _, r in df_m_sorted.iterrows():
        rows += (
            f"<tr><td>{r['date'].strftime('%m/%d')}</td>"
            f"<td>{r.get('company','')}</td>"
            f"<td>{r.get('attendance_type','')}</td>"
            f"<td style='text-align:right'>{r.get('work_hours',0):.1f}</td>"
            f"<td>{r.get('work_content','')}</td></tr>"
        )
    st.markdown(
        f"""<div class="table-wrap"><table class="styled-table">
        <thead><tr><th>日付</th><th>会社名</th><th>勤怠</th><th>時間(h)</th><th>業務内容</th></tr></thead>
        <tbody>{rows}</tbody></table></div>""",
        unsafe_allow_html=True,
    )

    csv_data = df_m.sort_values("date").to_csv(index=False, encoding="utf-8-sig")
    st.download_button("月報 CSV をダウンロード",
                       data=csv_data.encode("utf-8-sig"),
                       file_name=f"monthly_report_{sel_month}.csv",
                       mime="text/csv")

# ================================================================
# 週報タブ
# ================================================================
with tab_weekly:
    # 週キー → 「YYYY/MM/DD（月）〜 MM/DD（日）」の分かりやすいラベルを生成
    week_label_map: dict[str, str] = {}
    for wk, grp in df_raw.groupby("year_week"):
        dmin = grp["date"].min()
        monday = dmin - timedelta(days=int(dmin.weekday()))
        sunday = monday + timedelta(days=6)
        n_days = grp["date"].dt.normalize().nunique()
        week_label_map[wk] = (
            f"{monday.strftime('%Y/%m/%d')}（月）〜 {sunday.strftime('%m/%d')}（日）　[{n_days}日記録]"
        )

    week_list = sorted(df_raw["year_week"].unique().tolist(), reverse=True)
    sel_week  = persist_selectbox(
        "対象週を選択", week_list, "rep_week",
        format_func=lambda wk: week_label_map.get(wk, wk),
    )
    st.caption(f"対象期間: {week_label_map.get(sel_week, sel_week)}")
    df_w = df_raw[df_raw["year_week"] == sel_week]

    wc1, wc2, wc3 = st.columns(3)
    wc1.metric("週合計稼働時間", f"{df_w['work_hours'].sum():.2f} h")
    wc2.metric("稼働日数",       f"{df_w['date'].nunique()} 日")
    wc3.metric("平均稼働時間/日",
               f"{df_w['work_hours'].sum()/df_w['date'].nunique():.2f} h"
               if df_w['date'].nunique() > 0 else "0.00 h")

    # 週内の日別棒グラフ
    day_df = (
        df_w.groupby(df_w["date"].dt.strftime("%m/%d(%a)"))["work_hours"]
        .sum().reset_index()
        .rename(columns={"date":"日付","work_hours":"稼働時間(h)"})
        .sort_values("日付")
    )
    fig_week = go.Figure(go.Bar(
        x=day_df["日付"], y=day_df["稼働時間(h)"],
        marker_color=ACCENT, text=day_df["稼働時間(h)"].map(lambda x: f"{x:.1f}h"),
        textposition="outside", textfont=dict(color=TEXT_COLOR, size=11),
    ))
    fig_week.update_layout(**base_layout("日別稼働時間"), height=260)
    fig_week.update_yaxes(range=[0, day_df["稼働時間(h)"].max() * 1.3 + 1])
    st.plotly_chart(fig_week, use_container_width=True)

    st.markdown("#### 業務内容")
    df_w_sorted = df_w.sort_values("date")
    rows = ""
    for _, r in df_w_sorted.iterrows():
        rows += (
            f"<tr><td>{r['date'].strftime('%m/%d(%a)')}</td>"
            f"<td>{r.get('attendance_type','')}</td>"
            f"<td style='text-align:right'>{r.get('work_hours',0):.1f}</td>"
            f"<td>{r.get('work_content','')}</td>"
            f"<td>{r.get('remarks','')}</td></tr>"
        )
    st.markdown(
        f"""<div class="table-wrap"><table class="styled-table">
        <thead><tr><th>日付</th><th>勤怠</th><th>時間(h)</th><th>業務内容</th><th>備考</th></tr></thead>
        <tbody>{rows}</tbody></table></div>""",
        unsafe_allow_html=True,
    )

    csv_data_w = df_w.sort_values("date").to_csv(index=False, encoding="utf-8-sig")
    st.download_button("週報 CSV をダウンロード",
                       data=csv_data_w.encode("utf-8-sig"),
                       file_name=f"weekly_report_{sel_week}.csv",
                       mime="text/csv")

# ================================================================
# グラフタブ
# ================================================================
with tab_chart:

    # ---- 1. 月別稼働時間（折れ線 + 棒） ----
    monthly_df = (
        df_raw.groupby("year_month")["work_hours"].sum()
        .reset_index().sort_values("year_month")
        .rename(columns={"year_month":"月","work_hours":"稼働時間(h)"})
    )
    # 全月を埋める
    monthly_full = pd.DataFrame({"月": all_months})
    monthly_full = monthly_full.merge(monthly_df, on="月", how="left").fillna(0)

    fig1 = go.Figure()
    fig1.add_trace(go.Bar(
        x=monthly_full["月"], y=monthly_full["稼働時間(h)"],
        name="稼働時間", marker_color=ACCENT, opacity=0.7,
        text=monthly_full["稼働時間(h)"].map(lambda x: f"{x:.0f}h" if x > 0 else ""),
        textposition="outside", textfont=dict(color=TEXT_COLOR, size=10),
    ))
    fig1.add_trace(go.Scatter(
        x=monthly_full["月"], y=monthly_full["稼働時間(h)"],
        mode="lines+markers", name="推移",
        line=dict(color="#6366f1", width=2),
        marker=dict(color="#6366f1", size=6),
    ))
    fig1.update_layout(**base_layout("月別稼働時間推移"), height=320,
                       yaxis_title="時間 (h)", showlegend=False)
    st.plotly_chart(fig1, use_container_width=True)

    col_a, col_b = st.columns(2)

    # ---- 2. 勤怠区分の割合（ドーナツ） ----
    with col_a:
        att_dist = df_raw["attendance_type"].value_counts().reset_index()
        att_dist.columns = ["勤怠区分","件数"]
        fig2 = go.Figure(go.Pie(
            labels=att_dist["勤怠区分"], values=att_dist["件数"],
            hole=0.55,
            marker=dict(colors=PALETTE[:len(att_dist)],
                        line=dict(color=PAPER_BG, width=2)),
            textfont=dict(color="#e2e8f0", size=11),
        ))
        _lo2 = base_layout("勤怠区分の内訳（全期間）")
        _lo2.update(height=300, margin=dict(l=0, r=0, t=40, b=0))
        fig2.update_layout(**_lo2)
        st.plotly_chart(fig2, use_container_width=True)

    # ---- 3. 会社別稼働時間（横棒） ----
    with col_b:
        co_df = (
            df_raw[df_raw["company"] != ""].groupby("company")["work_hours"]
            .sum().reset_index().sort_values("work_hours")
            .rename(columns={"company":"会社名","work_hours":"稼働時間(h)"})
        )
        fig3 = go.Figure(go.Bar(
            x=co_df["稼働時間(h)"], y=co_df["会社名"],
            orientation="h",
            marker=dict(
                color=co_df["稼働時間(h)"],
                colorscale=[[0,"#1e3a5f"],[1,"#3b82f6"]],
                showscale=False,
            ),
            text=co_df["稼働時間(h)"].map(lambda x: f"{x:.0f}h"),
            textposition="outside", textfont=dict(color=TEXT_COLOR, size=11),
        ))
        fig3.update_layout(**base_layout("会社別稼働時間（全期間）"),
                           height=300, xaxis_title="時間 (h)")
        st.plotly_chart(fig3, use_container_width=True)

    # ---- 4. 直近12週の稼働時間（折れ線） ----
    weekly_df = (
        df_raw.groupby("year_week")["work_hours"].sum()
        .reset_index().sort_values("year_week").tail(12)
        .rename(columns={"year_week":"週","work_hours":"稼働時間(h)"})
    )
    fig4 = go.Figure()
    fig4.add_trace(go.Scatter(
        x=weekly_df["週"], y=weekly_df["稼働時間(h)"],
        mode="lines+markers+text",
        line=dict(color=ACCENT, width=2),
        marker=dict(color=ACCENT, size=7),
        fill="tozeroy", fillcolor="rgba(59,130,246,0.1)",
        text=weekly_df["稼働時間(h)"].map(lambda x: f"{x:.0f}h"),
        textposition="top center", textfont=dict(color=TEXT_COLOR, size=10),
    ))
    fig4.update_layout(**base_layout("直近12週の稼働時間推移"),
                       height=280, yaxis_title="時間 (h)", showlegend=False)
    st.plotly_chart(fig4, use_container_width=True)

    # ---- 5. 月別 勤怠区分の積み上げ棒 ----
    att_monthly = (
        df_raw.groupby(["year_month","attendance_type"])["work_hours"]
        .sum().reset_index()
    )
    att_types = att_monthly["attendance_type"].unique().tolist()
    fig5 = go.Figure()
    for i, att in enumerate(att_types):
        sub = att_monthly[att_monthly["attendance_type"] == att]
        sub_full = pd.DataFrame({"year_month": all_months}).merge(
            sub, on="year_month", how="left").fillna(0)
        fig5.add_trace(go.Bar(
            x=sub_full["year_month"], y=sub_full["work_hours"],
            name=att,
            marker_color=PALETTE[i % len(PALETTE)],
        ))
    fig5.update_layout(**base_layout("月別 勤怠区分別稼働時間"),
                       barmode="stack", height=320, yaxis_title="時間 (h)")
    st.plotly_chart(fig5, use_container_width=True)
