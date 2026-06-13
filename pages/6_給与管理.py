"""
pages/6_給与管理.py
月次給与・賞与の記録・手取り自動計算・年収サマリー
- 15日締め・当月25日払い（土曜→前日、日曜→翌日）
- 過不足税額：プラス=還付（手取り増）、マイナス=追徴（手取り減）
- 賞与：同月に給与と別エントリで登録可
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
        <p>月次給与・賞与の記録・手取り自動計算（15日締め・当月25日払い）</p>
    </div>
    """,
    unsafe_allow_html=True,
)

# ================================================================
# 定数
# ================================================================
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
# 賞与で使う控除（社保3種＋所得税）
BONUS_DEDUCTION_FIELDS = [
    ("health_insurance",    "健康保険料"),
    ("nursing_insurance",   "介護保険料"),
    ("pension",             "厚生年金保険"),
    ("employment_insurance","雇用保険料"),
    ("income_tax",          "所得税"),
]
NON_TAXABLE_KEYS = {"transport_allowance", "expense_reimbursement", "commute_allowance"}

PLOT_BG    = "#0f1117"
PAPER_BG   = "#161b27"
GRID_COLOR = "#1e2a3a"
TEXT_COLOR  = "#94a3b8"
ACCENT      = "#3b82f6"
BONUS_COLOR = "#f59e0b"
PALETTE     = ["#3b82f6","#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899"]

JP_MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"]


# ================================================================
# ユーティリティ
# ================================================================
def to_int(v) -> int:
    """符号付き整数へ変換（カンマ・空白除去）"""
    try:
        return int(str(v).replace(",", "").strip() or 0)
    except Exception:
        return 0


def calc_summary(row: dict) -> dict:
    income_total    = sum(to_int(row.get(k, 0)) for k, _ in INCOME_FIELDS)
    taxable_income  = sum(to_int(row.get(k, 0)) for k, _ in INCOME_FIELDS if k not in NON_TAXABLE_KEYS)
    transport_total = sum(to_int(row.get(k, 0)) for k in NON_TAXABLE_KEYS)
    deduction_total = sum(to_int(row.get(k, 0)) for k, _ in DEDUCTION_FIELDS)
    tax_adj         = to_int(row.get("tax_adjustment", 0))   # +還付 / -追徴
    take_home       = taxable_income - deduction_total + tax_adj
    return {
        "income_total":    income_total,
        "taxable_income":  taxable_income,
        "transport_total": transport_total,
        "deduction_total": deduction_total,
        "tax_adjustment":  tax_adj,
        "take_home":       take_home,
    }


def calc_bonus_summary(row: dict) -> dict:
    gross     = to_int(row.get("basic_salary", 0))
    deduction = sum(to_int(row.get(k, 0)) for k, _ in BONUS_DEDUCTION_FIELDS)
    take_home = gross - deduction
    return {"gross": gross, "deduction": deduction, "take_home": take_home}


def pay_date(ym: str) -> str:
    y, m = int(ym[:4]), int(ym[5:])
    d25 = date(y, m, 25)
    wd  = d25.weekday()
    if wd == 5: d25 -= timedelta(days=1)
    elif wd == 6: d25 += timedelta(days=1)
    return d25.strftime("%Y年%#m月%#d日") if os.name == "nt" else d25.strftime("%Y年%-m月%-d日")


def prev_ym(ym: str) -> str:
    y, m = int(ym[:4]), int(ym[5:])
    m -= 1
    if m == 0: m = 12; y -= 1
    return f"{y}-{m:02d}"


def prev_year_ym(ym: str) -> str:
    return f"{int(ym[:4]) - 1}{ym[4:]}"


def fmt_delta(cur: int, base: int) -> tuple[str, str]:
    if base == 0:
        return "—", "#64748b"
    diff  = cur - base
    pct   = diff / base * 100
    sign  = "+" if diff >= 0 else ""
    color = "#10b981" if diff >= 0 else "#ef4444"
    return f"{sign}{pct:.1f}%", color


