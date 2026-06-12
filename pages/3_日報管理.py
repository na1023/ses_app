"""
pages/3_日報管理.py
日報の入力・編集・削除・閲覧を管理するページ
"""

import pandas as pd
import streamlit as st
from datetime import datetime, date, timedelta
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import (
    load, save, append_row, generate_id, init_all,
    get_company_list, get_project_list_by_company,
)
from utils.styles import THEME_CSS, render_sidebar

st.set_page_config(page_title="日報管理 | SES業務管理", layout="wide")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()

st.markdown(
    """
    <div class="page-header">
        <h1>日報管理</h1>
        <p>日々の勤務記録を入力・確認できます。</p>
    </div>
    """,
    unsafe_allow_html=True,
)

ATTENDANCE_OPTIONS = [
    "出社", "在宅", "出社+在宅", "有給", "午前半休", "午後半休",
    "欠勤", "特別休暇", "その他",
]


def parse_hhmm(s: str, fallback: str = "00:00") -> str:
    """'H:MM' / 'HH:MM' を正規化して返す。不正な場合は fallback。"""
    s = str(s).strip()
    try:
        if ":" in s:
            h, m = s.split(":", 1)
        else:
            # 数字のみ（例: "900" → "09:00"）は非対応、エラー扱い
            return fallback
        h, m = int(h), int(m)
        if 0 <= h <= 23 and 0 <= m <= 59:
            return f"{h:02d}:{m:02d}"
    except Exception:
        pass
    return fallback


def calc_work_hours(start: str, end: str, brk: str) -> float:
    """HH:MM 文字列 3つから実働時間(h)を計算する"""
    def to_minutes(t: str) -> int:
        h, m = parse_hhmm(t).split(":")
        return int(h) * 60 + int(m)
    diff = to_minutes(end) - to_minutes(start) - to_minutes(brk)
    return max(0.0, diff / 60)


def time_inputs(label_start="出社時刻", label_end="退勤時刻", label_brk="休憩時間",
                default_start="09:00", default_end="18:00", default_brk="01:00",
                key_prefix="t") -> tuple[str, str, str]:
    """出社・退勤・休憩を HH:MM テキスト入力で受け取り正規化済み文字列を返す"""
    c1, c2, c3 = st.columns(3)
    s = c1.text_input(label_start, value=default_start, key=f"{key_prefix}_s",
                      placeholder="09:00", max_chars=5)
    e = c2.text_input(label_end,   value=default_end,   key=f"{key_prefix}_e",
                      placeholder="18:00", max_chars=5)
    b = c3.text_input(label_brk,   value=default_brk,   key=f"{key_prefix}_b",
                      placeholder="01:00", max_chars=5)
    st.markdown('<div class="time-hint">HH:MM 形式で入力（例: 09:00）</div>',
                unsafe_allow_html=True)
    return parse_hhmm(s, default_start), parse_hhmm(e, default_end), parse_hhmm(b, default_brk)


companies = get_company_list()

