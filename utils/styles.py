"""
utils/styles.py
アプリ全体で使用するスタイル定数を管理するモジュール
"""

THEME_CSS = """
<style>

[data-testid="stSidebarNav"] {
    display: none !important;
}

/* ===== ベースリセット ===== */
[data-testid="stAppViewContainer"] {
    background: #0f1117;
}
[data-testid="stSidebar"] {
    background: #161b27 !important;
    border-right: 1px solid #1e2a3a;
}
[data-testid="stSidebar"] * {
    color: #c8d6e5 !important;
}

/* ===== メインコンテンツ ===== */
.main .block-container {
    padding: 1.5rem 1.5rem 3rem;
    max-width: 1100px;
}

/* ===== ページタイトル ===== */
.page-header {
    border-left: 4px solid #3b82f6;
    padding-left: 1rem;
    margin-bottom: 1.5rem;
}
.page-header h1 {
    font-size: 1.6rem;
    font-weight: 700;
    color: #e2e8f0;
    margin: 0 0 0.2rem 0;
    letter-spacing: -0.02em;
}
.page-header p {
    font-size: 0.85rem;
    color: #64748b;
    margin: 0;
}

/* ===== KPIカード ===== */
.kpi-card {
    background: #161b27;
    border: 1px solid #1e2a3a;
    border-radius: 10px;
    padding: 1.25rem 1.5rem;
    text-align: center;
    transition: border-color 0.2s;
}
.kpi-card:hover { border-color: #3b82f6; }
.kpi-label {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.5rem;
}
.kpi-value {
    font-size: 2.2rem;
    font-weight: 800;
    color: #3b82f6;
    line-height: 1;
}
.kpi-unit {
    font-size: 0.9rem;
    color: #94a3b8;
    margin-left: 0.2rem;
}

/* ===== セクションカード ===== */
.section-card {
    background: #161b27;
    border: 1px solid #1e2a3a;
    border-radius: 10px;
    padding: 1.25rem;
    margin-bottom: 1rem;
}

/* ===== バッジ ===== */
.badge {
    display: inline-block;
    padding: 0.2rem 0.65rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    white-space: nowrap;
}
.badge-green  { background: #052e16; color: #4ade80; border: 1px solid #166534; }
.badge-red    { background: #2d0707; color: #f87171; border: 1px solid #7f1d1d; }
.badge-yellow { background: #1c1400; color: #fbbf24; border: 1px solid #78350f; }
.badge-blue   { background: #0c1a2e; color: #60a5fa; border: 1px solid #1e40af; }
.badge-gray   { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }

/* ===== テーブルラッパー（横スクロール） ===== */
.table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}
/* ===== テーブル ===== */
.styled-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    min-width: 480px;
}
.styled-table th {
    background: #1e2a3a;
    color: #94a3b8;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.6rem 0.8rem;
    text-align: left;
    border-bottom: 1px solid #1e2a3a;
    white-space: nowrap;
}
.styled-table td {
    color: #c8d6e5;
    padding: 0.65rem 0.8rem;
    border-bottom: 1px solid #1e2a3a;
}
.styled-table tr:hover td { background: #1e2a3a; }

/* ===== Streamlit ウィジェット上書き ===== */
div[data-testid="stMetricValue"] {
    font-size: 2rem !important;
    color: #3b82f6 !important;
}
.stButton > button {
    border-radius: 8px !important;
    font-weight: 600 !important;
    min-height: 2.5rem;
}
.stSelectbox label, .stTextInput label, .stTextArea label,
.stDateInput label, .stNumberInput label {
    color: #94a3b8 !important;
    font-size: 0.82rem !important;
}
[data-testid="stSidebarNav"] a[aria-selected="true"] {
    background: #1e3a5f !important;
    border-radius: 6px;
}

/* ===== パーソナルコントロールセンター ===== */
.transit-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #161b27;
    border: 1px solid #1e2a3a;
    border-radius: 12px;
    padding: 1rem 0.5rem;
    cursor: pointer;
    transition: all 0.15s ease;
    text-decoration: none !important;
    gap: 0.35rem;
    min-height: 80px;
}
.transit-btn:hover {
    background: #1e2a3a;
    border-color: #3b82f6;
    transform: translateY(-1px);
}
.transit-icon { font-size: 1.6rem; line-height: 1; }
.transit-label { font-size: 0.78rem; font-weight: 600; color: #c8d6e5; text-align: center; }
.transit-sub   { font-size: 0.65rem; color: #64748b; text-align: center; }

.badge-income  { background: #052e16; color: #4ade80; border: 1px solid #166534; }
.badge-expense { background: #2d0707; color: #f87171; border: 1px solid #7f1d1d; }
.badge-acquired { background: #052e16; color: #4ade80; border: 1px solid #166534; }
.badge-studying { background: #0c1a2e; color: #60a5fa; border: 1px solid #1e40af; }
.badge-planned  { background: #1c1400; color: #fbbf24; border: 1px solid #78350f; }
.badge-expired  { background: #2d0707; color: #f87171; border: 1px solid #7f1d1d; }

.alert-card {
    background: #1c0f00;
    border: 1px solid #78350f;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
}
.alert-card.urgent { background: #1a0000; border-color: #7f1d1d; }
.alert-icon  { font-size: 1.1rem; }
.alert-body  { flex: 1; }
.alert-title { font-size: 0.88rem; font-weight: 600; color: #e2e8f0; }
.alert-sub   { font-size: 0.75rem; color: #94a3b8; margin-top: 0.1rem; }
.alert-days  { font-size: 0.72rem; font-weight: 700; color: #fbbf24; white-space: nowrap; }
.alert-days.urgent { color: #f87171; }

.event-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.6rem 0;
    border-bottom: 1px solid #1e2a3a;
}
.event-item:last-child { border-bottom: none; }
.event-date-tag {
    background: #0c1a2e;
    border: 1px solid #1e40af;
    border-radius: 6px;
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
    font-weight: 700;
    color: #60a5fa;
    white-space: nowrap;
    min-width: 60px;
    text-align: center;
}
.event-date-tag.today { background: #1e3a5f; border-color: #3b82f6; color: #93c5fd; }
.event-title { font-size: 0.85rem; color: #e2e8f0; font-weight: 500; }
.event-time  { font-size: 0.72rem; color: #64748b; }

.kakeibo-summary { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
.ks-block {
    flex: 1;
    min-width: 110px;
    background: #161b27;
    border: 1px solid #1e2a3a;
    border-radius: 8px;
    padding: 0.75rem 1rem;
}
.ks-label   { font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
.ks-value   { font-size: 1.35rem; font-weight: 800; margin-top: 0.15rem; }
.ks-income  { color: #4ade80; }
.ks-expense { color: #f87171; }
.ks-balance { color: #60a5fa; }

.cat-bar-wrap  { margin: 0.4rem 0; }
.cat-bar-label { font-size: 0.75rem; color: #94a3b8; display: flex; justify-content: space-between; }
.cat-bar-track { background: #1e2a3a; border-radius: 4px; height: 6px; margin-top: 0.2rem; }
.cat-bar-fill  { background: #3b82f6; border-radius: 4px; height: 6px; }
.cat-bar-fill.income { background: #4ade80; }

.quick-form-card {
    background: #0c1a2e;
    border: 1px solid #1e40af;
    border-radius: 12px;
    padding: 1.25rem;
    margin-bottom: 1rem;
}

/* ===== レスポンシブ (スマホ) ===== */
@media (max-width: 768px) {
    .main .block-container {
        padding: 0.75rem 0.5rem 2rem;
    }
    .page-header h1 { font-size: 1.2rem; }
    .page-header p  { font-size: 0.78rem; }
    .kpi-value      { font-size: 1.6rem; }
    .kpi-label      { font-size: 0.7rem; }
    .kpi-card       { padding: 0.9rem 0.75rem; }
    .section-card   { padding: 0.9rem; }
    .styled-table   { font-size: 0.78rem; }
    .styled-table th, .styled-table td { padding: 0.5rem 0.5rem; }
    div[data-testid="column"] { min-width: 0; }
    .stButton > button { min-height: 3rem; font-size: 1rem; }
    .ks-value { font-size: 1.1rem; }
    .transit-label { font-size: 0.72rem; }
    }
</style>
"""


