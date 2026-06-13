"""
pages/3_日報管理.py
日報の入力・編集・削除・閲覧を管理するページ
"""

import calendar
import pandas as pd
import streamlit as st
from datetime import datetime, date, timedelta
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.data_manager import (
    load, save, append_row, generate_id, init_all,
    get_company_list, get_project_list_by_company,
)
from utils.styles import THEME_CSS, render_sidebar, set_flash, show_flash

st.set_page_config(page_title="日報管理 | SES業務管理", layout="wide")
st.markdown(THEME_CSS, unsafe_allow_html=True)

if "initialized" not in st.session_state:
    init_all()
    st.session_state["initialized"] = True

render_sidebar()
show_flash()

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
    # 通常勤務
    "出社", "在宅", "出社+在宅",
    # 遅刻・早退
    "遅刻", "早退", "遅刻+早退",
    # 休暇・休日
    "有給", "午前半休", "午後半休", "特別休暇",
    # 欠勤・その他
    "欠勤", "振替休日", "その他",
]

# 勤怠区分ごとのカラー（カレンダー用）
ATT_COLOR = {
    "出社":       "#3b82f6",
    "在宅":       "#6366f1",
    "出社+在宅":  "#8b5cf6",
    "遅刻":       "#fb923c",
    "早退":       "#fb923c",
    "遅刻+早退":  "#f97316",
    "有給":       "#f59e0b",
    "午前半休":   "#fbbf24",
    "午後半休":   "#fbbf24",
    "特別休暇":   "#10b981",
    "欠勤":       "#ef4444",
    "振替休日":   "#14b8a6",
    "その他":     "#64748b",
}


def parse_hhmm(s: str, fallback: str = "00:00") -> str:
    s = str(s).strip()
    try:
        if ":" in s:
            h, m = s.split(":", 1)
            h, m = int(h), int(m)
            if 0 <= h <= 23 and 0 <= m <= 59:
                return f"{h:02d}:{m:02d}"
    except Exception:
        pass
    return fallback


def calc_work_hours(start: str, end: str, brk: str) -> float:
    def to_min(t: str) -> int:
        h, m = parse_hhmm(t).split(":")
        return int(h) * 60 + int(m)
    return max(0.0, (to_min(end) - to_min(start) - to_min(brk)) / 60)


def time_inputs(label_start="出社時刻", label_end="退勤時刻", label_brk="休憩時間",
                default_start="09:00", default_end="18:00", default_brk="01:00",
                key_prefix="t") -> tuple[str, str, str]:
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


def render_calendar(year: int, month: int, recorded: dict) -> str:
    """
    recorded: {day(int): attendance_type(str)} の辞書
    カレンダーHTMLを返す
    """
    cal = calendar.monthcalendar(year, month)
    dow_labels = ["月", "火", "水", "木", "金", "土", "日"]

    header_cells = "".join(
        f"<th style='color:{'#94a3b8' if i < 5 else ('#60a5fa' if i == 5 else '#f87171')}'>"
        f"{d}</th>"
        for i, d in enumerate(dow_labels)
    )

    rows_html = ""
    today = date.today()
    for week in cal:
        cells = ""
        for i, day in enumerate(week):
            if day == 0:
                cells += "<td></td>"
                continue
            att  = recorded.get(day)
            color = ATT_COLOR.get(att, "") if att else ""
            is_today = (year == today.year and month == today.month and day == today.day)
            is_sat = (i == 5)
            is_sun = (i == 6)

            day_color = "#60a5fa" if is_sat else ("#f87171" if is_sun else "#c8d6e5")
            bg = color if color else ("rgba(255,255,255,0.04)" if not (is_sat or is_sun) else "transparent")
            border = "2px solid #3b82f6" if is_today else "1px solid transparent"
            dot = f"<div style='width:6px;height:6px;border-radius:50%;background:{color};margin:2px auto 0;'></div>" if color else ""

            cells += (
                f"<td style='text-align:center;padding:6px 2px;border-radius:6px;"
                f"background:{bg};border:{border};'>"
                f"<span style='font-size:0.82rem;color:{day_color};font-weight:{'700' if is_today else '400'};'>"
                f"{day}</span>{dot}</td>"
            )
        rows_html += f"<tr>{cells}</tr>"

    legend = "".join(
        f"<span style='display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:0.72rem;color:#94a3b8;'>"
        f"<span style='width:8px;height:8px;border-radius:50%;background:{c};display:inline-block;'></span>{k}</span>"
        for k, c in ATT_COLOR.items()
        if k in recorded.values()
    )

    jp_months = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"]
    title = f"{year}年{jp_months[month-1]}"

    return f"""
    <div style='background:#161b27;border:1px solid #1e2a3a;border-radius:10px;padding:1rem;margin-bottom:1rem;'>
      <div style='font-size:0.95rem;font-weight:700;color:#e2e8f0;margin-bottom:0.6rem;'>{title}</div>
      <table style='width:100%;border-collapse:separate;border-spacing:3px;'>
        <thead><tr>{header_cells}</tr></thead>
        <tbody>{rows_html}</tbody>
      </table>
      <div style='margin-top:0.6rem;line-height:2;'>{legend}</div>
    </div>
    """


