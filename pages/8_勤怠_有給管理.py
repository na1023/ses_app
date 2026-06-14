"""
pages/8_勤怠_有給管理.py
有給休暇の残日数管理と、残業時間の累積アラートを提供するページ。
- 有給：付与を登録し、日報の有給/半休消化から残数・失効予定を自動計算
- 残業：所定労働時間を超えた分を月次・年次で集計し、36協定上限に対して警告
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime, date, timedelta
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import load, save, generate_id, init_all
from utils.styles import THEME_CSS, render_sidebar, set_flash, show_flash
from utils.ui import jp_date_selector, persist_selectbox

st.set_page_config(page_title="有給・残業管理 | SES業務管理", layout="wide")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()
show_flash()

st.markdown(
    """
    <div class="page-header">
        <h1>有給・残業管理</h1>
        <p>有給休暇の残数と残業時間の累積を自動で見える化します</p>
    </div>
    """,
    unsafe_allow_html=True,
)

PLOT_BG    = "#0f1117"
PAPER_BG   = "#161b27"
GRID_COLOR = "#1e2a3a"
TEXT_COLOR = "#94a3b8"

# 有給として消化する勤怠区分と消化日数
PAID_LEAVE_CONSUME = {"有給": 1.0, "午前半休": 0.5, "午後半休": 0.5}
# 有給の有効期限（年）— 労基法は付与から2年
LEAVE_VALID_YEARS = 2


def _num(v, default=0.0):
    try:
        return float(str(v).replace(",", "").strip() or 0)
    except Exception:
        return default


def consumed_leavegdays(df_daily: pd.DataFrame) -> tuple[float, pd.DataFrame]:
    """日報から有給消化日数を集計し、(合計, 明細df) を返す"""
    if df_daily.empty or "attendance_type" not in df_daily.columns:
        return 0.0, pd.DataFrame(columns=["date", "attendance_type", "日数"])
    mask = df_daily["attendance_type"].isin(PAID_LEAVE_CONSUME.keys())
    df_c = df_daily[mask].copy()
    if df_c.empty:
        return 0.0, pd.DataFrame(columns=["date", "attendance_type", "日数"])
    df_c["日数"] = df_c["attendance_type"].map(PAID_LEAVE_CONSUME)
    total = df_c["日数"].sum()
    return float(total), df_c[["date", "attendance_type", "日数"]].sort_values("date", ascending=False)


tab_leave, tab_ot = st.tabs(["有給休暇", "残業アラート"])

# ================================================================
# 有給休暇タブ
# ================================================================
with tab_leave:
    today = date.today()
    df_grants = load("leave")
    df_daily  = load("daily")

    # --- 付与の登録 ---
    with st.expander("有給を付与登録する", expanded=df_grants.empty):
        st.caption("入社日・基準日に付与された有給日数を登録してください（年ごとに登録）。")
        st.markdown("<div style='font-size:0.82rem;color:#94a3b8;margin-bottom:0.25rem;'>付与日</div>", unsafe_allow_html=True)
        g_date = jp_date_selector("leave_grant_date", default=date(today.year, today.month, 1), year_back=5, year_fwd=1)
        with st.form("add_leave_form", clear_on_submit=True):
            gc1, gc2 = st.columns(2)
            ggdays = gc1.number_input("付与日数", min_value=0.0, max_value=40.0, step=0.5, value=10.0)
            g_memo = gc2.text_input("メモ", placeholder="例: 入社1年付与")
            add = st.form_submit_button("付与を登録する", use_container_width=True)
        if add:
            df_grants = pd.concat([df_grants, pd.DataFrame([{
                "id": generate_id(), "grant_date": g_date,
                "days": str(ggdays), "memo": g_memo,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            }])], ignore_index=True)
            save("leave", df_grants)
            set_flash("success", f"{g_date} に {ggdays} 日を付与登録しました。")
            st.rerun()

    if df_grants.empty:
        st.info("有給の付与がまだ登録されていません。上のフォームから登録してください。")
    else:
        # 有効/失効の判定
        df_g = df_grants.copy()
        df_g["gdt"] = pd.to_datetime(df_g["grant_date"], errors="coerce")
        df_g["gdays"]  = df_g["days"].apply(_num)
        df_g = df_g.dropna(subset=["gdt"])
        df_g["gexpire"] = df_g["gdt"] + pd.DateOffset(years=LEAVE_VALID_YEARS)
        df_g["gvalid"]  = df_g["gexpire"].dt.date > today

        grantedgvalid = df_g[df_g["gvalid"]]["gdays"].sum()
        granted_all   = df_g["gdays"].sum()
        consumed, df_consume = consumed_leavegdays(df_daily)
        remaining = grantedgvalid - consumed

        # --- サマリー ---
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("有効付与（合計）", f"{grantedgvalid:.1f} 日")
        c2.metric("消化済み",       f"{consumed:.1f} 日")
        rem_color = "normal" if remaining > 5 else "inverse"
        c3.metric("残日数",         f"{remaining:.1f} 日")
        c4.metric("累計付与",       f"{granted_all:.1f} 日")

        if remaining < 0:
            st.error(f"消化日数が有効付与を超えています（{remaining:.1f}日）。付与登録の漏れがないか確認してください。")
        elif remaining <= 3:
            st.warning(f"残り {remaining:.1f} 日です。計画的に取得しましょう。")

        # --- 失効予定アラート ---
        soon = df_g[df_g["gvalid"]].copy()
        soon["gdays_to_exp"] = (soon["gexpire"].dt.date.apply(lambda d: (d - today).days))
        soon_warn = soon[soon["gdays_to_exp"] <= 120].sort_values("gdays_to_exp")
        if not soon_warn.empty:
            st.markdown("##### 失効が近い付与")
            for r in soon_warn.itertuples():
                exp = r.gexpire.date()
                st.warning(
                    f"{r.grant_date} 付与の {r.gdays:.1f}日 は **{exp.strftime('%Y/%m/%d')}** に失効予定"
                    f"（あと {r.gdays_to_exp} 日）"
                )

        # --- 付与履歴 ---
        with st.expander("付与履歴・消化明細"):
            st.markdown("**付与履歴**")
            show_g = df_g.sort_values("gdt", ascending=False)
            rows = ""
            for r in show_g.itertuples():
                status = "有効" if r.gvalid else "失効"
                color  = "#10b981" if r.gvalid else "#64748b"
                rows += (
                    f"<tr><td>{r.grant_date}</td><td style='text-align:right'>{r.gdays:.1f} 日</td>"
                    f"<td>{r.gexpire.date().strftime('%Y/%m/%d')}</td>"
                    f"<td style='color:{color}'>{status}</td><td>{r.memo}</td>"
                    f"<td><code>{r.id[:8]}</code></td></tr>"
                )
            st.markdown(
                f"""<div class="table-wrap"><table class="styled-table">
                <thead><tr><th>付与日</th><th>日数</th><th>失効予定</th><th>状態</th><th>メモ</th><th>ID</th></tr></thead>
                <tbody>{rows}</tbody></table></div>""",
                unsafe_allow_html=True,
            )
            # 削除
            del_id = st.selectbox(
                "付与を削除", ["—"] + df_g["id"].tolist(),
                format_func=lambda x: "—" if x == "—" else
                    f"{df_g[df_g['id']==x]['grant_date'].iloc[0]} / {df_g[df_g['id']==x]['gdays'].iloc[0]:.1f}日",
                key="leave_del_sel",
            )
            if del_id != "—" and st.button("選択した付与を削除", key="leave_del_btn"):
                df_grants2 = load("leave")
                df_grants2 = df_grants2[df_grants2["id"] != del_id].reset_index(drop=True)
                save("leave", df_grants2)
                set_flash("success", "付与を削除しました。")
                st.rerun()

            st.markdown("**消化明細（有給・半休）**")
            if df_consume.empty:
                st.caption("消化はまだありません。")
            else:
                st.dataframe(
                    df_consume.rename(columns={"date": "日付", "attendance_type": "区分"}),
                    use_container_width=True, hide_index=True,
                )

# ================================================================
# 残業アラートタブ
# ================================================================
with tab_ot:
    df_daily = load("daily")
    if df_daily.empty:
        st.info("日報データがありません。先に日報を登録してください。")
        st.stop()

    std_hours = st.number_input(
        "所定労働時間（1日あたり・h）", min_value=1.0, max_value=12.0, step=0.5, value=8.0,
        help="この時間を超えた分を残業として集計します。",
    )

    LIMIT_MONTH = 45.0   # 36協定 原則上限/月
    LIMIT_YEAR  = 360.0  # 36協定 原則上限/年

    df = df_daily.copy()
    df["_date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["_date"])
    df["_wh"] = pd.to_numeric(df["work_hours"], errors="coerce").fillna(0)
    df["_ot"] = (df["_wh"] - std_hours).clip(lower=0)
    df["_ym"] = df["_date"].dt.strftime("%Y-%m")
    df["_year"] = df["_date"].dt.strftime("%Y")

    # データの最古年〜今年までを連続生成（データが無い年も選べるよう自動更新）
    this_year = date.today().year
    data_years = [int(y) for y in df["_year"].dropna().unique().tolist()]
    min_year = min(data_years) if data_years else this_year
    max_year = max([this_year] + data_years)
    years = [str(y) for y in range(max_year, min_year - 1, -1)]
    sel_year = persist_selectbox("対象年", years, "ot_year", format_func=lambda y: f"{y}年")
    df_y = df[df["_year"] == sel_year]

    # 今月の残業
    this_month = date.today().strftime("%Y-%m")
    ot_this_month = df[df["_ym"] == this_month]["_ot"].sum()
    ot_year_total = df_y["_ot"].sum()

    def level(value, limit):
        r = value / limit if limit else 0
        if r >= 1.0:   return "#ef4444", "上限超過"
        if r >= 0.8:   return "#f59e0b", "上限に接近"
        return "#10b981", "余裕あり"

    mcol1, mcol2, mcol3 = st.columns(3)
    c_color, c_label = level(ot_this_month, LIMIT_MONTH)
    mcol1.metric("今月の残業", f"{ot_this_month:.1f} h", help=f"月上限 {LIMIT_MONTH:.0f}h")
    mcol1.markdown(f"<span style='color:{c_color};font-weight:600;font-size:0.82rem;'>{c_label}（上限 {LIMIT_MONTH:.0f}h）</span>", unsafe_allow_html=True)
    y_color, y_label = level(ot_year_total, LIMIT_YEAR)
    mcol2.metric(f"{sel_year}年の残業累計", f"{ot_year_total:.1f} h", help=f"年上限 {LIMIT_YEAR:.0f}h")
    mcol2.markdown(f"<span style='color:{y_color};font-weight:600;font-size:0.82rem;'>{y_label}（上限 {LIMIT_YEAR:.0f}h）</span>", unsafe_allow_html=True)
    avg_ot = ot_year_total / max(1, df_y["_ym"].nunique())
    mcol3.metric("月平均残業", f"{avg_ot:.1f} h")

    # アラート
    if ot_this_month >= LIMIT_MONTH:
        st.error(f"今月の残業が月上限 {LIMIT_MONTH:.0f}h を超えています（{ot_this_month:.1f}h）。直ちに調整が必要です。")
    elif ot_this_month >= LIMIT_MONTH * 0.8:
        st.warning(f"今月の残業が上限の8割（{LIMIT_MONTH*0.8:.0f}h）を超えています（{ot_this_month:.1f}h）。")
    if ot_year_total >= LIMIT_YEAR:
        st.error(f"{sel_year}年の残業累計が年上限 {LIMIT_YEAR:.0f}h を超えています（{ot_year_total:.1f}h）。")
    elif ot_year_total >= LIMIT_YEAR * 0.8:
        st.warning(f"{sel_year}年の残業累計が上限の8割（{LIMIT_YEAR*0.8:.0f}h）を超えています（{ot_year_total:.1f}h）。")

    st.markdown("---")

    # 月別残業の棒グラフ（上限45hの基準線）
    months_all = [f"{sel_year}-{m:02d}" for m in range(1, 13)]
    by_month = df_y.groupby("_ym")["_ot"].sum().reindex(months_all).fillna(0)
    labels = [f"{int(m[5:])}月" for m in months_all]
    bar_colors = ["#ef4444" if v >= LIMIT_MONTH else ("#f59e0b" if v >= LIMIT_MONTH*0.8 else "#3b82f6")
                  for v in by_month.values]

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=labels, y=by_month.values, marker_color=bar_colors,
        text=[f"{v:.1f}h" if v > 0 else "" for v in by_month.values],
        textposition="outside", textfont=dict(size=9, color=TEXT_COLOR),
        name="残業",
    ))
    fig.add_hline(y=LIMIT_MONTH, line_dash="dash", line_color="#ef4444",
                  annotation_text="月上限 45h", annotation_font_color="#ef4444")
    fig.update_layout(
        title=dict(text=f"{sel_year}年 月別残業時間", font=dict(color="#e2e8f0", size=14), x=0),
        paper_bgcolor=PAPER_BG, plot_bgcolor=PLOT_BG,
        font=dict(color=TEXT_COLOR, size=12),
        margin=dict(l=16, r=16, t=40, b=40),
        xaxis=dict(gridcolor=GRID_COLOR, linecolor=GRID_COLOR),
        yaxis=dict(gridcolor=GRID_COLOR, linecolor=GRID_COLOR, ticksuffix="h"),
        height=340, showlegend=False,
    )
    st.plotly_chart(fig, use_container_width=True)

    # 累計推移（年上限360hの基準線）
    cum = by_month.cumsum()
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(
        x=labels, y=cum.values, mode="lines+markers",
        line=dict(color="#f59e0b", width=2), marker=dict(size=6),
        name="残業累計",
    ))
    fig2.add_hline(y=LIMIT_YEAR, line_dash="dash", line_color="#ef4444",
                   annotation_text="年上限 360h", annotation_font_color="#ef4444")
    fig2.update_layout(
        title=dict(text=f"{sel_year}年 残業累計推移", font=dict(color="#e2e8f0", size=14), x=0),
        paper_bgcolor=PAPER_BG, plot_bgcolor=PLOT_BG,
        font=dict(color=TEXT_COLOR, size=12),
        margin=dict(l=16, r=16, t=40, b=40),
        xaxis=dict(gridcolor=GRID_COLOR, linecolor=GRID_COLOR),
        yaxis=dict(gridcolor=GRID_COLOR, linecolor=GRID_COLOR, ticksuffix="h"),
        height=300, showlegend=False,
    )
    st.plotly_chart(fig2, use_container_width=True)
    st.caption("※ 残業 = 各日の実働時間 − 所定労働時間（マイナスは0扱い）。上限は36協定の原則値（月45h/年360h）を基準に表示しています。")
