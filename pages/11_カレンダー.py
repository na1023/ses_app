"""
pages/11_カレンダー.py
カレンダー管理 ― 手動入力・ICSテキストインポート・7日間ビュー
"""

import streamlit as st
import pandas as pd
import re
from datetime import date, datetime, timedelta

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import init_all, load, save, append_row, generate_id
from utils.styles import THEME_CSS, render_sidebar, show_flash, set_flash

st.set_page_config(page_title="カレンダー", layout="wide", initial_sidebar_state="expanded")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()
show_flash()

today = date.today()
EVENT_CATS = ["仕事", "個人", "勉強", "医療", "その他"]
CAT_COLORS = {
    "仕事": "#3b82f6", "個人": "#4ade80",
    "勉強": "#fbbf24", "医療": "#f87171", "その他": "#94a3b8",
}

st.markdown(
    '<div class="page-header"><h1>カレンダー</h1>'
    '<p>予定の管理・ICSインポート・週間ビュー</p></div>',
    unsafe_allow_html=True,
)

# ================================================================
# タブ構成
# ================================================================
tab_week, tab_add, tab_import, tab_all = st.tabs(["週間ビュー", "予定追加", "ICSインポート", "全予定"])

df_cal = load("calendar_events")

# ================================================================
# TAB: 週間ビュー
# ================================================================
with tab_week:
    week_offset = st.session_state.get("week_offset", 0)
    base_monday = today - timedelta(days=today.weekday()) + timedelta(weeks=week_offset)

    nav_c1, nav_c2, nav_c3 = st.columns([1, 4, 1])
    with nav_c1:
        if st.button("← 前週"):
            st.session_state["week_offset"] = week_offset - 1
            st.rerun()
    with nav_c2:
        st.markdown(
            f"<p style='text-align:center; color:#94a3b8; font-size:0.9rem; margin:0.4rem 0;'>"
            f"{base_monday.strftime('%Y/%m/%d')} 〜 "
            f"{(base_monday+timedelta(6)).strftime('%m/%d')}</p>",
            unsafe_allow_html=True,
        )
    with nav_c3:
        if st.button("次週 →"):
            st.session_state["week_offset"] = week_offset + 1
            st.rerun()
    if week_offset != 0:
        if st.button("今週に戻る"):
            st.session_state["week_offset"] = 0
            st.rerun()

    day_names = ["月", "火", "水", "木", "金", "土", "日"]
    cols_week = st.columns(7)

    df_tmp = df_cal.copy() if not df_cal.empty else pd.DataFrame(columns=["date","title","start_time","category"])
    if not df_tmp.empty:
        df_tmp["date_parsed"] = pd.to_datetime(df_tmp["date"], errors="coerce").dt.date

    for i, col in enumerate(cols_week):
        target = base_monday + timedelta(days=i)
        is_today = target == today
        is_weekend = i >= 5

        header_color = "#f87171" if is_weekend else ("#93c5fd" if is_today else "#94a3b8")
        bg_style = "background:#1e3a5f; border:1px solid #3b82f6;" if is_today else \
                   "background:#161b27; border:1px solid #1e2a3a;"

        with col:
            st.markdown(
                f'<div style="{bg_style} border-radius:8px; padding:0.5rem; min-height:120px;">'
                f'<div style="font-size:0.7rem; color:{header_color}; font-weight:700; margin-bottom:0.4rem;">'
                f'{day_names[i]} {target.strftime("%-m/%-d")}</div>',
                unsafe_allow_html=True,
            )
            if not df_tmp.empty:
                day_events = df_tmp[df_tmp["date_parsed"] == target]
                for _, ev in day_events.iterrows():
                    cat   = ev.get("category", "その他")
                    color = CAT_COLORS.get(cat, "#94a3b8")
                    time_str = ev.get("start_time", "")
                    st.markdown(
                        f'<div style="background:{color}22; border-left:2px solid {color}; '
                        f'border-radius:3px; padding:0.2rem 0.35rem; margin-bottom:0.25rem; '
                        f'font-size:0.68rem; color:{color};">'
                        f'{time_str + " " if time_str else ""}{ev["title"]}</div>',
                        unsafe_allow_html=True,
                    )
            st.markdown("</div>", unsafe_allow_html=True)