companies = get_company_list()
df_all_daily = load("daily")

# ===== カレンダー表示 =====
st.markdown("### 入力状況カレンダー")

today = date.today()
# 最古の日報月〜今月の全月リスト
if not df_all_daily.empty and "date" in df_all_daily.columns:
    dates_valid = pd.to_datetime(df_all_daily["date"], errors="coerce").dropna()
    if not dates_valid.empty:
        min_ym = (dates_valid.min().year, dates_valid.min().month)
    else:
        min_ym = (today.year, today.month)
else:
    min_ym = (today.year, today.month)

all_months = []
y, m = min_ym
while (y, m) <= (today.year, today.month):
    all_months.append(f"{y}-{m:02d}")
    m += 1
    if m > 12:
        m = 1; y += 1

JP_MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"]

def ym_to_jp(ym: str) -> str:
    y, m = int(ym[:4]), int(ym[5:])
    return f"{y}年{JP_MONTHS[m-1]}"

months_reversed = list(reversed(all_months))
cal_month = st.selectbox(
    "表示月",
    months_reversed,
    format_func=ym_to_jp,
    key="cal_month",
    index=0,
)
cal_y, cal_m = int(cal_month[:4]), int(cal_month[5:])

# その月の記録日マップ
recorded_days: dict[int, str] = {}
if not df_all_daily.empty:
    mask = df_all_daily["date"].str.startswith(cal_month, na=False)
    for _, r in df_all_daily[mask].iterrows():
        try:
            d = int(str(r["date"]).split("-")[2])
            recorded_days[d] = r.get("attendance_type", "その他")
        except Exception:
            pass

st.markdown(render_calendar(cal_y, cal_m, recorded_days), unsafe_allow_html=True)
cnt = len(recorded_days)
total_days = calendar.monthrange(cal_y, cal_m)[1]
st.caption(f"{cal_month}：{cnt} 日 / {total_days} 日 入力済み")

st.markdown("---")

# ===== 日報入力フォーム =====
def jp_date_selector(key_prefix: str, default: date) -> str:
    """年・月・日セレクトボックスで日付を選ばせ YYYY-MM-DD 文字列を返す"""
    today = date.today()
    years = list(range(today.year - 2, today.year + 2))
    months_jp = [f"{m}月" for m in range(1, 13)]
    d1, d2, d3 = st.columns(3)
    sel_y = d1.selectbox("年",  years,       index=years.index(default.year) if default.year in years else len(years)-1, key=f"{key_prefix}_y", label_visibility="collapsed")
    sel_m = d2.selectbox("月",  months_jp,   index=default.month - 1,                                                    key=f"{key_prefix}_m", label_visibility="collapsed")
    sel_m_int = months_jp.index(sel_m) + 1
    max_day = calendar.monthrange(sel_y, sel_m_int)[1]
    days = list(range(1, max_day + 1))
    sel_d = d3.selectbox("日",  [f"{d}日" for d in days], index=min(default.day, max_day) - 1,                          key=f"{key_prefix}_d", label_visibility="collapsed")
    sel_d_int = int(sel_d.replace("日", ""))
    st.caption(f"選択中: {sel_y}年{sel_m}{sel_d}")
    return f"{sel_y}-{sel_m_int:02d}-{sel_d_int:02d}"


LATE_EARLY_TYPES = {"遅刻", "早退", "遅刻+早退"}
LATE_EARLY_LABEL = {"遅刻": "遅刻時間 (h)", "早退": "早退時間 (h)", "遅刻+早退": "遅刻+早退時間 (h)"}