APP_VERSION = "1.2.0"


def set_flash(kind: str, message: str) -> None:
    """rerun 後に表示するメッセージをセッションに保存する。kind: success/error/warning/info"""
    import streamlit as st
    st.session_state["_flash"] = (kind, message)


def show_flash() -> None:
    """ページ先頭で呼び出してフラッシュメッセージを表示・クリアする"""
    import streamlit as st
    if "_flash" in st.session_state:
        kind, msg = st.session_state.pop("_flash")
        getattr(st, kind)(msg)


def render_sidebar() -> None:
    """全ページ共通のサイドバーナビゲーションを描画する"""
    import streamlit as st
    from datetime import datetime

    with st.sidebar:
        st.markdown("## SES業務管理")
        st.markdown(
            f"<div style='font-size:0.72rem; color:#475569; margin-top:-0.5rem; "
            f"margin-bottom:0.75rem; padding-left:0.1rem;'>ver {APP_VERSION}</div>",
            unsafe_allow_html=True,
        )
        st.markdown("---")
        st.markdown(
            "<div style='font-size:0.75rem; color:#64748b; padding: 0 0.25rem; "
            "margin-bottom:0.25rem;'>ナビゲーション</div>",
            unsafe_allow_html=True,
        )
        st.page_link("app.py",                    label="ダッシュボード")
        st.page_link("pages/1_案件管理.py",        label="案件管理")
        st.page_link("pages/2_面談_ToDo管理.py",   label="面談・ToDo管理")
        st.page_link("pages/3_日報管理.py",        label="日報管理")
        st.page_link("pages/8_勤怠_有給管理.py",   label="有給・残業管理")
        st.page_link("pages/6_給与管理.py",        label="給与管理")
        st.page_link("pages/7_職務経歴生成.py",    label="職務経歴生成")
        st.page_link("pages/4_レポート.py",         label="レポート")
        st.page_link("pages/5_設定_データ管理.py", label="設定・データ管理")

        st.markdown("---")
        st.markdown(
            "<div style='font-size:0.75rem; color:#64748b; padding: 0 0.25rem; "
            "margin-bottom:0.25rem;'>パーソナル</div>",
            unsafe_allow_html=True,
        )
        st.page_link("pages/9_コントロールセンター.py",  label="コントロールセンター")
        st.page_link("pages/10_家計簿.py",               label="家計簿")
        st.page_link("pages/11_カレンダー.py",            label="カレンダー")
        st.page_link("pages/12_資格管理.py",              label="資格管理")
        st.page_link("pages/13_運行情報.py",              label="運行情報")

        st.markdown("---")
        if st.session_state.get("backup_path"):
            st.caption("自動バックアップ完了")
        st.caption(datetime.now().strftime("%Y/%m/%d %H:%M"))


def status_badge(status: str) -> str:
    """ステータス文字列を色つきバッジ HTML に変換する"""
    mapping = {
        "通過":    ("badge-green",  "通過"),
        "不通過":  ("badge-red",    "不通過"),
        "結果待ち": ("badge-yellow", "結果待ち"),
        "完了":    ("badge-green",  "完了"),
        "進行中":  ("badge-blue",   "進行中"),
        "未着手":  ("badge-gray",   "未着手"),
    }
    cls, label = mapping.get(status, ("badge-gray", status))
    return f'<span class="badge {cls}">{label}</span>'
