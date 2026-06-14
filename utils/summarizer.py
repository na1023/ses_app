"""
utils/summarizer.py
日報データから職務経歴書レベルの実績サマリーを自動生成するモジュール。
外部API不使用・Python標準ライブラリ + Pandas のみ。

方針：
- 技術名は辞書で正規化し、カテゴリ別（言語/FW/DB/インフラ/ツール）に整理。
- 業務内容は「設計・実装・テスト・調査・運用…」の工程キーワードで分類し、
  代表文を抽出・重複除去・体言止めに整形して職務経歴書向けに要約する。
- 一次情報（日報）を要約し、誤字・口語・冗長表現を簡易添削する。
"""

from __future__ import annotations
import re
from collections import Counter, defaultdict
import pandas as pd

# ============================================================
# 技術辞書（正規化名: [別名・表記ゆれ]）
# ============================================================
TECH_DICT: dict[str, dict] = {
    # 言語
    "Python":     {"cat": "言語", "alias": [r"python", r"パイソン"]},
    "Java":       {"cat": "言語", "alias": [r"java(?!script)"]},
    "JavaScript": {"cat": "言語", "alias": [r"javascript", r"js\b", r"ジャバスクリプト"]},
    "TypeScript": {"cat": "言語", "alias": [r"typescript", r"\bts\b"]},
    "C#":         {"cat": "言語", "alias": [r"c#", r"csharp"]},
    "C++":        {"cat": "言語", "alias": [r"c\+\+"]},
    "C":          {"cat": "言語", "alias": [r"\bc言語\b"]},
    "Go":         {"cat": "言語", "alias": [r"\bgolang\b", r"\bgo言語\b"]},
    "Ruby":       {"cat": "言語", "alias": [r"ruby", r"ルビー"]},
    "PHP":        {"cat": "言語", "alias": [r"\bphp\b"]},
    "Swift":      {"cat": "言語", "alias": [r"swift"]},
    "Kotlin":     {"cat": "言語", "alias": [r"kotlin"]},
    "SQL":        {"cat": "言語", "alias": [r"\bsql\b"]},
    "Shell":      {"cat": "言語", "alias": [r"shell", r"bash", r"シェル"]},
    "HTML/CSS":   {"cat": "言語", "alias": [r"\bhtml\b", r"\bcss\b"]},
    # フレームワーク
    "Django":     {"cat": "FW", "alias": [r"django"]},
    "Flask":      {"cat": "FW", "alias": [r"flask"]},
    "FastAPI":    {"cat": "FW", "alias": [r"fastapi"]},
    "Spring":     {"cat": "FW", "alias": [r"spring"]},
    "React":      {"cat": "FW", "alias": [r"react"]},
    "Vue.js":     {"cat": "FW", "alias": [r"vue"]},
    "Angular":    {"cat": "FW", "alias": [r"angular"]},
    "Next.js":    {"cat": "FW", "alias": [r"next\.?js"]},
    "Node.js":    {"cat": "FW", "alias": [r"node\.?js"]},
    "Rails":      {"cat": "FW", "alias": [r"rails", r"ルビーオンレールズ"]},
    "Laravel":    {"cat": "FW", "alias": [r"laravel"]},
    ".NET":       {"cat": "FW", "alias": [r"\.net", r"dotnet"]},
    "Streamlit":  {"cat": "FW", "alias": [r"streamlit"]},
    # DB
    "MySQL":      {"cat": "DB", "alias": [r"mysql"]},
    "PostgreSQL": {"cat": "DB", "alias": [r"postgres", r"postgresql"]},
    "Oracle":     {"cat": "DB", "alias": [r"oracle"]},
    "SQL Server": {"cat": "DB", "alias": [r"sql ?server"]},
    "MongoDB":    {"cat": "DB", "alias": [r"mongo"]},
    "Redis":      {"cat": "DB", "alias": [r"redis"]},
    "SQLite":     {"cat": "DB", "alias": [r"sqlite"]},
    "Supabase":   {"cat": "DB", "alias": [r"supabase"]},
    # インフラ/クラウド
    "AWS":        {"cat": "インフラ", "alias": [r"\baws\b", r"amazon web"]},
    "Azure":      {"cat": "インフラ", "alias": [r"azure"]},
    "GCP":        {"cat": "インフラ", "alias": [r"\bgcp\b", r"google cloud"]},
    "Docker":     {"cat": "インフラ", "alias": [r"docker"]},
    "Kubernetes": {"cat": "インフラ", "alias": [r"kubernetes", r"\bk8s\b"]},
    "Linux":      {"cat": "インフラ", "alias": [r"linux", r"centos", r"ubuntu"]},
    "Terraform":  {"cat": "インフラ", "alias": [r"terraform"]},
    # ツール
    "Git":        {"cat": "ツール", "alias": [r"\bgit\b", r"github", r"gitlab"]},
    "Jira":       {"cat": "ツール", "alias": [r"jira"]},
    "Backlog":    {"cat": "ツール", "alias": [r"backlog"]},
    "Jenkins":    {"cat": "ツール", "alias": [r"jenkins"]},
    "Excel":      {"cat": "ツール", "alias": [r"excel", r"エクセル"]},
    "Figma":      {"cat": "ツール", "alias": [r"figma"]},
}

