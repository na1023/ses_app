"""
utils/data_manager.py
データの読み書き・バックアップ・初期化を管理するモジュール
Supabase が設定されている場合はクラウドDBを使用（再起動後もデータが保持される）
"""

import os
import shutil
import pandas as pd
from datetime import datetime

# ---- パス定義 ----
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
BACKUP_DIR = os.path.join(BASE_DIR, "backup")

# Supabase テーブル名マッピング
_TABLE_MAP = {
    "projects":          "projects",
    "interviews":        "interviews",
    "todos":             "todos",
    "daily":             "daily_reports",
    "salary":            "salary_records",
    "leave":             "leave_grants",
    "kakeibo":           "kakeibo",
    "calendar_events":   "calendar_events",
    "qualifications":    "qualifications",
    "transit_shortcuts": "transit_shortcuts",
}

PATHS = {
    "projects":          os.path.join(DATA_DIR, "projects.csv"),
    "interviews":        os.path.join(DATA_DIR, "interviews.csv"),
    "todos":             os.path.join(DATA_DIR, "todos.csv"),
    "daily":             os.path.join(DATA_DIR, "daily_reports.csv"),
    "salary":            os.path.join(DATA_DIR, "salary_records.csv"),
    "leave":             os.path.join(DATA_DIR, "leave_grants.csv"),
    "kakeibo":           os.path.join(DATA_DIR, "kakeibo.csv"),
    "calendar_events":   os.path.join(DATA_DIR, "calendar_events.csv"),
    "qualifications":    os.path.join(DATA_DIR, "qualifications.csv"),
    "transit_shortcuts": os.path.join(DATA_DIR, "transit_shortcuts.csv"),
}

# ---- スキーマ定義 ----
SCHEMAS = {
    "projects": {
        "columns": ["id", "company", "project_name", "status", "start_date", "end_date", "memo"],
        "dtypes":  {"id": str, "company": str, "project_name": str, "status": str,
                    "start_date": str, "end_date": str, "memo": str},
    },
    "interviews": {
        "columns": ["id", "company", "project_name", "work_content",
                    "attendance_content", "status", "interview_date", "memo"],
        "dtypes":  {"id": str, "company": str, "project_name": str,
                    "work_content": str, "attendance_content": str,
                    "status": str, "interview_date": str, "memo": str},
    },
    "todos": {
        "columns": ["id", "company", "project_name", "task", "due_date",
                    "progress", "created_at"],
        "dtypes":  {"id": str, "company": str, "project_name": str,
                    "task": str, "due_date": str, "progress": str,
                    "created_at": str},
    },
    "salary": {
        "columns": [
            "id", "year_month", "salary_type",
            "basic_salary", "skill_allowance", "qualification_allowance",
            "commute_allowance", "expense_reimbursement", "other_expense",
            "transport_allowance", "overtime_pay",
            "health_insurance", "nursing_insurance", "pension",
            "employment_insurance", "income_tax", "resident_tax",
            "deduction_amount", "tax_adjustment",
            "memo", "created_at",
        ],
        "dtypes": {k: str for k in [
            "id", "year_month", "salary_type",
            "basic_salary", "skill_allowance", "qualification_allowance",
            "commute_allowance", "expense_reimbursement", "other_expense",
            "transport_allowance", "overtime_pay",
            "health_insurance", "nursing_insurance", "pension",
            "employment_insurance", "income_tax", "resident_tax",
            "deduction_amount", "tax_adjustment",
            "memo", "created_at",
        ]},
    },
    "daily": {
        "columns": ["id", "date", "company", "project_name", "attendance_type",
                    "start_time", "end_time", "break_time", "work_hours",
                    "late_early_time", "work_content", "remarks", "created_at"],
        "dtypes":  {"id": str, "date": str, "company": str, "project_name": str, "late_early_time": str,
                    "attendance_type": str, "start_time": str, "end_time": str,
                    "break_time": str, "work_hours": float,
                    "work_content": str, "remarks": str, "created_at": str},
    },
    "leave": {
        "columns": ["id", "grant_date", "days", "memo", "created_at"],
        "dtypes":  {"id": str, "grant_date": str, "days": str, "memo": str, "created_at": str},
    },
    # ===== パーソナルコントロールセンター =====
    "kakeibo": {
        "columns": ["id", "date", "type", "category", "amount", "memo", "created_at"],
        "dtypes":  {"id": str, "date": str, "type": str, "category": str,
                    "amount": str, "memo": str, "created_at": str},
    },
    "calendar_events": {
        "columns": ["id", "title", "date", "start_time", "end_time", "category", "memo", "created_at"],
        "dtypes":  {"id": str, "title": str, "date": str, "start_time": str,
                    "end_time": str, "category": str, "memo": str, "created_at": str},
    },
    "qualifications": {
        "columns": ["id", "name", "category", "exam_date", "expiry_date",
                    "status", "score", "cert_number", "memo", "created_at"],
        "dtypes":  {"id": str, "name": str, "category": str, "exam_date": str,
                    "expiry_date": str, "status": str, "score": str,
                    "cert_number": str, "memo": str, "created_at": str},
    },
    "transit_shortcuts": {
        "columns": ["id", "label", "station_name", "line_name", "url", "icon", "display_order"],
        "dtypes":  {"id": str, "label": str, "station_name": str, "line_name": str,
                    "url": str, "icon": str, "display_order": str},
    },
}


