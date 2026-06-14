"""
utils/diagnostics.py
データ整合性の自動エラー検出モジュール。
全データ種別（案件/面談/ToDo/日報/給与）を横断して高精度に検査し、
重大度付きの所見リストを返す。外部API不使用。

所見の重大度:
  - "error"  : データ破損・矛盾（要修正）
  - "warning": 不自然・要確認
  - "info"   : 参考情報（整合性の弱い参照など）
"""

from __future__ import annotations
import re
from datetime import datetime, date
import pandas as pd

from utils.data_manager import load, SCHEMAS

ATTENDANCE_OPTIONS = [
    "出社", "在宅", "出社+在宅",
    "遅刻", "早退", "遅刻+早退",
    "有給", "午前半休", "午後半休", "特別休暇",
    "欠勤", "振替休日", "その他",
]
LATE_EARLY_TYPES = {"遅刻", "早退", "遅刻+早退"}
PROJECT_STATUSES = {"参画前", "参画中", "終了"}
SALARY_TYPES = {"給与", "賞与"}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^\d{1,2}:\d{2}$")

DATASET_LABELS = {
    "projects":   "案件マスタ",
    "interviews": "面談データ",
    "todos":      "ToDo データ",
    "daily":      "日報データ",
    "salary":     "給与データ",
}


def _finding(severity, dataset, message, row_id="", field="", hint=""):
    return {
        "severity": severity,
        "dataset":  DATASET_LABELS.get(dataset, dataset),
        "row_id":   row_id,
        "field":    field,
        "message":  message,
        "hint":     hint,
    }


def _is_valid_date(s: str) -> bool:
    s = str(s).strip()
    if not DATE_RE.match(s):
        return False
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def _to_min(t: str):
    t = str(t).strip()
    if not TIME_RE.match(t):
        return None
    h, m = t.split(":")
    h, m = int(h), int(m)
    if not (0 <= h <= 23 and 0 <= m <= 59):
        return None
    return h * 60 + m


def _num(v):
    try:
        return float(str(v).replace(",", "").strip() or 0)
    except Exception:
        return None


# ============================================================
# 共通チェック（全データ）
# ============================================================
def _check_common(key: str, df: pd.DataFrame, findings: list):
    cols = SCHEMAS[key]["columns"]

    # カラム欠落
    missing = [c for c in cols if c not in df.columns]
    if missing:
        findings.append(_finding(
            "error", key, f"必要カラムが不足しています: {', '.join(missing)}",
            hint="CSV のヘッダ行を確認するか、データを再保存してください。",
        ))

    if df.empty or "id" not in df.columns:
        return

    # ID 空欄
    blank_ids = df[df["id"].astype(str).str.strip() == ""]
    for _ in blank_ids.itertuples():
        findings.append(_finding(
            "error", key, "ID が空欄の行があります。",
            hint="該当行を削除して再登録してください。",
        ))

    # ID 重複
    dup = df[df["id"].duplicated(keep=False) & (df["id"].astype(str).str.strip() != "")]
    for rid in sorted(set(dup["id"].tolist())):
        n = int((df["id"] == rid).sum())
        findings.append(_finding(
            "error", key, f"ID が重複しています（{n} 件）。",
            row_id=str(rid),
            hint="重複行のいずれかを削除してください。",
        ))

    # 完全空行
    content_cols = [c for c in cols if c not in ("id", "created_at")]
    for r in df.itertuples():
        rd = {c: str(getattr(r, c, "")).strip() for c in content_cols if hasattr(r, c)}
        if rd and all(v == "" for v in rd.values()):
            findings.append(_finding(
                "warning", key, "中身が空の行があります。",
                row_id=str(getattr(r, "id", "")),
                hint="不要な空行は削除してください。",
            ))


# ============================================================
# 案件
# ============================================================
def _check_projects(df: pd.DataFrame, findings: list):
    if df.empty:
        return
    for r in df.itertuples():
        rid = str(getattr(r, "id", ""))
        company = str(getattr(r, "company", "")).strip()
        pname   = str(getattr(r, "project_name", "")).strip()
        status  = str(getattr(r, "status", "")).strip()
        sd      = str(getattr(r, "start_date", "")).strip()
        ed      = str(getattr(r, "end_date", "")).strip()

        if not company:
            findings.append(_finding("error", "projects", "会社名が未入力です。", rid, "company"))
        if not pname:
            findings.append(_finding("error", "projects", "案件名が未入力です。", rid, "project_name"))
        if status and status not in PROJECT_STATUSES:
            findings.append(_finding(
                "warning", "projects", f"ステータスが不正です: 「{status}」", rid, "status",
                hint="参画前 / 参画中 / 終了 のいずれかにしてください。",
            ))
        if sd and not _is_valid_date(sd):
            findings.append(_finding("error", "projects", f"開始日の形式が不正です: 「{sd}」", rid, "start_date",
                                     hint="YYYY-MM-DD 形式にしてください。"))
        if ed and not _is_valid_date(ed):
            findings.append(_finding("error", "projects", f"終了日の形式が不正です: 「{ed}」", rid, "end_date",
                                     hint="YYYY-MM-DD 形式にしてください。"))
        if _is_valid_date(sd) and _is_valid_date(ed) and sd > ed:
            findings.append(_finding(
                "error", "projects", f"開始日（{sd}）が終了日（{ed}）より後になっています。", rid,
                hint="開始日と終了日を入れ替えてください。",
            ))
        if status == "終了" and not ed:
            findings.append(_finding("info", "projects", "ステータスが「終了」ですが終了日が未入力です。", rid, "end_date"))