CAT_ORDER = ["言語", "FW", "DB", "インフラ", "ツール"]
CAT_LABEL = {"言語": "言語", "FW": "フレームワーク", "DB": "データベース",
             "インフラ": "インフラ・クラウド", "ツール": "ツール"}

# 工程キーワード（業務分類用）
PHASE_KEYWORDS = {
    "要件定義": [r"要件定義", r"要件", r"ヒアリング", r"業務分析"],
    "設計":     [r"設計", r"基本設計", r"詳細設計", r"画面設計", r"db設計", r"アーキ"],
    "実装・開発": [r"実装", r"開発", r"コーディング", r"製造", r"プログラ"],
    "テスト":   [r"テスト", r"試験", r"単体", r"結合", r"検証", r"デバッグ", r"評価"],
    "レビュー": [r"レビュー", r"指摘", r"添削"],
    "運用・保守": [r"運用", r"保守", r"監視", r"障害", r"問い合わせ", r"対応"],
    "調査・分析": [r"調査", r"分析", r"検討", r"研究", r"比較"],
    "ドキュメント": [r"資料", r"ドキュメント", r"手順書", r"仕様書", r"報告書", r"マニュアル"],
    "会議・折衝": [r"会議", r"打ち合わせ", r"打合せ", r"mtg", r"ミーティング", r"報告", r"共有"],
}


def extract_period(df: pd.DataFrame, start: str, end: str) -> pd.DataFrame:
    """start/end (YYYY-MM-DD) の範囲で日報を絞り込む"""
    df = df.copy()
    df["_date"] = pd.to_datetime(df["date"], errors="coerce")
    mask = (df["_date"] >= pd.Timestamp(start)) & (df["_date"] <= pd.Timestamp(end))
    return df[mask].drop(columns=["_date"]).reset_index(drop=True)


# ------------------------------------------------------------
# 技術抽出
# ------------------------------------------------------------
def extract_technologies(df: pd.DataFrame) -> dict[str, list[tuple[str, int]]]:
    """work_content から技術を辞書ベースで抽出し、カテゴリ別に頻度付きで返す"""
    text_all = " \n ".join(str(v) for v in df.get("work_content", pd.Series([])).dropna())
    low = text_all.lower()
    counts: Counter = Counter()
    for canon, info in TECH_DICT.items():
        total = 0
        for pat in info["alias"]:
            # \b は日本語隣接（例: "aws上"）で境界にならないため、
            # ASCII英数字境界（前後が英数字でない）で囲んで判定する。
            core = pat.replace(r"\b", "")
            wrapped = rf"(?<![a-z0-9]){core}(?![a-z0-9])"
            try:
                total += len(re.findall(wrapped, low))
            except re.error:
                total += len(re.findall(pat, low))
        if total > 0:
            counts[canon] = total
    by_cat: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for canon, cnt in counts.most_common():
        by_cat[TECH_DICT[canon]["cat"]].append((canon, cnt))
    return by_cat


# ------------------------------------------------------------
# 業務内容の整形・要約
# ------------------------------------------------------------
def _clean_sentence(text: str) -> str:
    """口語・冗長表現・日付/時刻ノイズを簡易添削して体言止めへ寄せる"""
    s = re.sub(r"[\s　]+", " ", str(text)).strip()
    # 箇条書き記号や番号を除去
    s = re.sub(r"^[・\-\*●○◇◆\d]+[.)、]?\s*", "", s)
    # 日付・時刻の除去
    s = re.sub(r"\d{1,2}[:：]\d{2}", "", s)
    s = re.sub(r"\d{4}[/年]\d{1,2}[/月]\d{1,2}日?", "", s)
    # 口語・主観表現を除去
    for w in ["と思います", "と思う", "でした", "ました", "です。", "ます。",
              "を行った", "を行いました", "を実施した", "を実施", "など",
              "に関して", "について", "という", "とても", "かなり", "少し"]:
        s = s.replace(w, "")
    s = s.strip(" 　。.、,")
    return s


def _representative_activities(df: pd.DataFrame, limit: int = 12) -> list[str]:
    """work_content を整形・重複除去し、代表的な業務を抽出する"""
    seen: set[str] = set()
    result: list[tuple[int, str]] = []
    freq: Counter = Counter()

    cleaned: list[str] = []
    for raw in df.get("work_content", pd.Series([])).dropna():
        c = _clean_sentence(raw)
        # 文を句点・改行で分割し、意味のある長さのものだけ採用
        for part in re.split(r"[。\n]", c):
            part = part.strip()
            if 6 <= len(part) <= 60:
                cleaned.append(part)
                freq[part[:12]] += 1

    for part in cleaned:
        key = part[:12]
        if key in seen:
            continue
        seen.add(key)
        result.append((freq[key], part))

    # 頻度の高い（≒重要な）業務を優先
    result.sort(key=lambda x: (-x[0], -len(x[1])))
    return [p for _, p in result[:limit]]


