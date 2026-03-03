#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
reconcile.py — Сверка данных PDF-плана с базой данных SQLite.

Запуск:
    pip install thefuzz python-Levenshtein pdfplumber
    python reconcile.py                        # PDF из файла pdf_text.txt
    python reconcile.py --pdf plan.pdf         # Прямой парсинг PDF
    python reconcile.py --db ./local.db --pdf plan.pdf --threshold 80

Результат: reconciliation_report.txt
"""

import sqlite3
import re
import argparse
import sys
from pathlib import Path

# ── Попытка импортировать библиотеки ──────────────────────────────────────────
try:
    from thefuzz import fuzz, process as fuzz_process
    FUZZY_BACKEND = "thefuzz"
except ImportError:
    import difflib
    FUZZY_BACKEND = "difflib"
    print("[WARN] thefuzz не найден, используется difflib (менее точный).")
    print("       Рекомендуется: pip install thefuzz python-Levenshtein\n")

# ── Константы ─────────────────────────────────────────────────────────────────

DEFAULT_DB_PATH        = "local.db"
DEFAULT_PDF_TEXT_PATH  = "pdf_text.txt"
DEFAULT_REPORT_PATH    = "reconciliation_report.txt"
DEFAULT_THRESHOLD      = 82   # % совпадения — ниже этого значения строка считается "потерянной"
MIN_LINE_LENGTH        = 10   # минимальная длина смысловой строки из PDF

# Паттерны "мусорных" строк, которые надо отфильтровать
NOISE_PATTERNS = [
    r"^\s*$",                              # пустые строки
    r"^\s*\d{1,2}[-–]\d{1,2}\s*$",        # "1-15", "10-30"
    r"^\s*\d{1,2}\.\d{2}\s*$",            # "20.01", "28.02"
    r"^\s*[А-ЯA-Z]{1,5}[-–]?\d?\s*$",    # "КВ", "ПД", "ЗКВ-2", "КНР"
    r"^\s*[А-ЯA-Z]{1,3}\s*$",            # "ПС", "НД", "МГ"
    r"^\s*\d{1,2}\s*$",                   # одиночные числа "20", "25"
    r"^\s*…\s*$",                          # многоточие
    r"^\s*[–—]\s*$",                       # одиночные тире
    r"^\s*\*\s*$",                         # одиночная звёздочка
]

NOISE_RE = [re.compile(p) for p in NOISE_PATTERNS]

# Роли-аббревиатуры, которые могут «прилипнуть» к концу строки в PDF
TRAILING_ROLES_RE = re.compile(
    r"\s*(КНР|КВ-[12]|КВ|ЗКВ-[12]|ЗКВ|ПД|ПС|БП|ВПР|ЗиТ|МГ|НД|ЕМ|УЛС|ПМП|"
    r"СР|КО-[12]|А|Н|У|П)\s*$"
)

# ── Нормализация текста ───────────────────────────────────────────────────────

def normalize(text: str) -> str:
    """Привести строку к нижнему регистру, убрать лишние пробелы и спецсимволы."""
    if not text:
        return ""
    # Убираем переносы строк внутри строки
    text = text.replace("\n", " ").replace("\r", " ")
    # Убираем bullet-символы и дефисы в начале
    text = re.sub(r"^\s*[-–—•·*]\s*", "", text)
    # Убираем роли в конце (КВ-2, КНР и т.п.)
    text = TRAILING_ROLES_RE.sub("", text)
    # Убираем даты в начале (10-15, 01-20 и т.п.)
    text = re.sub(r"^\s*\d{1,2}[-–]\d{1,2}\s+", "", text)
    text = re.sub(r"^\s*\d{1,2}\.\d{2}\s+", "", text)
    # Нормализуем пробелы
    text = re.sub(r"\s+", " ", text).strip()
    # Нижний регистр
    text = text.lower()
    # Убираем знаки препинания, оставляем буквы/цифры/пробелы
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()
    return text

# ── Работа с базой данных ─────────────────────────────────────────────────────

def load_db_texts(db_path: str) -> list[str]:
    """
    Извлечь все тексты из БД:
    - epics.title, epics.description
    - tasks.title, tasks.description
    - subtasks.title
    Вернуть список нормализованных строк.
    """
    if not Path(db_path).exists():
        print(f"[ERROR] База данных не найдена: {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    raw_texts = []

    queries = [
        "SELECT title FROM epics WHERE title IS NOT NULL",
        "SELECT description FROM epics WHERE description IS NOT NULL",
        "SELECT title FROM tasks WHERE title IS NOT NULL",
        "SELECT description FROM tasks WHERE description IS NOT NULL",
        "SELECT title FROM subtasks WHERE title IS NOT NULL",
    ]

    for q in queries:
        try:
            rows = cursor.execute(q).fetchall()
            for (val,) in rows:
                if val and val.strip():
                    raw_texts.append(val.strip())
        except sqlite3.OperationalError as e:
            print(f"[WARN] Ошибка запроса '{q}': {e}")

    conn.close()

    # Нормализуем и дедуплицируем
    normalized = list({normalize(t) for t in raw_texts if normalize(t)})
    print(f"[DB] Загружено записей из БД: {len(raw_texts)}, уникальных нормализованных: {len(normalized)}")
    return normalized

# ── Извлечение текста из PDF через pdfplumber ─────────────────────────────────

def extract_pdf_lines_from_file(pdf_path: str) -> list[str]:
    """Извлечь строки напрямую из PDF-файла через pdfplumber."""
    try:
        import pdfplumber
    except ImportError:
        print("[ERROR] pdfplumber не установлен. Выполните: pip install pdfplumber")
        sys.exit(1)

    lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                lines.extend(text.split("\n"))

    print(f"[PDF] Извлечено строк из PDF-файла: {len(lines)}")
    return lines

# ── Загрузка текста из txt-файла ──────────────────────────────────────────────

def load_pdf_text_from_file(txt_path: str) -> list[str]:
    """Прочитать построчно txt-файл с OCR/экспортированным текстом PDF."""
    if not Path(txt_path).exists():
        print(f"[ERROR] Файл с текстом PDF не найден: {txt_path}")
        print(f"        Создайте файл '{txt_path}' или используйте флаг --pdf plan.pdf")
        sys.exit(1)

    with open(txt_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    print(f"[TXT] Загружено строк из текстового файла: {len(lines)}")
    return [line.rstrip("\n") for line in lines]

# ── Фильтрация мусора ─────────────────────────────────────────────────────────

def is_noise(line: str) -> bool:
    """Вернуть True, если строка — мусор и не несёт смысловой нагрузки."""
    stripped = line.strip()
    if len(stripped) < MIN_LINE_LENGTH:
        return True
    for pattern in NOISE_RE:
        if pattern.match(stripped):
            return True
    return False

def filter_meaningful_lines(raw_lines: list[str]) -> list[str]:
    """Оставить только смысловые строки из PDF."""
    result = []
    for line in raw_lines:
        line = line.strip()
        if not is_noise(line):
            result.append(line)
    print(f"[FILTER] Смысловых строк после фильтрации: {len(result)}")
    return result

# ── Fuzzy-сравнение ───────────────────────────────────────────────────────────

def fuzzy_score_thefuzz(query: str, candidates: list[str]) -> tuple[int, str]:
    """Найти лучшее совпадение через thefuzz. Возвращает (score, best_match)."""
    if not candidates:
        return 0, ""
    # token_set_ratio лучше справляется с перестановками слов и частичными совпадениями
    best_match, score = fuzz_process.extractOne(
        query, candidates, scorer=fuzz.token_set_ratio
    )
    return score, best_match

def fuzzy_score_difflib(query: str, candidates: list[str]) -> tuple[int, str]:
    """Найти лучшее совпадение через difflib. Возвращает (score, best_match)."""
    if not candidates:
        return 0, ""
    matches = difflib.get_close_matches(query, candidates, n=1, cutoff=0.0)
    if not matches:
        return 0, ""
    best = matches[0]
    ratio = difflib.SequenceMatcher(None, query, best).ratio()
    return int(ratio * 100), best

def find_best_match(query_normalized: str, db_normalized: list[str]) -> tuple[int, str]:
    """Универсальная обёртка для fuzzy-поиска."""
    if FUZZY_BACKEND == "thefuzz":
        return fuzzy_score_thefuzz(query_normalized, db_normalized)
    else:
        return fuzzy_score_difflib(query_normalized, db_normalized)

# ── Основная логика сверки ────────────────────────────────────────────────────

def reconcile(
    pdf_lines: list[str],
    db_normalized: list[str],
    threshold: int,
) -> dict:
    """
    Сверить строки PDF с текстами БД.
    
    Возвращает словарь:
      - total: общее число проанализированных строк
      - found: найдено в БД
      - missing: список словарей с деталями по каждой потерянной строке
    """
    meaningful = filter_meaningful_lines(pdf_lines)
    total = len(meaningful)
    found_count = 0
    missing = []

    print(f"\n[RECONCILE] Начинаю сверку {total} строк с {len(db_normalized)} записями БД...")
    print(f"[RECONCILE] Порог совпадения: {threshold}%\n")

    for i, raw_line in enumerate(meaningful, 1):
        norm = normalize(raw_line)
        if not norm:
            total -= 1
            continue

        score, best_match = find_best_match(norm, db_normalized)

        if score >= threshold:
            found_count += 1
        else:
            missing.append({
                "original": raw_line,
                "normalized": norm,
                "best_score": score,
                "best_match_in_db": best_match,
            })

        # Прогресс каждые 50 строк
        if i % 50 == 0:
            print(f"  ... обработано {i}/{total} строк")

    return {
        "total": total,
        "found": found_count,
        "missing": missing,
    }

# ── Генерация отчёта ──────────────────────────────────────────────────────────

def generate_report(result: dict, report_path: str, threshold: int):
    """Записать результаты сверки в текстовый файл."""
    total   = result["total"]
    found   = result["found"]
    missing = result["missing"]
    not_found_count = len(missing)

    lines = []
    lines.append("=" * 70)
    lines.append("ОТЧЁТ АВТОМАТИЧЕСКОЙ СВЕРКИ: PDF-ПЛАН vs БАЗА ДАННЫХ")
    lines.append("=" * 70)
    lines.append("")
    lines.append(f"Порог нечёткого совпадения:       {threshold}%")
    lines.append(f"Бэкенд сравнения:                 {FUZZY_BACKEND}")
    lines.append("")
    lines.append(f"Всего проанализировано строк в PDF: {total}")
    lines.append(f"Найдено в БД (score >= {threshold}%):    {found}")
    lines.append(f"НЕ НАЙДЕНО В БД:                    {not_found_count}")
    coverage = (found / total * 100) if total > 0 else 0
    lines.append(f"Покрытие:                           {coverage:.1f}%")
    lines.append("")

    if not missing:
        lines.append("✅ ВСЕ СТРОКИ PDF НАЙДЕНЫ В БАЗЕ ДАННЫХ!")
    else:
        lines.append("=" * 70)
        lines.append(f"СПИСОК ПОТЕРЯННЫХ СТРОК ({not_found_count} шт.)")
        lines.append("=" * 70)
        lines.append("")
        for idx, item in enumerate(missing, 1):
            lines.append(f"[{idx:03d}] СТРОКА ИЗ PDF:")
            lines.append(f"       {item['original']}")
            lines.append(f"       Лучшее совпадение в БД (score={item['best_score']}%):")
            if item["best_match_in_db"]:
                lines.append(f"       → {item['best_match_in_db'][:120]}")
            else:
                lines.append(f"       → (совпадений не найдено)")
            lines.append("")

    lines.append("=" * 70)
    lines.append("КОНЕЦ ОТЧЁТА")
    lines.append("=" * 70)

    report_text = "\n".join(lines)

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_text)

    print(report_text)
    print(f"\n[OK] Отчёт сохранён в: {report_path}")

# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="Сверка данных годового плана (PDF) с базой данных SQLite."
    )
    parser.add_argument(
        "--db", default=DEFAULT_DB_PATH,
        help=f"Путь к файлу SQLite (по умолчанию: {DEFAULT_DB_PATH})"
    )
    parser.add_argument(
        "--txt", default=DEFAULT_PDF_TEXT_PATH,
        help=f"Путь к TXT-файлу с текстом PDF (по умолчанию: {DEFAULT_PDF_TEXT_PATH})"
    )
    parser.add_argument(
        "--pdf", default=None,
        help="Путь к PDF-файлу (если указан, парсится напрямую через pdfplumber)"
    )
    parser.add_argument(
        "--report", default=DEFAULT_REPORT_PATH,
        help=f"Путь к выходному отчёту (по умолчанию: {DEFAULT_REPORT_PATH})"
    )
    parser.add_argument(
        "--threshold", type=int, default=DEFAULT_THRESHOLD,
        help=f"Порог совпадения в %% (по умолчанию: {DEFAULT_THRESHOLD})"
    )
    return parser.parse_args()


def main():
    args = parse_args()

    print("=" * 70)
    print("ЗАПУСК СВЕРКИ ДАННЫХ: PDF-ПЛАН vs SQLite")
    print("=" * 70)
    print(f"  База данных:  {args.db}")
    print(f"  Источник PDF: {args.pdf or args.txt}")
    print(f"  Порог:        {args.threshold}%")
    print(f"  Отчёт:        {args.report}")
    print()

    # 1. Загрузить тексты из БД
    db_normalized = load_db_texts(args.db)

    # 2. Получить строки из PDF
    if args.pdf:
        raw_lines = extract_pdf_lines_from_file(args.pdf)
    else:
        raw_lines = load_pdf_text_from_file(args.txt)

    # 3. Сверка
    result = reconcile(raw_lines, db_normalized, args.threshold)

    # 4. Отчёт
    generate_report(result, args.report, args.threshold)


if __name__ == "__main__":
    main()