with st.expander("日報を入力する", expanded=True):
    show_flash()
    # 1行目：日付（広め）＋勤怠区分
    dr1, dr2 = st.columns([3, 1])
    with dr1:
        st.markdown("<div style='font-size:0.82rem;color:#94a3b8;margin-bottom:0.25rem;'>日付 *</div>", unsafe_allow_html=True)
        reg_date = jp_date_selector("reg_date", date.today())
    reg_att = dr2.selectbox("勤怠区分 *", ATTENDANCE_OPTIONS, key="reg_att")
    # 2行目：会社名・案件名
    rc2, rc3 = st.columns([1, 1])
    reg_company = rc2.selectbox("会社名 *", [""] + companies, key="reg_company")
    reg_projs   = get_project_list_by_company(reg_company) if reg_company else []
    reg_project = rc3.selectbox("案件名 *", [""] + reg_projs, key="reg_project")

    # 同日付の重複チェック
    dup_dates = set(df_all_daily["date"].tolist()) if not df_all_daily.empty else set()
    if reg_date and reg_date in dup_dates:
        st.warning(f"{reg_date} の日報はすでに登録されています。内容を確認してから登録してください。")

    with st.form("daily_report_form", clear_on_submit=True):
        st_s, st_e, st_b = time_inputs(key_prefix="reg")
        wh_prev = calc_work_hours(st_s, st_e, st_b)
        st.info(f"実働時間（自動計算）: **{wh_prev:.2f} h**　※稼働時間として集計されます")

        late_early_h = 0.0
        if reg_att in LATE_EARLY_TYPES:
            late_early_h = st.number_input(
                LATE_EARLY_LABEL[reg_att],
                min_value=0.0, max_value=12.0, step=0.25, value=0.0,
                key="reg_let",
                help="遅刻・早退した時間を入力してください（例: 1.5 = 1時間30分）"
            )

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
            let = round(late_early_h, 2) if reg_att in LATE_EARLY_TYPES else 0.0
            append_row("daily", {
                "id":               generate_id(),
                "date":             reg_date,
                "company":          reg_company,
                "project_name":     reg_project,
                "attendance_type":  reg_att,
                "start_time":       st_s,
                "end_time":         st_e,
                "break_time":       st_b,
                "work_hours":       round(wh, 2),
                "late_early_time":  str(let),
                "work_content":     work_content.strip(),
                "remarks":          remarks.strip(),
                "created_at":       datetime.now().strftime("%Y-%m-%d %H:%M"),
            })
            extra = f"　遅刻/早退 {let:.2f}h" if let > 0 else ""
            set_flash("success", f"{reg_date} の日報を登録しました。（実働 {wh:.2f}h{extra}）")
            st.rerun()

st.markdown("---")

# ===== 日報一覧 =====
show_flash()
st.markdown("### 日報一覧")
df = load("daily")

if df.empty:
    st.info("日報がまだ登録されていません。")
    st.stop()

fc1, fc2, fc3 = st.columns(3)
sel_month   = fc1.selectbox(
    "月で絞り込み",
    ["全期間"] + list(reversed(all_months)),
    format_func=lambda v: v if v == "全期間" else ym_to_jp(v),
    key="dr_month",
)
sel_company = fc2.selectbox("会社で絞り込み", ["全社"]   + companies,                  key="dr_company_f")

df_view = df.copy()
if sel_month   != "全期間": df_view = df_view[df_view["date"].str.startswith(sel_month, na=False)]
if sel_company != "全社":   df_view = df_view[df_view["company"] == sel_company]
df_view = df_view.sort_values("date", ascending=False).reset_index(drop=True)

