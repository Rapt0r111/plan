/**
 * @file seed.ts - shared/db
 *
 * Intelligent seed: raw annual plan data analysed into 5 Epics, ~25 tasks,
 * distributed across all 8 roles with realistic M:N assignments.
 *
 * Run: bun run src/shared/db/seed.ts
 *
 * Role mapping from source document codes:
 *  КНР   -> company_commander
 *  КВ-1  -> platoon_1_commander
 *  КВ-2  -> platoon_2_commander
 *  ЗКВ   -> deputy_commander
 *  ПС    -> sergeant_major
 *  ЗиТ   -> security_officer
 *  Н     -> research_officer
 *  (ДО)  -> duty_officer
 */

import { Database } from "bun:sqlite";          // ← было: import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/bun-sqlite"; // ← было: drizzle-orm/better-sqlite3
import { users, epics, tasks, subtasks, taskAssignees } from "./schema";
import path from "path";

const sqlite = new Database(path.resolve(process.cwd(), "local.db"), { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");  // ← было: sqlite.pragma(...)
sqlite.exec("PRAGMA foreign_keys = ON;");
const db = drizzle(sqlite, { schema: { users, epics, tasks, subtasks, taskAssignees } });

// ── USERS ──────────────────────────────────────────────────────────────────
const USER_SEEDS = [
  { name: "Алексей Смирнов",  login: "a.smirnov",  role: "company_commander" as const,   initials: "АС" },
  { name: "Дмитрий Козлов",   login: "d.kozlov",   role: "deputy_commander" as const,    initials: "ДК" },
  { name: "Игорь Петров",     login: "i.petrov",   role: "platoon_1_commander" as const, initials: "ИП" },
  { name: "Никита Волков",    login: "n.volkov",   role: "platoon_2_commander" as const, initials: "НВ" },
  { name: "Сергей Морозов",   login: "s.morozov",  role: "sergeant_major" as const,      initials: "СМ" },
  { name: "Андрей Захаров",   login: "a.zakharov", role: "security_officer" as const,    initials: "АЗ" },
  { name: "Евгений Новиков",  login: "e.novikov",  role: "research_officer" as const,    initials: "ЕН" },
  { name: "Михаил Орлов",     login: "m.orlov",    role: "duty_officer" as const,        initials: "МО" },
];

// ── EPICS ──────────────────────────────────────────────────────────────────
const EPIC_SEEDS = [
  { title: "Итоговая проверка",            description: "Подготовка и проведение годовой итоговой проверки: документы, репетиции, встреча комиссии.", color: "#6366f1", startDate: "2026-01-10", endDate: "2026-02-15" },
  { title: "Квартальные проверки",         description: "Плановые квартальные проверки ВНК ГУС Q1-Q4, реализация рекомендаций, акты.", color: "#f59e0b", startDate: "2026-01-07", endDate: "2026-10-31" },
  { title: "Приём молодого пополнения",    description: "Полный цикл приёма призыва: документы, размещение, медосмотр, ПМП, присяга.", color: "#10b981", startDate: "2026-07-01", endDate: "2026-08-31" },
  { title: "Агитация и отбор кандидатов", description: "Командировки в ВУЗы, сбор анкет, рейтинговые списки, работа с ГОМУ и ДИМК.", color: "#ec4899", startDate: "2026-02-25", endDate: "2026-09-28" },
  { title: "Наука и МВТФ Армия",          description: "Подготовка к форуму, стрельбы, конкурсы ГУС, публикации, общевойсковая подготовка.", color: "#8b5cf6", startDate: "2026-05-01", endDate: "2026-08-15" },
];

type RoleSlug = "company_commander"|"deputy_commander"|"platoon_1_commander"|"platoon_2_commander"|"sergeant_major"|"security_officer"|"research_officer"|"duty_officer";
interface Subtask { title: string; isCompleted: boolean; }
interface TaskSeed { epicIndex: number; title: string; description?: string; status: "todo"|"in_progress"|"done"|"blocked"; priority: "low"|"medium"|"high"|"critical"; dueDate?: string; sortOrder: number; assigneeRoles: RoleSlug[]; subtasks?: Subtask[]; }

const TASK_SEEDS: TaskSeed[] = [
  // Epic 0: Итоговая проверка
  { epicIndex: 0, title: "Подготовка презентации для итогового доклада", description: "Слайды о деятельности роты, достижениях операторов, статистика по призывам.", status: "in_progress", priority: "critical", dueDate: "2026-02-01", sortOrder: 0, assigneeRoles: ["platoon_2_commander"],
    subtasks: [ { title: "Собрать статистику по 4 призывам", isCompleted: true }, { title: "Подготовить слайды об офицерах ВАС", isCompleted: true }, { title: "Сведения о трудоустройстве операторов", isCompleted: false }, { title: "Согласовать с командиром роты", isCompleted: false } ] },
  { epicIndex: 0, title: "Подготовка проекта Акта итоговой проверки", status: "todo", priority: "high", dueDate: "2026-02-10", sortOrder: 1, assigneeRoles: ["platoon_2_commander", "deputy_commander"],
    subtasks: [ { title: "Ознакомиться с перечнем вопросов проверки", isCompleted: false }, { title: "Подготовить план реализации рекомендаций", isCompleted: false }, { title: "Оформить справку-доклад", isCompleted: false } ] },
  { epicIndex: 0, title: "Подготовка демонстрации проектов роты", description: "Проект, презентация, доклад, плакат. Запросить инновационные экспонаты у НИЦ.", status: "todo", priority: "high", dueDate: "2026-02-03", sortOrder: 2, assigneeRoles: ["research_officer", "platoon_1_commander"],
    subtasks: [ { title: "Запросить экспонаты у организаций", isCompleted: false }, { title: "Предварительное заслушивание докладов", isCompleted: false }, { title: "Подготовить плакаты для точек развёртывания", isCompleted: false } ] },
  { epicIndex: 0, title: "Проверка внутреннего порядка перед комиссией", status: "todo", priority: "medium", dueDate: "2026-02-02", sortOrder: 3, assigneeRoles: ["sergeant_major"],
    subtasks: [ { title: "Инвентаризация документов в канцелярии", isCompleted: false }, { title: "Документы по учёту личного состава", isCompleted: false }, { title: "Личные документы операторов (ВБ, дипломы)", isCompleted: false } ] },
  { epicIndex: 0, title: "Подготовка культурной программы для комиссии", status: "todo", priority: "low", dueDate: "2026-02-03", sortOrder: 4, assigneeRoles: ["deputy_commander", "platoon_2_commander"] },

  // Epic 1: Квартальные проверки
  { epicIndex: 1, title: "Q1: Проверка ВНК ГУС — январь", status: "done", priority: "high", dueDate: "2026-01-20", sortOrder: 0, assigneeRoles: ["platoon_2_commander"],
    subtasks: [ { title: "Проверить реализацию рекомендаций Q3", isCompleted: true }, { title: "Подготовить проект Акта", isCompleted: true }, { title: "Подготовить справку-доклад", isCompleted: true } ] },
  { epicIndex: 1, title: "Q2: Проверка ВНК ГУС — апрель", status: "todo", priority: "high", dueDate: "2026-04-09", sortOrder: 1, assigneeRoles: ["company_commander"],
    subtasks: [ { title: "Проверить реализацию рекомендаций Q4", isCompleted: false }, { title: "Подготовить проект Акта", isCompleted: false } ] },
  { epicIndex: 1, title: "Q3: Проверка ВНК ГУС — июль", status: "todo", priority: "medium", dueDate: "2026-07-09", sortOrder: 2, assigneeRoles: ["platoon_2_commander", "platoon_1_commander"] },
  { epicIndex: 1, title: "Квартальная проверка службы ЗГТ", status: "todo", priority: "medium", dueDate: "2026-03-31", sortOrder: 3, assigneeRoles: ["security_officer"],
    subtasks: [ { title: "Проверить учёт техники (форма 8, ЖМНИ)", isCompleted: false }, { title: "Проверить хранение ПЭВМ и USB", isCompleted: false } ] },
  { epicIndex: 1, title: "Мобилизационная тренировка (январь)", status: "in_progress", priority: "high", dueDate: "2026-01-20", sortOrder: 4, assigneeRoles: ["company_commander", "sergeant_major"],
    subtasks: [ { title: "Расписаться в ГрОМР", isCompleted: true }, { title: "Подготовить рапорт и сдать в ГрОМР", isCompleted: false } ] },

  // Epic 2: Приём молодого пополнения
  { epicIndex: 2, title: "Документальный приём молодого пополнения", description: "Фотографирование, медосмотр, сбор ВБ и паспортов, постановка на довольствие.", status: "todo", priority: "critical", dueDate: "2026-07-15", sortOrder: 0, assigneeRoles: ["platoon_1_commander", "sergeant_major"],
    subtasks: [ { title: "Рапорт на автотранспорт", isCompleted: false }, { title: "Фотографирование воинской команды", isCompleted: false }, { title: "Медицинский осмотр", isCompleted: false }, { title: "Копии паспортов и ВБ", isCompleted: false }, { title: "Занести ПЭК в журнал учёта", isCompleted: false }, { title: "Сдать рапорта в прод. службу до 12:00", isCompleted: false } ] },
  { epicIndex: 2, title: "Размещение и бытовое обеспечение пополнения", status: "todo", priority: "high", dueDate: "2026-07-10", sortOrder: 1, assigneeRoles: ["sergeant_major"],
    subtasks: [ { title: "Определить спальные места", isCompleted: false }, { title: "Выдать постельное бельё", isCompleted: false }, { title: "Организовать питание и помывку", isCompleted: false }, { title: "Создать родительский чат", isCompleted: false } ] },
  { epicIndex: 2, title: "ПМП: второй этап профессиональных мероприятий", status: "todo", priority: "high", dueDate: "2026-07-31", sortOrder: 2, assigneeRoles: ["platoon_1_commander", "research_officer"],
    subtasks: [ { title: "Барьерный медицинский осмотр", isCompleted: false }, { title: "Проф-псих тестирование", isCompleted: false }, { title: "КПЗ по БВС (12 тем)", isCompleted: false }, { title: "Проф. собеседования (16 чел.)", isCompleted: false }, { title: "Предварительное распределение научных руководителей", isCompleted: false } ] },
  { epicIndex: 2, title: "Организация и проведение Присяги", description: "Приказ, сценарий, списки, тренировка, генеральная репетиция.", status: "todo", priority: "critical", dueDate: "2026-08-30", sortOrder: 3, assigneeRoles: ["deputy_commander", "platoon_1_commander"],
    subtasks: [ { title: "Выписка из приказа о Присяге", isCompleted: false }, { title: "Рапорт на получение оружия для тренировок", isCompleted: false }, { title: "Составить сценарий церемонии", isCompleted: false }, { title: "Тренировка и генеральная репетиция", isCompleted: false } ] },
  { epicIndex: 2, title: "Активация пропусков и выдача имущества МНИ", status: "todo", priority: "medium", dueDate: "2026-07-31", sortOrder: 4, assigneeRoles: ["security_officer"],
    subtasks: [ { title: "Активация пропусков в ЦОИ", isCompleted: false }, { title: "Выдача ПЭВМ (24 комплекта)", isCompleted: false }, { title: "Выдача USB и электронных пропусков", isCompleted: false } ] },
  { epicIndex: 2, title: "Доклад в ГУС и ГОМУ о результатах набора МП", status: "todo", priority: "high", dueDate: "2026-07-20", sortOrder: 5, assigneeRoles: ["company_commander", "platoon_2_commander"],
    subtasks: [ { title: "Телеграмма в ГОМУ", isCompleted: false }, { title: "Данные для ВНК ГУС", isCompleted: false }, { title: "Письмо-доклад для НГУС", isCompleted: false } ] },

  // Epic 3: Агитация
  { epicIndex: 3, title: "Подготовка командировочных документов на агитацию", description: "Удостоверения, письма в ВУЗы, памятки x200.", status: "in_progress", priority: "high", dueDate: "2026-02-20", sortOrder: 0, assigneeRoles: ["platoon_2_commander"],
    subtasks: [ { title: "Оформить командировочные удостоверения", isCompleted: true }, { title: "Подготовить удостоверения ГОМУ", isCompleted: false }, { title: "Напечатать памятки и агитматериалы x200", isCompleted: false }, { title: "Листы собеседования", isCompleted: false } ] },
  { epicIndex: 3, title: "Инструктаж убывающих в командировку", status: "todo", priority: "high", dueDate: "2026-02-20", sortOrder: 1, assigneeRoles: ["company_commander", "platoon_2_commander"],
    subtasks: [ { title: "Выдать комплект документов (бум. и эл.)", isCompleted: false }, { title: "Выдать брошюры и плакаты НР ВАС", isCompleted: false } ] },
  { epicIndex: 3, title: "Формирование базы анкет кандидатов", description: "Обработка писем, заявок, мониторинг Telegram.", status: "in_progress", priority: "medium", dueDate: "2026-03-25", sortOrder: 2, assigneeRoles: ["platoon_2_commander"],
    subtasks: [ { title: "Занести новые заявки в систему", isCompleted: false }, { title: "Обработать письма на почте", isCompleted: false }, { title: "Мониторинг Telegram-канала", isCompleted: false } ] },
  { epicIndex: 3, title: "Формирование рейтинговых документов для ВНК и ДИМК", status: "todo", priority: "critical", dueDate: "2026-03-28", sortOrder: 3, assigneeRoles: ["platoon_2_commander", "deputy_commander"],
    subtasks: [ { title: "Рейтинговый список кандидатов", isCompleted: false }, { title: "Оформить протокол", isCompleted: false }, { title: "Оценочная ведомость", isCompleted: false }, { title: "Отправить в ВНК и ДИМК", isCompleted: false } ] },
  { epicIndex: 3, title: "Рассылка писем в ВУЗы (89 субъектов)", status: "todo", priority: "medium", dueDate: "2026-07-31", sortOrder: 4, assigneeRoles: ["platoon_1_commander"] },
  { epicIndex: 3, title: "Публикация результатов этапов отбора", status: "todo", priority: "medium", dueDate: "2026-04-15", sortOrder: 5, assigneeRoles: ["platoon_2_commander"] },

  // Epic 4: Наука и МВТФ Армия
  { epicIndex: 4, title: "Подготовка частного плана для МВТФ Армия", status: "in_progress", priority: "high", dueDate: "2026-05-15", sortOrder: 0, assigneeRoles: ["platoon_1_commander", "deputy_commander"],
    subtasks: [ { title: "Получить указания по форуму", isCompleted: true }, { title: "Составить частный план мероприятий", isCompleted: false }, { title: "Командировочные документы", isCompleted: false } ] },
  { epicIndex: 4, title: "Организация и проведение стрельб", description: "7 выписок из приказов, изучение матчасти, зачёт на допуск.", status: "todo", priority: "high", dueDate: "2026-08-20", sortOrder: 1, assigneeRoles: ["platoon_2_commander", "deputy_commander"],
    subtasks: [ { title: "7 выписок из приказа (123, 6, 5 каф., НР-2)", isCompleted: false }, { title: "Изучение матчасти и ТБ", isCompleted: false }, { title: "Практическая тренировка нормативов", isCompleted: false }, { title: "Зачёт на допуск к стрельбам", isCompleted: false } ] },
  { epicIndex: 4, title: "Занятие по требованиям РД и оформлению научных статей", status: "todo", priority: "medium", dueDate: "2026-01-20", sortOrder: 2, assigneeRoles: ["research_officer", "platoon_2_commander"],
    subtasks: [ { title: "Требования руководящих документов", isCompleted: false }, { title: "Оформление отчётов и научных статей", isCompleted: false }, { title: "Свидетельства о регистрации", isCompleted: false } ] },
  { epicIndex: 4, title: "Конкурс ГУС: два этапа", status: "todo", priority: "medium", dueDate: "2026-04-18", sortOrder: 3, assigneeRoles: ["platoon_1_commander", "research_officer"],
    subtasks: [ { title: "Приказ на конкурс ГУС", isCompleted: false }, { title: "1 этап (15-28 февраля)", isCompleted: false }, { title: "2 этап (1-15 марта)", isCompleted: false }, { title: "Подведение итогов", isCompleted: false } ] },
  { epicIndex: 4, title: "Ежемесячная публикация новостей на сайте ВАС", status: "in_progress", priority: "low", dueDate: "2026-01-25", sortOrder: 4, assigneeRoles: ["platoon_2_commander", "deputy_commander"] },
  { epicIndex: 4, title: "Подготовка перечня направлений научной деятельности", status: "todo", priority: "low", dueDate: "2026-08-25", sortOrder: 5, assigneeRoles: ["research_officer"],
    subtasks: [ { title: "Направить перечень в ГУС", isCompleted: false }, { title: "Подготовить профили НИР по Положению", isCompleted: false } ] },
];

async function seed() {
  console.log("Starting seed...");
  await db.delete(taskAssignees);
  await db.delete(subtasks);
  await db.delete(tasks);
  await db.delete(epics);
  await db.delete(users);

  const insertedUsers = await db.insert(users).values(USER_SEEDS).returning({ id: users.id, role: users.role });
  const roleToUserId = new Map<string, number>(insertedUsers.map((u) => [u.role, u.id]));

  const insertedEpics = await db.insert(epics).values(EPIC_SEEDS).returning({ id: epics.id });

  let tCount = 0, stCount = 0, aCount = 0;
  for (const ts of TASK_SEEDS) {
    const epicId = insertedEpics[ts.epicIndex].id;
    const [t] = await db.insert(tasks).values({ epicId, title: ts.title, description: ts.description, status: ts.status, priority: ts.priority, dueDate: ts.dueDate, sortOrder: ts.sortOrder }).returning({ id: tasks.id });
    tCount++;
    if (ts.subtasks?.length) {
      await db.insert(subtasks).values(ts.subtasks.map((st, idx) => ({ taskId: t.id, title: st.title, isCompleted: st.isCompleted, sortOrder: idx })));
      stCount += ts.subtasks.length;
    }
    for (const role of ts.assigneeRoles) {
      const userId = roleToUserId.get(role);
      if (userId) { await db.insert(taskAssignees).values({ taskId: t.id, userId }).onConflictDoNothing(); aCount++; }
    }
  }

  console.log("Seed complete:");
  console.log("  Users:     " + insertedUsers.length);
  console.log("  Epics:     " + insertedEpics.length);
  console.log("  Tasks:     " + tCount);
  console.log("  Subtasks:  " + stCount);
  console.log("  Assignees: " + aCount);
}

seed().catch((err) => { console.error("Seed failed:", err); process.exit(1); });
