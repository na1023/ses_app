"""
utils/data_manager.py
データの読み書き・バックアップ・初期化を管理するモジュール
"""

import os
import shutil
import pandas as pd
from datetime import datetime

# ---- パス定義 ----
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
BACKUP_DIR = os.path.join(BASE_DIR, "backup")

PATHS = {
    "projects":   os.path.join(DATA_DIR, "projects.csv"),
    "interviews": os.path.join(DATA_DIR, "interviews.csv"),
    "todos":      os.path.join(DATA_DIR, "todos.csv"),
    "daily":      os.path.join(DATA_DIR, "daily_reports.csv"),
}

# ---- スキーマ定義 ----
SCHEMAS = {
    "projects": {
        "columns": ["id", "company", "project_name", "start_date", "end_date", "memo"],
        "dtypes":  {"id": str, "company": str, "project_name": str,
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
    "daily": {
        "columns": ["id", "date", "company", "project_name", "attendance_type",
                    "start_time", "end_time", "break_time", "work_hours",
                    "work_content", "remarks", "created_at"],
        "dtypes":  {"id": str, "date": str, "company": str, "project_name": str,
                    "attendance_type": str, "start_time": str, "end_time": str,
                    "break_time": str, "work_hours": float,
                    "work_content": str, "remarks": str, "created_at": str},
    },
}


def ensure_data_dirs():
    """data/ と backup/ ディレクトリを確保する"""
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(BACKUP_DIR, exist_ok=True)


def init_csv(key: str) -> None:
    """CSVが存在しなければ空のファイルを作成する"""
    path = PATHS[key]
    if not os.path.exists(path):
        df = pd.DataFrame(columns=SCHEMAS[key]["columns"])
        df.to_csv(path, index=False, encoding="utf-8-sig")


def init_all():
    """全CSVを初期化（存在しない場合のみ）"""
    ensure_data_dirs()
    for key in PATHS:
        init_csv(key)


def load(key: str) -> pd.DataFrame:
    """CSVを読み込んで DataFrame を返す"""
    path = PATHS[key]
    if not os.path.exists(path):
        init_csv(key)
    try:
        df = pd.read_csv(path, dtype=str, encoding="utf-8-sig")
        # 不足カラムを補完
        for col in SCHEMAS[key]["columns"]:
            if col not in df.columns:
                df[col] = ""
        return df[SCHEMAS[key]["columns"]].fillna("")
    except pd.errors.EmptyDataError:
        return pd.DataFrame(columns=SCHEMAS[key]["columns"])


def save(key: str, df: pd.DataFrame) -> None:
    """DataFrame を CSV に上書き保存する"""
    ensure_data_dirs()
    df.to_csv(PATHS[key], index=False, encoding="utf-8-sig")


def append_row(key: str, row: dict) -> None:
    """1行を CSV に追記する"""
    df = load(key)
    new_row = pd.DataFrame([row])
    df = pd.concat([df, new_row], ignore_index=True)
    save(key, df)


def generate_id() -> str:
    """タイムスタンプベースのユニーク ID を生成する"""
    return datetime.now().strftime("%Y%m%d%H%M%S%f")


def backup_data():
    """data/ 配下を backup/YYYYMMDD_HHMMSS/ にコピーする"""
    ensure_data_dirs()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = os.path.join(BACKUP_DIR, timestamp)
    if os.path.exists(DATA_DIR) and os.listdir(DATA_DIR):
        shutil.copytree(DATA_DIR, dest)
        return dest
    return None


def get_project_options() -> list[dict]:
    """案件プルダウン用に (会社名, 案件名) のリストを返す"""
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