# ============================================================
# 日報
# ============================================================
def _check_daily(df: pd.DataFrame, findings: list):
    if df.empty:
        return

    # 同一日付の重複登録
    if "date" in df.columns:
        valid_dates = df[df["date"].apply(_is_valid_date)]
        dup_dates = valid_dates["date"].value_counts()
        for d, n in dup_dates.items():
            if n > 1:
                findings.append(_finding(
                    "warning", "daily", f"同じ日付（{d}）の日報が {n} 件あります。",
                    hint="重複した日報を統合または削除してください。",
                ))

    for r in df.itertuples():
        rid = str(getattr(r, "id", ""))
        d   = str(getattr(r, "date", "")).strip()
        att = str(getattr(r, "attendance_type", "")).strip()
        s   = str(getattr(r, "start_time", "")).strip()
        e   = str(getattr(r, "end_time", "")).strip()
        b   = str(getattr(r, "break_time", "")).strip()
        wh  = _num(getattr(r, "work_hours", 0))
        let = _num(getattr(r, "late_early_time", 0)) if hasattr(r, "late_early_time") else 0
        content = str(getattr(r, "work_content", "")).strip()

        if not d:
            findings.append(_finding("error", "daily", "日付が未入力です。", rid, "date"))
        elif not _is_valid_date(d):
            findings.append(_finding("error", "daily", f"日付の形式が不正です: 「{d}」", rid, "date",
                                     hint="YYYY-MM-DD 形式にしてください。"))
        elif _is_valid_date(d) and datetime.strptime(d, "%Y-%m-%d").date() > date.today():
            findings.append(_finding("info", "daily", f"未来の日付（{d}）の日報があります。", rid, "date"))

        if att and att not in ATTENDANCE_OPTIONS:
            findings.append(_finding("warning", "daily", f"勤怠区分が不正です: 「{att}」", rid, "attendance_type"))

        # 時刻の整合性
        sm, em, bm = _to_min(s), _to_min(e), _to_min(b)
        if s and sm is None:
            findings.append(_finding("error", "daily", f"出社時刻の形式が不正です: 「{s}」", rid, "start_time"))
        if e and em is None:
            findings.append(_finding("error", "daily", f"退勤時刻の形式が不正です: 「{e}」", rid, "end_time"))
        if sm is not None and em is not None:
            if em <= sm:
                findings.append(_finding(
                    "error", "daily", f"退勤時刻（{e}）が出社時刻（{s}）以前になっています。", rid,
                    hint="時刻を確認してください。",
                ))
            else:
                # work_hours の再計算と照合
                expected = max(0.0, (em - sm - (bm or 0)) / 60)
                if wh is not None and abs(expected - wh) > 0.05:
                    findings.append(_finding(
                        "warning", "daily",
                        f"実働時間が時刻と一致しません（記録 {wh:.2f}h / 計算 {expected:.2f}h）。", rid, "work_hours",
                        hint="出社・退勤・休憩時刻から再計算した値とずれています。",
                    ))

        if wh is None:
            findings.append(_finding("error", "daily", "実働時間が数値ではありません。", rid, "work_hours"))
        elif wh < 0 or wh > 24:
            findings.append(_finding("error", "daily", f"実働時間が範囲外です（{wh}h）。", rid, "work_hours"))

        # 遅刻/早退時間
        if let and let > 0 and att not in LATE_EARLY_TYPES:
            findings.append(_finding(
                "warning", "daily", f"遅刻/早退時間が入力されていますが勤怠区分が「{att}」です。", rid, "late_early_time",
            ))

        # 業務内容（勤務日のみ必須）
        work_types = {"出社", "在宅", "出社+在宅", "遅刻", "早退", "遅刻+早退"}
        if att in work_types and not content:
            findings.append(_finding("warning", "daily", "勤務日ですが業務内容が空欄です。", rid, "work_content"))


# ============================================================
# 面談
# ============================================================
def _check_interviews(df: pd.DataFrame, findings: list):
    if df.empty:
        return
    valid_status = {"結果待ち", "通過", "不通過", "辞退", "不明"}
    for r in df.itertuples():
        rid = str(getattr(r, "id", ""))
        company = str(getattr(r, "company", "")).strip()
        d = str(getattr(r, "interview_date", "")).strip()
        status = str(getattr(r, "status", "")).strip()
        if not company:
            findings.append(_finding("error", "interviews", "会社名が未入力です。", rid, "company"))
        if d and not _is_valid_date(d):
            findings.append(_finding("error", "interviews", f"面談日の形式が不正です: 「{d}」", rid, "interview_date"))
        if status and status not in valid_status:
            findings.append(_finding("info", "interviews", f"見慣れないステータスです: 「{status}」", rid, "status"))