def daily_summary_for_month(ym: str) -> dict:
    df = load("daily")
    if df.empty or "date" not in df.columns:
        return {"days": 0, "hours": 0.0}
    mask      = df["date"].str.startswith(ym, na=False)
    df_m      = df[mask]
    work_types = {"出社", "在宅", "出社+在宅", "遅刻", "早退", "遅刻+早退"}
    work_mask  = df_m["attendance_type"].isin(work_types)
    hours      = pd.to_numeric(df_m.loc[work_mask, "work_hours"], errors="coerce").sum()
    return {"days": int(work_mask.sum()), "hours": float(hours)}


def ym_jp(ym): return f"{ym[:4]}年{JP_MONTHS[int(ym[5:])-1]}"


# 月リスト生成
today = date.today()
all_ym = []
y, m = today.year - 1, 1
while (y, m) <= (today.year, today.month):
    all_ym.append(f"{y}-{m:02d}")
    m += 1
    if m > 12: m = 1; y += 1


# ================================================================
# 比較テーブル描画（全項目の前月比・前年同月比）
# ================================================================
def render_comparison_table(row: dict, prev_m_row: dict, prev_y_row: dict, is_bonus: bool = False):
    inc_fields = [("basic_salary", "賞与額")] if is_bonus else INCOME_FIELDS
    ded_fields = BONUS_DEDUCTION_FIELDS if is_bonus else DEDUCTION_FIELDS

    has_pm = bool(prev_m_row)
    has_py = bool(prev_y_row)

    pm_inc = sum(to_int(prev_m_row.get(k,0)) for k,_ in inc_fields) if has_pm else 0
    py_inc = sum(to_int(prev_y_row.get(k,0)) for k,_ in inc_fields) if has_py else 0
    pm_ded = sum(to_int(prev_m_row.get(k,0)) for k,_ in ded_fields) if has_pm else 0
    py_ded = sum(to_int(prev_y_row.get(k,0)) for k,_ in ded_fields) if has_py else 0
    pm_adj = to_int(prev_m_row.get("tax_adjustment", 0)) if has_pm else 0
    py_adj = to_int(prev_y_row.get("tax_adjustment", 0)) if has_py else 0

    cur_inc = sum(to_int(row.get(k,0)) for k,_ in inc_fields)
    cur_ded = sum(to_int(row.get(k,0)) for k,_ in ded_fields)
    cur_adj = to_int(row.get("tax_adjustment", 0))
    cur_take = cur_inc - cur_ded + cur_adj

    summary_rows = [
        ("【総支給額】",  cur_inc,  pm_inc,  py_inc,  True),
        ("【控除合計】",  cur_ded,  pm_ded,  py_ded,  True),
        ("【手取り】",    cur_take, pm_inc - pm_ded + pm_adj, py_inc - py_ded + py_adj, True),
    ]

    detail_rows = []
    for key, lbl in inc_fields:
        cur = to_int(row.get(key, 0))
        pm  = to_int(prev_m_row.get(key, 0)) if has_pm else 0
        py  = to_int(prev_y_row.get(key, 0)) if has_py else 0
        if cur or pm or py:
            detail_rows.append((f"　{lbl}", cur, pm, py, False))
    for key, lbl in ded_fields:
        cur = to_int(row.get(key, 0))
        pm  = to_int(prev_m_row.get(key, 0)) if has_pm else 0
        py  = to_int(prev_y_row.get(key, 0)) if has_py else 0
        if cur or pm or py:
            detail_rows.append((f"　{lbl}", cur, pm, py, False))
    if not is_bonus:
        adj = to_int(row.get("tax_adjustment", 0))
        pm_a = to_int(prev_m_row.get("tax_adjustment", 0)) if has_pm else 0
        py_a = to_int(prev_y_row.get("tax_adjustment", 0)) if has_py else 0
        if adj or pm_a or py_a:
            sign_cur = f"+¥{adj:,}" if adj >= 0 else f"-¥{abs(adj):,}"
            sign_pm  = (f"+¥{pm_a:,}" if pm_a >= 0 else f"-¥{abs(pm_a):,}") if has_pm else "—"
            sign_py  = (f"+¥{py_a:,}" if py_a >= 0 else f"-¥{abs(py_a):,}") if has_py else "—"
            dm, dc = fmt_delta(adj, pm_a) if has_pm else ("—", "#64748b")
            dy, dyc = fmt_delta(adj, py_a) if has_py else ("—", "#64748b")
            rows_html_extra = (
                f"<tr><td style='font-style:italic'>　過不足税額</td>"
                f"<td style='text-align:right'>{sign_cur}</td>"
                f"<td style='text-align:right;color:#64748b'>{sign_pm}</td>"
                f"<td style='text-align:right;color:{dc};font-weight:600'>{dm}</td>"
                f"<td style='text-align:right;color:#64748b'>{sign_py}</td>"
                f"<td style='text-align:right;color:{dyc};font-weight:600'>{dy}</td></tr>"
            )
        else:
            rows_html_extra = ""
    else:
        rows_html_extra = ""

    hdr = ["項目", "今月", "前月", "前月比", "前年同月", "前年同月比"]
    rows_html = ""
    for lbl, cur, pm, py, bold in summary_rows + detail_rows:
        dm, dc = fmt_delta(cur, pm) if has_pm else ("—", "#64748b")
        dy, dyc = fmt_delta(cur, py) if has_py else ("—", "#64748b")
        fw = "700" if bold else "400"
        rows_html += (
            f"<tr>"
            f"<td style='font-weight:{fw}'>{lbl}</td>"
            f"<td style='text-align:right;font-weight:{fw}'>¥{cur:,}</td>"
            f"<td style='text-align:right;color:#64748b'>{'¥'+f'{pm:,}' if has_pm else '—'}</td>"
            f"<td style='text-align:right;color:{dc};font-weight:600'>{dm}</td>"
            f"<td style='text-align:right;color:#64748b'>{'¥'+f'{py:,}' if has_py else '—'}</td>"
            f"<td style='text-align:right;color:{dyc};font-weight:600'>{dy}</td>"
            f"</tr>"
        )
    rows_html += rows_html_extra

    st.markdown(
        f"""<div class="table-wrap"><table class="styled-table">
        <thead><tr>{''.join(f'<th>{h}</th>' for h in hdr)}</tr></thead>
        <tbody>{rows_html}</tbody></table></div>""",
        unsafe_allow_html=True,
    )


