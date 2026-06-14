"""
utils/ui.py
画面共通のUIコンポーネント
- jp_date_selector: 年/月/日を日本語セレクトボックスで選ばせる（未定可）
- persist_selectbox: ページ遷移しても選択状態と表示を完全に同期させる selectbox
"""

from __future__ import annotations
import calendar
from datetime import date


def _parse_default(default) -> date | None:
    """default が str(YYYY-MM-DD) / date / None いずれでも date|None に正規化"""
    if default is None or default == "":
        return None
    if isinstance(default, date):
        return default
    try:
        s = str(default)
        y, m, d = s.split("-")[:3]
        return date(int(y), int(m), int(d))
    except Exception:
        return None


def jp_date_selector(
    key_prefix: str,
    default=None,
    allow_empty: bool = False,
    year_back: int = 3,
    year_fwd: int = 5,
) -> str:
    """
    年・月・日を日本語セレクトボックスで選ばせ YYYY-MM-DD 文字列を返す。
    allow_empty=True の場合「未定」チェックで空文字を返せる。
    """
    import streamlit as st

    today = date.today()
    dflt = _parse_default(default) or today
    years = list(range(today.year - year_back, today.year + year_fwd + 1))
    if dflt.year not in years:
        years = sorted(set(years) | {dflt.year})
    months_jp = [f"{m}月" for m in range(1, 13)]

    if allow_empty:
        default_undecided = (default in ("", "未定", "—")) or (default is not None and _parse_default(default) is None)
        is_undecided = st.checkbox(
            "未定", value=bool(default_undecided),
            key=f"{key_prefix}_undecided",
        )
        if is_undecided:
            st.caption("未定として登録します")
            return ""

    d1, d2, d3 = st.columns(3)
    sel_y = d1.selectbox(
        "年", years,
        index=years.index(dflt.year),
        key=f"{key_prefix}_y", label_visibility="collapsed",
    )
    sel_m = d2.selectbox(
        "月", months_jp,
        index=dflt.month - 1,
        key=f"{key_prefix}_m", label_visibility="collapsed",
    )
    sel_m_int = months_jp.index(sel_m) + 1
    max_day = calendar.monthrange(sel_y, sel_m_int)[1]
    days = [f"{d}日" for d in range(1, max_day + 1)]
    sel_d = d3.selectbox(
        "日", days,
        index=min(dflt.day, max_day) - 1,
        key=f"{key_prefix}_d", label_visibility="collapsed",
    )
    sel_d_int = int(sel_d.replace("日", ""))
    st.caption(f"選択中: {sel_y}年{sel_m}{sel_d}")
    return f"{sel_y}-{sel_m_int:02d}-{sel_d_int:02d}"


def persist_selectbox(label, options, state_key, format_func=None, **kwargs):
    """
    ページ遷移しても選択状態と表示を完全同期させる selectbox。

    Streamlit のマルチページ構成では、別ページへ遷移するとウィジェットの
    session_state キーが破棄され、戻ってきた際に既定値（先頭）へ戻る一方、
    見た目だけ前回の選択が残るといった不整合が起きることがある。
    値を専用のミラーキーに常時退避し、ウィジェットキーが失われていれば
    復元してからウィジェットを生成することで、表示とデータを必ず一致させる。
    """
    import streamlit as st

    if not options:
        return None

    mirror = f"{state_key}__persist"
    # ウィジェットキーが失われていればミラーから復元
    if state_key not in st.session_state and st.session_state.get(mirror) in options:
        st.session_state[state_key] = st.session_state[mirror]
    # ミラー値がもう選択肢に無い場合は破棄
    if st.session_state.get(mirror) not in options and state_key not in st.session_state:
        st.session_state.pop(mirror, None)

    val = st.selectbox(
        label, options,
        key=state_key,
        format_func=format_func or (lambda x: x),
        **kwargs,
    )
    st.session_state[mirror] = val
    return val