# ================================================================
# TAB: 予定追加
# ================================================================
with tab_add:
    st.markdown('<div class="quick-form-card">', unsafe_allow_html=True)
    with st.form("cal_add", clear_on_submit=True):
        f1, f2 = st.columns(2)
        with f1:
            title     = st.text_input("タイトル *", placeholder="例：プロジェクト定例")
            ev_date   = st.date_input("日付 *", value=today)
            category  = st.selectbox("カテゴリ", EVENT_CATS)
        with f2:
            start_time = st.text_input("開始時刻", placeholder="例：10:00")
            end_time   = st.text_input("終了時刻", placeholder="例：11:00")
            memo       = st.text_area("メモ", height=80)

        if st.form_submit_button("追加", type="primary"):
            if title:
                append_row("calendar_events", {
                    "id":         generate_id(),
                    "title":      title,
                    "date":       ev_date.isoformat(),
                    "start_time": start_time,
                    "end_time":   end_time,
                    "category":   category,
                    "memo":       memo,
                    "created_at": datetime.now().isoformat(),
                })
                set_flash("success", f"「{title}」を追加しました")
                st.rerun()
            else:
                st.warning("タイトルは必須です")
    st.markdown("</div>", unsafe_allow_html=True)

# ================================================================
# TAB: ICSインポート
# ================================================================
with tab_import:
    st.markdown(
        "<p style='color:#94a3b8; font-size:0.85rem; margin-bottom:1rem;'>"
        "Googleカレンダー / Apple カレンダーからエクスポートした .ics ファイルの内容を"
        "テキストボックスにペーストしてインポートします。</p>",
        unsafe_allow_html=True,
    )

    ics_text = st.text_area("ICS テキストをペースト", height=200,
                             placeholder="BEGIN:VCALENDAR\n...\nEND:VCALENDAR")

    if st.button("インポート実行", type="primary"):
        if not ics_text.strip():
            st.warning("ICSテキストを入力してください")
        else:
            events_raw = re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", ics_text, re.DOTALL)
            imported = 0
            for ev_block in events_raw:
                def _field(name):
                    m = re.search(rf"^{name}[^:]*:(.*?)$", ev_block, re.MULTILINE)
                    return m.group(1).strip() if m else ""

                summary = _field("SUMMARY")
                dtstart = _field("DTSTART")
                dtend   = _field("DTEND")

                if not summary or not dtstart:
                    continue

                try:
                    dtstart_clean = re.sub(r"[TZ]", " ", dtstart[:15]).strip()
                    if len(dtstart_clean) >= 8:
                        d = datetime.strptime(dtstart_clean[:8], "%Y%m%d").date()
                    else:
                        continue
                    time_str = ""
                    if len(dtstart_clean) >= 13:
                        time_str = dtstart_clean[9:11] + ":" + dtstart_clean[11:13]
                    end_time_str = ""
                    if dtend:
                        dtend_clean = re.sub(r"[TZ]", " ", dtend[:15]).strip()
                        if len(dtend_clean) >= 13:
                            end_time_str = dtend_clean[9:11] + ":" + dtend_clean[11:13]
                except Exception:
                    continue

                append_row("calendar_events", {
                    "id":         generate_id(),
                    "title":      summary,
                    "date":       d.isoformat(),
                    "start_time": time_str,
                    "end_time":   end_time_str,
                    "category":   "その他",
                    "memo":       "",
                    "created_at": datetime.now().isoformat(),
                })
                imported += 1

            if imported:
                set_flash("success", f"{imported}件のイベントをインポートしました")
                st.rerun()
            else:
                st.warning("インポートできるイベントが見つかりませんでした")

# ================================================================
# TAB: 全予定一覧
# ================================================================
with tab_all:
    df_all_cal = load("calendar_events")

    if df_all_cal.empty:
        st.info("予定がありません")
    else:
        df_all_cal["date_parsed"] = pd.to_datetime(df_all_cal["date"], errors="coerce").dt.date
        df_all_cal = df_all_cal.sort_values("date_parsed", ascending=False).reset_index(drop=True)

        filter_cat = st.selectbox("カテゴリフィルタ", ["すべて"] + EVENT_CATS)
        if filter_cat != "すべて":
            df_all_cal = df_all_cal[df_all_cal["category"] == filter_cat]

        for _, ev in df_all_cal.iterrows():
            cat   = ev.get("category", "その他")
            color = CAT_COLORS.get(cat, "#94a3b8")
            time_info = ""
            if ev.get("start_time"):
                time_info = ev["start_time"]
                if ev.get("end_time"):
                    time_info += f"–{ev['end_time']}"

            with st.expander(
                f"{ev['date']}　{ev['title']}　[{cat}]"
                + (f"　{time_info}" if time_info else ""),
                expanded=False
            ):
                ec1, ec2 = st.columns([3, 1])
                with ec1:
                    st.markdown(
                        f"**日付：** {ev['date']}　**時刻：** {time_info or '終日'}　"
                        f"**カテゴリ：** {cat}",
                    )
                    if ev.get("memo"):
                        st.caption(ev["memo"])
                with ec2:
                    if st.button("削除", key=f"cal_del_{ev['id']}"):
                        df_fresh = load("calendar_events")
                        df_fresh = df_fresh[df_fresh["id"] != ev["id"]]
                        save("calendar_events", df_fresh)
                        set_flash("success", "削除しました")
                        st.rerun()