# ================================================================
# 給与フォーム
# ================================================================
def salary_form_fields(form_key: str, defaults: dict = None) -> tuple:
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

        st.markdown("#### 過不足税額（円）")
        st.caption("還付はプラス（例：+12,000）、追徴はマイナス（例：-3,000）で入力してください")
        tax_adj = st.number_input(
            "過不足税額", step=100,
            value=to_int(defaults.get("tax_adjustment", 0)),
            key=f"{form_key}_tax_adj",
        )

        memo = st.text_input("メモ", value=defaults.get("memo", ""), key=f"{form_key}_memo")

        preview = calc_summary({**inc_vals, **ded_vals, "tax_adjustment": tax_adj})
        p1, p2, p3, p4 = st.columns(4)
        p1.metric("総支給額",     f"¥{preview['income_total']:,}")
        p2.metric("控除合計",     f"¥{preview['deduction_total']:,}")
        sign = "+" if tax_adj >= 0 else ""
        p3.metric("過不足税額",   f"{sign}¥{tax_adj:,}")
        p4.metric("手取り（概算）", f"¥{preview['take_home']:,}")

        btn_label = "更新する" if defaults else "登録する"
        submitted = st.form_submit_button(btn_label, use_container_width=True)

    return inc_vals, ded_vals, int(tax_adj), memo, submitted


# ================================================================
# 賞与フォーム
# ================================================================
def bonus_form_fields(form_key: str, defaults: dict = None) -> tuple:
    defaults = defaults or {}
    with st.form(form_key, clear_on_submit=False):
        st.markdown("#### 賞与支給額（円）")
        gross = st.number_input(
            "賞与額（税引前）", min_value=0, step=10000,
            value=to_int(defaults.get("basic_salary", 0)),
            key=f"{form_key}_gross",
        )

        st.markdown("#### 控除項目（円）")
        ded_cols = st.columns(2)
        ded_vals = {}
        for i, (key, label) in enumerate(BONUS_DEDUCTION_FIELDS):
            ded_vals[key] = ded_cols[i % 2].number_input(
                label, min_value=0, step=100,
                value=to_int(defaults.get(key, 0)),
                key=f"{form_key}_ded_{key}",
            )

        memo = st.text_input("メモ", value=defaults.get("memo", ""), key=f"{form_key}_memo")

        ded_total = sum(ded_vals.values())
        take_home = gross - ded_total
        p1, p2, p3 = st.columns(3)
        p1.metric("賞与額",     f"¥{gross:,}")
        p2.metric("控除合計",   f"¥{ded_total:,}")
        p3.metric("手取り賞与", f"¥{take_home:,}")

        btn_label = "更新する" if defaults else "登録する"
        submitted = st.form_submit_button(btn_label, use_container_width=True)

    return gross, ded_vals, memo, submitted


