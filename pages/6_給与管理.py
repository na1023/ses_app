"""
pages/6_給与管理.py
月次給与の記録・手取り自動計算・年収サマリーを管理するページ
15日締め・当月25日払い（土曜→前日、日曜→翌日）
日報データと裏連携：稼働日数・稼働時間を自動参照
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
    ("deduction_amount",    "減額金"),
]
NON_TAXABLE_KEYS = {"transport_allowance", "expense_reimbursement", "commute_allowance"}

PLOT_BG   = "#0f1117"
PAPER_BG  = "#161b27"
GRID_COLOR= "#1e2a3a"
TEXT_COLOR= "#94a3b8"
ACCENT    = "#3b82f6"
PALETTE   = ["#3b82f6","#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899"]

ALL_FIELDS = INCOME_FIELDS + DEDUCTION_FIELDS


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
    wd = d25.weekday()
    if wd == 5:
        d25 -= timedelta(days=1)
    elif wd == 6:
        d25 += timedelta(days=1)
    return d25.strftime("%Y年%#m月%#d日") if os.name == "nt" else d25.strftime("%Y年%-m月%-d日")


def prev_ym(ym: str) -> str:
    """1ヶ月前の YYYY-MM を返す"""
    y, m = int(ym[:4]), int(ym[5:])
    m -= 1
    if m == 0:
        m = 12; y -= 1
    return f"{y}-{m:02d}"


def prev_year_ym(ym: str) -> str:
    """1年前の YYYY-MM を返す"""
    return f"{int(ym[:4]) - 1}{ym[4:]}"


def delta_str(current: int, base: int) -> tuple[str, str]:
    """差分と符号付き文字列を返す (delta_label, color)"""
    if base == 0:
        return "—", "#64748b"
    diff = current - base
    pct  = diff / base * 100
    sign = "+" if diff >= 0 else ""
    color = "#10b981" if diff >= 0 else "#ef4444"
    return f"{sign}¥{diff:,}（{sign}{pct:.1f}%）", color


def daily_summary_for_month(ym: str) -> dict:
    """日報から該当月の稼働日数・稼働時間を集計（裏連携）"""
    df = load("daily")
    if df.empty or "date" not in df.columns:
        return {"days": 0, "hours": 0.0}
    mask = df["date"].str.startswith(ym, na=False)
    df_m = df[mask]
    work_types = {"出社", "在宅", "出社+在宅", "遅刻", "早退", "遅刻+早退"}
    work_mask  = df_m["attendance_type"].isin(work_types)
    hours = pd.to_numeric(df_m.loc[work_mask, "work_hours"], errors="coerce").sum()
    return {"days": int(work_mask.sum()), "hours": float(hours)}


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


# ================================================================
# 給与フォームの共通描画（登録・編集で再利用）
# ================================================================
def salary_form_fields(form_key: str, defaults: dict = None) -> tuple[dict, dict, str, bool]:
    """支給・控除フォームを描画して (inc_vals, ded_vals, memo, submitted) を返す"""
    defaults = defaults or {}
    with st.form(form_key, clear_on_submit=False):
        st.markdown("#### 支給項目（円）")
        inc_cols = st.columns(2)
        inc_vals = {}
        for i, (key, label) in enumerate(INCOME_FIELDS):
            inc_vals[key] = inc_cols[i % 2].number_input(
                label, min_value=0, step=1000,
                value=to_int(defaults.get(key, 0)),
                key=f"{form_key}_inc_{key}",
            )

        st.markdown("#### 控除項目（円）")
        ded_cols = st.columns(2)
        ded_vals = {}
        for i, (key, label) in enumerate(DEDUCTION_FIELDS):
            ded_vals[key] = ded_cols[i % 2].number_input(
                label, min_value=0, step=100,
                value=to_int(defaults.get(key, 0)),
                key=f"{form_key}_ded_{key}",
            )

        memo = st.text_input("メモ", value=defaults.get("memo", ""), key=f"{form_key}_memo")

        preview = calc_summary({**inc_vals, **ded_vals})
        p1, p2, p3 = st.columns(3)
        p1.metric("総支給額",     f"¥{preview['income_total']:,}")
        p2.metric("控除合計",     f"¥{preview['deduction_total']:,}")
        p3.metric("手取り（概算）", f"¥{preview['take_home']:,}")

        label = "更新する" if defaults else "登録する"
        submitted = st.form_submit_button(label, use_container_width=True)

    return inc_vals, ded_vals, memo, submitted


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
    st.caption(
        f"締め日：{reg_ym[:4]}年{JP_MONTHS[int(reg_ym[5:])-1]}15日　／　支払日：{pay_date(reg_ym)}"
    )

    # 日報連携：その月の稼働サマリーをサイレント表示
    ds = daily_summary_for_month(reg_ym)
    if ds["days"] > 0:
        st.caption(f"日報参照　稼働 {ds['days']} 日 / {ds['hours']:.2f} h")

    inc_vals, ded_vals, memo, submitted = salary_form_fields("salary_form")

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
            st.warning(f"{ym_jp(reg_ym)} の給与はすでに登録されています。一覧タブから編集してください。")
        else:
            preview = calc_summary({**inc_vals, **ded_vals})
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
            # 前月・前年同月のデータを取得
            df_prev_m  = df_sal[df_sal["year_month"] == prev_ym(sel_ym)]
            df_prev_y  = df_sal[df_sal["year_month"] == prev_year_ym(sel_ym)]
            prev_m_sum = calc_summary(df_prev_m.iloc[0].to_dict()) if not df_prev_m.empty else None
            prev_y_sum = calc_summary(df_prev_y.iloc[0].to_dict()) if not df_prev_y.empty else None

            for _, row in df_month.iterrows():
                rid  = row["id"]
                s    = calc_summary(row.to_dict())
                edit_key = f"sal_edit_{rid}"
                del_key  = f"sal_del_{rid}"

                st.markdown('<div class="section-card">', unsafe_allow_html=True)
                st.markdown(f"**{ym_jp(sel_ym)}**　支払日：{pay_date(sel_ym)}")

                # 日報連携：稼働サマリーをサイレント表示
                ds = daily_summary_for_month(sel_ym)
                if ds["days"] > 0:
                    st.caption(f"日報参照　稼働 {ds['days']} 日 / {ds['hours']:.2f} h")

                # --- KPI + 前月比・前年比 ---
                c1, c2, c3, c4 = st.columns(4)
                c1.metric("総支給額",    f"¥{s['income_total']:,}")
                c2.metric("課税対象収入", f"¥{s['taxable_income']:,}")
                c3.metric("控除合計",    f"¥{s['deduction_total']:,}")
                c4.metric("手取り",      f"¥{s['take_home']:,}")

                # 前月比・前年比（手取りベース）
                comp_cols = st.columns(2)
                if prev_m_sum:
                    d_label, d_color = delta_str(s["take_home"], prev_m_sum["take_home"])
                    comp_cols[0].markdown(
                        f"<span style='font-size:0.78rem;color:#64748b;'>前月比（手取り）</span><br>"
                        f"<span style='font-size:0.92rem;font-weight:600;color:{d_color};'>{d_label}</span>",
                        unsafe_allow_html=True,
                    )
                if prev_y_sum:
                    d_label, d_color = delta_str(s["take_home"], prev_y_sum["take_home"])
                    comp_cols[1].markdown(
                        f"<span style='font-size:0.78rem;color:#64748b;'>前年同月比（手取り）</span><br>"
                        f"<span style='font-size:0.92rem;font-weight:600;color:{d_color};'>{d_label}</span>",
                        unsafe_allow_html=True,
                    )

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

                # --- 編集 / 削除ボタン ---
                btn1, btn2, _ = st.columns([1, 1, 4])
                if btn1.button("編集", key=f"sal_ebtn_{rid}"):
                    st.session_state[edit_key] = not st.session_state.get(edit_key, False)
                    st.session_state[del_key]  = False
                if btn2.button("削除", key=f"sal_dbtn_{rid}"):
                    st.session_state[del_key]  = True
                    st.session_state[edit_key] = False

                # 編集フォーム
                if st.session_state.get(edit_key):
                    st.markdown("##### 編集")
                    inc_vals, ded_vals, new_memo, upd = salary_form_fields(
                        f"sal_edit_form_{rid}", defaults=row.to_dict()
                    )
                    if upd:
                        df_sal = load("salary")
                        idx = df_sal.index[df_sal["id"] == rid]
                        if len(idx):
                            for k, v in inc_vals.items():
                                df_sal.loc[idx, k] = str(v)
                            for k, v in ded_vals.items():
                                df_sal.loc[idx, k] = str(v)
                            df_sal.loc[idx, "memo"] = new_memo
                            save("salary", df_sal)
                        st.session_state[edit_key] = False
                        st.success("更新しました。")
                        st.rerun()

                # 削除確認
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
    prev_year_str = str(int(sel_year) - 1)
    df_prev_year  = df_sal[df_sal["year_month"].str.startswith(prev_year_str)].copy()

    num_keys = [k for k, _ in ALL_FIELDS]
    for col in num_keys:
        for df in [df_year, df_prev_year]:
            if col in df.columns:
                df[col] = df[col].apply(to_int)

    def add_totals(df):
        if df.empty:
            return df
        df["income_total"]    = df[[k for k, _ in INCOME_FIELDS]].sum(axis=1)
        df["deduction_total"] = df[[k for k, _ in DEDUCTION_FIELDS]].sum(axis=1)
        df["take_home"]       = df["income_total"] - df["deduction_total"]
        df["taxable_income"]  = df[[k for k, _ in INCOME_FIELDS if k not in NON_TAXABLE_KEYS]].sum(axis=1)
        return df

    df_year      = add_totals(df_year)
    df_prev_year = add_totals(df_prev_year)

    annual_income    = int(df_year["income_total"].sum())
    annual_takehome  = int(df_year["take_home"].sum())
    annual_deduction = int(df_year["deduction_total"].sum())
    months_count     = df_year["year_month"].nunique()

    prev_annual_takehome = int(df_prev_year["take_home"].sum()) if not df_prev_year.empty else 0

    k1, k2, k3, k4 = st.columns(4)
    k1.metric("年間総支給額", f"¥{annual_income:,}")
    k2.metric("年間手取り",   f"¥{annual_takehome:,}")
    k3.metric("年間控除合計", f"¥{annual_deduction:,}")
    k4.metric("月平均手取り", f"¥{annual_takehome // months_count:,}" if months_count else "—")

    # 前年比（年間手取り）
    if prev_annual_takehome:
        d_label, d_color = delta_str(annual_takehome, prev_annual_takehome)
        st.markdown(
            f"<span style='font-size:0.82rem;color:#64748b;'>前年比（年間手取り）</span>　"
            f"<span style='font-size:0.95rem;font-weight:600;color:{d_color};'>{d_label}</span>",
            unsafe_allow_html=True,
        )

    st.markdown("---")

    months_all = [f"{sel_year}-{mo:02d}" for mo in range(1, 13)]
    chart_df = pd.DataFrame({"year_month": months_all})
    chart_df = chart_df.merge(
        df_year[["year_month", "income_total", "take_home", "deduction_total"]],
        on="year_month", how="left"
    ).fillna(0)
    chart_df["label"] = chart_df["year_month"].apply(lambda v: f"{int(v[5:])}月")

    # 前月比用に take_home を shift
    chart_df["prev_take_home"] = chart_df["take_home"].shift(1)
    chart_df["mom_pct"] = (
        (chart_df["take_home"] - chart_df["prev_take_home"])
        / chart_df["prev_take_home"].replace(0, float("nan"))
        * 100
    ).round(1)

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
    # 前月比ラベル
    valid = chart_df[chart_df["mom_pct"].notna() & (chart_df["take_home"] > 0)]
    for _, vr in valid.iterrows():
        sign  = "+" if vr["mom_pct"] >= 0 else ""
        color = "#10b981" if vr["mom_pct"] >= 0 else "#ef4444"
        fig.add_annotation(
            x=vr["label"], y=vr["take_home"],
            text=f"{sign}{vr['mom_pct']}%",
            showarrow=False,
            yshift=14,
            font=dict(size=9, color=color),
        )
    fig.update_layout(
        title=dict(text=f"{sel_year}年 月別給与推移", font=dict(color="#e2e8f0", size=14), x=0),
        paper_bgcolor=PAPER_BG, plot_bgcolor=PLOT_BG,
        font=dict(color=TEXT_COLOR, size=12),
        margin=dict(l=16, r=16, t=40, b=40),
        xaxis=dict(gridcolor=GRID_COLOR, linecolor=GRID_COLOR),
        yaxis=dict(gridcolor=GRID_COLOR, linecolor=GRID_COLOR, tickprefix="¥", tickformat=","),
        legend=dict(bgcolor="rgba(0,0,0,0)"),
        height=340, barmode="overlay",
    )
    st.plotly_chart(fig, use_container_width=True)

    # 控除内訳ドーナツ
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

    # 月別明細テーブル（前月比付き）
    st.markdown("#### 月別明細")
    disp = chart_df[chart_df["income_total"] > 0].copy()
    disp["総支給額"] = disp["income_total"].apply(lambda v: f"¥{int(v):,}")
    disp["控除合計"] = disp["deduction_total"].apply(lambda v: f"¥{int(v):,}")
    disp["手取り"]   = disp["take_home"].apply(lambda v: f"¥{int(v):,}")
    disp["支払日"]   = disp["year_month"].apply(pay_date)
    disp["前月比"]   = disp["mom_pct"].apply(
        lambda v: f"{'+'if v>=0 else ''}{v:.1f}%" if pd.notna(v) else "—"
    )
    st.dataframe(
        disp[["label","支払日","総支給額","控除合計","手取り","前月比"]].rename(columns={"label":"月"}),
        use_container_width=True, hide_index=True,
    )
