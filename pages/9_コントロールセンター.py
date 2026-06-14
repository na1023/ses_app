"""
pages/9_コントロールセンター.py
パーソナルコントロールセンター ― 全機能を1画面で俯瞰するダッシュボード
"""

import streamlit as st
import pandas as pd
from datetime import date, datetime, timedelta

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import init_all, load, append_row, generate_id
from utils.styles import THEME_CSS, render_sidebar, show_flash, set_flash

st.set_page_config(page_title="コントロールセンター", layout="wide", initial_sidebar_state="expanded")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()
show_flash()

today = date.today()
this_month = today.strftime("%Y-%m")

# ================================================================
# ヘッダー
# ================================================================
day_names = ["月", "火", "水", "木", "金", "土", "日"]
st.markdown(
    f"""
    <div style="display:flex; align-items:baseline; gap:1rem; margin-bottom:1.25rem;">
        <h1 style="font-size:1.6rem; font-weight:800; color:#e2e8f0; margin:0;
                   letter-spacing:-0.02em;">コントロールセンター</h1>
        <span style="font-size:0.9rem; color:#64748b;">
            {today.strftime('%Y/%m/%d')}（{day_names[today.weekday()]}）
        </span>
    </div>
    """,
    unsafe_allow_html=True,
)

# ================================================================
# データ読み込み
# ================================================================
df_kakeibo    = load("kakeibo")
df_calendar   = load("calendar_events")
df_qual       = load("qualifications")
df_transit    = load("transit_shortcuts")

# ================================================================
# 1. 運行情報ショートカット（最上部 ― 最も使用頻度が高い）
# ================================================================
st.markdown('<div class="section-card">', unsafe_allow_html=True)
st.markdown(
    "<p style='font-size:0.72rem; color:#64748b; text-transform:uppercase; "
    "letter-spacing:0.08em; margin-bottom:0.75rem;'>運行情報ショートカット</p>",
    unsafe_allow_html=True,
)

if df_transit.empty:
    st.markdown(
        "<p style='color:#475569; font-size:0.85rem;'>まだショートカットが登録されていません。"
        "「運行情報」ページから追加してください。</p>",
        unsafe_allow_html=True,
    )
else:
    df_t = df_transit.copy()
    df_t["display_order"] = pd.to_numeric(df_t["display_order"], errors="coerce").fillna(99)
    df_t = df_t.sort_values("display_order").reset_index(drop=True)

    cols = st.columns(min(len(df_t), 5))
    for i, row in df_t.iterrows():
        with cols[i % 5]:
            icon  = row.get("icon") or "🚃"
            label = row.get("label") or row.get("station_name") or "―"
            sub   = row.get("line_name") or ""
            url   = row.get("url") or "#"
            st.markdown(
                f'<a href="{url}" target="_blank" class="transit-btn">'
                f'  <span class="transit-icon">{icon}</span>'
                f'  <span class="transit-label">{label}</span>'
                f'  <span class="transit-sub">{sub}</span>'
                f'</a>',
                unsafe_allow_html=True,
            )
st.markdown("</div>", unsafe_allow_html=True)

# ================================================================
# 2. クイック家計簿入力（ワンアクション）
# ================================================================
st.markdown('<div class="quick-form-card">', unsafe_allow_html=True)
st.markdown(
    "<p style='font-size:0.72rem; color:#60a5fa; text-transform:uppercase; "
    "letter-spacing:0.08em; margin-bottom:0.75rem;'>クイック入力 ― 家計簿</p>",
    unsafe_allow_html=True,
)

EXPENSE_CATS = ["食費", "交通費", "光熱費", "通信費", "娯楽", "医療", "住居費", "衣類", "その他"]
INCOME_CATS  = ["給与", "副業", "ボーナス", "その他"]