# ================================================================
# タブ
# ================================================================
tab_reg, tab_list, tab_summary = st.tabs(["登録", "月別一覧", "年収サマリー"])

# ================================================================
# 登録タブ
# ================================================================
with tab_reg:
    reg_type = st.radio("種別", ["給与", "賞与"], horizontal=True, key="sal_type_radio")
    st.markdown("---")

    reg_ym = st.selectbox(
        "対象月",
        list(reversed(all_ym)),
        format_func=ym_jp,
        key="sal_ym",
    )
    if reg_type == "給与":
        st.caption(
            f"締め日：{reg_ym[:4]}年{JP_MONTHS[int(reg_ym[5:])-1]}15日　／　支払日：{pay_date(reg_ym)}"
        )

    # 日報連携
    ds = daily_summary_for_month(reg_ym)
    if ds["days"] > 0:
        st.caption(f"日報参照　稼働 {ds['days']} 日 / {ds['hours']:.2f} h")

    if reg_type == "給与":
        inc_vals, ded_vals, tax_adj, memo, submitted = salary_form_fields("salary_form")
        if submitted:
            df_sal = load("salary")
            dup = df_sal[(df_sal["year_month"] == reg_ym) & (df_sal["salary_type"] == "給与")]
            if not dup.empty:
                st.warning(f"{ym_jp(reg_ym)} の給与はすでに登録されています。一覧タブから編集してください。")
            else:
                row = {
                    "id": generate_id(), "year_month": reg_ym, "salary_type": "給与",
                    "tax_adjustment": str(tax_adj), "memo": memo,
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    **{k: str(v) for k, v in inc_vals.items()},
                    **{k: str(v) for k, v in ded_vals.items()},
                }
                preview = calc_summary({**inc_vals, **ded_vals, "tax_adjustment": tax_adj})
                df_sal = pd.concat([df_sal, pd.DataFrame([row])], ignore_index=True)
                save("salary", df_sal)
                st.success(f"{ym_jp(reg_ym)} の給与を登録しました。手取り: ¥{preview['take_home']:,}")
                st.rerun()
    else:
        gross, ded_vals, memo, submitted = bonus_form_fields("bonus_form")
        if submitted:
            df_sal = load("salary")
            row = {
                "id": generate_id(), "year_month": reg_ym, "salary_type": "賞与",
                "basic_salary": str(gross), "tax_adjustment": "0", "memo": memo,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                **{k: str(v) for k, v in ded_vals.items()},
            }
            ded_total = sum(ded_vals.values())
            df_sal = pd.concat([df_sal, pd.DataFrame([row])], ignore_index=True)
            save("salary", df_sal)
            st.success(f"{ym_jp(reg_ym)} の賞与を登録しました。手取り: ¥{gross - ded_total:,}")
            st.rerun()

