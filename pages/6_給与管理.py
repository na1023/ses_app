"""
pages/6_給与管理.py
月次給与の記録・手取り自動計算・年収サマリーを管理するページ
15日締め・当月25日払い（土曜→前日、日曜→翌日）
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime, date, timedelta
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import load, save, generate_id, init_all
from utils.styles import THEME_CSS, render_sidebar

st.set_page_config(page_title="給与管理 | SES業務管理", layout="wide")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()

st.markdown(
    """
    <div class="page-header">
        <h1>給与管理</h1>
        <p>月次給与の記録・手取り自動計算・年収サマリー（15日締め・当月25日払い）</p>
    </div>
    """,
    unsafe_allow_html=True,
)

# ---- 項目定義 ----
INCOME_FIELDS = [
    ("basic_salary",            "基本給"),
    ("skill_allowance",         "職能手当"),
    ("qualification_allowance", "資格手当"),
    ("commute_allowance",       "通勤手当"),
    ("transport_allowance",     "交通費及び立替経費"),
    ("expense_reimbursement",   "通勤交通費"),
    ("overtime_pay",            "普通残業"),
    ("other_expense",           "その他経費"),
]
DEDUCTION_FIELDS = [
    ("health_insurance",    "健康保険料"),
    ("nursing_insurance",   "介護保険料"),
    ("pension",             "厚生年金保険"),
    ("employment_insurance","雇用保険料"),
    ("income_tax",          "所得税"),
    ("resident_tax",        "住民税"),
]
NON_TAXABLE_KEYS = {"transport_allowance", "expense_reimbursement", "commute_allowance"}

PLOT_BG   = "#0f1117"
PAPER_BG  = "#161b27"
GRID_COLOR= "#1e2a3a"
TEXT_COLOR= "#94a3b8"
ACCENT    = "#3b82f6"
PALETTE   = ["#3b82f6","#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6"]


def to_int(v) -> int:
    try:
        return int(str(v).replace(",", "").strip() or 0)
    except Exception:
        return 0


def calc_summary(row: dict) -> dict:
    income_total    = sum(to_int(row.get(k, 0)) for k, _ in INCOME_FIELDS)
    taxable_income  = sum(to_int(row.get(k, 0)) for k, _ in INCOME_FIELDS if k not in NON_TAXABLE_KEYS)
    transport_total = sum(to_int(row.get(k, 0)) for k in NON_TAXABLE_KEYS)
    deduction_total = sum(to_int(row.get(k, 0)) for k, _ in DEDUCTION_FIELDS)
    take_home       = income_total - deduction_total
    return {
        "income_total":    income_total,
        "taxable_income":  taxable_income,
        "transport_total": transport_total,
        "deduction_total": deduction_total,
        "take_home":       take_home,
    }


def pay_date(ym: str) -> str:
    """15日締め・当月25日払い。土曜→前日(金)、日曜→翌日(月)"""
    y, m = int(ym[:4]), int(ym[5:])
    d25 = date(y, m, 25)
    wd = d25.weekday()  # 0=月 … 5=土 6=日
    if wd == 5:
        d25 -= timedelta(days=1)
    elif wd == 6:
        d25 += timedelta(days=1)
    return d25.strftime("%Y年%-m月%-d日") if os.name != "nt" else d25.strftime("%Y年%#m月%#d日")


# ---- 月セレクト用ユーティリティ ----
today = date.today()
JP_MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"]

all_ym = []
y, m = today.year - 1, 1
while (y, m) <= (today.year, today.month):
    all_ym.append(f"{y}-{m:02d}")
    m += 1
    if m > 12: m = 1; y += 1

def ym_jp(ym): return f"{ym[:4]}年{JP_MONTHS[int(ym[5:])-1]}"

tab_reg, tab_list, tab_summary = st.tabs(["給与を登録", "月別一覧", "年収サマリー"])

# ================================================================
# 登録タブ
# ================================================================
with tab_reg:
    reg_ym = st.selectbox(
        "対象月",
        list(reversed(all_ym)),
        format_func=ym_jp,
        key="sal_ym",
    )
    # 締め日・支払日の案内
    st.caption(f"締め日：{reg_ym[:4]}年{JP_MONTHS[int(reg_ym[5:])-1]}15日　／　支払日：{pay_date(reg_ym)}")

    with st.form("salary_form", clear_on_submit=False):
        st.markdown("#### 支給項目（円）")
        inc_cols = st.columns(2)
        inc_vals = {}
        for i, (key, label) in enumerate(INCOME_FIELDS):
            inc_vals[key] = inc_cols[i % 2].number_input(label, min_value=0, step=1000, key=f"inc_{key}")

        st.markdown("#### 控除項目（円）")
        ded_cols = st.columns(2)
        ded_vals = {}
        for i, (key, label) in enumerate(DEDUCTION_FIELDS):
            ded_vals[key] = ded_cols[i % 2].number_input(label, min_value=0, step=100, key=f"ded_{key}")

        memo = st.text_input("メモ")

        preview = calc_summary({**inc_vals, **ded_vals})
        p1, p2, p3 = st.columns(3)
        p1.metric("総支給額", f"¥{preview['income_total']:,}")
        p2.metric("控除合計", f"¥{preview['deduction_total']:,}")
        p3.metric("手取り（概算）", f"¥{preview['take_home']:,}")

        submitted = st.form_submit_button("登録する", use_container_width=True)

    if submitted:
        row = {
            "id":         generate_id(),
            "year_month": reg_ym,
            "memo":       memo,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            **{k: str(v) for k, v in inc_vals.items()},
            **{k: str(v) for k, v in ded_vals.items()},
        }
        df_sal = load("salary")
        dup = df_sal[df_sal["year_month"] == reg_ym]
        if not dup.empty:
            st.warning(f"{ym_jp(reg_ym)} の給与はすでに登録されています。一覧タブから確認・削除してください。")
        else:
            df_sal = pd.concat([df_sal, pd.DataFrame([row])], ignore_index=True)
            save("salary", df_sal)
            st.success(f"{ym_jp(reg_ym)} の給与を登録しました。手取り: ¥{preview['take_home']:,}")
            st.rerun()

# ================================================================
# 月別一覧タブ
# ================================================================
with tab_list:
    df_sal = load("salary")
    if df_sal.empty:
        st.info("給与データがまだ登録されていません。")
    else:
        sel_ym = st.selectbox(
            "表示月",
            list(reversed(all_ym)),
            format_func=ym_jp,
            key="sal_list_ym",
        )
        df_month = df_sal[df_sal["year_month"] == sel_ym].reset_index(drop=True)
        if df_month.empty:
            st.info(f"{ym_jp(sel_ym)} のデータはありません。")
        else:
            for _, row in df_month.iterrows():
                rid = row["id"]
                s = calc_summary(row)
                st.markdown('<div class="section-card">', unsafe_allow_html=True)
                st.markdown(f"**{ym_jp(sel_ym)}**　支払日：{pay_date(sel_ym)}")

                c1, c2, c3, c4 = st.columns(4)
                c1.metric("総支給額",    f"¥{s['income_total']:,}")
                c2.metric("課税対象収入", f"¥{s['taxable_income']:,}")
                c3.metric("控除合計",    f"¥{s['deduction_total']:,}")
                c4.metric("手取り",      f"¥{s['take_home']:,}")

                with st.expander("詳細を表示"):
                    dc1, dc2 = st.columns(2)
                    dc1.markdown("**支給項目**")
                    for key, label in INCOME_FIELDS:
                        v = to_int(row.get(key, 0))
                        if v: dc1.caption(f"{label}：¥{v:,}")
                    dc2.markdown("**控除項目**")
                    for key, label in DEDUCTION_FIELDS:
                        v = to_int(row.get(key, 0))
                        if v: dc2.caption(f"{label}：¥{v:,}")
                    if row.get("memo"):
                        st.caption(f"メモ：{row['memo']}")

                del_key = f"sal_del_{rid}"
                if st.button("削除", key=f"sal_dbtn_{rid}"):
                    st.session_state[del_key] = True
                if st.session_state.get(del_key):
                    st.warning("このデータを削除しますか？")
                    cc1, cc2, _ = st.columns([1, 1, 4])
                    if cc1.button("削除する", key=f"sal_del_ok_{rid}"):
                        df_sal = load("salary")
                        df_sal = df_sal[df_sal["id"] != rid].reset_index(drop=True)
                        save("salary", df_sal)
                        st.session_state[del_key] = False
                        st.success("削除しました。")
                        st.rerun()
                    if cc2.button("やめる", key=f"sal_del_no_{rid}"):
                        st.session_state[del_key] = False
                        st.rerun()
                st.markdown("</div>", unsafe_allow_html=True)

# ================================================================
# 年収サマリータブ
# ================================================================
with tab_summary:
    df_sal = load("salary")
    if df_sal.empty:
        st.info("給与データがまだ登録されていません。")
        st.stop()

    years_available = sorted(df_sal["year_month"].str[:4].unique().tolist(), reverse=True)
    sel_year = st.selectbox("対象年", years_available, format_func=lambda y: f"{y}年", key="sal_year")
    df_year = df_sal[df_sal["year_month"].str.startswith(sel_year)].copy()

    num_cols = [k for k, _ in INCOME_FIELDS + DEDUCTION_FIELDS]
    for col in num_cols:
        if col in df_year.columns:
            df_year[col] = df_year[col].apply(to_int)

    df_year["income_total"]    = df_year[[k for k, _ in INCOME_FIELDS]].sum(axis=1)
    df_year["deduction_total"] = df_year[[k for k, _ in DEDUCTION_FIELDS]].sum(axis=1)
    df_year["take_home"]       = df_year["income_total"] - df_year["deduction_total"]
    df_year["taxable_income"]  = df_year[[k for k, _ in INCOME_FIELDS if k not in NON_TAXABLE_KEYS]].sum(axis=1)

    annual_income    = int(df_year["income_total"].sum())
    annual_takehome  = int(df_year["take_home"].sum())
    annual_deduction = int(df_year["deduction_total"].sum())
    months_count     = df_year["year_month"].nunique()

    k1, k2, k3, k4 = st.columns(4)
    k1.metric("年間総支給額", f"¥{annual_income:,}")
    k2.metric("年間手取り",   f"¥{annual_takehome:,}")
    k3.metric("年間控除合計", f"¥{annual_deduction:,}")
    k4.metric("月平均手取り", f"¥{annual_takehome // months_count:,}" if months_count else "—")

    st.markdown("---")

    months_all = [f"{sel_year}-{m:02d}" for m in range(1, 13)]
    chart_df = pd.DataFrame({"year_month": months_all})
    chart_df = chart_df.merge(
        df_year[["year_month", "income_total", "take_home", "deduction_total"]],
        on="year_month", how="left"
    ).fillna(0)
    chart_df["label"] = chart_df["year_month"].apply(lambda v: f"{int(v[5:])}月")

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=chart_df["label"], y=chart_df["income_total"],
        name="総支給額", marker_color=ACCENT, opacity=0.6,
        text=chart_df["income_total"].apply(lambda v: f"¥{int(v):,}" if v > 0 else ""),
        textposition="outside", textfont=dict(size=9, color=TEXT_COLOR),
    ))
    fig.add_trace(go.Scatter(
        x=chart_df["label"], y=chart_df["take_home"],
        name="手取り", mode="lines+markers",
        line=dict(color="#10b981", width=2),
        marker=dict(color="#10b981", size=7),
    ))
    fig.update_layout(
        title=dict(text=f"{sel_year}年 月別給与推移", font=dict(color="#e2e8f0", size=14), x=0),
        paper_bgcolor=PAPER_BG, plot_bgcolor=PLOT_BG,
        font=dict(color=TEXT_COLOR, size=12),
        margin=dict(l=16, r=16, t=40, b=40),
        xaxis=dict(gridcolor=GRID_COLOR, linecolor=GRID_COLOR),
        yaxis=dict(gridcolor=GRID_COLOR, linecolor=GRID_COLOR, tickprefix="¥", tickformat=","),
        legend=dict(bgcolor="rgba(0,0,0,0)"),
        height=320, barmode="overlay",
    )
    st.plotly_chart(fig, use_container_width=True)

    st.markdown("#### 控除内訳（年間合計）")
    ded_totals = {label: int(df_year[key].sum()) for key, label in DEDUCTION_FIELDS if key in df_year.columns}
    ded_totals = {k: v for k, v in ded_totals.items() if v > 0}
    if ded_totals:
        fig2 = go.Figure(go.Pie(
            labels=list(ded_totals.keys()),
            values=list(ded_totals.values()),
            hole=0.55,
            marker=dict(colors=PALETTE, line=dict(color=PAPER_BG, width=2)),
            textfont=dict(color="#e2e8f0", size=11),
        ))
        fig2.update_layout(
            paper_bgcolor=PAPER_BG, plot_bgcolor=PLOT_BG,
            font=dict(color=TEXT_COLOR),
            margin=dict(l=16, r=16, t=16, b=16),
            legend=dict(bgcolor="rgba(0,0,0,0)"),
            height=280,
        )
        st.plotly_chart(fig2, use_container_width=True)

    st.markdown("#### 月別明細")
    disp = chart_df[chart_df["income_total"] > 0].copy()
    disp["総支給額"] = disp["income_total"].apply(lambda v: f"¥{int(v):,}")
    disp["控除合計"] = disp["deduction_total"].apply(lambda v: f"¥{int(v):,}")
    disp["手取り"]   = disp["take_home"].apply(lambda v: f"¥{int(v):,}")
    disp["支払日"]   = disp["year_month"].apply(pay_date)
    st.dataframe(
        disp[["label","支払日","総支給額","控除合計","手取り"]].rename(columns={"label":"月"}),
        use_container_width=True, hide_index=True,
    )