# ===== 日報入力フォーム =====
with st.expander("日報を入力する", expanded=True):
    # 会社名・案件名はフォーム外（変更で即リスト更新）
    rc1, rc2, rc3 = st.columns([1, 1, 1])
    reg_date    = rc1.date_input("日付 *", value=date.today(), key="reg_date")
    reg_company = rc2.selectbox("会社名 *", [""] + companies, key="reg_company")
    reg_projs   = get_project_list_by_company(reg_company) if reg_company else []
    reg_project = rc3.selectbox("案件名 *", [""] + reg_projs, key="reg_project")

    with st.form("daily_report_form", clear_on_submit=True):
        attendance = st.selectbox("勤怠区分 *", ATTENDANCE_OPTIONS)

        st_s, st_e, st_b = time_inputs(key_prefix="reg")
        wh_prev = calc_work_hours(st_s, st_e, st_b)
        st.info(f"実働時間（自動計算）: **{wh_prev:.2f} h**")

        work_content = st.text_area("業務内容 *", height=100,
                                    placeholder="本日行った作業・対応内容を記載してください")
        remarks      = st.text_area("備考", height=60,
                                    placeholder="特記事項・翌日の予定など")
        submitted = st.form_submit_button("日報を登録する", use_container_width=True)

    if submitted:
        errors = []
        if not reg_company:          errors.append("会社名を選択してください。")
        if not reg_project:          errors.append("案件名を選択してください。")
        if not work_content.strip(): errors.append("業務内容を入力してください。")

        if errors:
            for e in errors: st.error(e)
        else:
            wh = calc_work_hours(st_s, st_e, st_b)
            append_row("daily", {
                "id":              generate_id(),
                "date":            str(reg_date),
                "company":         reg_company,
                "project_name":    reg_project,
                "attendance_type": attendance,
                "start_time":      st_s,
                "end_time":        st_e,
                "break_time":      st_b,
                "work_hours":      round(wh, 2),
                "work_content":    work_content.strip(),
                "remarks":         remarks.strip(),
                "created_at":      datetime.now().strftime("%Y-%m-%d %H:%M"),
            })
            st.success(f"{reg_date} の日報を登録しました。（実働 {wh:.2f}h）")
            st.rerun()

st.markdown("---")

# ===== 日報一覧 =====
st.markdown("### 日報一覧")
df = load("daily")

if df.empty:
    st.info("日報がまだ登録されていません。")
    st.stop()

# フィルタ
fc1, fc2, fc3 = st.columns(3)
month_list  = sorted(df["date"].str[:7].dropna().unique().tolist(), reverse=True)
sel_month   = fc1.selectbox("月で絞り込み",   ["全期間"] + month_list, key="dr_month")
sel_company = fc2.selectbox("会社で絞り込み", ["全社"]   + companies,  key="dr_company_f")

df_view = df.copy()
if sel_month   != "全期間": df_view = df_view[df_view["date"].str.startswith(sel_month, na=False)]
if sel_company != "全社":   df_view = df_view[df_view["company"] == sel_company]
df_view = df_view.sort_values("date", ascending=False).reset_index(drop=True)

total_h = pd.to_numeric(df_view["work_hours"], errors="coerce").sum()
fc3.metric("表示期間の合計稼働時間", f"{total_h:.1f} h")
st.caption(f"表示件数: {len(df_view)} 件")

