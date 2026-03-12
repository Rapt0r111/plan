/**
 * @file seed.ts — shared/db
 *
 * Идемпотентный seed: роли → пользователи → эпики (март–июль) → задачи
 *
 * Личный состав:
 *   КНР  — Тарасенко Станислав Евгеньевич   (командир роты)
 *   КВ-1 — Халупа Алексей Иванович           (командир 1 взвода)
 *   КВ-2 — Трепалин Павел Викторович          (командир 2 взвода)
 *   ЗКВ-1— Антипов Егор Викторович            (зам. ком. 1 взвода)
 *   ЗКВ-2— Ермаков Владимир Александрович     (зам. ком. 2 взвода)
 *   СР   — Долгополов Андрей Андреевич        (старшина роты)
 *   КО-2 — Арсенов Алексей Владимирович       (командир 2 отделения)
 *
 * Условные обозначения ответственных из плана:
 *   КНР   → tarasenko
 *   КВ-1  → khalupa
 *   КВ-2  → trepalin
 *   КВ    → khalupa + trepalin (оба командира взводов)
 *   ЗКВ-1 → antipov
 *   ЗКВ-2 → ermakov
 *   ПС    → все 7 человек
 *   СР    → dolgopolov
 *   КО-2  → arsenov
 *   ЕМ    → all (еженедельные/ежемесячные мероприятия)
 *   МГ    → all
 */

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { sql } from "drizzle-orm";
import { roles, users, epics, tasks, subtasks, taskAssignees } from "./schema";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "local.db");
const sqlite = new Database(DB_PATH, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

const db = drizzle(sqlite, { schema: { roles, users, epics, tasks, subtasks, taskAssignees } });

// ─── ROLES ────────────────────────────────────────────────────────────────────

const SEED_ROLES = [
  {
    key: "company_commander",
    label: "Командир роты",
    short: "КНР",
    hex: "#8b5cf6",
    sortOrder: 0,
    description: "Командир научной роты.",
  },
  {
    key: "platoon_1_commander",
    label: "Командир 1 взвода",
    short: "КВ-1",
    hex: "#38bdf8",
    sortOrder: 1,
    description: null,
  },
  {
    key: "platoon_2_commander",
    label: "Командир 2 взвода",
    short: "КВ-2",
    hex: "#60a5fa",
    sortOrder: 2,
    description: null,
  },
  {
    key: "deputy_platoon_1",
    label: "Зам. ком. 1 взвода",
    short: "ЗКВ-1",
    hex: "#22d3ee",
    sortOrder: 3,
    description: null,
  },
  {
    key: "deputy_platoon_2",
    label: "Зам. ком. 2 взвода",
    short: "ЗКВ-2",
    hex: "#2dd4bf",
    sortOrder: 4,
    description: null,
  },
  {
    key: "sergeant_major",
    label: "Старшина роты",
    short: "СР",
    hex: "#fbbf24",
    sortOrder: 5,
    description: null,
  },
  {
    key: "squad_commander_2",
    label: "Командир 2 отделения",
    short: "КО-2",
    hex: "#fb923c",
    sortOrder: 6,
    description: null,
  },
] as const;

console.log("Seeding roles...");
for (const role of SEED_ROLES) {
  await db.insert(roles).values(role).onConflictDoNothing({ target: roles.key });
}

const allRoles = await db.select({ id: roles.id, key: roles.key }).from(roles);
const roleMap = new Map(allRoles.map((r) => [r.key, r.id]));
console.log(`Roles ready: ${allRoles.length}`);

// ─── USERS ────────────────────────────────────────────────────────────────────

const SEED_USERS = [
  {
    name: "Тарасенко Станислав Евгеньевич",
    login: "tarasenko",
    roleKey: "company_commander",
    initials: "ТС",
  },
  {
    name: "Халупа Алексей Иванович",
    login: "khalupa",
    roleKey: "platoon_1_commander",
    initials: "ХА",
  },
  {
    name: "Трепалин Павел Викторович",
    login: "trepalin",
    roleKey: "platoon_2_commander",
    initials: "ТП",
  },
  {
    name: "Антипов Егор Викторович",
    login: "antipov",
    roleKey: "deputy_platoon_1",
    initials: "АЕ",
  },
  {
    name: "Ермаков Владимир Александрович",
    login: "ermakov",
    roleKey: "deputy_platoon_2",
    initials: "ЕВ",
  },
  {
    name: "Долгополов Андрей Андреевич",
    login: "dolgopolov",
    roleKey: "sergeant_major",
    initials: "ДА",
  },
  {
    name: "Арсенов Алексей Владимирович",
    login: "arsenov",
    roleKey: "squad_commander_2",
    initials: "АА",
  },
] as const;

console.log("Seeding users...");
for (const u of SEED_USERS) {
  const roleId = roleMap.get(u.roleKey);
  if (!roleId) { console.warn(`Role not found: ${u.roleKey}`); continue; }
  await db
    .insert(users)
    .values({ name: u.name, login: u.login, roleId, initials: u.initials })
    .onConflictDoNothing({ target: users.login });
}

const allUsers = await db.select({ id: users.id, login: users.login }).from(users);
const userMap = new Map(allUsers.map((u) => [u.login, u.id]));
console.log(`Users ready: ${allUsers.length}`);

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Все 7 пользователей — для задач с ответственным ПС */
const ALL_LOGINS = ["tarasenko", "khalupa", "trepalin", "antipov", "ermakov", "dolgopolov", "arsenov"];

/** КВ = оба командира взводов */
const KV_LOGINS = ["khalupa", "trepalin"];

type TaskInput = {
  title: string;
  description?: string;
  status?: "todo" | "in_progress" | "done" | "blocked";
  priority?: "low" | "medium" | "high" | "critical";
  dueDate?: string | null;
  sortOrder: number;
  assigneeLogins: string[];
  subtaskTitles?: string[];
};

async function insertEpicWithTasks(
  epicData: {
    title: string;
    description?: string;
    color: string;
    startDate: string;
    endDate: string;
  },
  taskList: TaskInput[]
) {
  const [epic] = await db
    .insert(epics)
    .values(epicData)
    .onConflictDoNothing()
    .returning({ id: epics.id });

  if (!epic) {
    console.warn(`Epic already exists or insert failed: ${epicData.title}`);
    return;
  }

  for (const t of taskList) {
    const [task] = await db
      .insert(tasks)
      .values({
        epicId: epic.id,
        title: t.title,
        description: t.description ?? null,
        status: t.status ?? "todo",
        priority: t.priority ?? "medium",
        dueDate: t.dueDate ?? null,
        sortOrder: t.sortOrder,
      })
      .returning({ id: tasks.id });

    if (!task) continue;

    // Assignees
    for (const login of t.assigneeLogins) {
      const userId = userMap.get(login);
      if (!userId) continue;
      await db
        .insert(taskAssignees)
        .values({ taskId: task.id, userId })
        .onConflictDoNothing();
    }

    // Subtasks
    if (t.subtaskTitles?.length) {
      for (let i = 0; i < t.subtaskTitles.length; i++) {
        await db.insert(subtasks).values({
          taskId: task.id,
          title: t.subtaskTitles[i],
          isCompleted: false,
          sortOrder: i,
        });
      }
    }
  }

  console.log(`  ✓ Epic "${epicData.title}" — ${taskList.length} задач`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// МАРТ
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\nSeeding МАРТ...");
await insertEpicWithTasks(
  {
    title: "Март",
    description: "Агитация, проверки, передача нарядов, II этап конкурса ГУС",
    color: "#6366f1",
    startDate: "2025-03-01",
    endDate: "2025-03-31",
  },
  [
    // ── Агитация (25.02 – 25.03) ────────────────────────────────────────────
    {
      title: "Еженедельный доклад в ГУС о результатах агитации (по четвергам)",
      description: "Период: 25.02 – 25.03. Отправлять каждый четверг.",
      priority: "high",
      dueDate: "2025-03-25",
      sortOrder: 0,
      assigneeLogins: ["trepalin"],
    },
    {
      title: "Формирование базы анкет кандидатов",
      description:
        "Сбор сведений по результатам агитации. Обработка писем на почте. Обработка новых заявок. Опрос кандидатов с предыдущего призыва. Мониторинг Telegram.",
      priority: "high",
      dueDate: "2025-03-25",
      sortOrder: 1,
      assigneeLogins: ["trepalin"],
      subtaskTitles: [
        "Сбор сведений по результатам агитации",
        "Обработка писем на почте",
        "Обработка новых заявок",
        "Опрос кандидатов с предыдущего призыва",
        "Мониторинг Telegram",
      ],
    },
    {
      title: "Личное ознакомление с анкетами кандидатов, телефонное собеседование",
      description: "Проведение собеседования по телефону для формирования профессионального портрета. Срок: 20–25 марта.",
      priority: "high",
      dueDate: "2025-03-25",
      sortOrder: 2,
      assigneeLogins: ["trepalin"],
    },
    {
      title: "Формирование документов для ВНК и ДИМК",
      description: "Срок: 25 марта.",
      priority: "high",
      dueDate: "2025-03-25",
      sortOrder: 3,
      assigneeLogins: ["trepalin"],
      subtaskTitles: ["Рейтинговый список", "Протокол", "Оценочная ведомость"],
    },
    {
      title: "Согласование документов и отправка в ВНК и ДИМК",
      description: "Срок: 25–28 марта.",
      priority: "high",
      dueDate: "2025-03-28",
      sortOrder: 4,
      assigneeLogins: ["trepalin"],
    },
    // ── Квартальная проверка ЗГТ ─────────────────────────────────────────────
    {
      title: "Квартальная проверка в ЗГТ",
      priority: "critical",
      sortOrder: 5,
      assigneeLogins: ALL_LOGINS,
    },
    // ── Отправка плана увольнения ─────────────────────────────────────────────
    {
      title: "Отправка плана увольнения в запас в ОМУ ЛВО",
      description: "Срок: 1–10 марта.",
      priority: "high",
      dueDate: "2025-03-10",
      sortOrder: 6,
      assigneeLogins: ["khalupa"],
    },
    // ── II этап конкурса ГУС ──────────────────────────────────────────────────
    {
      title: "Проведение II этапа конкурса ГУС",
      description: "Срок: 1–15 марта.",
      priority: "high",
      dueDate: "2025-03-15",
      sortOrder: 7,
      assigneeLogins: ALL_LOGINS,
    },
    // ── Ежемесячные мероприятия ───────────────────────────────────────────────
    {
      title: "Сверка личных планов постоянного состава",
      priority: "medium",
      sortOrder: 8,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Мобилизационная неделя",
      description: "Расписаться в ГрОМР. Подготовить рапорт (сдать в ГрОМР в четверг).",
      priority: "medium",
      sortOrder: 9,
      assigneeLogins: ALL_LOGINS,
      subtaskTitles: ["Расписаться в ГрОМР", "Подготовить рапорт (сдать в ГрОМР в четверг)"],
    },
    {
      title: "Сверка служебных карточек",
      priority: "medium",
      sortOrder: 10,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Сверка листов бесед",
      priority: "medium",
      sortOrder: 11,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Уточнение плана публикаций на следующий месяц и проверка статей за текущий",
      priority: "medium",
      sortOrder: 12,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Подготовка ИРС",
      priority: "medium",
      sortOrder: 13,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Проверка индивидуальных планов",
      priority: "medium",
      sortOrder: 14,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Проверка боевой подготовки",
      priority: "medium",
      sortOrder: 15,
      assigneeLogins: ["antipov", "ermakov"],
    },
    {
      title: "Проверка стенной печати",
      priority: "medium",
      sortOrder: 16,
      assigneeLogins: ["tarasenko"],
    },
    {
      title: "Дисциплинарная практика за месяц",
      priority: "medium",
      sortOrder: 17,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Проведение подведения итогов роты за месяц",
      priority: "medium",
      sortOrder: 18,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Подготовка материала для публикации новостей на сайте ВАС",
      priority: "medium",
      sortOrder: 19,
      assigneeLogins: ["khalupa"],
    },
    // ── Передача нарядов ──────────────────────────────────────────────────────
    {
      title: "Передача ротных обязанностей и нарядов младшему призыву",
      description: "Срок: 28.02 (переходящее мероприятие).",
      priority: "high",
      dueDate: "2025-02-28",
      sortOrder: 20,
      assigneeLogins: ALL_LOGINS,
    },
  ]
);

// ═══════════════════════════════════════════════════════════════════════════════
// АПРЕЛЬ
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\nSeeding АПРЕЛЬ...");
await insertEpicWithTasks(
  {
    title: "Апрель",
    description: "Квартальная проверка ВНК ГУС (1 кв.), конкурс НЦУО, публикация рейтинга",
    color: "#10b981",
    startDate: "2025-04-01",
    endDate: "2025-04-30",
  },
  [
    // ── Квартальная проверка ВНК ГУС за 1 квартал ────────────────────────────
    {
      title: "Квартальная проверка ВНК ГУС за 1 квартал (7–9 апреля)",
      description: "Проверить реализацию рекомендаций за 4 квартал. Подготовить проект Акта. Подготовить справку-доклад по результатам проверки.",
      priority: "critical",
      dueDate: "2025-04-09",
      sortOrder: 0,
      assigneeLogins: ["tarasenko"],
      subtaskTitles: [
        "Проверить реализацию рекомендаций за 4 квартал",
        "Подготовить проект Акта",
        "Подготовить справку-доклад с указаниями и рекомендациями",
      ],
    },
    // ── Конкурс НЦУО ─────────────────────────────────────────────────────────
    {
      title: "Участие в конкурсе НЦУО",
      description: "В соответствии с указаниями.",
      priority: "high",
      sortOrder: 1,
      assigneeLogins: ["khalupa"],
    },
    // ── Публикация рейтинга ───────────────────────────────────────────────────
    {
      title: "Публикация рейтингового списка первого этапа отбора",
      priority: "high",
      dueDate: "2025-04-15",
      sortOrder: 2,
      assigneeLogins: ["trepalin"],
    },
    // ── Ежемесячные (20.04 / 18.04) ──────────────────────────────────────────
    {
      title: "Сверка личных планов постоянного состава",
      priority: "medium",
      dueDate: "2025-04-20",
      sortOrder: 3,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Сверка служебных карточек",
      priority: "medium",
      dueDate: "2025-04-20",
      sortOrder: 4,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Сверка листов бесед",
      priority: "medium",
      dueDate: "2025-04-20",
      sortOrder: 5,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Уточнение плана публикаций на следующий месяц и проверка статей за текущий",
      priority: "medium",
      dueDate: "2025-04-18",
      sortOrder: 6,
      assigneeLogins: ["khalupa"],
    },
    {
      title: "Подготовка ИРС",
      priority: "medium",
      dueDate: "2025-04-18",
      sortOrder: 7,
      assigneeLogins: ["khalupa"],
    },
    {
      title: "Проверка индивидуальных планов",
      priority: "medium",
      dueDate: "2025-04-18",
      sortOrder: 8,
      assigneeLogins: KV_LOGINS,
    },
    {
      title: "Проверка боевой подготовки",
      priority: "medium",
      dueDate: "2025-04-18",
      sortOrder: 9,
      assigneeLogins: ["antipov", "ermakov"],
    },
    {
      title: "Проверка стенной печати",
      priority: "medium",
      dueDate: "2025-04-18",
      sortOrder: 10,
      assigneeLogins: ["tarasenko"],
    },
    {
      title: "Дисциплинарная практика за месяц",
      priority: "medium",
      sortOrder: 11,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Проведение подведения итогов роты за месяц",
      priority: "medium",
      dueDate: "2025-04-18",
      sortOrder: 12,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Подготовка материала для публикации новостей на сайте ВАС",
      priority: "medium",
      dueDate: "2025-04-18",
      sortOrder: 13,
      assigneeLogins: ["khalupa"],
    },
    {
      title: "Подведение итогов конкурса ГУС",
      priority: "high",
      dueDate: "2025-04-18",
      sortOrder: 14,
      assigneeLogins: ALL_LOGINS,
    },
  ]
);

// ═══════════════════════════════════════════════════════════════════════════════
// МАЙ
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\nSeeding МАЙ...");
await insertEpicWithTasks(
  {
    title: "Май",
    description: "Майские праздники, подготовка к МВТФ «Армия», плановые мероприятия",
    color: "#f59e0b",
    startDate: "2025-05-01",
    endDate: "2025-05-31",
  },
  [
    // ── Майские праздники ─────────────────────────────────────────────────────
    {
      title: "Планирование и организация майских праздников",
      description: "Срок: 1–5 мая.",
      priority: "high",
      dueDate: "2025-05-05",
      sortOrder: 0,
      assigneeLogins: ["khalupa"],
      subtaskTitles: [
        "Определить ответственность",
        "Спланировать увольнения",
        "Организовать шашлыки (по призывно)",
      ],
    },
    // ── МВТФ «Армия» ─────────────────────────────────────────────────────────
    {
      title: "Указания по МВТФ «Армия» — подготовка частного плана мероприятий",
      description: "Срок: 1–15 мая.",
      priority: "high",
      dueDate: "2025-05-15",
      sortOrder: 1,
      assigneeLogins: ["khalupa", "antipov"],
    },
    // ── Ежемесячные ───────────────────────────────────────────────────────────
    {
      title: "Сверка личных планов постоянного состава",
      priority: "medium",
      sortOrder: 2,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Сверка служебных карточек",
      priority: "medium",
      sortOrder: 3,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Сверка листов бесед",
      priority: "medium",
      sortOrder: 4,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Уточнение плана публикаций на следующий месяц и проверка статей за текущий",
      priority: "medium",
      sortOrder: 5,
      assigneeLogins: ["khalupa"],
    },
    {
      title: "Подготовка ИРС",
      priority: "medium",
      sortOrder: 6,
      assigneeLogins: ["khalupa"],
    },
    {
      title: "Проверка индивидуальных планов",
      priority: "medium",
      sortOrder: 7,
      assigneeLogins: KV_LOGINS,
    },
    {
      title: "Проверка боевой подготовки",
      priority: "medium",
      sortOrder: 8,
      assigneeLogins: ["antipov", "ermakov"],
    },
    {
      title: "Проверка стенной печати",
      priority: "medium",
      sortOrder: 9,
      assigneeLogins: ["tarasenko"],
    },
    {
      title: "Дисциплинарная практика за месяц",
      priority: "medium",
      sortOrder: 10,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Проведение подведения итогов роты за месяц",
      priority: "medium",
      sortOrder: 11,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Подготовка материала для публикации новостей на сайте ВАС",
      priority: "medium",
      dueDate: "2025-05-25",
      sortOrder: 12,
      assigneeLogins: ["khalupa"],
    },
  ]
);

// ═══════════════════════════════════════════════════════════════════════════════
// ИЮНЬ
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\nSeeding ИЮНЬ...");
await insertEpicWithTasks(
  {
    title: "Июнь",
    description: "Квартальные проверки, план ноябрь, МВТФ «Армия», сдача МНИ",
    color: "#ec4899",
    startDate: "2025-06-01",
    endDate: "2025-06-30",
  },
  [
    // ── Квартальные проверки ──────────────────────────────────────────────────
    {
      title: "Квартальная проверка в ЗГТ",
      priority: "critical",
      sortOrder: 0,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Квартальная проверка в моб. группе",
      priority: "critical",
      sortOrder: 1,
      assigneeLogins: ALL_LOGINS,
    },
    // ── Мероприятия по плану ──────────────────────────────────────────────────
    {
      title: "Мероприятия по плану на ноябрь",
      priority: "medium",
      sortOrder: 2,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Мероприятия по частному плану подготовки к МВТФ «Армия»",
      priority: "high",
      sortOrder: 3,
      assigneeLogins: ALL_LOGINS,
    },
    // ── Ежемесячные ───────────────────────────────────────────────────────────
    {
      title: "Сверка личных планов постоянного состава",
      priority: "medium",
      sortOrder: 4,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Мобилизационная неделя",
      description: "Расписаться в ГрОМР. Подготовить рапорт (сдать в ГрОМР в четверг).",
      priority: "medium",
      sortOrder: 5,
      assigneeLogins: ALL_LOGINS,
      subtaskTitles: ["Расписаться в ГрОМР", "Подготовить рапорт (сдать в ГрОМР в четверг)"],
    },
    {
      title: "Сверка служебных карточек",
      priority: "medium",
      sortOrder: 6,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Сверка листов бесед",
      priority: "medium",
      sortOrder: 7,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Уточнение плана публикаций на следующий месяц и проверка статей за текущий",
      priority: "medium",
      sortOrder: 8,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Подготовка ИРС",
      priority: "medium",
      sortOrder: 9,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Проверка индивидуальных планов",
      priority: "medium",
      sortOrder: 10,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Проверка боевой подготовки",
      priority: "medium",
      sortOrder: 11,
      assigneeLogins: ["antipov", "ermakov"],
    },
    {
      title: "Проверка стенной печати",
      priority: "medium",
      sortOrder: 12,
      assigneeLogins: ["tarasenko"],
    },
    {
      title: "Дисциплинарная практика за месяц",
      priority: "medium",
      sortOrder: 13,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Проведение подведения итогов роты за месяц",
      priority: "medium",
      sortOrder: 14,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Подготовка материала для публикации новостей на сайте ВАС",
      priority: "medium",
      sortOrder: 15,
      assigneeLogins: ALL_LOGINS,
    },
    // ── Сдача МНИ ─────────────────────────────────────────────────────────────
    {
      title: "Сдача по учёту в журнале МНИ с составлением актов (16 единиц)",
      description: "Срок: 25–30 июня. Позиции: ПЭВМ (в комплекте: сумка, мышь, ЗУ); USB; электронные пропуска.",
      priority: "high",
      dueDate: "2025-06-30",
      sortOrder: 16,
      assigneeLogins: ALL_LOGINS,
      subtaskTitles: [
        "ПЭВМ (в комплекте: сумка, мышь, ЗУ)",
        "USB-накопители",
        "Электронные пропуска",
        "Составление актов (16 ед.)",
      ],
    },
  ]
);

// ═══════════════════════════════════════════════════════════════════════════════
// ИЮЛЬ
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\nSeeding ИЮЛЬ...");
await insertEpicWithTasks(
  {
    title: "Июль",
    description: "Квартальная проверка ВНК ГУС (2 кв.), приём молодого пополнения, агитация, стрельбы, ОВП",
    color: "#ef4444",
    startDate: "2025-07-01",
    endDate: "2025-07-31",
  },
  [
    // ── Квартальная проверка ВНК ГУС за 2 квартал ────────────────────────────
    {
      title: "Квартальная проверка ВНК ГУС за 2 квартал (7–9 июля)",
      description: "Проверить реализацию рекомендаций за 1 квартал. Подготовить проект Акта. Подготовить справку-доклад.",
      priority: "critical",
      dueDate: "2025-07-09",
      sortOrder: 0,
      assigneeLogins: ["tarasenko"],
      subtaskTitles: [
        "Проверить реализацию рекомендаций за 1 квартал",
        "Подготовить проект Акта",
        "Подготовить справку-доклад с указаниями и рекомендациями",
      ],
    },
    // ── МВТФ «Армия» ─────────────────────────────────────────────────────────
    {
      title: "Мероприятия по частному плану подготовки к МВТФ «Армия»",
      priority: "high",
      sortOrder: 1,
      assigneeLogins: ["tarasenko"],
    },
    // ── Снятие с довольствия увольняемых ─────────────────────────────────────
    {
      title: "Снять с довольствия увольняемых в запас",
      description: "Срок: 1–10 июля.",
      priority: "high",
      dueDate: "2025-07-10",
      sortOrder: 2,
      assigneeLogins: ["khalupa"],
      subtaskTitles: [
        "Сдать рапорта и выписки в СО",
        "Сдать 3 выписки об исключении (в ФЭС, прод. службу и в дело)",
      ],
    },
    // ── Сдача МНИ (июль) ─────────────────────────────────────────────────────
    {
      title: "Сдача по учёту в журнале МНИ с составлением актов (16 единиц)",
      description: "ПЭВМ (в комплекте: сумка, мышь, ЗУ); USB; электронные пропуска.",
      priority: "high",
      sortOrder: 3,
      assigneeLogins: ALL_LOGINS,
      subtaskTitles: [
        "ПЭВМ (в комплекте: сумка, мышь, ЗУ)",
        "USB-накопители",
        "Электронные пропуска",
        "Составление актов (16 ед.)",
      ],
    },
    // ── Приём молодого пополнения ─────────────────────────────────────────────
    {
      title: "Приём молодого пополнения",
      description: "Полный цикл мероприятий по приёму нового призыва.",
      priority: "critical",
      sortOrder: 4,
      assigneeLogins: ALL_LOGINS,
      subtaskTitles: [
        "Рапорт на автомобильный транспорт",
        "Фотографирование воинской команды",
        "Медицинский осмотр",
        "Копии паспорта и военного билета",
        "Подготовить военные билеты и паспорта (бирки, жетоны)",
        "Собрать ВУ, загран. паспорта, дипломы (копии), ПЭК, УПК, карты МО/ПО, маршрутные листы, билеты",
        "Занести ПЭК в журнал учёта",
        "Подготовить рапорт на сдачу документов",
        "Проверить вещевое имущество (раздаточная ведомость, вещевой аттестат, акт приёма)",
        "Проверить наличие банковских карт у прибывших",
        "Заполнить заявления для Алушты и сдать в отдел кадров",
        "Сдать рапорт (бум. и эл.) в строевой отдел на все виды довольствия",
        "Сдать 2 рапорта на котловое довольствие в продовольственную службу",
        "Подготовить 4 выписки о включении в ВАС",
        "Определить место хранения личных вещей и спальные места",
        "Выдать постельное бельё",
        "Провести инструктаж",
        "Организовать питание и помывку",
        "Провести первичную беседу",
        "Установить связь с родителями (создать родительский чат)",
        "Составить рапорт о назначении на должность",
        "Получить в лазарете профилактические лекарства",
      ],
    },
    // ── Отправить доклад в ГУС и ГОМУ о результатах набора ───────────────────
    {
      title: "Подготовить доклад в ГУС и ГОМУ о результатах набора МП",
      priority: "high",
      sortOrder: 5,
      assigneeLogins: ["tarasenko"],
      subtaskTitles: [
        "Телеграмма в ГОМУ",
        "Данные в ГОМУ",
        "Данные для ВНК ГУС",
        "Письмо-доклад для НГУС",
      ],
    },
    // ── УЛС ──────────────────────────────────────────────────────────────────
    {
      title: "Внести данные по увольнению и призыву в документацию УЛС",
      priority: "high",
      sortOrder: 6,
      assigneeLogins: ALL_LOGINS,
      subtaskTitles: [
        "Книга алфавитного учёта",
        "Книга УЛС (Форма № 1)",
        "Именные списки взводов (Форма №1-а)",
        "Книга ШДУ (Форма № 4)",
        "ШДК",
        "ШДС",
      ],
    },
    {
      title: "Донесение 47 ОМУ о составе численности л/с",
      priority: "high",
      sortOrder: 7,
      assigneeLogins: ALL_LOGINS,
    },
    // ── 2 этап ПМП ───────────────────────────────────────────────────────────
    {
      title: "Организация 2 этапа ПМП (первично-медицинская подготовка)",
      priority: "high",
      sortOrder: 8,
      assigneeLogins: ALL_LOGINS,
      subtaskTitles: [
        "Провести барьерный медицинский осмотр",
        "Провести проф-псих тестирование",
        "Провести КПЗ по БВС (вводный, первичный, 12 тем ТБ, фотоотчёт) — взаимодействие с 4 кафедрой",
        "Спланировать изоляцию",
        "Подготовить расписание",
        "Подготовить материалы занятий",
        "Подготовить доклады и презентации по науке (старших)",
        "Провести профессиональные собеседования (16 чел.)",
        "Предварительное распределение научных руководителей и направлений",
        "Разработка Боевого листа на призыв",
        "Подготовить ведомость допуска в бассейн",
        "Фотографирование личного состава",
        "Подготовка анкет на оформление 3 формы допуска",
        "Подготовка подписок о неразглашении",
        "Подать рапорт о назначении на должности",
        "Подать данные приказов об назначении в ДП ЗГТ",
        "Заполнить электронную книгу алфавитного учёта",
        "Оформить служебные карточки",
        "Согласовать выдачу банковских карт",
      ],
    },
    // ── Агитация (июль) ───────────────────────────────────────────────────────
    {
      title: "Рассылка в ВУЗы (89 субъектов)",
      description: "Срок: 1–31 июля.",
      priority: "high",
      dueDate: "2025-07-31",
      sortOrder: 9,
      assigneeLogins: ["tarasenko"],
    },
    {
      title: "Подготовить приказ на агитацию НР",
      description: "Срок: 1–15 июля.",
      priority: "high",
      dueDate: "2025-07-15",
      sortOrder: 10,
      assigneeLogins: ["tarasenko"],
    },
    {
      title: "Подготовить план мероприятий по агитации, заверенный у НВАС",
      description: "Срок: 1–15 июля.",
      priority: "high",
      dueDate: "2025-07-15",
      sortOrder: 11,
      assigneeLogins: ["tarasenko"],
    },
    {
      title: "Подготовить и направить в ДиД предложения в состав комиссии в ТП ЭРА",
      description: "Срок: 1–15 июля.",
      priority: "high",
      dueDate: "2025-07-15",
      sortOrder: 12,
      assigneeLogins: ["tarasenko"],
    },
    {
      title: "Отправить заявку на выдачу удостоверений в ГУС (pdf, doc)",
      description: "Срок: 1–15 июля.",
      priority: "high",
      dueDate: "2025-07-15",
      sortOrder: 13,
      assigneeLogins: ["tarasenko"],
    },
    {
      title: "Отправить план отбора в ГУС (pdf, doc)",
      description: "Срок: 1–15 июля.",
      priority: "high",
      dueDate: "2025-07-15",
      sortOrder: 14,
      assigneeLogins: ["tarasenko"],
    },
    // ── Приказ на присягу прикомандированных ─────────────────────────────────
    {
      title: "Приказ на присягу прикомандированных",
      description: "Срок: 1–15 июля.",
      priority: "high",
      dueDate: "2025-07-15",
      sortOrder: 15,
      assigneeLogins: ["antipov"],
    },
    // ── Мобилизационная тренировка (14–20 июля) ──────────────────────────────
    {
      title: "Мобилизационная тренировка (14–20 июля)",
      priority: "high",
      dueDate: "2025-07-20",
      sortOrder: 16,
      assigneeLogins: ALL_LOGINS,
      subtaskTitles: [
        "Составить частный план мероприятий",
        "Рапорт на уточнение списков оповещения",
        "Уточнение документации ПУ",
        "Смена суточного наряда",
      ],
    },
    // ── ПДП ──────────────────────────────────────────────────────────────────
    {
      title: "Подготовка индивидуальных заданий и личных планов по ПДП на 2 семестр",
      description: "Срок: 1–31 июля.",
      priority: "medium",
      sortOrder: 17,
      assigneeLogins: ["khalupa", "antipov"],
    },
    // ── Научные собеседования ─────────────────────────────────────────────────
    {
      title: "Проведение собеседований с ННИЦ для распределения молодого пополнения",
      priority: "high",
      sortOrder: 18,
      assigneeLogins: ["tarasenko"],
    },
    {
      title: "Проведение собеседований с сотрудниками НИЦ для закрепления молодого пополнения",
      priority: "high",
      sortOrder: 19,
      assigneeLogins: ["tarasenko"],
    },
    // ── Подготовка к ОВП ─────────────────────────────────────────────────────
    {
      title: "Приказ о проведении общевойсковой подготовки",
      priority: "high",
      sortOrder: 20,
      assigneeLogins: ["khalupa", "antipov"],
    },
    {
      title: "Подготовка к проведению ОВП на 6 в/г (20 июля)",
      description: "Расписание, оружие, размещение, экипировка.",
      priority: "high",
      dueDate: "2025-07-20",
      sortOrder: 21,
      assigneeLogins: ["khalupa", "antipov"],
      subtaskTitles: [
        "Подготовить расписание",
        "Оружие",
        "Размещение",
        "Экипировка",
      ],
    },
    // ── Ежемесячные ───────────────────────────────────────────────────────────
    {
      title: "Сверка личных планов постоянного состава",
      priority: "medium",
      sortOrder: 22,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Мобилизационная неделя",
      description: "Расписаться в ГрОМР. Подготовить рапорт (сдать в ГрОМР в четверг).",
      priority: "medium",
      sortOrder: 23,
      assigneeLogins: ALL_LOGINS,
      subtaskTitles: ["Расписаться в ГрОМР", "Подготовить рапорт (сдать в ГрОМР в четверг)"],
    },
    {
      title: "Сверка служебных карточек",
      priority: "medium",
      sortOrder: 24,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Сверка листов бесед",
      priority: "medium",
      sortOrder: 25,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Уточнение плана публикаций на следующий месяц и проверка статей за текущий",
      priority: "medium",
      sortOrder: 26,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Подготовка ИРС",
      priority: "medium",
      sortOrder: 27,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Проверка индивидуальных планов",
      priority: "medium",
      sortOrder: 28,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Проверка боевой подготовки",
      priority: "medium",
      sortOrder: 29,
      assigneeLogins: ["antipov", "ermakov"],
    },
    {
      title: "Проверка стенной печати",
      priority: "medium",
      sortOrder: 30,
      assigneeLogins: ["tarasenko"],
    },
    {
      title: "Дисциплинарная практика за месяц",
      priority: "medium",
      sortOrder: 31,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Проведение подведения итогов роты за месяц",
      priority: "medium",
      sortOrder: 32,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Подготовка материала для публикации новостей на сайте ВАС",
      priority: "medium",
      sortOrder: 33,
      assigneeLogins: ALL_LOGINS,
    },
    {
      title: "Ежемесячное доведение приказа № 85дсп",
      priority: "medium",
      sortOrder: 34,
      assigneeLogins: ["ermakov"],
    },
    {
      title: "Еженедельный рапорт в ЗГТ",
      priority: "medium",
      sortOrder: 35,
      assigneeLogins: ["ermakov"],
    },
    {
      title: "Еженедельная проверка САВЗ (с записью в журнал)",
      priority: "medium",
      sortOrder: 36,
      assigneeLogins: ["ermakov"],
    },
    {
      title: "Еженедельный рапорт о ГДП",
      priority: "medium",
      sortOrder: 37,
      assigneeLogins: ["ermakov"],
    },
  ]
);

// ─── FINAL STATS ──────────────────────────────────────────────────────────────

const epicCount = await db.select({ count: sql<number>`COUNT(*)` }).from(epics);
const taskCount = await db.select({ count: sql<number>`COUNT(*)` }).from(tasks);
const subtaskCount = await db.select({ count: sql<number>`COUNT(*)` }).from(subtasks);
const assigneeCount = await db.select({ count: sql<number>`COUNT(*)` }).from(taskAssignees);

console.log(`
════════════════════════════════
  Seed complete!
  Эпики:       ${epicCount[0].count}
  Задачи:      ${taskCount[0].count}
  Подзадачи:   ${subtaskCount[0].count}
  Назначения:  ${assigneeCount[0].count}
════════════════════════════════
`);

sqlite.close();