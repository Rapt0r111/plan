#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pdf_to_sqlite.py — Автоматический импорт годового плана из PDF в SQLite.

Установка: pip install pdfplumber

Запуск:
  python pdf_to_sqlite.py --pdf ./Годовой_план.pdf --db ./local.db
  python pdf_to_sqlite.py --pdf ./Годовой_план.pdf --db ./local.db --dry-run
  python pdf_to_sqlite.py --pdf ./Годовой_план.pdf --db ./local.db --clear
"""

import sqlite3, re, argparse, sys
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("[ERROR] pip install pdfplumber"); sys.exit(1)

RESPONSIBLE_MAP = {
    "КНР": "Тарасенко С.Е. (КНР)",
    "КВ-1": "Халупа А.И. (КВ-1)",
    "КВ-2": "Трепалин П.В. (КВ-2)",
    "КВ": "Халупа А.И. + Трепалин П.В. (КВ)",
    "ЗКВ-1": "Антипов Е.В. (ЗКВ-1)",
    "ЗКВ-2": "Ермаков В.А. (ЗКВ-2)",
    "ПС": "Весь постоянный состав (ПС)",
    "СР": "Долгополов А.А. (СР)",
    "КО-2": "Арсенов А.В. (КО-2)",
}

MONTH_COLORS = {
    "ЯНВАРЬ": "#6366f1", "ФЕВРАЛЬ": "#8b5cf6", "МАРТ": "#a855f7",
    "АПРЕЛЬ": "#ec4899", "МАЙ": "#f43f5e",     "ИЮНЬ": "#f97316",
    "ИЮЛЬ": "#eab308",   "АВГУСТ": "#22c55e",  "СЕНТЯБРЬ": "#14b8a6",
    "ОКТЯБРЬ": "#06b6d4","НОЯБРЬ": "#3b82f6",  "ДЕКАБРЬ": "#64748b",
}

MONTH_RE = re.compile(
    r"^\s*(ЯНВАРЬ|ФЕВРАЛЬ|МАРТ|АПРЕЛЬ|МАЙ|ИЮНЬ|ИЮЛЬ|АВГУСТ|"
    r"СЕНТЯБРЬ|ОКТЯБРЬ|НОЯБРЬ|ДЕКАБРЬ)\s*$"
)

ABBREV = (r"КНР|КВ[-–]?[12]?|ЗКВ[-–]?[12]?|ПД|ПС|БП|ВПР|ЗиТ|МГ|НД|"
          r"ЕМ|УЛС|ПМП|СР|КО[-–]?[12]?")

TRAILING_RE = re.compile(rf"\s+({ABBREV})(\s*[,\/]\s*({ABBREV}))*\s*$")
DATE_RE = re.compile(r"^(\d{{1,2}}[-–]\d{{1,2}}|\d{{2}}\.\d{{2}})\s*")
LEAD_RE = re.compile(rf"^({ABBREV}|[АНУПA-Z])\s+")
NOISE_RE = re.compile(
    rf"^\s*$|^\s*({ABBREV})\s*$|^\s*\d{{1,2}}[-–]\d{{1,2}}\s*$"
    r"|^\s*\d{2}\.\d{2}\s*$|^\s*[–—…\*\.]\s*$|^\s*п/п\s*$"
)
CONT_RE = re.compile(
    r"^(суббота|результатам|образования|довольствия|продовольственные|"
    r"осуществляется|углублен|взаимодействии|ПО,\s+именные|билеты;)\b"
)


def extract_resp(line):
    found = []
    m = TRAILING_RE.search(line)
    if m:
        found = re.findall(ABBREV, line[m.start():])
        line = line[:m.start()].strip()
    return line, found


def clean_line(raw):
    s = raw.strip()
    date_str = ""
    m = DATE_RE.match(s)
    if m:
        date_str = m.group(1)
        s = s[m.end():]
    leading = []
    m2 = LEAD_RE.match(s)
    if m2:
        leading = [m2.group(1)]
        s = s[m2.end():]
    s = re.sub(r"^\*\s*", "", s).strip()
    s, trailing = extract_resp(s)
    return date_str, s.strip().rstrip(";,"), leading + trailing


def fmt_resp(abbrevs):
    seen, names = set(), []
    for a in abbrevs:
        k = a.replace("–", "-")
        if k not in seen:
            seen.add(k)
            names.append(RESPONSIBLE_MAP.get(k, k))
    return "Ответственный: " + ", ".join(names) if names else ""


def parse_pdf(pdf_path):
    lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text(x_tolerance=3, y_tolerance=3)
            if t:
                lines.extend(t.split("\n"))

    sections, cur_month, cur_lines = [], None, []
    for line in lines:
        m = MONTH_RE.match(line)
        if m:
            if cur_month:
                sections.append((cur_month, cur_lines))
            cur_month, cur_lines = m.group(1), []
        elif cur_month:
            cur_lines.append(line)
    if cur_month:
        sections.append((cur_month, cur_lines))

    epics = []
    for month, mlines in sections:
        tasks = parse_tasks(mlines)
        epics.append({
            "title": month[0] + month[1:].lower(),
            "description": f"Раздел годового плана: {month}",
            "color": MONTH_COLORS.get(month, "#64748b"),
            "tasks": tasks,
        })
    return epics


def parse_tasks(lines):
    tasks, current = [], None

    def flush():
        nonlocal current
        if current and current["title"].strip():
            tasks.append(current)
        current = None

    for raw in lines:
        s = raw.strip()
        if NOISE_RE.match(s):
            continue
        if s in ("…", "*", "– …", "..."):
            continue
        if CONT_RE.match(s) and current:
            current["title"] = (current["title"] + " " + s).strip()
            continue
        if s.startswith("- ") or s.startswith("– "):
            sub = re.sub(r"^[-–]\s*", "", s).strip().rstrip(";,")
            _, sub_clean, _ = clean_line("- " + sub)
            if sub_clean and len(sub_clean) > 1:
                if current is None:
                    current = {"title": "Подготовительные мероприятия",
                               "description": "", "subtasks": []}
                current["subtasks"].append(sub_clean.rstrip(";,"))
            continue
        date_str, text, resp = clean_line(s)
        if not text or len(text) < 3:
            continue
        flush()
        desc_parts = []
        if date_str:
            desc_parts.append(f"Срок: {date_str}")
        r = fmt_resp(resp)
        if r:
            desc_parts.append(r)
        current = {
            "title": text.rstrip(":"),
            "description": " | ".join(desc_parts),
            "subtasks": [],
        }
    flush()
    return tasks


def find_col(cols, *names):
    low = {c[0].lower(): c[0] for c in cols}
    for n in names:
        if n.lower() in low:
            return low[n.lower()]
    return None


def run(db_path, epics, clear, dry_run):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    schema = {}
    for t in tables:
        cur.execute(f"PRAGMA table_info({t})")
        schema[t] = [(r[1], r[2]) for r in cur.fetchall()]

    if not schema:
        print("[ERROR] БД пустая. Запустите drizzle-kit push сначала.")
        conn.close(); return

    print(f"\n[INFO] Таблицы: {list(schema.keys())}")

    epics_t = next((t for t in schema if "epic" in t.lower()), None)
    tasks_t = next((t for t in schema
                    if "task" in t.lower() and "sub" not in t.lower()), None)
    subs_t  = next((t for t in schema
                    if "subtask" in t.lower() or "sub_task" in t.lower()), None)

    if not epics_t:
        print("[ERROR] Таблица epics не найдена."); conn.close(); return

    ec = schema[epics_t]
    e_title = find_col(ec, "title", "name")
    e_desc  = find_col(ec, "description", "desc")
    e_color = find_col(ec, "color")

    tc = schema.get(tasks_t, []) if tasks_t else []
    t_title = find_col(tc, "title", "name")
    t_desc  = find_col(tc, "description", "desc")
    t_efk   = find_col(tc, "epic_id", "epicId", "epic")

    sc = schema.get(subs_t, []) if subs_t else []
    s_title = find_col(sc, "title", "name")
    s_tfk   = find_col(sc, "task_id", "taskId", "task")

    tt = sum(len(e["tasks"]) for e in epics)
    ts = sum(len(t["subtasks"]) for e in epics for t in e["tasks"])

    if dry_run:
        print(f"\n[DRY RUN] {len(epics)} эпиков / {tt} задач / {ts} сабтасков")
        for ep in epics:
            print(f"\n  📅 {ep['title']} ({len(ep['tasks'])} задач)")
            for task in ep["tasks"][:3]:
                print(f"     ✓ {task['title'][:70]}")
                if task['description']:
                    print(f"       → {task['description'][:60]}")
                for sub in task["subtasks"][:2]:
                    print(f"         - {sub[:60]}")
                if len(task["subtasks"]) > 2:
                    print(f"         … ещё {len(task['subtasks'])-2}")
        conn.close(); return

    if clear:
        print("[WARN] Очищаем таблицы...")
        if subs_t:  cur.execute(f"DELETE FROM {subs_t}")
        if tasks_t: cur.execute(f"DELETE FROM {tasks_t}")
        cur.execute(f"DELETE FROM {epics_t}")
        conn.commit()

    st = {"e": 0, "t": 0, "s": 0, "err": 0}

    for ep in epics:
        try:
            cs, vs = [], []
            if e_title: cs.append(e_title); vs.append(ep["title"])
            if e_desc:  cs.append(e_desc);  vs.append(ep["description"])
            if e_color: cs.append(e_color); vs.append(ep["color"])
            cur.execute(
                f"INSERT INTO {epics_t} ({','.join(cs)}) VALUES ({','.join(['?']*len(cs))})",
                vs)
            eid = cur.lastrowid; st["e"] += 1
        except sqlite3.Error as ex:
            print(f"[WARN] Эпик '{ep['title']}': {ex}"); st["err"] += 1; continue

        if not tasks_t or not t_title: continue

        for task in ep["tasks"]:
            if not task["title"].strip(): continue
            try:
                cs, vs = [], []
                if t_title: cs.append(t_title); vs.append(task["title"])
                if t_desc:  cs.append(t_desc);  vs.append(task["description"])
                if t_efk:   cs.append(t_efk);   vs.append(eid)
                cur.execute(
                    f"INSERT INTO {tasks_t} ({','.join(cs)}) VALUES ({','.join(['?']*len(cs))})",
                    vs)
                tid = cur.lastrowid; st["t"] += 1
            except sqlite3.Error as ex:
                print(f"[WARN] Задача '{task['title'][:40]}': {ex}"); st["err"] += 1; continue

            if not subs_t or not s_title: continue
            for sub in task["subtasks"]:
                if not sub.strip(): continue
                try:
                    cs, vs = [], []
                    if s_title: cs.append(s_title); vs.append(sub)
                    if s_tfk:   cs.append(s_tfk);   vs.append(tid)
                    cur.execute(
                        f"INSERT INTO {subs_t} ({','.join(cs)}) VALUES ({','.join(['?']*len(cs))})",
                        vs)
                    st["s"] += 1
                except sqlite3.Error as ex:
                    print(f"[WARN] Sub '{sub[:30]}': {ex}"); st["err"] += 1

    conn.commit(); conn.close()
    print(f"\n{'='*50}")
    print(f"  Эпиков:    {st['e']}")
    print(f"  Задач:     {st['t']}")
    print(f"  Сабтасков: {st['s']}")
    if st["err"]: print(f"  Ошибок:    {st['err']}")
    print(f"{'='*50}")


def main():
    ap = argparse.ArgumentParser(description="PDF → SQLite импорт")
    ap.add_argument("--pdf",     default="Годовой_план.pdf")
    ap.add_argument("--db",      default="local.db")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--clear",   action="store_true")
    args = ap.parse_args()

    if not Path(args.pdf).exists():
        print(f"[ERROR] PDF не найден: {args.pdf}"); sys.exit(1)
    if not args.dry_run and not Path(args.db).exists():
        print(f"[ERROR] БД не найдена: {args.db}"); sys.exit(1)

    print(f"[INFO] Читаем: {args.pdf}")
    epics = parse_pdf(args.pdf)
    tt = sum(len(e["tasks"]) for e in epics)
    ts = sum(len(t["subtasks"]) for e in epics for t in e["tasks"])
    print(f"[INFO] Распознано: {len(epics)} эпиков / {tt} задач / {ts} сабтасков")
    run(args.db, epics, args.clear, args.dry_run)

if __name__ == "__main__":
    main()