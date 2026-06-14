"""
pages/10_家計簿.py
家計簿管理 ― 収支の入力・編集・集計・推移グラフ
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import date, datetime

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import init_all, load, save, append_row, generate_id
from utils.styles import THEME_CSS, render_sidebar, show_flash, set_flash

st.set_page_config(page_title="家計簿", layout="wide", initial_sidebar_state="expanded")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()
show_flash()

EXPENSE_CATS = ["食費", "交通費", "光熱費", "通信費", "娯楽", "医療", "住居費", "衣類", "その他"]
INCOME_CATS  = ["給与", "副業", "ボーナス", "その他"]

today      = date.today()
this_month = today.strftime("%Y-%m")

st.markdown(
    '<div class="page-header"><h1>家計簿</h1>'
    '<p>収入・支出を記録し、月次サマリーを確認します</p></div>',
    unsafe_allow_html=True,
)

# ================================================================
# クイック入力フォーム
# ================================================================
st.markdown('<div class="quick-form-card">', unsafe_allow_html=True)
st.markdown(
    "<p style='font-size:0.72rem; color:#60a5fa; text-transform:uppercase; "
    "letter-spacing:0.08em; margin-bottom:0.75rem;'>新規追加</p>",
    unsafe_allow_html=True,
)

with st.form("kakeibo_add", clear_on_submit=True):
    c1, c2, c3, c4, c5, c6 = st.columns([1.2, 1.8, 2, 1.5, 2, 1.2])
    with c1:
        entry_type = st.selectbox("種別", ["支出", "収入"])
    with c2:
        cats = EXPENSE_CATS if entry_type == "支出" else INCOME_CATS
        category = st.selectbox("カテゴリ", cats)
    with c3:
        amount = st.number_input("金額（円）", min_value=1, value=None, placeholder="例：500")
    with c4:
        entry_date = st.date_input("日付", value=today)
    with c5:
        memo = st.text_input("メモ", placeholder="任意")
    with c6:
        submitted = st.form_submit_button("追加", use_container_width=True, type="primary")

    if submitted:
        if amount:
            append_row("kakeibo", {
                "id":         generate_id(),
                "date":       entry_date.isoformat(),
                "type":       entry_type,
                "category":   category,
                "amount":     str(int(amount)),
                "memo":       memo,
                "created_at": datetime.now().isoformat(),
            })
            set_flash("success", f"¥{int(amount):,}（{entry_type}・{category}）を追加しました")
            st.rerun()
        else:
            st.warning("金額を入力してください")

st.markdown("</div>", unsafe_allow_html=True)

# ================================================================
# データ読み込み
# ================================================================
df = load("kakeibo")

if df.empty:
    st.info("まだデータがありません。上のフォームから追加してください。")
    st.stop()

df["amount"]     = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
df["date_parsed"] = pd.to_datetime(df["date"], errors="coerce").dt.date

# ================================================================
# 月選択フィルタ
# ================================================================
months_available = sorted(df["date"].str[:7].dropna().unique().tolist(), reverse=True)
if this_month not in months_available:
    months_available.insert(0, this_month)

selected_month = st.selectbox("表示月", months_available, index=0, label_visibility="collapsed")

df_month = df[df["date"].str.startswith(selected_month, na=False)].copy()

income_total  = int(df_month[df_month["type"] == "収入"]["amount"].sum())
expense_total = int(df_month[df_month["type"] == "支出"]["amount"].sum())
balance       = income_total - expense_total
balance_color = "#4ade80" if balance >= 0 else "#f87171"

# KPI
st.markdown(
    f"""
    <div class="kakeibo-summary">
        <div class="ks-block">
            <div class="ks-label">収入合計</div>
            <div class="ks-value ks-income">¥{income_total:,}</div>
        </div>
        <div class="ks-block">
            <div class="ks-label">支出合計</div>
            <div class="ks-value ks-expense">¥{expense_total:,}</div>
        </div>
        <div class="ks-block">
            <div class="ks-label">差引残高</div>
            <div class="ks-value" style="color:{balance_color};">
                {'▲' if balance < 0 else ''}¥{abs(balance):,}
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ================================================================
# 支出カテゴリ内訳 + 収入内訳（2カラム）
# ================================================================
col_l, col_r = st.columns(2)

