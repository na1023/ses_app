"""
pages/3_日報管理.py
日報の入力・編集・削除・閲覧を管理するページ
"""

import pandas as pd
import streamlit as st
from datetime import datetime, date, time, timedelta
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


def calc_work_hours(start: time, end: time, brk: time) -> float:
    s = timedelta(hours=start.hour, minutes=start.minute)
    e = timedelta(hours=end.hour,   minutes=end.minute)
    b = timedelta(hours=brk.hour,   minutes=brk.minute)
    return max(0.0, (e - s - b).total_seconds() / 3600)


def parse_time(s: str, default: time) -> time:
    try:
        h, m = str(s).strip().split(":")
        return time(int(h), int(m))
    except Exception:
        return default


companies = get_company_list()

# ===== 日報入力フォーム =====
with st.expander("日報を入力する", expanded=True):
    # 会社名・案件名はフォームの外に置いて連動させる
    reg_c1, reg_c2, reg_c3 = st.columns(3)
    reg_date    = reg_c1.date_input("日付 *", value=date.today(), key="reg_date")
    reg_company = reg_c2.selectbox("会社名 *", [""] + companies, key="reg_company")
    reg_projs   = get_project_list_by_company(reg_company) if reg_company else []
    reg_project = reg_c3.selectbox("案件名 *", [""] + reg_projs, key="reg_project")

    with st.form("daily_report_form", clear_on_submit=True):
        attendance = st.selectbox("勤怠区分 *", ATTENDANCE_OPTIONS)

        tc1, tc2, tc3 = st.columns(3)
        start_t = tc1.time_input("出社時刻", value=time(9,  0), step=60)
        end_t   = tc2.time_input("退勤時刻", value=time(18, 0), step=60)
        brk_t   = tc3.time_input("休憩時間", value=time(1,  0), step=60)

        wh_preview = calc_work_hours(start_t, end_t, brk_t)
        st.caption(f"実働時間（自動計算）: **{wh_preview:.2f} h**")

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
            wh = calc_work_hours(start_t, end_t, brk_t)
            append_row("daily", {
                "id":              generate_id(),
                "date":            str(reg_date),
                "company":         reg_company,
                "project_name":    reg_project,
                "attendance_type": attendance,
                "start_time":      start_t.strftime("%H:%M"),
                "end_time":        end_t.strftime("%H:%M"),
                "break_time":      brk_t.strftime("%H:%M"),
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

    start_str = row.get("start_time", "")
    end_str   = row.get("end_time",   "")
    brk_str   = row.get("break_time", "")
    time_label = (
        f"{start_str} 〜 {end_str}（休憩 {brk_str}）"
        if start_str and end_str else ""
    )

    with st.container():
        st.markdown('<div class="section-card">', unsafe_allow_html=True)

        info_col, btn_col = st.columns([6, 2])
        with info_col:
            wh_val = row.get("work_hours", "")
            st.markdown(
                f"**{row.get('date','')}** &nbsp; "
                f"<span style='color:#64748b; font-size:0.82rem;'>"
                f"{row.get('company','')} / {row.get('project_name','')}&nbsp;&nbsp;"
                f"{row.get('attendance_type','')}"
                f"</span>",
                unsafe_allow_html=True,
            )
            detail_parts = []
            if time_label: detail_parts.append(time_label)
            try:
                if wh_val: detail_parts.append(f"実働 {float(wh_val):.2f}h")
            except Exception:
                pass
            if detail_parts:
                st.caption("  |  ".join(detail_parts))
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
            cur_start = parse_time(row.get("start_time", ""), time(9,  0))
            cur_end   = parse_time(row.get("end_time",   ""), time(18, 0))
            cur_brk   = parse_time(row.get("break_time", ""), time(1,  0))
            cur_att   = row.get("attendance_type", "出社")
            att_idx   = ATTENDANCE_OPTIONS.index(cur_att) if cur_att in ATTENDANCE_OPTIONS else 0

            # 会社・案件はフォーム外で連動させる
            all_companies = get_company_list()
            ec1, ec2 = st.columns(2)
            cur_company_idx = ([""] + all_companies).index(row.get("company", "")) \
                if row.get("company", "") in all_companies else 0
            edit_company = ec1.selectbox("会社名", [""] + all_companies,
                                         index=cur_company_idx, key=f"ec_{rid}")
            edit_projs   = get_project_list_by_company(edit_company) if edit_company else []
            cur_proj     = row.get("project_name", "")
            proj_opts    = [""] + edit_projs
            proj_idx     = proj_opts.index(cur_proj) if cur_proj in proj_opts else 0
            edit_project = ec2.selectbox("案件名", proj_opts,
                                         index=proj_idx, key=f"ep_{rid}")

            with st.form(f"dr_edit_form_{rid}"):
                ef1, ef2 = st.columns(2)
                new_date = ef1.text_input("日付 (YYYY-MM-DD)", value=row.get("date", ""))
                new_att  = ef2.selectbox("勤怠区分", ATTENDANCE_OPTIONS, index=att_idx)

                tc1, tc2, tc3 = st.columns(3)
                new_start = tc1.time_input("出社時刻", value=cur_start, step=60, key=f"es_{rid}")
                new_end   = tc2.time_input("退勤時刻", value=cur_end,   step=60, key=f"ee_{rid}")
                new_brk   = tc3.time_input("休憩時間", value=cur_brk,   step=60, key=f"eb_{rid}")

                new_wh_preview = calc_work_hours(new_start, new_end, new_brk)
                st.caption(f"実働時間（自動計算）: **{new_wh_preview:.2f} h**")

                new_content = st.text_area("業務内容", value=row.get("work_content", ""), height=100)
                new_remarks = st.text_area("備考",     value=row.get("remarks",      ""), height=60)
                sc1, sc2 = st.columns(2)
                do_save   = sc1.form_submit_button("保存する",   use_container_width=True)
                do_cancel = sc2.form_submit_button("キャンセル", use_container_width=True)

            if do_save:
                new_wh = calc_work_hours(new_start, new_end, new_brk)
                df_all = load("daily")
                m = df_all["id"] == rid
                df_all.loc[m, "date"]            = new_date
                df_all.loc[m, "company"]         = edit_company
                df_all.loc[m, "project_name"]    = edit_project
                df_all.loc[m, "attendance_type"] = new_att
                df_all.loc[m, "start_time"]      = new_start.strftime("%H:%M")
                df_all.loc[m, "end_time"]        = new_end.strftime("%H:%M")
                df_all.loc[m, "break_time"]      = new_brk.strftime("%H:%M")
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
            cc1, cc2, _ = st.columns([1, 1, 3])
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
