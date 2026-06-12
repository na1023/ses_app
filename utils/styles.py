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
    padding: 1.5rem 2rem 3rem;
    max-width: 960px;
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

/* ===== 時刻入力ヘルパーテキスト ===== */
.time-hint {
    font-size: 0.72rem;
    color: #64748b;
    margin-top: -0.4rem;
    margin-bottom: 0.5rem;
}

/* ===== レスポンシブ (スマホ) ===== */
@media (max-width: 768px) {
    .main .block-container {
        padding: 0.75rem 0.75rem 2rem;
    }
    .page-header h1 { font-size: 1.15rem; }
    .page-header p  { font-size: 0.78rem; }
    .kpi-value      { font-size: 1.5rem; }
    .kpi-label      { font-size: 0.68rem; }
    .kpi-card       { padding: 0.85rem 0.6rem; }
    .section-card   { padding: 0.85rem 0.75rem; }
    .styled-table   { font-size: 0.76rem; }
    .styled-table th, .styled-table td { padding: 0.45rem 0.4rem; }
    div[data-testid="column"] { min-width: 0; }
    .stButton > button { min-height: 2.8rem; font-size: 0.95rem; }
}
</style>
"""


APP_VERSION = "1.1.0"


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
        st.page_link("pages/4_レポート.py",         label="レポート")
        st.page_link("pages/5_設定_データ管理.py", label="設定・データ管理")
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
