"""
pages/2_面談_ToDo管理.py
面談情報とToDoタスクの登録・編集・削除を管理するページ
"""

import pandas as pd
import streamlit as st
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import (
    load, save, generate_id, init_all,
    get_company_list, get_project_list_by_company, get_project_options,
)
from utils.styles import THEME_CSS, status_badge, render_sidebar

st.set_page_config(page_title="面談・ToDo管理 | SES業務管理", layout="wide")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()

st.markdown(
    """
    <div class="page-header">
        <h1>面談・ToDo管理</h1>
        <p>面談の進捗と案件に紐づくタスクを管理します</p>
    </div>
    """,
    unsafe_allow_html=True,
)

tab_interview, tab_todo = st.tabs(["面談管理", "ToDo管理"])

companies = get_company_list()

# ================================================================
# 面談管理タブ
# ================================================================
with tab_interview:
    with st.expander("面談を登録する", expanded=False):
        # 案件マスタから候補を取得（サジェスト用・強制はしない）
        all_projects = get_project_options()
        all_co_hints = sorted({p["company"] for p in all_projects})
        iv_c1, iv_c2 = st.columns(2)
        company_sel = iv_c1.text_input(
            "会社名（自由入力）",
            key="iv_company",
            placeholder="例: 〇〇株式会社",
        )
        if all_co_hints:
            iv_c1.caption("登録済み: " + "　".join(all_co_hints))

        proj_hints = [p["project_name"] for p in all_projects if p["company"] == company_sel]
        project_sel = iv_c2.text_input(
            "案件名（自由入力）",
            key="iv_project",
            placeholder="例: POSレジ改修",
        )
        if proj_hints:
            iv_c2.caption("登録済み: " + "　".join(proj_hints))

        with st.form("add_interview_form", clear_on_submit=True):
            r2c1, r2c2 = st.columns(2)
            interview_date = r2c1.text_input("面談日 (YYYY-MM-DD)", placeholder="2026-06-15")
            status         = r2c2.selectbox("ステータス", ["結果待ち", "通過", "不通過"])

            work_content       = st.text_area("業務内容", height=80, placeholder="担当する業務の概要")
            attendance_content = st.text_area("勤怠内容", height=60, placeholder="週5日フルリモート 等")
            memo               = st.text_input("メモ")
            submitted = st.form_submit_button("登録する", use_container_width=True)

        if submitted:
            if not company_sel.strip():
                st.error("会社名を入力してください。")
            else:
                df = load("interviews")
                df = pd.concat([df, pd.DataFrame([{
                    "id":                 generate_id(),
                    "company":            company_sel.strip(),
                    "project_name":       project_sel.strip(),
                    "work_content":       work_content,
                    "attendance_content": attendance_content,
                    "status":             status,
                    "interview_date":     interview_date.strip(),
                    "memo":               memo,
                }])], ignore_index=True)
                save("interviews", df)
                st.success("面談を登録しました。")
                st.rerun()

    # 面談一覧
    st.markdown("#### 面談一覧")
    df_iv = load("interviews")

    if df_iv.empty:
        st.info("面談がまだ登録されていません。")
    else:
        status_filter = st.multiselect(
            "ステータスで絞り込み",
            ["通過", "不通過", "結果待ち"],
            default=["通過", "不通過", "結果待ち"],
            key="iv_filter",
        )
        df_show = df_iv[df_iv["status"].isin(status_filter)].sort_values(
            "interview_date", ascending=False
        ).reset_index(drop=True)

        for _, row in df_show.iterrows():
            rid      = row["id"]
            edit_key = f"iv_edit_{rid}"
            del_key  = f"iv_del_{rid}"

            with st.container():
                st.markdown('<div class="section-card">', unsafe_allow_html=True)

                info_col, badge_col, btn_col = st.columns([4, 2, 2])
                with info_col:
                    st.markdown(
                        f"**{row['company']}** / {row['project_name']}  \n"
                        f"<span style='color:#64748b; font-size:0.82rem;'>{row.get('interview_date','')}</span>",
                        unsafe_allow_html=True,
                    )
                    if row.get("work_content"):
                        st.caption(row["work_content"][:60] + ("…" if len(row.get("work_content","")) > 60 else ""))
                with badge_col:
                    st.markdown(status_badge(row.get("status", "")), unsafe_allow_html=True)
                with btn_col:
                    bc1, bc2 = st.columns(2)
                    if bc1.button("編集", key=f"iv_ebtn_{rid}", use_container_width=True):
                        st.session_state[edit_key] = not st.session_state.get(edit_key, False)
                        st.session_state[del_key]  = False
                    if bc2.button("削除", key=f"iv_dbtn_{rid}", use_container_width=True):
                        st.session_state[del_key]  = not st.session_state.get(del_key, False)
                        st.session_state[edit_key] = False

                # 編集フォーム
                if st.session_state.get(edit_key):
                    ie1, ie2 = st.columns(2)
                    iv_edit_co   = ie1.text_input("会社名（自由入力）", value=row.get("company",""),      key=f"iv_eco_{rid}")
                    iv_edit_proj = ie2.text_input("案件名（自由入力）", value=row.get("project_name",""), key=f"iv_epr_{rid}")
                    # サジェスト表示
                    _co_hints = sorted({p["company"] for p in get_project_options()})
                    if _co_hints:
                        ie1.caption("登録済み: " + "　".join(_co_hints))
                    _pr_hints = [p["project_name"] for p in get_project_options() if p["company"] == iv_edit_co]
                    if _pr_hints:
                        ie2.caption("登録済み: " + "　".join(_pr_hints))

                    with st.form(f"iv_edit_form_{rid}"):
                        ef3, ef4 = st.columns(2)
                        new_date   = ef3.text_input("面談日 (YYYY-MM-DD)", value=row.get("interview_date", ""))
                        new_status = ef4.selectbox(
                            "ステータス",
                            ["結果待ち", "通過", "不通過"],
                            index=["結果待ち", "通過", "不通過"].index(row.get("status", "結果待ち"))
                            if row.get("status", "") in ["結果待ち", "通過", "不通過"] else 0,
                        )
                        new_work   = st.text_area("業務内容", value=row.get("work_content", ""), height=80)
                        new_att    = st.text_area("勤怠内容", value=row.get("attendance_content", ""), height=60)
                        new_memo   = st.text_input("メモ", value=row.get("memo", ""))
                        sc1, sc2 = st.columns(2)
                        do_save   = sc1.form_submit_button("保存する", use_container_width=True)
                        do_cancel = sc2.form_submit_button("キャンセル", use_container_width=True)

                    if do_save:
                        df_all = load("interviews")
                        m = df_all["id"] == rid
                        df_all.loc[m, "company"]            = iv_edit_co
                        df_all.loc[m, "project_name"]       = iv_edit_proj
                        df_all.loc[m, "interview_date"]     = new_date
                        df_all.loc[m, "status"]             = new_status
                        df_all.loc[m, "work_content"]       = new_work
                        df_all.loc[m, "attendance_content"] = new_att
                        df_all.loc[m, "memo"]               = new_memo
                        save("interviews", df_all)
                        st.session_state[edit_key] = False
                        st.success("更新しました。")
                        st.rerun()
                    if do_cancel:
                        st.session_state[edit_key] = False
                        st.rerun()

                # 削除確認
                if st.session_state.get(del_key):
                    st.warning(f"「{row['company']} / {row['project_name']}」の面談を削除しますか？")
                    cc1, cc2, _ = st.columns([1, 1, 3])
                    if cc1.button("削除する", key=f"iv_del_ok_{rid}", use_container_width=True):
                        df_all = load("interviews")
                        df_all = df_all[df_all["id"] != rid].reset_index(drop=True)
                        save("interviews", df_all)
                        st.session_state[del_key] = False
                        st.success("削除しました。")
                        st.rerun()
                    if cc2.button("やめる", key=f"iv_del_no_{rid}", use_container_width=True):
                        st.session_state[del_key] = False
                        st.rerun()

                st.markdown("</div>", unsafe_allow_html=True)