for _, row in df_view.iterrows():
    rid      = row["id"]
    edit_key = f"dr_edit_{rid}"
    del_key  = f"dr_del_{rid}"

    s_str = row.get("start_time", "")
    e_str = row.get("end_time",   "")
    b_str = row.get("break_time", "")
    time_label = f"{s_str} 〜 {e_str}（休憩 {b_str}）" if s_str and e_str else ""

    with st.container():
        st.markdown('<div class="section-card">', unsafe_allow_html=True)

        info_col, btn_col = st.columns([7, 2])
        with info_col:
            try:
                wh_disp = f"実働 {float(row.get('work_hours', 0)):.2f}h"
            except Exception:
                wh_disp = ""
            st.markdown(
                f"**{row.get('date','')}** &nbsp;"
                f"<span style='color:#94a3b8; font-size:0.82rem;'>"
                f"{row.get('attendance_type','')}</span>",
                unsafe_allow_html=True,
            )
            meta = "  |  ".join(x for x in [
                f"{row.get('company','')} / {row.get('project_name','')}",
                time_label,
                wh_disp,
            ] if x)
            st.caption(meta)
            content = str(row.get("work_content", ""))
            if content:
                st.caption(content[:80] + ("…" if len(content) > 80 else ""))

        with btn_col:
            bc1, bc2 = st.columns(2)
            if bc1.button("編集", key=f"dr_ebtn_{rid}", use_container_width=True):
                st.session_state[edit_key] = not st.session_state.get(edit_key, False)
                st.session_state[del_key]  = False
            if bc2.button("削除", key=f"dr_dbtn_{rid}", use_container_width=True):
                st.session_state[del_key]  = not st.session_state.get(del_key, False)
                st.session_state[edit_key] = False

        # 編集フォーム
        if st.session_state.get(edit_key):
            cur_att = row.get("attendance_type", "出社")
            att_idx = ATTENDANCE_OPTIONS.index(cur_att) if cur_att in ATTENDANCE_OPTIONS else 0

            all_companies = get_company_list()
            ec1, ec2 = st.columns(2)
            cur_co_idx   = ([""] + all_companies).index(row.get("company","")) \
                if row.get("company","") in all_companies else 0
            edit_company = ec1.selectbox("会社名", [""] + all_companies,
                                         index=cur_co_idx, key=f"ec_{rid}")
            edit_projs   = get_project_list_by_company(edit_company) if edit_company else []
            cur_proj     = row.get("project_name","")
            proj_opts    = [""] + edit_projs
            proj_idx     = proj_opts.index(cur_proj) if cur_proj in proj_opts else 0
            edit_project = ec2.selectbox("案件名", proj_opts,
                                         index=proj_idx, key=f"ep_{rid}")

            with st.form(f"dr_edit_form_{rid}"):
                ef1, ef2 = st.columns(2)
                new_date = ef1.text_input("日付 (YYYY-MM-DD)", value=row.get("date",""))
                new_att  = ef2.selectbox("勤怠区分", ATTENDANCE_OPTIONS, index=att_idx)

                e_s, e_e, e_b = time_inputs(
                    default_start=row.get("start_time","09:00") or "09:00",
                    default_end  =row.get("end_time",  "18:00") or "18:00",
                    default_brk  =row.get("break_time","01:00") or "01:00",
                    key_prefix=f"edit_{rid}",
                )
                new_wh_prev = calc_work_hours(e_s, e_e, e_b)
                st.info(f"実働時間（自動計算）: **{new_wh_prev:.2f} h**")

                new_content = st.text_area("業務内容", value=row.get("work_content",""), height=100)
                new_remarks = st.text_area("備考",     value=row.get("remarks",     ""), height=60)
                sc1, sc2 = st.columns(2)
                do_save   = sc1.form_submit_button("保存する",   use_container_width=True)
                do_cancel = sc2.form_submit_button("キャンセル", use_container_width=True)

            if do_save:
                new_wh = calc_work_hours(e_s, e_e, e_b)
                df_all = load("daily")
                m = df_all["id"] == rid
                df_all.loc[m, "date"]            = new_date
                df_all.loc[m, "company"]         = edit_company
                df_all.loc[m, "project_name"]    = edit_project
                df_all.loc[m, "attendance_type"] = new_att
                df_all.loc[m, "start_time"]      = e_s
                df_all.loc[m, "end_time"]        = e_e
                df_all.loc[m, "break_time"]      = e_b
                df_all.loc[m, "work_hours"]      = round(new_wh, 2)
                df_all.loc[m, "work_content"]    = new_content
                df_all.loc[m, "remarks"]         = new_remarks
                save("daily", df_all)
                st.session_state[edit_key] = False
                st.success("更新しました。")
                st.rerun()
            if do_cancel:
                st.session_state[edit_key] = False
                st.rerun()

        # 削除確認
        if st.session_state.get(del_key):
            st.warning(f"{row.get('date','')} の日報を削除しますか？")
            cc1, cc2, _ = st.columns([1, 1, 4])
            if cc1.button("削除する", key=f"dr_del_ok_{rid}", use_container_width=True):
                df_all = load("daily")
                df_all = df_all[df_all["id"] != rid].reset_index(drop=True)
                save("daily", df_all)
                st.session_state[del_key] = False
                st.success("削除しました。")
                st.rerun()
            if cc2.button("やめる", key=f"dr_del_no_{rid}", use_container_width=True):
                st.session_state[del_key] = False
                st.rerun()

        st.markdown("</div>", unsafe_allow_html=True)