# ================================================================
# Supabase 接続
# ================================================================

def _use_supabase() -> bool:
    """Supabase の接続情報が st.secrets に設定されているか確認する"""
    try:
        import streamlit as st
        return bool(
            st.secrets.get("SUPABASE_URL") and st.secrets.get("SUPABASE_KEY")
        )
    except Exception:
        return False


def _get_supabase():
    """Supabase クライアントを返す（セッション内でキャッシュ）"""
    import streamlit as st
    from supabase import create_client

    if "_supabase_client" not in st.session_state:
        st.session_state["_supabase_client"] = create_client(
            st.secrets["SUPABASE_URL"],
            st.secrets["SUPABASE_KEY"],
        )
    return st.session_state["_supabase_client"]


# ================================================================
# ローカル CSV ヘルパー
# ================================================================

def ensure_data_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(BACKUP_DIR, exist_ok=True)


def init_csv(key: str) -> None:
    path = PATHS[key]
    if not os.path.exists(path):
        ensure_data_dirs()
        df = pd.DataFrame(columns=SCHEMAS[key]["columns"])
        df.to_csv(path, index=False, encoding="utf-8-sig")


def init_all():
    """全データソースを初期化（存在しない場合のみ）"""
    ensure_data_dirs()
    for key in PATHS:
        init_csv(key)


def _load_csv(key: str) -> pd.DataFrame:
    path = PATHS[key]
    if not os.path.exists(path):
        init_csv(key)
    try:
        df = pd.read_csv(path, dtype=str, encoding="utf-8-sig")
        for col in SCHEMAS[key]["columns"]:
            if col not in df.columns:
                df[col] = ""
        return df[SCHEMAS[key]["columns"]].fillna("")
    except pd.errors.EmptyDataError:
        return pd.DataFrame(columns=SCHEMAS[key]["columns"])


def _save_csv(key: str, df: pd.DataFrame) -> None:
    ensure_data_dirs()
    df.to_csv(PATHS[key], index=False, encoding="utf-8-sig")


# ================================================================
# 公開 API
# ================================================================

def load(key: str) -> pd.DataFrame:
    """データを読み込んで DataFrame を返す"""
    cols = SCHEMAS[key]["columns"]

    if _use_supabase():
        try:
            client = _get_supabase()
            table  = _TABLE_MAP[key]
            resp   = client.table(table).select("*").execute()
            if resp.data:
                df = pd.DataFrame(resp.data)
                for col in cols:
                    if col not in df.columns:
                        df[col] = ""
                return df[cols].fillna("").astype(str)
            return pd.DataFrame(columns=cols)
        except Exception as e:
            import streamlit as st
            st.warning(f"Supabase 読み込みエラー（ローカルで代替）: {e}")

    return _load_csv(key)


def save(key: str, df: pd.DataFrame) -> None:
    """DataFrame を保存する"""
    if _use_supabase():
        try:
            client  = _get_supabase()
            table   = _TABLE_MAP[key]
            records = df.fillna("").to_dict("records")

            # 削除されたレコードを消す
            existing = client.table(table).select("id").execute()
            existing_ids = {r["id"] for r in (existing.data or [])}
            new_ids = {str(r["id"]) for r in records}
            for did in existing_ids - new_ids:
                client.table(table).delete().eq("id", did).execute()

            # 残りを upsert
            if records:
                client.table(table).upsert(records).execute()
            return
        except Exception as e:
            import streamlit as st
            st.warning(f"Supabase 保存エラー（ローカルに保存）: {e}")

    _save_csv(key, df)


def append_row(key: str, row: dict) -> None:
    """1行を追加する"""
    if _use_supabase():
        try:
            client = _get_supabase()
            table  = _TABLE_MAP[key]
            client.table(table).insert(row).execute()
            return
        except Exception as e:
            import streamlit as st
            st.warning(f"Supabase 追加エラー（ローカルに追記）: {e}")

    df = _load_csv(key)
    df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
    _save_csv(key, df)


def generate_id() -> str:
    """タイムスタンプベースのユニーク ID を生成する"""
    return datetime.now().strftime("%Y%m%d%H%M%S%f")


def backup_data():
    """data/ 配下を backup/YYYYMMDD_HHMMSS/ にコピーする（CSV モードのみ）"""
    if _use_supabase():
        return None
    ensure_data_dirs()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = os.path.join(BACKUP_DIR, timestamp)
    if os.path.exists(DATA_DIR) and os.listdir(DATA_DIR):
        shutil.copytree(DATA_DIR, dest)
        return dest
    return None


def get_project_options() -> list[dict]:
    df = load("projects")
    if df.empty:
        return []
    return df[["company", "project_name"]].drop_duplicates().to_dict("records")


def get_company_list() -> list[str]:
    df = load("projects")
    if df.empty:
        return []
    return sorted(df["company"].dropna().unique().tolist())


def get_project_list_by_company(company: str) -> list[str]:
    df = load("projects")
    if df.empty:
        return []
    return df[df["company"] == company]["project_name"].dropna().unique().tolist()