# ================================================================
# ToDo管理タブ
# ================================================================
with tab_todo:
    with st.expander("ToDo を登録する", expanded=False):
        td_c1, td_c2 = st.columns(2)
        todo_company  = td_c1.selectbox("会社名", [""] + companies, key="todo_company")
        todo_projects = get_project_list_by_company(todo_company) if todo_company else []
        todo_project  = td_c2.selectbox("案件名", [""] + todo_projects, key="todo_project")

        with st.form("add_todo_form", clear_on_submit=True):

            task     = st.text_input("タスク内容 *", placeholder="〇〇の資料を作成する")
            tc3, tc4 = st.columns(2)
            due_date = tc3.date_input("期限")
            progress = tc4.selectbox("進捗", ["未着手", "進行中", "完了"])
            t_submitted = st.form_submit_button("登録する", use_container_width=True)

        if t_submitted:
            if not task:
                st.error("タスク内容は必須です。")
            else:
                from datetime import datetime as dt
                df_t = load("todos")
                df_t = pd.concat([df_t, pd.DataFrame([{
                    "id":           generate_id(),
                    "company":      todo_company,
                    "project_name": todo_project,
                    "task":         task,
                    "due_date":     str(due_date),
                    "progress":     progress,
                    "created_at":   dt.now().strftime("%Y-%m-%d %H:%M"),
                }])], ignore_index=True)
                save("todos", df_t)
                st.success("ToDo を登録しました。")
                st.rerun()

    # ToDo一覧
    st.markdown("#### ToDo 一覧")
    df_todos = load("todos")

    if df_todos.empty:
        st.info("ToDo がまだ登録されていません。")
    else:
        prog_filter = st.multiselect(
            "進捗で絞り込み",
            ["未着手", "進行中", "完了"],
            default=["未着手", "進行中"],
            key="todo_filter",
        )
        df_t_show = df_todos[df_todos["progress"].isin(prog_filter)].sort_values(
            "due_date", ascending=True
        ).reset_index(drop=True)

        for _, row in df_t_show.iterrows():
            rid      = row["id"]
            edit_key = f"td_edit_{rid}"
            del_key  = f"td_del_{rid}"

            with st.container():
                st.markdown('<div class="section-card">', unsafe_allow_html=True)

                info_col, badge_col, btn_col = st.columns([4, 2, 2])
                with info_col:
                    st.markdown(f"**{row.get('task', '')}**")
                    st.caption(
                        f"{row.get('company','')}{'/' + row.get('project_name','') if row.get('project_name') else ''}  "
                        f"期限: {row.get('due_date','')}"
                    )
                with badge_col:
                    st.markdown(status_badge(row.get("progress", "")), unsafe_allow_html=True)
                    # 進捗を1クリックで変更できるボタン
                    prog_cycle = {"未着手": "進行中", "進行中": "完了", "完了": "未着手"}
                    next_prog = prog_cycle.get(row.get("progress", "未着手"), "未着手")
                    if st.button(f"→ {next_prog}", key=f"td_prog_{rid}", use_container_width=True):
                        df_all = load("todos")
                        df_all.loc[df_all["id"] == rid, "progress"] = next_prog
                        save("todos", df_all)
                        st.rerun()
                with btn_col:
                    bc1, bc2 = st.columns(2)
                    if bc1.button("編集", key=f"td_ebtn_{rid}", use_container_width=True):
                        st.session_state[edit_key] = not st.session_state.get(edit_key, False)
                        st.session_state[del_key]  = False
                    if bc2.button("削除", key=f"td_dbtn_{rid}", use_container_width=True):
                        st.session_state[del_key]  = not st.session_state.get(del_key, False)
                        st.session_state[edit_key] = False

                # 編集フォーム
                if st.session_state.get(edit_key):
                    with st.form(f"td_edit_form_{rid}"):
                        new_task = st.text_input("タスク内容", value=row.get("task", ""))
                        ef1, ef2 = st.columns(2)
                        new_company = ef1.text_input("会社名", value=row.get("company", ""))
                        new_proj    = ef2.text_input("案件名", value=row.get("project_name", ""))
                        ef3, ef4 = st.columns(2)
                        new_due  = ef3.text_input("期限 (YYYY-MM-DD)", value=row.get("due_date", ""))
                        new_prog = ef4.selectbox(
                            "進捗",
                            ["未着手", "進行中", "完了"],
                            index=["未着手", "進行中", "完了"].index(row.get("progress", "未着手"))
                            if row.get("progress", "") in ["未着手", "進行中", "完了"] else 0,
                        )
                        sc1, sc2 = st.columns(2)
                        do_save   = sc1.form_submit_button("保存する", use_container_width=True)
                        do_cancel = sc2.form_submit_button("キャンセル", use_container_width=True)

                    if do_save:
                        df_all = load("todos")
                        m = df_all["id"] == rid
                        df_all.loc[m, "task"]         = new_task
                        df_all.loc[m, "company"]      = new_company
                        df_all.loc[m, "project_name"] = new_proj
                        df_all.loc[m, "due_date"]     = new_due
                        df_all.loc[m, "progress"]     = new_prog
                        save("todos", df_all)
                        st.session_state[edit_key] = False
                        st.success("更新しました。")
                        st.rerun()
                    if do_cancel:
                        st.session_state[edit_key] = False
                        st.rerun()

                # 削除確認
                if st.session_state.get(del_key):
                    st.warning(f"「{row.get('task','')}」を削除しますか？")
                    cc1, cc2, _ = st.columns([1, 1, 3])
                    if cc1.button("削除する", key=f"td_del_ok_{rid}", use_container_width=True):
                        df_all = load("todos")
                        df_all = df_all[df_all["id"] != rid].reset_index(drop=True)
                        save("todos", df_all)
                        st.session_state[del_key] = False
                        st.success("削除しました。")
                        st.rerun()
                    if cc2.button("やめる", key=f"td_del_no_{rid}", use_container_width=True):
                        st.session_state[del_key] = False
                        st.rerun()

                st.markdown("</div>", unsafe_allow_html=True)