with st.form("quick_kakeibo", clear_on_submit=True):
    c1, c2, c3, c4, c5 = st.columns([1.2, 2, 2, 2, 1.5])
    with c1:
        entry_type = st.selectbox("種別", ["支出", "収入"], label_visibility="collapsed",
                                  key="qk_type")
    with c2:
        cats = EXPENSE_CATS if entry_type == "支出" else INCOME_CATS
        category = st.selectbox("カテゴリ", cats, label_visibility="collapsed")
    with c3:
        amount = st.number_input("金額（円）", min_value=1, value=None,
                                 placeholder="金額（円）", label_visibility="collapsed")
    with c4:
        memo = st.text_input("メモ", placeholder="メモ（任意）", label_visibility="collapsed")
    with c5:
        submitted = st.form_submit_button("追加", use_container_width=True, type="primary")

    if submitted:
        if amount:
            append_row("kakeibo", {
                "id":         generate_id(),
                "date":       today.isoformat(),
                "type":       entry_type,
                "category":   category,
                "amount":     str(int(amount)),
                "memo":       memo,
                "created_at": datetime.now().isoformat(),
            })
            set_flash("success", f"{entry_type} ¥{int(amount):,}（{category}）を記録しました")
            st.rerun()
        else:
            st.warning("金額を入力してください")

st.markdown("</div>", unsafe_allow_html=True)

# ================================================================
# 3. 今月の収支サマリー KPI
# ================================================================
income_total  = 0
expense_total = 0
if not df_kakeibo.empty:
    df_this = df_kakeibo[df_kakeibo["date"].str.startswith(this_month, na=False)].copy()
    df_this["amount"] = pd.to_numeric(df_this["amount"], errors="coerce").fillna(0)
    income_total  = int(df_this[df_this["type"] == "収入"]["amount"].sum())
    expense_total = int(df_this[df_this["type"] == "支出"]["amount"].sum())
balance = income_total - expense_total
balance_color = "#4ade80" if balance >= 0 else "#f87171"

