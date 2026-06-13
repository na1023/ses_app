"""
utils/summarizer.py
日報データから職務経歴の実績を自動生成するモジュール
外部API不使用・Python標準ライブラリ + Pandas/Collections のみ
"""

from __future__ import annotations
import re
from collections import Counter
from datetime import date, datetime
import pandas as pd


def extract_period(df: pd.DataFrame, start: str, end: str) -> pd.DataFrame:
    """start/end (YYYY-MM-DD) の範囲で日報を絞り込む"""
    df = df.copy()
    df["_date"] = pd.to_datetime(df["date"], errors="coerce")
    mask = (df["_date"] >= pd.Timestamp(start)) & (df["_date"] <= pd.Timestamp(end))
    return df[mask].drop(columns=["_date"]).reset_index(drop=True)


def _normalize(text: str) -> str:
    """連続空白・記号を整理して比較用に正規化"""
    return re.sub(r"[\s　]+", " ", str(text)).strip()


def _dedup_sentences(texts: list[str]) -> list[str]:
    """重複文を除去（先頭40文字で一致判定）"""
    seen: set[str] = set()
    result: list[str] = []
    for t in texts:
        key = _normalize(t)[:40]
        if key and key not in seen:
            seen.add(key)
            result.append(_normalize(t))
    return result


def _rank_tech_tags(df: pd.DataFrame, col: str = "work_content") -> list[tuple[str, int]]:
    """
    work_content からキーワード頻度をカウントする。
    （tech_tags カラムがあればそちらも使う）
    """
    counter: Counter = Counter()

    # tech_tags カラムがある場合
    if "tech_tags" in df.columns:
        for val in df["tech_tags"].dropna():
            for tag in re.split(r"[,、\s]+", str(val)):
                tag = tag.strip()
                if len(tag) >= 2:
                    counter[tag] += 1

    # work_content からも簡易抽出（英数字 or 日本語カタカナ語）
    pattern = re.compile(r"\b[A-Za-z][A-Za-z0-9+#.\-]{1,20}\b|[ァ-ヶー]{3,}")
    for val in df[col].dropna():
        for m in pattern.findall(str(val)):
            counter[m.strip()] += 1

    # 一般的すぎる語を除外
    STOPWORDS = {
        "the","for","and","with","to","of","in","on","as","at","by","or",
        "PC","OK","PM","AM","ID","WEB","Web","App","API","DB","IT","HR",
    }
    return [(k, v) for k, v in counter.most_common(20) if k not in STOPWORDS]


def _summarize_activities(df: pd.DataFrame) -> list[str]:
    """業務内容を重複除去して返す（最大30件）"""
    raw = df["work_content"].dropna().tolist()
    return _dedup_sentences(raw)[:30]


def generate_career_markdown(
    df_period: pd.DataFrame,
    start: str,
    end: str,
    max_tech: int = 10,
) -> str:
    """
    絞り込み済み DataFrame から職務経歴Markdownを生成する。
    """
    if df_period.empty:
        return "_対象期間に日報データがありません。_"

    # 基本情報
    company      = df_period["company"].dropna().mode().iloc[0] if not df_period["company"].dropna().empty else "—"
    project_name = df_period["project_name"].dropna().mode().iloc[0] if not df_period["project_name"].dropna().empty else "—"
    days         = df_period["date"].nunique()
    total_hours  = pd.to_numeric(df_period["work_hours"], errors="coerce").sum()
    att_counts   = df_period["attendance_type"].value_counts().to_dict()

    # 技術タグ
    tech_list = _rank_tech_tags(df_period)[:max_tech]
    tech_line = "、".join(f"{tag}（{cnt}件）" for tag, cnt in tech_list) if tech_list else "—"

    # 業務内容
    activities = _summarize_activities(df_period)

    # 勤怠サマリ
    att_summary = "　".join(f"{k}:{v}日" for k, v in att_counts.items())

    # Markdown 生成
    lines = [
        f"## 職務経歴",
        f"",
        f"| 項目 | 内容 |",
        f"|---|---|",
        f"| 期間 | {start} 〜 {end} |",
        f"| 会社名 | {company} |",
        f"| 案件名 | {project_name} |",
        f"| 稼働日数 | {days} 日 |",
        f"| 合計稼働時間 | {total_hours:.2f} h |",
        f"| 勤怠内訳 | {att_summary} |",
        f"",
        f"### 使用技術・キーワード",
        f"",
        tech_line,
        f"",
        f"### 業務内容（重複除去）",
        f"",
    ]
    for act in activities:
        lines.append(f"- {act}")

    return "\n".join(lines)


def generate_career_text(
    df_period: pd.DataFrame,
    start: str,
    end: str,
) -> str:
    """職務経歴書向けプレーンテキストを生成する"""
    if df_period.empty:
        return "対象期間に日報データがありません。"

    company      = df_period["company"].dropna().mode().iloc[0] if not df_period["company"].dropna().empty else "—"
    project_name = df_period["project_name"].dropna().mode().iloc[0] if not df_period["project_name"].dropna().empty else "—"
    days         = df_period["date"].nunique()
    total_hours  = pd.to_numeric(df_period["work_hours"], errors="coerce").sum()
    tech_list    = _rank_tech_tags(df_period)[:10]
    activities   = _summarize_activities(df_period)

    tech_line = " / ".join(tag for tag, _ in tech_list) if tech_list else "—"
    act_lines = "\n".join(f"  ・{a}" for a in activities)

    return (
        f"【期間】{start} 〜 {end}\n"
        f"【会社名】{company}\n"
        f"【案件名】{project_name}\n"
        f"【稼働】{days}日 / {total_hours:.2f}h\n"
        f"【使用技術】{tech_line}\n"
        f"【業務内容】\n{act_lines}"
    )
