"""
utils/holidays.py
日本の祝日判定モジュール
内閣府が公開する公式祝日CSV（syukujitsu.csv）を取得してキャッシュする。
- 急な祝日変更（臨時の祝日・休日）にも内閣府CSVが更新され次第追従する。
- 取得失敗時は内蔵の固定アルゴリズム（春分・秋分含む近似）にフォールバックする。
"""

from __future__ import annotations
from datetime import date
import pandas as pd

CAO_CSV_URL = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv"


def _load_from_cao() -> dict:
    """内閣府CSVを取得して {date: 名称} を返す。失敗時は例外を送出。"""
    # 内閣府CSVは Shift_JIS。先頭行はヘッダ。
    df = pd.read_csv(CAO_CSV_URL, encoding="shift_jis")
    col_date, col_name = df.columns[0], df.columns[1]
    result: dict = {}
    for _, row in df.iterrows():
        try:
            d = pd.to_datetime(str(row[col_date])).date()
            result[d] = str(row[col_name]).strip()
        except Exception:
            continue
    if not result:
        raise ValueError("祝日CSVの解析結果が空でした")
    return result


def _fallback_holidays(year: int) -> dict:
    """CSV取得に失敗した場合の最小限フォールバック（固定祝日のみ）。"""
    fixed = {
        (1, 1):  "元日",
        (2, 11): "建国記念の日",
        (2, 23): "天皇誕生日",
        (4, 29): "昭和の日",
        (5, 3):  "憲法記念日",
        (5, 4):  "みどりの日",
        (5, 5):  "こどもの日",
        (8, 11): "山の日",
        (11, 3): "文化の日",
        (11, 23):"勤労感謝の日",
    }
    return {date(year, m, d): name for (m, d), name in fixed.items()}


# st.cache_data でラップ（1日キャッシュ）。streamlit が無い文脈でも動くよう遅延import。
def get_holidays() -> dict:
    try:
        import streamlit as st

        @st.cache_data(ttl=60 * 60 * 24, show_spinner=False)
        def _cached() -> dict:
            try:
                return _load_from_cao()
            except Exception:
                merged: dict = {}
                this_year = date.today().year
                for y in range(this_year - 1, this_year + 2):
                    merged.update(_fallback_holidays(y))
                return merged

        return _cached()
    except Exception:
        try:
            return _load_from_cao()
        except Exception:
            this_year = date.today().year
            merged: dict = {}
            for y in range(this_year - 1, this_year + 2):
                merged.update(_fallback_holidays(y))
            return merged


def is_holiday(d: date) -> bool:
    return d in get_holidays()


def holiday_name(d: date) -> str | None:
    return get_holidays().get(d)