st.markdown(
    f"""
    <div class="kakeibo-summary">
        <div class="ks-block">
            <div class="ks-label">今月の収入</div>
            <div class="ks-value ks-income">¥{income_total:,}</div>
        </div>
        <div class="ks-block">
            <div class="ks-label">今月の支出</div>
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
# 4. メイン2カラム — 今後の予定 / 資格アラート
# ================================================================
col_left, col_right = st.columns([1.2, 1])

# ---- 今後7日の予定 ----
with col_left:
    st.markdown('<div class="section-card">', unsafe_allow_html=True)
    st.markdown(
        "<p style='font-size:0.72rem; color:#64748b; text-transform:uppercase; "
        "letter-spacing:0.08em; margin-bottom:0.75rem;'>今後7日の予定</p>",
        unsafe_allow_html=True,
    )

    upcoming_html = ""
    if not df_calendar.empty:
        df_cal = df_calendar.copy()
        df_cal["date_parsed"] = pd.to_datetime(df_cal["date"], errors="coerce").dt.date
        mask = (df_cal["date_parsed"] >= today) & (df_cal["date_parsed"] <= today + timedelta(days=7))
        df_up = df_cal[mask].sort_values("date_parsed")
        for _, ev in df_up.iterrows():
            d = ev["date_parsed"]
            is_today = d == today
            tag_cls  = "event-date-tag today" if is_today else "event-date-tag"
            label    = "TODAY" if is_today else d.strftime("%m/%d")
            time_str = ""
            if ev.get("start_time"):
                time_str = ev["start_time"]
                if ev.get("end_time"):
                    time_str += f"–{ev['end_time']}"
            upcoming_html += (
                f'<div class="event-item">'
                f'  <span class="{tag_cls}">{label}</span>'
                f'  <div>'
                f'    <div class="event-title">{ev["title"]}</div>'
                f'    {"<div class=event-time>" + time_str + "</div>" if time_str else ""}'
                f'  </div>'
                f'</div>'
            )

    if upcoming_html:
        st.markdown(upcoming_html, unsafe_allow_html=True)
    else:
        st.markdown(
            "<p style='color:#475569; font-size:0.85rem;'>今後7日間の予定はありません</p>",
            unsafe_allow_html=True,
        )
    st.markdown("</div>", unsafe_allow_html=True)

# ---- 資格アラート ----
with col_right:
    st.markdown('<div class="section-card">', unsafe_allow_html=True)
    st.markdown(
        "<p style='font-size:0.72rem; color:#64748b; text-transform:uppercase; "
        "letter-spacing:0.08em; margin-bottom:0.75rem;'>資格アラート</p>",
        unsafe_allow_html=True,
    )

    alerts_html = ""
    if not df_qual.empty:
        for _, q in df_qual.iterrows():
            alerts = []
            name = q.get("name", "―")
            for col, label in [("exam_date", "受験日"), ("expiry_date", "有効期限")]:
                d_str = q.get(col, "")
                if not d_str:
                    continue
                try:
                    d = datetime.strptime(d_str, "%Y-%m-%d").date()
                except ValueError:
                    continue
                days_left = (d - today).days
                if days_left < 0 or days_left > 60:
                    continue
                urgent = days_left <= 14
                cls_card = "alert-card urgent" if urgent else "alert-card"
                cls_days = "alert-days urgent" if urgent else "alert-days"
                icon = "🔴" if urgent else "🟡"
                days_text = "本日" if days_left == 0 else (f"あと{days_left}日" if days_left > 0 else f"{abs(days_left)}日超過")
                alerts.append(
                    f'<div class="{cls_card}">'
                    f'  <span class="alert-icon">{icon}</span>'
                    f'  <div class="alert-body">'
                    f'    <div class="alert-title">{name}</div>'
                    f'    <div class="alert-sub">{label}：{d_str}</div>'
                    f'  </div>'
                    f'  <span class="{cls_days}">{days_text}</span>'
                    f'</div>'
                )
            alerts_html += "".join(alerts)

    if alerts_html:
        st.markdown(alerts_html, unsafe_allow_html=True)
    else:
        st.markdown(
            "<p style='color:#475569; font-size:0.85rem;'>60日以内の期限はありません</p>",
            unsafe_allow_html=True,
        )
    st.markdown("</div>", unsafe_allow_html=True)

# ================================================================
# 5. 今月の支出カテゴリ内訳
# ================================================================
if not df_kakeibo.empty and expense_total > 0:
    st.markdown('<div class="section-card">', unsafe_allow_html=True)
    st.markdown(
        "<p style='font-size:0.72rem; color:#64748b; text-transform:uppercase; "
        "letter-spacing:0.08em; margin-bottom:0.75rem;'>今月の支出カテゴリ内訳</p>",
        unsafe_allow_html=True,
    )
    df_this_exp = df_this[df_this["type"] == "支出"].copy()
    cat_sum = df_this_exp.groupby("category")["amount"].sum().sort_values(ascending=False)
    bars_html = ""
    for cat, amt in cat_sum.items():
        pct = int(amt / expense_total * 100)
        bars_html += (
            f'<div class="cat-bar-wrap">'
            f'  <div class="cat-bar-label"><span>{cat}</span><span>¥{int(amt):,} ({pct}%)</span></div>'
            f'  <div class="cat-bar-track"><div class="cat-bar-fill" style="width:{pct}%;"></div></div>'
            f'</div>'
        )
    st.markdown(bars_html, unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

# ================================================================
# 6. 直近の収支履歴（5件）
# ================================================================
if not df_kakeibo.empty:
    st.markdown('<div class="section-card">', unsafe_allow_html=True)
    st.markdown(
        "<p style='font-size:0.72rem; color:#64748b; text-transform:uppercase; "
        "letter-spacing:0.08em; margin-bottom:0.75rem;'>直近の収支</p>",
        unsafe_allow_html=True,
    )
    df_recent = df_kakeibo.sort_values("created_at", ascending=False).head(8)
    rows_html = ""
    for _, r in df_recent.iterrows():
        badge_cls = "badge badge-income" if r["type"] == "収入" else "badge badge-expense"
        sign = "+" if r["type"] == "収入" else "−"
        amt  = int(float(r["amount"])) if r["amount"] else 0
        rows_html += (
            f'<tr>'
            f'  <td>{r["date"]}</td>'
            f'  <td><span class="{badge_cls}">{r["type"]}</span></td>'
            f'  <td>{r["category"]}</td>'
            f'  <td style="text-align:right; font-weight:600;">{sign}¥{amt:,}</td>'
            f'  <td style="color:#64748b;">{r.get("memo","")}</td>'
            f'</tr>'
        )
    st.markdown(
        f'<div class="table-wrap"><table class="styled-table">'
        f'<thead><tr><th>日付</th><th>種別</th><th>カテゴリ</th>'
        f'<th style="text-align:right;">金額</th><th>メモ</th></tr></thead>'
        f'<tbody>{rows_html}</tbody></table></div>',
        unsafe_allow_html=True,
    )
    st.markdown("</div>", unsafe_allow_html=True)