# ============================================================
# ToDo
# ============================================================
def _check_todos(df: pd.DataFrame, findings: list):
    if df.empty:
        return
    valid_prog = {"未着手", "進行中", "完了"}
    for r in df.itertuples():
        rid = str(getattr(r, "id", ""))
        task = str(getattr(r, "task", "")).strip()
        due = str(getattr(r, "due_date", "")).strip()
        prog = str(getattr(r, "progress", "")).strip()
        if not task:
            findings.append(_finding("error", "todos", "タスク内容が未入力です。", rid, "task"))
        if due and not _is_valid_date(due):
            findings.append(_finding("warning", "todos", f"期限の形式が不正です: 「{due}」", rid, "due_date"))
        if prog and prog not in valid_prog:
            findings.append(_finding("warning", "todos", f"進捗が不正です: 「{prog}」", rid, "progress"))
        # 期限超過で未完了
        if _is_valid_date(due) and prog != "完了":
            if datetime.strptime(due, "%Y-%m-%d").date() < date.today():
                findings.append(_finding("info", "todos", f"期限切れの未完了タスクがあります（期限 {due}）。", rid, "due_date"))


# ============================================================
# 給与
# ============================================================
def _check_salary(df: pd.DataFrame, findings: list):
    if df.empty:
        return
    num_fields = [c for c in df.columns if c not in
                  ("id", "year_month", "salary_type", "memo", "created_at")]

    # 同一月・同一種別の重複
    if "year_month" in df.columns:
        st_col = df["salary_type"] if "salary_type" in df.columns else pd.Series(["給与"] * len(df))
        combo = df["year_month"].astype(str) + "|" + st_col.astype(str)
        for val, n in combo.value_counts().items():
            if n > 1:
                ym, stype = val.split("|", 1)
                findings.append(_finding(
                    "warning", "salary", f"{ym} の「{stype}」が {n} 件登録されています。",
                    hint="重複した給与/賞与レコードを確認してください。",
                ))

    for r in df.itertuples():
        rid = str(getattr(r, "id", ""))
        ym = str(getattr(r, "year_month", "")).strip()
        stype = str(getattr(r, "salary_type", "給与")).strip() or "給与"
        if ym and not re.match(r"^\d{4}-\d{2}$", ym):
            findings.append(_finding("error", "salary", f"対象月の形式が不正です: 「{ym}」", rid, "year_month",
                                     hint="YYYY-MM 形式にしてください。"))
        if stype not in SALARY_TYPES:
            findings.append(_finding("warning", "salary", f"種別が不正です: 「{stype}」", rid, "salary_type"))
        for f in num_fields:
            v = getattr(r, f, "")
            if str(v).strip() == "":
                continue
            if _num(v) is None:
                findings.append(_finding("error", "salary", f"「{f}」が数値ではありません: 「{v}」", rid, f))


# ============================================================
# 参照整合性（情報レベル）
# ============================================================
def _check_references(findings: list):
    df_proj = load("projects")
    if df_proj.empty:
        return
    proj_pairs = set(
        (str(c).strip(), str(p).strip())
        for c, p in zip(df_proj.get("company", []), df_proj.get("project_name", []))
    )
    proj_companies = set(str(c).strip() for c in df_proj.get("company", []))

    df_daily = load("daily")
    if not df_daily.empty:
        for r in df_daily.itertuples():
            company = str(getattr(r, "company", "")).strip()
            pname = str(getattr(r, "project_name", "")).strip()
            if company and company not in proj_companies:
                findings.append(_finding(
                    "info", "daily", f"案件マスタに無い会社「{company}」の日報があります。",
                    str(getattr(r, "id", "")), "company",
                    hint="案件マスタへの登録漏れがないか確認してください。",
                ))


# ============================================================
# エントリポイント
# ============================================================
def run_diagnostics() -> list[dict]:
    findings: list[dict] = []
    checkers = {
        "projects":   _check_projects,
        "daily":      _check_daily,
        "interviews": _check_interviews,
        "todos":      _check_todos,
        "salary":     _check_salary,
    }
    for key, checker in checkers.items():
        try:
            df = load(key)
        except Exception as e:
            findings.append(_finding("error", key, f"データの読み込みに失敗しました: {e}"))
            continue
        _check_common(key, df, findings)
        try:
            checker(df, findings)
        except Exception as e:
            findings.append(_finding("error", key, f"検査中にエラーが発生しました: {e}"))

    try:
        _check_references(findings)
    except Exception:
        pass

    return findings


def summarize(findings: list[dict]) -> dict:
    return {
        "error":   sum(1 for f in findings if f["severity"] == "error"),
        "warning": sum(1 for f in findings if f["severity"] == "warning"),
        "info":    sum(1 for f in findings if f["severity"] == "info"),
        "total":   len(findings),
    }