# ================================================================
# 月別一覧タブ
# ================================================================
with tab_list:
    df_sal = load("salary")
    if "salary_type" not in df_sal.columns:
        df_sal["salary_type"] = "給与"

    if df_sal.empty:
        st.info("給与データがまだ登録されていません。")
    else:
        sel_ym = st.selectbox(
            "表示月", list(reversed(all_ym)), format_func=ym_jp, key="sal_list_ym"
        )
        df_month = df_sal[df_sal["year_month"] == sel_ym].reset_index(drop=True)
        if df_month.empty:
            st.info(f"{ym_jp(sel_ym)} のデータはありません。")
        else:
            # 前月・前年同月（給与のみ比較）
            df_prev_m_sal = df_sal[(df_sal["year_month"] == prev_ym(sel_ym))       & (df_sal["salary_type"] == "給与")]
            df_prev_y_sal = df_sal[(df_sal["year_month"] == prev_year_ym(sel_ym))  & (df_sal["salary_type"] == "給与")]
            df_prev_m_bon = df_sal[(df_sal["year_month"] == prev_ym(sel_ym))       & (df_sal["salary_type"] == "賞与")]
            df_prev_y_bon = df_sal[(df_sal["year_month"] == prev_year_ym(sel_ym))  & (df_sal["salary_type"] == "賞与")]

            ds = daily_summary_for_month(sel_ym)

            for _, row in df_month.iterrows():
                rid      = row["id"]
                stype    = row.get("salary_type", "給与")
                is_bonus = (stype == "賞与")
                edit_key = f"sal_edit_{rid}"
                del_key  = f"sal_del_{rid}"

                prev_m_row = df_prev_m_bon.iloc[0].to_dict() if (is_bonus and not df_prev_m_bon.empty) else \
                             df_prev_m_sal.iloc[0].to_dict() if (not is_bonus and not df_prev_m_sal.empty) else {}
                prev_y_row = df_prev_y_bon.iloc[0].to_dict() if (is_bonus and not df_prev_y_bon.empty) else \
                             df_prev_y_sal.iloc[0].to_dict() if (not is_bonus and not df_prev_y_sal.empty) else {}

                badge_color = BONUS_COLOR if is_bonus else ACCENT
                st.markdown('<div class="section-card">', unsafe_allow_html=True)
                st.markdown(
                    f"<span style='font-size:0.78rem;font-weight:700;color:{badge_color};"
                    f"border:1px solid {badge_color};border-radius:4px;padding:1px 8px;'>{stype}</span>"
                    f"　**{ym_jp(sel_ym)}**" +
                    (f"　支払日：{pay_date(sel_ym)}" if not is_bonus else ""),
                    unsafe_allow_html=True,
                )
                if ds["days"] > 0:
                    st.caption(f"日報参照　稼働 {ds['days']} 日 / {ds['hours']:.2f} h")

                if is_bonus:
                    bs = calc_bonus_summary(row.to_dict())
                    c1, c2, c3 = st.columns(3)
                    c1.metric("賞与額",   f"¥{bs['gross']:,}")
                    c2.metric("控除合計", f"¥{bs['deduction']:,}")
                    c3.metric("手取り賞与", f"¥{bs['take_home']:,}")
                else:
                    s = calc_summary(row.to_dict())
                    c1, c2, c3, c4 = st.columns(4)
                    c1.metric("総支給額",    f"¥{s['income_total']:,}")
                    c2.metric("控除合計",    f"¥{s['deduction_total']:,}")
                    tax_adj = s["tax_adjustment"]
                    sign = "+" if tax_adj >= 0 else ""
                    c3.metric("過不足税額",  f"{sign}¥{tax_adj:,}" if tax_adj != 0 else "—")
                    c4.metric("手取り",      f"¥{s['take_home']:,}")

                with st.expander("全項目の前月比・前年同月比"):
                    render_comparison_table(row.to_dict(), prev_m_row, prev_y_row, is_bonus=is_bonus)
                    if row.get("memo"):
                        st.caption(f"メモ：{row['memo']}")

                btn1, btn2, _ = st.columns([1, 1, 4])
                if btn1.button("編集", key=f"sal_ebtn_{rid}"):
                    st.session_state[edit_key] = not st.session_state.get(edit_key, False)
                    st.session_state[del_key]  = False
                if btn2.button("削除", key=f"sal_dbtn_{rid}"):
                    st.session_state[del_key]  = True
                    st.session_state[edit_key] = False

                if st.session_state.get(edit_key):
                    st.markdown("##### 編集")
                    if is_bonus:
                        gross, ded_vals, new_memo, upd = bonus_form_fields(
                            f"sal_edit_form_{rid}", defaults=row.to_dict()
                        )
                        if upd:
                            df_sal = load("salary")
                            idx = df_sal.index[df_sal["id"] == rid]
                            if len(idx):
                                df_sal.loc[idx, "basic_salary"] = str(gross)
                                for k, v in ded_vals.items():
                                    df_sal.loc[idx, k] = str(v)
                                df_sal.loc[idx, "memo"] = new_memo
                                save("salary", df_sal)
                            st.session_state[edit_key] = False
                            st.success("更新しました。")
                            st.rerun()
                    else:
                        inc_vals, ded_vals, tax_adj, new_memo, upd = salary_form_fields(
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
                                df_sal.loc[idx, "tax_adjustment"] = str(tax_adj)
                                df_sal.loc[idx, "memo"] = new_memo
                                save("salary", df_sal)
                            st.session_state[edit_key] = False
                            st.success("更新しました。")
                            st.rerun()

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
    if "salary_type" not in df_sal.columns:
        df_sal["salary_type"] = "給与"

    if df_sal.empty:
        st.info("給与データがまだ登録されていません。")
        st.stop()

    years_available = sorted(df_sal["year_month"].str[:4].unique().tolist(), reverse=True)
    sel_year = st.selectbox("対象年", years_available, format_func=lambda y: f"{y}年", key="sal_year")

    df_year_sal = df_sal[(df_sal["year_month"].str.startswith(sel_year)) & (df_sal["salary_type"] == "給与")].copy()
    df_year_bon = df_sal[(df_sal["year_month"].str.startswith(sel_year)) & (df_sal["salary_type"] == "賞与")].copy()
    prev_year_str = str(int(sel_year) - 1)
    df_prev_sal   = df_sal[(df_sal["year_month"].str.startswith(prev_year_str)) & (df_sal["salary_type"] == "給与")].copy()

    num_keys = [k for k, _ in INCOME_FIELDS + DEDUCTION_FIELDS]
    for df in [df_year_sal, df_year_bon, df_prev_sal]:
        for col in num_keys + ["tax_adjustment", "basic_salary"]:
            if col in df.columns:
                df[col] = df[col].apply(to_int)

    def add_totals(df, is_bonus=False):
        if df.empty: return df
        if is_bonus:
            df["income_total"]    = df["basic_salary"]
            df["deduction_total"] = df[[k for k, _ in BONUS_DEDUCTION_FIELDS]].sum(axis=1)
        else:
            df["income_total"]    = df[[k for k, _ in INCOME_FIELDS]].sum(axis=1)
            df["deduction_total"] = df[[k for k, _ in DEDUCTION_FIELDS]].sum(axis=1)
        df["taxable_income"]  = df[[k for k, _ in INCOME_FIELDS if k not in NON_TAXABLE_KEYS]].sum(axis=1)
        df["tax_adjustment"]  = df["tax_adjustment"].apply(to_int) if "tax_adjustment" in df.columns else 0
        df["take_home"]       = df["taxable_income"] - df["deduction_total"] + df.get("tax_adjustment", 0)
        return df

    df_year_sal = add_totals(df_year_sal, False)
    df_year_bon = add_totals(df_year_bon, True)
    df_prev_sal = add_totals(df_prev_sal, False)

    annual_income    = int(df_year_sal["income_total"].sum())   if not df_year_sal.empty else 0
    annual_takehome  = int(df_year_sal["take_home"].sum())      if not df_year_sal.empty else 0
    annual_deduction = int(df_year_sal["deduction_total"].sum()) if not df_year_sal.empty else 0
    annual_bonus     = int(df_year_bon["take_home"].sum())      if not df_year_bon.empty else 0
    months_count     = df_year_sal["year_month"].nunique()      if not df_year_sal.empty else 0
    prev_takehome    = int(df_prev_sal["take_home"].sum())      if not df_prev_sal.empty else 0

    k1, k2, k3, k4, k5 = st.columns(5)
    k1.metric("年間総支給額", f"¥{annual_income:,}")
    k2.metric("年間手取り（給与）", f"¥{annual_takehome:,}")
    k3.metric("年間手取り賞与", f"¥{annual_bonus:,}")
    k4.metric("年間控除合計", f"¥{annual_deduction:,}")
    k5.metric("月平均手取り", f"¥{annual_takehome // months_count:,}" if months_count else "—")

    if prev_takehome:
        d_lbl, d_col = fmt_delta(annual_takehome, prev_takehome)
        st.markdown(
            f"<span style='font-size:0.82rem;color:#64748b;'>前年比（年間手取り・給与のみ）</span>　"
            f"<span style='font-size:0.95rem;font-weight:600;color:{d_col};'>{d_lbl}</span>",
            unsafe_allow_html=True,
        )

    st.markdown("---")

    months_all = [f"{sel_year}-{mo:02d}" for mo in range(1, 13)]
    chart_df = pd.DataFrame({"year_month": months_all})

    if not df_year_sal.empty:
        chart_df = chart_df.merge(
            df_year_sal[["year_month", "income_total", "take_home", "deduction_total"]],
            on="year_month", how="left"
        ).fillna(0)
    else:
        chart_df["income_total"] = chart_df["take_home"] = chart_df["deduction_total"] = 0

    if not df_year_bon.empty:
        bon_agg = df_year_bon.groupby("year_month")["take_home"].sum().reset_index()
        bon_agg.columns = ["year_month", "bonus_take_home"]
        chart_df = chart_df.merge(bon_agg, on="year_month", how="left").fillna(0)
    else:
        chart_df["bonus_take_home"] = 0

    chart_df["label"] = chart_df["year_month"].apply(lambda v: f"{int(v[5:])}月")
    chart_df["prev_take_home"] = chart_df["take_home"].shift(1)
    chart_df["mom_pct"] = (
        (chart_df["take_home"] - chart_df["prev_take_home"])
        / chart_df["prev_take_home"].replace(0, float("nan")) * 100
    ).round(1)

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=chart_df["label"], y=chart_df["income_total"],
        name="総支給額", marker_color=ACCENT, opacity=0.5,
    ))
    fig.add_trace(go.Bar(
        x=chart_df["label"], y=chart_df["bonus_take_home"],
        name="賞与（手取）", marker_color=BONUS_COLOR, opacity=0.8,
    ))
    fig.add_trace(go.Scatter(
        x=chart_df["label"], y=chart_df["take_home"],
        name="手取り（給与）", mode="lines+markers",
        line=dict(color="#10b981", width=2),
        marker=dict(color="#10b981", size=7),
    ))
    valid = chart_df[chart_df["mom_pct"].notna() & (chart_df["take_home"] > 0)]
    for _, vr in valid.iterrows():
        sign  = "+" if vr["mom_pct"] >= 0 else ""
        color = "#10b981" if vr["mom_pct"] >= 0 else "#ef4444"
        fig.add_annotation(
            x=vr["label"], y=vr["take_home"],
            text=f"{sign}{vr['mom_pct']}%",
            showarrow=False, yshift=14,
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
        height=360, barmode="overlay",
    )
    st.plotly_chart(fig, use_container_width=True)

    # 控除内訳ドーナツ
    st.markdown("#### 控除内訳（年間合計）")
    if not df_year_sal.empty:
        ded_totals = {label: int(df_year_sal[key].sum()) for key, label in DEDUCTION_FIELDS if key in df_year_sal.columns}
        ded_totals = {k: v for k, v in ded_totals.items() if v > 0}
        if ded_totals:
            fig2 = go.Figure(go.Pie(
                labels=list(ded_totals.keys()), values=list(ded_totals.values()),
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

    # 月別明細
    st.markdown("#### 月別明細")
    disp = chart_df[chart_df["income_total"] > 0].copy()
    disp["総支給額"] = disp["income_total"].apply(lambda v: f"¥{int(v):,}")
    disp["控除合計"] = disp["deduction_total"].apply(lambda v: f"¥{int(v):,}")
    disp["手取り"]   = disp["take_home"].apply(lambda v: f"¥{int(v):,}")
    disp["賞与"]     = disp["bonus_take_home"].apply(lambda v: f"¥{int(v):,}" if v > 0 else "—")
    disp["支払日"]   = disp["year_month"].apply(pay_date)
    disp["前月比"]   = disp["mom_pct"].apply(
        lambda v: f"{'+'if v>=0 else ''}{v:.1f}%" if pd.notna(v) else "—"
    )
    st.dataframe(
        disp[["label","支払日","総支給額","控除合計","手取り","賞与","前月比"]].rename(columns={"label":"月"}),
        use_container_width=True, hide_index=True,
    )