total_h = pd.to_numeric(df_view["work_hours"], errors="coerce").sum()
fc3.metric("表示期間の合計稼働時間", f"{total_h:.2f} h")
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
            att_val = row.get("attendance_type", "")
            att_color = ATT_COLOR.get(att_val, "#94a3b8")
            st.markdown(
                f"**{row.get('date','')}** &nbsp;"
                f"<span style='color:{att_color}; font-size:0.82rem;'>{att_val}</span>",
                unsafe_allow_html=True,
            )
            let_val = row.get("late_early_time", "0")
            try:
                let_f = float(let_val)
            except Exception:
                let_f = 0.0
            att_type = row.get("attendance_type", "")
            let_disp = f"遅刻/早退 {let_f:.2f}h" if (let_f > 0 and att_type in LATE_EARLY_TYPES) else ""
            meta = "  |  ".join(x for x in [
                f"{row.get('company','')} / {row.get('project_name','')}",
                time_label, wh_disp, let_disp,
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

        if st.session_state.get(edit_key):
            cur_att = row.get("attendance_type", "出社")
            att_idx = ATTENDANCE_OPTIONS.index(cur_att) if cur_att in ATTENDANCE_OPTIONS else 0
            all_cos = get_company_list()
            ec1, ec2 = st.columns(2)
            cur_co_idx   = ([""] + all_cos).index(row.get("company","")) \
                if row.get("company","") in all_cos else 0
            edit_company = ec1.selectbox("会社名", [""] + all_cos,
                                         index=cur_co_idx, key=f"ec_{rid}")
            edit_projs   = get_project_list_by_company(edit_company) if edit_company else []
            cur_proj     = row.get("project_name","")
            proj_opts    = [""] + edit_projs
            proj_idx     = proj_opts.index(cur_proj) if cur_proj in proj_opts else 0
            edit_project = ec2.selectbox("案件名", proj_opts, index=proj_idx, key=f"ep_{rid}")

            ef1, ef2 = st.columns(2)
            new_date = ef1.text_input("日付 (YYYY-MM-DD)", value=row.get("date",""), key=f"edate_{rid}")
            new_att  = ef2.selectbox("勤怠区分", ATTENDANCE_OPTIONS, index=att_idx, key=f"eatt_{rid}")

            with st.form(f"dr_edit_form_{rid}"):
                e_s, e_e, e_b = time_inputs(
                    default_start=row.get("start_time","09:00") or "09:00",
                    default_end  =row.get("end_time",  "18:00") or "18:00",
                    default_brk  =row.get("break_time","01:00") or "01:00",
                    key_prefix=f"edit_{rid}",
                )
                st.info(f"実働時間（自動計算）: **{calc_work_hours(e_s, e_e, e_b):.2f} h**　※稼働時間として集計されます")
                edit_late_h = 0.0
                if new_att in LATE_EARLY_TYPES:
                    try:
                        cur_let = float(row.get("late_early_time", 0) or 0)
                    except Exception:
                        cur_let = 0.0
                    edit_late_h = st.number_input(
                        LATE_EARLY_LABEL[new_att],
                        min_value=0.0, max_value=12.0, step=0.25, value=cur_let,
                        key=f"elet_{rid}",
                    )
                new_content = st.text_area("業務内容", value=row.get("work_content",""), height=100)
                new_remarks = st.text_area("備考",     value=row.get("remarks",     ""), height=60)
                sc1, sc2 = st.columns(2)
                do_save   = sc1.form_submit_button("保存する",   use_container_width=True)
                do_cancel = sc2.form_submit_button("キャンセル", use_container_width=True)

            if do_save:
                new_wh = calc_work_hours(e_s, e_e, e_b)
                new_let = round(edit_late_h, 2) if new_att in LATE_EARLY_TYPES else 0.0
                df_all = load("daily")
                m = df_all["id"] == rid
                df_all.loc[m, "date"]            = new_date
                df_all.loc[m, "company"]         = edit_company
                df_all.loc[m, "project_name"]    = edit_project
                df_all.loc[m, "attendance_type"] = new_att
                df_all.loc[m, "start_time"]      = e_s
                df_all.loc[m, "end_time"]        = e_e
                df_all.loc[m, "break_time"]      = e_b
                df_all.loc[m, "work_hours"]      = str(round(new_wh, 2))
                df_all.loc[m, "late_early_time"] = str(new_let)
                df_all.loc[m, "work_content"]    = new_content
                df_all.loc[m, "remarks"]         = new_remarks
                save("daily", df_all)
                st.session_state[edit_key] = False
                set_flash("success", "更新しました。")
                st.rerun()
            if do_cancel:
                st.session_state[edit_key] = False
                st.rerun()

        if st.session_state.get(del_key):
            st.warning(f"{row.get('date','')} の日報を削除しますか？")
            cc1, cc2, _ = st.columns([1, 1, 4])
            if cc1.button("削除する", key=f"dr_del_ok_{rid}", use_container_width=True):
                df_all = load("daily")
                df_all = df_all[df_all["id"] != rid].reset_index(drop=True)
                save("daily", df_all)
                st.session_state[del_key] = False
                set_flash("success", "削除しました。")
                st.rerun()
            if cc2.button("やめる", key=f"dr_del_no_{rid}", use_container_width=True):
                st.session_state[del_key] = False
                st.rerun()

        st.markdown("</div>", unsafe_allow_html=True)