def _phase_breakdown(df: pd.DataFrame) -> list[tuple[str, int]]:
    """工程キーワードで業務を分類し、出現日数を集計する"""
    counter: Counter = Counter()
    for raw in df.get("work_content", pd.Series([])).dropna():
        low = str(raw).lower()
        for phase, pats in PHASE_KEYWORDS.items():
            if any(re.search(p, low) for p in pats):
                counter[phase] += 1
    # PHASE_KEYWORDS の定義順で返す
    return [(p, counter[p]) for p in PHASE_KEYWORDS if counter[p] > 0]


def _summary_sentence(company, project, days, total_hours, phases, techs) -> str:
    """概要文を生成する"""
    top_phases = "・".join(p for p, _ in phases[:3]) if phases else "システム開発"
    flat_tech = [t for cat in CAT_ORDER for t, _ in techs.get(cat, [])][:5]
    tech_part = f"主に{'、'.join(flat_tech)}を用い、" if flat_tech else ""
    return (
        f"{project}にて{tech_part}{top_phases}を担当。"
        f"期間中の稼働は{days}日・約{total_hours:.0f}時間に及び、"
        f"継続的に開発・対応業務へ従事した。"
    )


def _build_blocks(df_period: pd.DataFrame, start: str, end: str) -> dict:
    company      = df_period["company"].dropna().mode().iloc[0] if not df_period["company"].dropna().empty else "—"
    project_name = df_period["project_name"].dropna().mode().iloc[0] if not df_period["project_name"].dropna().empty else "—"
    days         = df_period["date"].nunique()
    total_hours  = pd.to_numeric(df_period["work_hours"], errors="coerce").sum()
    techs        = extract_technologies(df_period)
    phases       = _phase_breakdown(df_period)
    activities   = _representative_activities(df_period)
    summary      = _summary_sentence(company, project_name, days, total_hours, phases, techs)
    return dict(company=company, project=project_name, days=days,
                total_hours=total_hours, techs=techs, phases=phases,
                activities=activities, summary=summary, start=start, end=end)


def generate_career_markdown(df_period: pd.DataFrame, start: str, end: str, max_tech: int = 10) -> str:
    """職務経歴書レベルのMarkdownを生成する"""
    if df_period.empty:
        return "_対象期間に日報データがありません。_"
    b = _build_blocks(df_period, start, end)

    lines = [
        "## 職務経歴",
        "",
        f"**期間**：{start} 〜 {end}（{b['days']}日 / 約{b['total_hours']:.0f}h）  ",
        f"**プロジェクト**：{b['project']}　**所属/取引先**：{b['company']}",
        "",
        "### 概要",
        "",
        b["summary"],
        "",
        "### 担当工程",
        "",
    ]
    if b["phases"]:
        lines.append(" / ".join(f"{p}" for p, _ in b["phases"]))
    else:
        lines.append("—")
    lines += ["", "### 主な担当業務", ""]
    for act in b["activities"]:
        lines.append(f"- {act}")
    if not b["activities"]:
        lines.append("- —")

    lines += ["", "### 使用技術", ""]
    any_tech = False
    for cat in CAT_ORDER:
        items = b["techs"].get(cat, [])[:max_tech]
        if items:
            any_tech = True
            names = "、".join(t for t, _ in items)
            lines.append(f"- **{CAT_LABEL[cat]}**：{names}")
    if not any_tech:
        lines.append("- （日報の業務内容から技術名を検出できませんでした）")

    return "\n".join(lines)


def generate_career_text(df_period: pd.DataFrame, start: str, end: str) -> str:
    """職務経歴書向けプレーンテキスト（コピペ用）を生成する"""
    if df_period.empty:
        return "対象期間に日報データがありません。"
    b = _build_blocks(df_period, start, end)

    tech_lines = []
    for cat in CAT_ORDER:
        items = b["techs"].get(cat, [])
        if items:
            tech_lines.append(f"  {CAT_LABEL[cat]}：" + "、".join(t for t, _ in items))
    tech_block = "\n".join(tech_lines) if tech_lines else "  —"

    phase_line = " / ".join(p for p, _ in b["phases"]) if b["phases"] else "—"
    act_block = "\n".join(f"  ・{a}" for a in b["activities"]) if b["activities"] else "  ・—"

    return (
        f"■ 期間\n  {start} 〜 {end}（{b['days']}日 / 約{b['total_hours']:.0f}h）\n\n"
        f"■ プロジェクト\n  {b['project']}（{b['company']}）\n\n"
        f"■ 概要\n  {b['summary']}\n\n"
        f"■ 担当工程\n  {phase_line}\n\n"
        f"■ 主な担当業務\n{act_block}\n\n"
        f"■ 使用技術\n{tech_block}"
    )
