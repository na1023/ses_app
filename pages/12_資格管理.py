"""
pages/12_資格管理.py
資格管理 ― 試験日・有効期限管理、期限アラート表示
"""

import streamlit as st
import pandas as pd
from datetime import date, datetime, timedelta

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import init_all, load, save, append_row, generate_id
from utils.styles import THEME_CSS, render_sidebar, show_flash, set_flash

st.set_page_config(page_title="資格管理", layout="wide", initial_sidebar_state="expanded")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()
show_flash()

today = date.today()
QUAL_CATS   = ["IT", "ビジネス", "語学", "医療・福祉", "その他"]
QUAL_STATUS = ["取得済", "勉強中", "受験予定"]

STATUS_BADGE = {
    "取得済":  "badge badge-acquired",
    "勉強中":  "badge badge-studying",
    "受験予定": "badge badge-planned",
}

st.markdown(
    '<div class="page-header"><h1>資格管理</h1>'
    '<p>試験日・有効期限を管理し、期限が近づくとアラートを表示します</p></div>',
    unsafe_allow_html=True,
)

df = load("qualifications")

# ================================================================
# アラートバナー（60日以内）
# ================================================================
if not df.empty:
    alerts = []
    for _, q in df.iterrows():
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
            if days_left > 60:
                continue
            alerts.append((days_left, name, label, d_str))

    if alerts:
        alerts.sort(key=lambda x: x[0])
        banner_html = ""
        for days_left, name, label, d_str in alerts:
            urgent = days_left <= 14
            if days_left < 0:
                icon, text, cls_c, cls_d = "⛔", f"{abs(days_left)}日超過", "alert-card urgent", "alert-days urgent"
            elif days_left == 0:
                icon, text, cls_c, cls_d = "🔴", "本日", "alert-card urgent", "alert-days urgent"
            elif urgent:
                icon, text, cls_c, cls_d = "🔴", f"あと{days_left}日", "alert-card urgent", "alert-days urgent"
            else:
                icon, text, cls_c, cls_d = "🟡", f"あと{days_left}日", "alert-card", "alert-days"
            banner_html += (
                f'<div class="{cls_c}">'
                f'  <span class="alert-icon">{icon}</span>'
                f'  <div class="alert-body">'
                f'    <div class="alert-title">{name}</div>'
                f'    <div class="alert-sub">{label}：{d_str}</div>'
                f'  </div>'
                f'  <span class="{cls_d}">{text}</span>'
                f'</div>'
            )
        st.markdown(banner_html, unsafe_allow_html=True)

# ================================================================
# 新規追加フォーム
# ================================================================
with st.expander("新規資格を追加", expanded=df.empty):
    st.markdown('<div class="quick-form-card">', unsafe_allow_html=True)
    with st.form("qual_add", clear_on_submit=True):
        f1, f2 = st.columns(2)
        with f1:
            q_name   = st.text_input("資格名 *", placeholder="例：応用情報技術者")
            q_cat    = st.selectbox("カテゴリ", QUAL_CATS)
            q_status = st.selectbox("ステータス", QUAL_STATUS)
            q_score  = st.text_input("スコア / 合格点", placeholder="例：720 / 1000")
        with f2:
            q_exam    = st.date_input("受験予定日 / 受験日", value=None)
            q_expiry  = st.date_input("有効期限", value=None)
            q_cert    = st.text_input("証明書番号", placeholder="任意")
            q_memo    = st.text_area("メモ", height=80)

        if st.form_submit_button("追加", type="primary"):
            if q_name:
                append_row("qualifications", {
                    "id":          generate_id(),
                    "name":        q_name,
                    "category":    q_cat,
                    "exam_date":   q_exam.isoformat() if q_exam else "",
                    "expiry_date": q_expiry.isoformat() if q_expiry else "",
                    "status":      q_status,
                    "score":       q_score,
                    "cert_number": q_cert,
                    "memo":        q_memo,
                    "created_at":  datetime.now().isoformat(),
                })
                set_flash("success", f"「{q_name}」を追加しました")
                st.rerun()
            else:
                st.warning("資格名は必須です")
    st.markdown("</div>", unsafe_allow_html=True)

# ================================================================
# 一覧表示
# ================================================================
df = load("qualifications")

if df.empty:
    st.info("資格が登録されていません")
    st.stop()

filter_col1, filter_col2 = st.columns(2)
with filter_col1:
    f_cat = st.selectbox("カテゴリフィルタ", ["すべて"] + QUAL_CATS, label_visibility="collapsed")
with filter_col2:
    f_status = st.selectbox("ステータスフィルタ", ["すべて"] + QUAL_STATUS, label_visibility="collapsed")

if f_cat != "すべて":
    df = df[df["category"] == f_cat]
