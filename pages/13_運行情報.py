"""
pages/13_運行情報.py
運行情報ショートカット管理 ― 駅・路線ページへのワンタップアクセス
"""

import streamlit as st
import pandas as pd
from datetime import datetime

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import init_all, load, save, append_row, generate_id
from utils.styles import THEME_CSS, render_sidebar, show_flash, set_flash

st.set_page_config(page_title="運行情報", layout="wide", initial_sidebar_state="expanded")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()
show_flash()

# 鉄道会社ごとの運行情報URLテンプレート集
PRESET_URLS = {
    "Yahoo!路線情報（遅延情報）": "https://transit.yahoo.co.jp/traininfo/top",
    "JR東日本 運行情報":          "https://traininfo.jreast.co.jp/train_info/",
    "東京メトロ 運行情報":        "https://www.tokyometro.jp/unkou/",
    "都営地下鉄 運行情報":        "https://www.kotsu.metro.tokyo.jp/subway/unkou/",
    "小田急線 運行情報":          "https://www.odakyu.jp/train/",
    "東急線 運行情報":            "https://www.tokyu.co.jp/railway/train_info/",
    "京王線 運行情報":            "https://www.keio.co.jp/train/unkou/",
    "西武線 運行情報":            "https://www.seiburailway.jp/railway/train_info/",
    "東武線 運行情報":            "https://www.tobu.co.jp/railway/delay/",
    "京急線 運行情報":            "https://www.keikyu.co.jp/train/",
    "相鉄線 運行情報":            "https://www.sotetsu.co.jp/train/unkou/",
    "カスタムURL":                "",
}

ICON_OPTIONS = ["🚃", "🚇", "🚆", "🚄", "🚊", "🏃", "🚌", "⭐"]

st.markdown(
    '<div class="page-header"><h1>運行情報</h1>'
    '<p>よく使う鉄道運行情報ページへのショートカットを管理します</p></div>',
    unsafe_allow_html=True,
)

df = load("transit_shortcuts")

# ================================================================
# ショートカット一覧（ワンタップアクセス）
# ================================================================
st.markdown('<div class="section-card">', unsafe_allow_html=True)
st.markdown(
    "<p style='font-size:0.72rem; color:#64748b; text-transform:uppercase; "
    "letter-spacing:0.08em; margin-bottom:0.75rem;'>登録済みショートカット</p>",
    unsafe_allow_html=True,
)

if df.empty:
    st.markdown(
        "<p style='color:#475569; font-size:0.85rem;'>まだショートカットが登録されていません。"
        "下のフォームから追加してください。</p>",
        unsafe_allow_html=True,
    )
else:
    df_sorted = df.copy()
    df_sorted["display_order"] = pd.to_numeric(df_sorted["display_order"], errors="coerce").fillna(99)
    df_sorted = df_sorted.sort_values("display_order").reset_index(drop=True)

    n_cols = min(len(df_sorted), 5)
    cols = st.columns(n_cols)
    for i, row in df_sorted.iterrows():
        with cols[i % n_cols]:
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
# 新規ショートカット追加
# ================================================================
with st.expander("ショートカットを追加", expanded=df.empty):
    st.markdown('<div class="quick-form-card">', unsafe_allow_html=True)

    preset_key = st.selectbox("プリセットから選択（URLを自動入力）", list(PRESET_URLS.keys()))
    preset_url = PRESET_URLS[preset_key]

    with st.form("transit_add", clear_on_submit=True):
        fc1, fc2 = st.columns(2)
        with fc1:
            label       = st.text_input("表示名 *", value="" if preset_key == "カスタムURL" else preset_key,
                                         placeholder="例：JR東日本")
            station     = st.text_input("駅名・路線名", placeholder="例：渋谷駅")
            line        = st.text_input("路線名（副題）", placeholder="例：JR山手線")
        with fc2:
            url         = st.text_input("URL *", value=preset_url, placeholder="https://...")
            icon        = st.selectbox("アイコン", ICON_OPTIONS)
            order       = st.number_input("表示順", min_value=1, value=len(df)+1)

        if st.form_submit_button("追加", type="primary"):
            if label and url:
                append_row("transit_shortcuts", {
                    "id":            generate_id(),
                    "label":         label,
                    "station_name":  station,
                    "line_name":     line,
                    "url":           url,
                    "icon":          icon,
                    "display_order": str(int(order)),
                })
                set_flash("success", f"「{label}」を追加しました")
                st.rerun()
            else:
                st.warning("表示名とURLは必須です")

    st.markdown("</div>", unsafe_allow_html=True)

# ================================================================
# 編集・削除・並び替え
# ================================================================
if not df.empty:
    st.markdown(
        "<p style='font-size:0.75rem; color:#475569; margin-top:1.5rem; margin-bottom:0.5rem;'>"
        "個別編集・削除</p>",
        unsafe_allow_html=True,
    )
    df_edit = load("transit_shortcuts")
    df_edit["display_order"] = pd.to_numeric(df_edit["display_order"], errors="coerce").fillna(99)
    df_edit = df_edit.sort_values("display_order")

    for _, row in df_edit.iterrows():
        icon  = row.get("icon") or "🚃"
        label = row.get("label") or "―"
        with st.expander(f"{icon} {label}"):
            e1, e2 = st.columns(2)
            with e1:
                new_label   = st.text_input("表示名", value=row.get("label",""), key=f"tl_{row['id']}")
                new_station = st.text_input("駅名", value=row.get("station_name",""), key=f"ts_{row['id']}")
                new_line    = st.text_input("路線名", value=row.get("line_name",""), key=f"tln_{row['id']}")
            with e2:
                new_url     = st.text_input("URL", value=row.get("url",""), key=f"tu_{row['id']}")
                new_icon    = st.selectbox("アイコン", ICON_OPTIONS,
                                           index=ICON_OPTIONS.index(row.get("icon","🚃")) if row.get("icon","🚃") in ICON_OPTIONS else 0,
                                           key=f"ti_{row['id']}")
                new_order   = st.number_input("表示順", value=int(row.get("display_order", 1)),
                                              min_value=1, key=f"to_{row['id']}")

            b1, b2 = st.columns([1, 4])
            with b1:
                if st.button("削除", key=f"tdel_{row['id']}", type="secondary"):
                    df_all = load("transit_shortcuts")
                    df_all = df_all[df_all["id"] != row["id"]]
                    save("transit_shortcuts", df_all)
                    set_flash("success", "削除しました")
                    st.rerun()
            with b2:
                if st.button("更新", key=f"tupd_{row['id']}", type="primary"):
                    df_all = load("transit_shortcuts")
                    idx    = df_all[df_all["id"] == row["id"]].index
                    if len(idx):
                        i = idx[0]
                        df_all.loc[i, "label"]         = new_label
                        df_all.loc[i, "station_name"]  = new_station
                        df_all.loc[i, "line_name"]     = new_line
                        df_all.loc[i, "url"]           = new_url
                        df_all.loc[i, "icon"]          = new_icon
                        df_all.loc[i, "display_order"] = str(new_order)
                        save("transit_shortcuts", df_all)
                        set_flash("success", "更新しました")
                        st.rerun()

# ================================================================
# 参考URL一覧
# ================================================================
with st.expander("主要鉄道会社 運行情報URL一覧（参考）"):
    for name, url in PRESET_URLS.items():
        if url:
            st.markdown(f"- [{name}]({url})")