def render_cat_bars(df_filtered: pd.DataFrame, title: str, total: int, bar_cls: str):
    st.markdown(
        f"<div class='section-card'>"
        f"<p style='font-size:0.72rem; color:#64748b; text-transform:uppercase; "
        f"letter-spacing:0.08em; margin-bottom:0.75rem;'>{title}</p>",
        unsafe_allow_html=True,
    )
    if total == 0:
        st.markdown("<p style='color:#475569; font-size:0.85rem;'>データなし</p>", unsafe_allow_html=True)
    else:
        cat_sum = df_filtered.groupby("category")["amount"].sum().sort_values(ascending=False)
        html = ""
        for cat, amt in cat_sum.items():
            pct = int(amt / total * 100) if total else 0
            html += (
                f'<div class="cat-bar-wrap">'
                f'  <div class="cat-bar-label"><span>{cat}</span>'
                f'  <span>¥{int(amt):,} ({pct}%)</span></div>'
                f'  <div class="cat-bar-track">'
                f'    <div class="cat-bar-fill {bar_cls}" style="width:{pct}%;"></div>'
                f'  </div>'
                f'</div>'
            )
        st.markdown(html, unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

with col_l:
    render_cat_bars(df_month[df_month["type"] == "支出"], "支出内訳", expense_total, "")
with col_r:
    render_cat_bars(df_month[df_month["type"] == "収入"], "収入内訳", income_total, "income")

# ================================================================
# 月次推移グラフ（過去6か月）
# ================================================================
st.markdown('<div class="section-card">', unsafe_allow_html=True)
st.markdown(
    "<p style='font-size:0.72rem; color:#64748b; text-transform:uppercase; "
    "letter-spacing:0.08em; margin-bottom:0.75rem;'>月次推移（過去6か月）</p>",
    unsafe_allow_html=True,
)

df["ym"] = df["date"].str[:7]
monthly = df.groupby(["ym", "type"])["amount"].sum().unstack(fill_value=0).reset_index()
monthly = monthly.sort_values("ym").tail(6)

if not monthly.empty:
    fig = go.Figure()
    if "収入" in monthly.columns:
        fig.add_bar(x=monthly["ym"], y=monthly["収入"], name="収入",
                    marker_color="#4ade80", opacity=0.85)
    if "支出" in monthly.columns:
        fig.add_bar(x=monthly["ym"], y=monthly["支出"], name="支出",
                    marker_color="#f87171", opacity=0.85)
    fig.update_layout(
        barmode="group",
        paper_bgcolor="#161b27",
        plot_bgcolor="#161b27",
        font_color="#94a3b8",
        height=260,
        margin=dict(l=0, r=0, t=0, b=0),
        legend=dict(orientation="h", yanchor="bottom", y=1.01, x=0),
        xaxis=dict(gridcolor="#1e2a3a"),
        yaxis=dict(gridcolor="#1e2a3a"),
    )
    st.plotly_chart(fig, use_container_width=True)

st.markdown("</div>", unsafe_allow_html=True)

# ================================================================
# 明細テーブル（編集・削除）
# ================================================================
st.markdown('<div class="section-card">', unsafe_allow_html=True)
st.markdown(
    "<p style='font-size:0.72rem; color:#64748b; text-transform:uppercase; "
    "letter-spacing:0.08em; margin-bottom:0.75rem;'>明細一覧</p>",
    unsafe_allow_html=True,
)

df_disp = df_month.sort_values("date", ascending=False).reset_index(drop=True)

if df_disp.empty:
    st.markdown("<p style='color:#475569; font-size:0.85rem;'>この月のデータはありません</p>",
                unsafe_allow_html=True)
else:
    for i, row in df_disp.iterrows():
        badge_cls = "badge badge-income" if row["type"] == "収入" else "badge badge-expense"
        sign = "+" if row["type"] == "収入" else "−"
        amt  = int(row["amount"])
        with st.expander(
            f"{row['date']}　{row['category']}　{sign}¥{amt:,}　{row.get('memo','')}", expanded=False
        ):
            dc1, dc2, dc3, dc4, dc5 = st.columns([1.2, 1.8, 2, 1.5, 2])
            with dc1:
                new_type = st.selectbox("種別", ["支出", "収入"], index=0 if row["type"]=="支出" else 1,
                                        key=f"type_{row['id']}")
            with dc2:
                new_cats = EXPENSE_CATS if new_type == "支出" else INCOME_CATS
                cur_idx  = new_cats.index(row["category"]) if row["category"] in new_cats else 0
                new_cat  = st.selectbox("カテゴリ", new_cats, index=cur_idx, key=f"cat_{row['id']}")
            with dc3:
                new_amt  = st.number_input("金額", value=int(row["amount"]), min_value=1,
                                           key=f"amt_{row['id']}")
            with dc4:
                try:
                    d_val = datetime.strptime(row["date"], "%Y-%m-%d").date()
                except:
                    d_val = today
                new_date = st.date_input("日付", value=d_val, key=f"date_{row['id']}")
            with dc5:
                new_memo = st.text_input("メモ", value=row.get("memo",""), key=f"memo_{row['id']}")

            b1, b2 = st.columns([1, 4])
            with b1:
                if st.button("削除", key=f"del_{row['id']}", type="secondary"):
                    df_all = load("kakeibo")
                    df_all = df_all[df_all["id"] != row["id"]]
                    save("kakeibo", df_all)
                    set_flash("success", "削除しました")
                    st.rerun()
            with b2:
                if st.button("更新", key=f"upd_{row['id']}", type="primary"):
                    df_all = load("kakeibo")
                    idx    = df_all[df_all["id"] == row["id"]].index
                    if len(idx):
                        df_all.loc[idx[0], "type"]     = new_type
                        df_all.loc[idx[0], "category"] = new_cat
                        df_all.loc[idx[0], "amount"]   = str(new_amt)
                        df_all.loc[idx[0], "date"]     = new_date.isoformat()
                        df_all.loc[idx[0], "memo"]     = new_memo
                        save("kakeibo", df_all)
                        set_flash("success", "更新しました")
                        st.rerun()

st.markdown("</div>", unsafe_allow_html=True)