if f_status != "すべて":
    df = df[df["status"] == f_status]


def days_label(d_str: str) -> str:
    if not d_str:
        return "―"
    try:
        d = datetime.strptime(d_str, "%Y-%m-%d").date()
        n = (d - today).days
        if n < 0:
            return f'<span style="color:#f87171;">{d_str}（{abs(n)}日前）</span>'
        elif n <= 30:
            return f'<span style="color:#fbbf24;">{d_str}（あと{n}日）</span>'
        return d_str
    except:
        return d_str


rows_html = ""
for _, q in df.sort_values("exam_date").iterrows():
    badge = STATUS_BADGE.get(q.get("status",""), "badge badge-gray")
    exam_disp   = days_label(q.get("exam_date",""))
    expiry_disp = days_label(q.get("expiry_date",""))
    rows_html += (
        f'<tr>'
        f'  <td><strong style="color:#e2e8f0;">{q.get("name","―")}</strong></td>'
        f'  <td><span class="{badge}">{q.get("status","")}</span></td>'
        f'  <td>{q.get("category","")}</td>'
        f'  <td>{exam_disp}</td>'
        f'  <td>{expiry_disp}</td>'
        f'  <td style="color:#64748b;">{q.get("score","")}</td>'
        f'</tr>'
    )

st.markdown(
    f'<div class="section-card"><div class="table-wrap">'
    f'<table class="styled-table">'
    f'<thead><tr>'
    f'  <th>資格名</th><th>ステータス</th><th>カテゴリ</th>'
    f'  <th>受験日</th><th>有効期限</th><th>スコア</th>'
    f'</tr></thead>'
    f'<tbody>{rows_html}</tbody>'
    f'</table></div></div>',
    unsafe_allow_html=True,
)

# ================================================================
# 詳細・編集・削除
# ================================================================
st.markdown(
    "<p style='font-size:0.75rem; color:#475569; margin-top:1rem;'>個別編集・削除</p>",
    unsafe_allow_html=True,
)

df_edit = load("qualifications")
for _, q in df_edit.iterrows():
    with st.expander(f"{q.get('name','―')}　[{q.get('status','')}]"):
        e1, e2 = st.columns(2)
        with e1:
            new_name   = st.text_input("資格名", value=q.get("name",""), key=f"qn_{q['id']}")
            new_cat    = st.selectbox("カテゴリ", QUAL_CATS,
                                      index=QUAL_CATS.index(q["category"]) if q.get("category") in QUAL_CATS else 0,
                                      key=f"qc_{q['id']}")
            new_status = st.selectbox("ステータス", QUAL_STATUS,
                                      index=QUAL_STATUS.index(q["status"]) if q.get("status") in QUAL_STATUS else 0,
                                      key=f"qs_{q['id']}")
            new_score  = st.text_input("スコア", value=q.get("score",""), key=f"qsc_{q['id']}")
        with e2:
            def safe_date(s):
                try:
                    return datetime.strptime(s, "%Y-%m-%d").date() if s else None
                except:
                    return None
            new_exam   = st.date_input("受験日", value=safe_date(q.get("exam_date","")),
                                       key=f"qe_{q['id']}")
            new_expiry = st.date_input("有効期限", value=safe_date(q.get("expiry_date","")),
                                       key=f"qex_{q['id']}")
            new_cert   = st.text_input("証明書番号", value=q.get("cert_number",""), key=f"qcert_{q['id']}")
            new_memo   = st.text_area("メモ", value=q.get("memo",""), height=60, key=f"qm_{q['id']}")

        b1, b2 = st.columns([1, 4])
        with b1:
            if st.button("削除", key=f"qdel_{q['id']}", type="secondary"):
                df_all = load("qualifications")
                df_all = df_all[df_all["id"] != q["id"]]
                save("qualifications", df_all)
                set_flash("success", "削除しました")
                st.rerun()
        with b2:
            if st.button("更新", key=f"qupd_{q['id']}", type="primary"):
                df_all = load("qualifications")
                idx    = df_all[df_all["id"] == q["id"]].index
                if len(idx):
                    i = idx[0]
                    df_all.loc[i, "name"]        = new_name
                    df_all.loc[i, "category"]    = new_cat
                    df_all.loc[i, "status"]      = new_status
                    df_all.loc[i, "score"]       = new_score
                    df_all.loc[i, "exam_date"]   = new_exam.isoformat() if new_exam else ""
                    df_all.loc[i, "expiry_date"] = new_expiry.isoformat() if new_expiry else ""
                    df_all.loc[i, "cert_number"] = new_cert
                    df_all.loc[i, "memo"]        = new_memo
                    save("qualifications", df_all)
                    set_flash("success", "更新しました")
                    st.rerun()
