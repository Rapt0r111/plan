/**
 * @file seed.ts — shared/db/seed.ts
 * Полный годовой план из PDF. 12 эпиков (январь–декабрь 2026).
 * Запуск: bun run db:seed
 */

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { users, epics, tasks, subtasks, taskAssignees } from "./schema";
import path from "path";

const sqlite = new Database(path.resolve(process.cwd(), "local.db"), { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");
const db = drizzle(sqlite, { schema: { users, epics, tasks, subtasks, taskAssignees } });

// ─── ПОЛЬЗОВАТЕЛИ ─────────────────────────────────────────────────────────────
const USER_SEEDS = [
  { name: "Тарасенко Станислав Евгеньевич",  login: "tarasenko",  role: "company_commander"   as const, initials: "КНР" },
  { name: "Халупа Алексей Иванович",          login: "khalupa",    role: "platoon_1_commander" as const, initials: "КВ1" },
  { name: "Трепалин Павел Викторович",        login: "trepalin",   role: "platoon_2_commander" as const, initials: "КВ2" },
  { name: "Антипов Егор Викторович",          login: "antipov",    role: "deputy_commander"    as const, initials: "ЗКВ" },
  { name: "Ермаков Владимир Александрович",   login: "ermakov",    role: "security_officer"    as const, initials: "ЗиТ" },
  { name: "Долгополов Андрей Андреевич",      login: "dolgopolov", role: "sergeant_major"      as const, initials: "СР"  },
  { name: "Арсенов Алексей Владимирович",     login: "arsenov",    role: "research_officer"    as const, initials: "КО2" },
  { name: "Весь постоянный состав",           login: "ps_all",     role: "duty_officer"        as const, initials: "ПС"  },
];

type RoleSlug = "company_commander"|"deputy_commander"|"platoon_1_commander"|"platoon_2_commander"|"sergeant_major"|"security_officer"|"research_officer"|"duty_officer";
interface Sub  { title: string; isCompleted?: boolean }
interface Task {
  epicIdx: number; title: string; description?: string;
  status: "todo"|"in_progress"|"done"|"blocked";
  priority: "low"|"medium"|"high"|"critical";
  dueDate?: string; sortOrder: number;
  roles: RoleSlug[]; subs?: Sub[];
}

// ─── ЭПИКИ ────────────────────────────────────────────────────────────────────
const EPIC_SEEDS = [
  { title:"Январь",   description:"Подготовка к итоговой проверке, стрельбы, Присяга, инвентаризация.", color:"#6366f1", startDate:"2026-01-01", endDate:"2026-01-31" },
  { title:"Февраль",  description:"Итоговая проверка МОРФ, конкурс ГУС 1 этап, командировки на агитацию.", color:"#8b5cf6", startDate:"2026-02-01", endDate:"2026-02-28" },
  { title:"Март",     description:"Агитация, II этап конкурса ГУС, квартальная проверка ЗГТ, план увольнения.", color:"#a855f7", startDate:"2026-03-01", endDate:"2026-03-31" },
  { title:"Апрель",   description:"Квартальная проверка ВНК ГУС Q1, конкурс НЦУО, публикация рейтингового списка.", color:"#ec4899", startDate:"2026-04-01", endDate:"2026-04-30" },
  { title:"Май",      description:"Майские праздники, подготовка к МВТФ Армия.", color:"#f43f5e", startDate:"2026-05-01", endDate:"2026-05-31" },
  { title:"Июнь",     description:"Квартальные проверки ЗГТ и моб. группы, сдача МНИ, подготовка к МВТФ.", color:"#f97316", startDate:"2026-06-01", endDate:"2026-06-30" },
  { title:"Июль",     description:"МВТФ Армия, проверка ВНК Q2, приём молодого пополнения, ПМП 2 этап.", color:"#eab308", startDate:"2026-07-01", endDate:"2026-07-31" },
  { title:"Август",   description:"ОВП, стрельбы, агитационные командировки, Присяга нового призыва.", color:"#22c55e", startDate:"2026-08-01", endDate:"2026-08-31" },
  { title:"Сентябрь", description:"Квартальные проверки, агитация, увольнение в запас, передача обязанностей.", color:"#14b8a6", startDate:"2026-09-01", endDate:"2026-09-30" },
  { title:"Октябрь",  description:"Квартальная проверка ВНК Q3, письма в ВК на кандидатов 1 этапа.", color:"#06b6d4", startDate:"2026-10-01", endDate:"2026-10-31" },
  { title:"Ноябрь",   description:"Торжественное увольнение, приём МП, круглый стол, командировки.", color:"#3b82f6", startDate:"2026-11-01", endDate:"2026-11-30" },
  { title:"Декабрь",  description:"Приём МП, ПМП 2 этап, инвентаризация, квартальные проверки, Новый год.", color:"#64748b", startDate:"2026-12-01", endDate:"2026-12-31" },
];

// ─── ЗАДАЧИ ────────────────────────────────────────────────────────────────────
const TASK_SEEDS: Task[] = [

  // ══ ЯНВАРЬ ══════════════════════════════════════════════════════════════════
  { epicIdx:0, sortOrder:0, status:"todo", priority:"medium", dueDate:"2026-01-15",
    title:"Отправить заявки на удостоверения в ГОМУ",
    roles:["platoon_2_commander"] },

  { epicIdx:0, sortOrder:1, status:"todo", priority:"high", dueDate:"2026-01-20",
    title:"Квартальная проверка ВНК ГУС за 4 квартал",
    description:"Срок: 15-20 января.",
    roles:["platoon_2_commander"],
    subs:[
      { title:"Проверить реализацию рекомендаций за 3 квартал" },
      { title:"Подготовить проект Акта" },
      { title:"Подготовить справку-доклад по полученным указаниям и рекомендациям" },
    ]},

  { epicIdx:0, sortOrder:2, status:"in_progress", priority:"critical", dueDate:"2026-02-03",
    title:"Подготовка к итоговой проверке",
    description:"Срок: 10-30 января. КНР + КВ.",
    roles:["company_commander","platoon_1_commander","platoon_2_commander"],
    subs:[
      { title:"Ознакомление с ТГ СС-ЗМОРФ через ВНК ГУС" },
      { title:"Отправка табличных сведений о деятельности научной роты" },
      { title:"Подготовка презентации для доклада" },
      { title:"Подготовка слайдов об офицерах и сотрудниках ВАС" },
      { title:"Подготовка сведений о трудоустройстве по операторам (4 призыва)" },
      { title:"Подготовка подписанных Соглашений" },
      { title:"Подготовка выписки из приказа о закреплении научных руководителей" },
      { title:"Подготовка удостоверений (аппроб.) ПО и рац. предложений, выписок о статьях" },
      { title:"Подготовка культурной программы для комиссии" },
      { title:"Подготовка приказа о закреплении научных руководителей" },
      { title:"Подготовка индивидуальных планов (старших и младших)" },
      { title:"Подготовка к демонстрации проектов роты (проект, презентация, доклад, плакат)" },
      { title:"Запросить у организаций инновационные экспонаты" },
      { title:"Предварительное заслушивание докладов на точках развёртывания" },
      { title:"Подготовить предложения на МВТФ «Армия»" },
      { title:"Провести проверку внутреннего порядка в роте" },
      { title:"Подготовить документы по учёту личного состава" },
      { title:"Подготовить личные документы операторов (ВБ, дипломы)" },
      { title:"Провести инвентаризацию документов в канцелярии" },
      { title:"Подготовить план мероприятий по агитации, заверенный у НВАС" },
      { title:"Подготовить план реализации рекомендаций предыдущей проверки" },
    ]},

  { epicIdx:0, sortOrder:3, status:"todo", priority:"medium", dueDate:"2026-01-15",
    title:"Отправить перечень направлений подготовки и профили НИР в ГУС",
    description:"Срок: 10-15 января.",
    roles:["company_commander"] },

  { epicIdx:0, sortOrder:4, status:"todo", priority:"medium",
    title:"Подготовить заверенные профили НИР в соответствии с Положением",
    roles:["company_commander"] },

  { epicIdx:0, sortOrder:5, status:"todo", priority:"medium", dueDate:"2026-01-20",
    title:"Подготовка индивидуальных заданий и личных планов по ПДП на 2 семестр",
    description:"Срок: 10-20 января.",
    roles:["platoon_1_commander"] },

  { epicIdx:0, sortOrder:6, status:"todo", priority:"medium", dueDate:"2026-01-15",
    title:"Проведение собеседований с ННИЦ для распределения м/п (январь)",
    description:"Срок: 10-15 января.",
    roles:["company_commander","platoon_1_commander","platoon_2_commander"] },

  { epicIdx:0, sortOrder:7, status:"todo", priority:"medium", dueDate:"2026-01-20",
    title:"Проведение собеседований с сотрудниками НИЦ для закрепления м/п (январь)",
    description:"Срок: 15-20 января.",
    roles:["company_commander","platoon_1_commander","platoon_2_commander"] },

  { epicIdx:0, sortOrder:8, status:"todo", priority:"medium", dueDate:"2026-01-20",
    title:"Приказ о закреплении научных руководителей (январь)",
    roles:["platoon_1_commander"] },

  { epicIdx:0, sortOrder:9, status:"todo", priority:"medium", dueDate:"2026-01-20",
    title:"Подготовка перечня направлений научной деятельности операторов для ГУС (январь)",
    roles:["platoon_1_commander"] },

  { epicIdx:0, sortOrder:10, status:"todo", priority:"high", dueDate:"2026-01-20",
    title:"Приказ на проведение Присяги (январь)",
    roles:["platoon_2_commander"] },

  { epicIdx:0, sortOrder:11, status:"todo", priority:"high", dueDate:"2026-01-27",
    title:"Подготовка к стрельбам (январь)",
    description:"Срок: 10-27 января. Приказ 10-25 января.",
    roles:["platoon_1_commander","platoon_2_commander"],
    subs:[
      { title:"Приказ на проведение стрельб" },
      { title:"Подготовить 7 выписок из приказа (123, 6, 5 каф., НР-2)" },
      { title:"Изучение материальной части" },
      { title:"Изучение требований безопасности" },
      { title:"Изучение упражнений и нормативов" },
      { title:"Практическая тренировка в выполнении нормативов" },
      { title:"Зачёт на допуск к практическим стрельбам" },
      { title:"Получить имущество по накладным согласно приказу" },
    ]},

  { epicIdx:0, sortOrder:12, status:"todo", priority:"medium", dueDate:"2026-01-20",
    title:"Мобилизационная тренировка (январь)",
    roles:["company_commander","sergeant_major"] },

  { epicIdx:0, sortOrder:13, status:"todo", priority:"medium",
    title:"Мобилизационная неделя (январь)",
    roles:["company_commander"],
    subs:[
      { title:"Расписаться в ГрОМР" },
      { title:"Подготовить рапорт (сдать в ГрОМР в четверг)" },
    ]},

  { epicIdx:0, sortOrder:14, status:"todo", priority:"low", dueDate:"2026-01-25",
    title:"Ежемесячные сверки и контроли (январь)",
    roles:["platoon_2_commander","security_officer"],
    subs:[
      { title:"Сверка личных планов постоянного состава (КВ-2)" },
      { title:"Сверка служебных карточек (ЗКВ-2)" },
      { title:"Сверка листов бесед (ЗКВ-2)" },
      { title:"Уточнение плана публикаций / проверка статей (КВ-2)" },
      { title:"Подготовка ИРС (КВ-2)" },
      { title:"Проверка индивидуальных планов (КВ)" },
      { title:"Проверка боевой подготовки (ЗКВ-1, ЗКВ-2)" },
      { title:"Уточнение тетрадей ПДП (КВ-2)" },
      { title:"Проверка стенной печати" },
      { title:"Дисциплинарная практика за месяц" },
      { title:"Актуализация списка ВУЗов (КВ-2)" },
      { title:"Утверждение графика ответственных (ЗКВ-2)" },
    ]},

  { epicIdx:0, sortOrder:15, status:"todo", priority:"medium", dueDate:"2026-01-25",
    title:"Подведение итогов роты за январь",
    roles:["duty_officer"] },

  { epicIdx:0, sortOrder:16, status:"todo", priority:"medium", dueDate:"2026-01-20",
    title:"Занятие по требованиям РД и оформлению отчётов, научных статей (20 января)",
    roles:["platoon_2_commander"] },

  { epicIdx:0, sortOrder:17, status:"todo", priority:"high", dueDate:"2026-01-27",
    title:"Организация стрельб (27 января)",
    description:"Во взаимодействии с 10 кафедрой.",
    roles:["platoon_1_commander","platoon_2_commander"] },

  { epicIdx:0, sortOrder:18, status:"todo", priority:"critical", dueDate:"2026-01-30",
    title:"Подготовка к проведению Присяги (январь)",
    description:"Срок: 28-30 января.",
    roles:["platoon_2_commander"],
    subs:[
      { title:"Выписка из приказа о проведении Присяги" },
      { title:"Сценарий" },
      { title:"Списки посетителей" },
      { title:"Списки и расписки для суточного увольнения" },
      { title:"Справки о прохождении службы" },
      { title:"Подготовка к встрече родителей (порядок, чай, презентация)" },
      { title:"Практическая подготовка МП" },
      { title:"Тренировка" },
      { title:"Генеральная репетиция" },
    ]},

  { epicIdx:0, sortOrder:19, status:"todo", priority:"critical", dueDate:"2026-01-31",
    title:"Торжественная церемония приведения к Присяге (последняя суббота января/февраля)",
    roles:["company_commander"] },

  { epicIdx:0, sortOrder:20, status:"todo", priority:"medium", dueDate:"2026-01-31",
    title:"Подготовка к передаче нарядов и ротных обязанностей между призывами (январь)",
    roles:["sergeant_major","platoon_2_commander"],
    subs:[
      { title:"Составление графика стажировок в наряде" },
      { title:"Актуализация и уточнение ротных обязанностей" },
    ]},

  { epicIdx:0, sortOrder:21, status:"todo", priority:"medium", dueDate:"2026-01-31",
    title:"Выдача МНИ по учёту (USB, электронные пропуска) — январь",
    roles:["security_officer","platoon_2_commander"],
    subs:[
      { title:"Выдача USB" },
      { title:"Выдача электронных пропусков" },
    ]},

  { epicIdx:0, sortOrder:22, status:"todo", priority:"medium", dueDate:"2026-01-31",
    title:"Активация пропусков в ЦОИ (январь)",
    roles:["platoon_1_commander"] },

  { epicIdx:0, sortOrder:23, status:"todo", priority:"low", dueDate:"2026-01-31",
    title:"Проведение беседы по трудоустройству (январь)",
    roles:["platoon_2_commander"] },

  // ══ ФЕВРАЛЬ ═════════════════════════════════════════════════════════════════
  { epicIdx:1, sortOrder:0, status:"todo", priority:"critical", dueDate:"2026-02-16",
    title:"Итоговая проверка деятельности МОРФ",
    description:"Срок: 03-16 февраля. Весь постоянный состав.",
    roles:["company_commander","platoon_1_commander","platoon_2_commander","sergeant_major","deputy_commander","security_officer"],
    subs:[
      { title:"Мероприятия в соответствии с планом подготовки" },
      { title:"Мероприятия по перечню вопросов проверки" },
      { title:"Мероприятия по плану реализации рекомендаций" },
    ]},

  { epicIdx:1, sortOrder:1, status:"todo", priority:"medium", dueDate:"2026-02-15",
    title:"Приказ на конкурс ГУС (1 этап)",
    description:"Срок: 1-15 февраля.",
    roles:["platoon_1_commander"] },

  { epicIdx:1, sortOrder:2, status:"todo", priority:"high", dueDate:"2026-02-20",
    title:"Подготовка командировочных документов на агитацию (февраль)",
    description:"Срок: 01-20 февраля.",
    roles:["platoon_2_commander"],
    subs:[
      { title:"Командировочные удостоверения" },
      { title:"Удостоверения на право ознакомления" },
      { title:"Проекты соглашений" },
      { title:"Перечень ВУЗов субъектов" },
      { title:"Письма в ВУЗы для взаимодействия" },
      { title:"Печать памяток и агитационных материалов (х200)" },
      { title:"Взаимодействие с УМО по ВПО ВАС" },
    ]},

  { epicIdx:1, sortOrder:3, status:"todo", priority:"medium", dueDate:"2026-02-28",
    title:"Проведение 1 этапа конкурса ГУС (февраль)",
    description:"Срок: 15-28 февраля.",
    roles:["platoon_1_commander"] },

  { epicIdx:1, sortOrder:4, status:"todo", priority:"medium",
    title:"Назначение ответственного в состав комиссии по ЗГТ (февраль)",
    description:"По согласованию с НС ЗГТ.",
    roles:["platoon_1_commander"] },

  { epicIdx:1, sortOrder:5, status:"todo", priority:"low",
    title:"Подготовка к праздничным дням (февраль)",
    roles:["sergeant_major"],
    subs:[
      { title:"Осмотр помещений" },
      { title:"Рапорт о готовности" },
      { title:"График ответственных" },
    ]},

  { epicIdx:1, sortOrder:6, status:"todo", priority:"high", dueDate:"2026-02-20",
    title:"Инструктаж убывающих в командировку и отправка документов (20 февраля)",
    roles:["company_commander","platoon_2_commander"],
    subs:[
      { title:"Командировочное удостоверение" },
      { title:"Удостоверение ГОМУ" },
      { title:"Листы собеседования" },
      { title:"Соглашения о ПД" },
      { title:"Образец заявления, проект соглашения" },
      { title:"Перечень ВУЗов, таблица кандидатов" },
      { title:"Форма еженедельного доклада" },
      { title:"Брошюры, плакаты, визитки НР ВАС" },
    ]},

  { epicIdx:1, sortOrder:7, status:"todo", priority:"high", dueDate:"2026-02-25",
    title:"Убытие в командировку на агитацию и ВПО (25 февраля)",
    roles:["company_commander"] },

  { epicIdx:1, sortOrder:8, status:"todo", priority:"low",
    title:"Ежемесячные сверки и контроли (февраль)",
    roles:["platoon_1_commander"],
    subs:[
      { title:"Сверка личных планов постоянного состава (КВ-1)" },
      { title:"Сверка служебных карточек" },
      { title:"Сверка листов бесед" },
      { title:"Уточнение плана публикаций / проверка статей (КВ-1)" },
      { title:"Подготовка ИРС (КВ-1)" },
      { title:"Проверка индивидуальных планов (КВ-1,2)" },
      { title:"Проверка боевой подготовки (ЗКВ-1,2)" },
      { title:"Проверка стенной печати (КНР)" },
      { title:"Дисциплинарная практика за месяц" },
    ]},

  { epicIdx:1, sortOrder:9, status:"todo", priority:"medium",
    title:"Подведение итогов роты за февраль",
    roles:["duty_officer"] },

  { epicIdx:1, sortOrder:10, status:"todo", priority:"low",
    title:"Публикация новостей на сайте ВАС (февраль)",
    roles:["platoon_1_commander"] },

  // ══ МАРТ ════════════════════════════════════════════════════════════════════
  { epicIdx:2, sortOrder:0, status:"in_progress", priority:"high", dueDate:"2026-03-25",
    title:"Еженедельный доклад в ГУС о результатах агитации (март)",
    description:"Срок: 25.02–25.03. По четвергам.",
    roles:["platoon_2_commander"] },

  { epicIdx:2, sortOrder:1, status:"in_progress", priority:"high", dueDate:"2026-03-25",
    title:"Формирование базы анкет кандидатов (март)",
    description:"Срок: 25.02–25.03.",
    roles:["platoon_2_commander"],
    subs:[
      { title:"Сбор сведений по результатам агитации" },
      { title:"Обработка писем на почте" },
      { title:"Обработка новых заявок" },
      { title:"Опрос кандидатов с предыдущего призыва" },
      { title:"Мониторинг Telegram" },
      { title:"Занесение анкет в систему учёта" },
    ]},

  { epicIdx:2, sortOrder:2, status:"todo", priority:"medium", dueDate:"2026-03-25",
    title:"Личное ознакомление с анкетами и собеседования по телефону (март)",
    description:"Срок: 20-25 марта. Для формирования профессионального портрета.",
    roles:["platoon_2_commander"] },

  { epicIdx:2, sortOrder:3, status:"todo", priority:"critical", dueDate:"2026-03-25",
    title:"Формирование документов для ВНК и ДИМК (март)",
    description:"25 марта.",
    roles:["platoon_2_commander"],
    subs:[
      { title:"Рейтинговый список кандидатов" },
      { title:"Протокол" },
      { title:"Оценочная ведомость" },
    ]},

  { epicIdx:2, sortOrder:4, status:"todo", priority:"critical", dueDate:"2026-03-28",
    title:"Согласование документов и отправка в ВНК и ДИМК (март)",
    description:"Срок: 25-28 марта.",
    roles:["platoon_2_commander","company_commander"] },

  { epicIdx:2, sortOrder:5, status:"todo", priority:"medium",
    title:"Квартальная проверка в ЗГТ (март)",
    roles:["security_officer"] },

  { epicIdx:2, sortOrder:6, status:"todo", priority:"medium", dueDate:"2026-03-10",
    title:"Отправка плана увольнения в запас в ОМУ ЛВО (март)",
    description:"Срок: 1-10 марта.",
    roles:["platoon_1_commander"] },

  { epicIdx:2, sortOrder:7, status:"todo", priority:"high", dueDate:"2026-03-15",
    title:"Проведение II этапа конкурса ГУС (март)",
    description:"Срок: 1-15 марта.",
    roles:["platoon_1_commander"] },

  { epicIdx:2, sortOrder:8, status:"todo", priority:"medium",
    title:"Мобилизационная неделя (март)",
    roles:["company_commander"],
    subs:[
      { title:"Расписаться в ГрОМР" },
      { title:"Подготовить рапорт (сдать в ГрОМР в четверг)" },
    ]},

  { epicIdx:2, sortOrder:9, status:"todo", priority:"low",
    title:"Ежемесячные сверки и контроли (март)",
    roles:["platoon_2_commander","security_officer"],
    subs:[
      { title:"Сверка личных планов постоянного состава" },
      { title:"Сверка служебных карточек" },
      { title:"Сверка листов бесед" },
      { title:"Уточнение плана публикаций / проверка статей" },
      { title:"Подготовка ИРС" },
      { title:"Проверка индивидуальных планов" },
      { title:"Проверка боевой подготовки" },
      { title:"Проверка стенной печати" },
      { title:"Дисциплинарная практика за месяц" },
    ]},

  { epicIdx:2, sortOrder:10, status:"todo", priority:"medium",
    title:"Подведение итогов роты за март",
    roles:["duty_officer"] },

  { epicIdx:2, sortOrder:11, status:"todo", priority:"medium", dueDate:"2026-03-01",
    title:"Передача ротных обязанностей и нарядов младшему призыву (28 февраля/март)",
    roles:["duty_officer"] },

  // ══ АПРЕЛЬ ══════════════════════════════════════════════════════════════════
  { epicIdx:3, sortOrder:0, status:"todo", priority:"critical", dueDate:"2026-04-09",
    title:"Квартальная проверка ВНК ГУС за 1 квартал (7-09 апреля)",
    roles:["company_commander"],
    subs:[
      { title:"Проверить реализацию рекомендаций за 4 квартал" },
      { title:"Подготовить проект Акта" },
      { title:"Подготовить справку-доклад по полученным указаниям и рекомендациям" },
    ]},

  { epicIdx:3, sortOrder:1, status:"todo", priority:"medium",
    title:"Участие в конкурсе НЦУО (апрель)",
    description:"В соответствии с указаниями.",
    roles:["platoon_1_commander"] },

  { epicIdx:3, sortOrder:2, status:"todo", priority:"high", dueDate:"2026-04-15",
    title:"Публикация рейтингового списка первого этапа отбора (15 апреля)",
    roles:["platoon_2_commander"] },

  { epicIdx:3, sortOrder:3, status:"todo", priority:"high", dueDate:"2026-04-18",
    title:"Подведение итогов конкурса ГУС (апрель)",
    description:"18 апреля.",
    roles:["company_commander","platoon_1_commander"] },

  { epicIdx:3, sortOrder:4, status:"todo", priority:"low", dueDate:"2026-04-20",
    title:"Ежемесячные сверки и контроли (апрель)",
    roles:["platoon_1_commander","security_officer"],
    subs:[
      { title:"Сверка личных планов постоянного состава (20.04)" },
      { title:"Сверка служебных карточек (20.04)" },
      { title:"Сверка листов бесед (20.04)" },
      { title:"Уточнение плана публикаций / проверка статей (18.04)" },
      { title:"Подготовка ИРС (18.04)" },
      { title:"Проверка индивидуальных планов КВ-1,2 (18.04)" },
      { title:"Проверка боевой подготовки ЗКВ-1,2 (18.04)" },
      { title:"Проверка стенной печати КНР (18.04)" },
      { title:"Дисциплинарная практика за месяц" },
    ]},

  { epicIdx:3, sortOrder:5, status:"todo", priority:"medium", dueDate:"2026-04-18",
    title:"Подведение итогов роты за апрель (18 апреля)",
    roles:["duty_officer"] },

  { epicIdx:3, sortOrder:6, status:"todo", priority:"low", dueDate:"2026-04-18",
    title:"Публикация новостей на сайте ВАС (18 апреля)",
    roles:["platoon_1_commander"] },

  // ══ МАЙ ═════════════════════════════════════════════════════════════════════
  { epicIdx:4, sortOrder:0, status:"todo", priority:"medium", dueDate:"2026-05-05",
    title:"Планирование и организация майских праздников",
    description:"Срок: 1-5 мая.",
    roles:["platoon_1_commander"],
    subs:[
      { title:"Распределение ответственности" },
      { title:"График увольнений" },
      { title:"Организация шашлыков (по призывно)" },
    ]},

  { epicIdx:4, sortOrder:1, status:"todo", priority:"high", dueDate:"2026-05-15",
    title:"Указания по МВТФ «Армия» и подготовка частного плана мероприятий",
    description:"Срок: 1-15 мая.",
    roles:["platoon_1_commander","deputy_commander"],
    subs:[
      { title:"Получить указания по МВТФ «Армия»" },
      { title:"Подготовка частного плана мероприятий" },
    ]},

  { epicIdx:4, sortOrder:2, status:"todo", priority:"low", dueDate:"2026-05-25",
    title:"Ежемесячные сверки и контроли (май)",
    roles:["platoon_1_commander"],
    subs:[
      { title:"Сверка личных планов постоянного состава" },
      { title:"Сверка служебных карточек" },
      { title:"Сверка листов бесед" },
      { title:"Уточнение плана публикаций / проверка статей (КВ-1)" },
      { title:"Подготовка ИРС (КВ-1)" },
      { title:"Проверка индивидуальных планов КВ-1,2" },
      { title:"Проверка боевой подготовки (ЗКВ-1,2)" },
      { title:"Проверка стенной печати (КНР)" },
      { title:"Дисциплинарная практика за месяц" },
    ]},

  { epicIdx:4, sortOrder:3, status:"todo", priority:"medium", dueDate:"2026-05-25",
    title:"Подведение итогов роты за май и публикация новостей (25 мая)",
    roles:["duty_officer","platoon_1_commander"] },

  // ══ ИЮНЬ ════════════════════════════════════════════════════════════════════
  { epicIdx:5, sortOrder:0, status:"todo", priority:"medium",
    title:"Квартальная проверка в ЗГТ (июнь)",
    roles:["security_officer"] },

  { epicIdx:5, sortOrder:1, status:"todo", priority:"medium",
    title:"Квартальная проверка в моб. группе (июнь)",
    roles:["company_commander"] },

  { epicIdx:5, sortOrder:2, status:"todo", priority:"high",
    title:"Мероприятия по частному плану подготовки к МВТФ «Армия» (июнь)",
    roles:["platoon_1_commander","deputy_commander"] },

  { epicIdx:5, sortOrder:3, status:"todo", priority:"medium",
    title:"Мобилизационная неделя (июнь)",
    roles:["company_commander"],
    subs:[
      { title:"Расписаться в ГрОМР" },
      { title:"Подготовить рапорт (сдать в ГрОМР в четверг)" },
    ]},

  { epicIdx:5, sortOrder:4, status:"todo", priority:"low",
    title:"Ежемесячные сверки и контроли (июнь)",
    roles:["company_commander"],
    subs:[
      { title:"Сверка личных планов постоянного состава" },
      { title:"Сверка служебных карточек" },
      { title:"Сверка листов бесед" },
      { title:"Уточнение плана публикаций / проверка статей" },
      { title:"Подготовка ИРС" },
      { title:"Проверка индивидуальных планов" },
      { title:"Проверка боевой подготовки" },
      { title:"Проверка стенной печати" },
      { title:"Дисциплинарная практика за месяц" },
    ]},

  { epicIdx:5, sortOrder:5, status:"todo", priority:"medium",
    title:"Подведение итогов роты за июнь и публикация новостей",
    roles:["duty_officer"] },

  { epicIdx:5, sortOrder:6, status:"todo", priority:"high", dueDate:"2026-06-30",
    title:"Сдача МНИ (16 комплектов) — июнь",
    description:"Срок: 25-30 июня. По учёту в журнале МНИ с составлением актов.",
    roles:["security_officer"],
    subs:[
      { title:"Сдача ПЭВМ (в комплекте: сумка, мышь, ЗУ)" },
      { title:"Сдача USB" },
      { title:"Сдача электронных пропусков" },
    ]},

  // ══ ИЮЛЬ ════════════════════════════════════════════════════════════════════
  { epicIdx:6, sortOrder:0, status:"todo", priority:"critical", dueDate:"2026-07-09",
    title:"Квартальная проверка ВНК ГУС за 2 квартал (07-09 июля)",
    roles:["platoon_2_commander"],
    subs:[
      { title:"Проверить реализацию рекомендаций за 1 квартал" },
      { title:"Подготовить проект Акта" },
      { title:"Подготовить справку-доклад по полученным указаниям и рекомендациям" },
    ]},

  { epicIdx:6, sortOrder:1, status:"todo", priority:"high",
    title:"Мероприятия по частному плану подготовки к МВТФ «Армия» (июль)",
    roles:["platoon_1_commander","deputy_commander"] },

  { epicIdx:6, sortOrder:2, status:"todo", priority:"high", dueDate:"2026-07-10",
    title:"Снятие с довольствия увольняемых в запас (июль)",
    description:"Срок: 01-10 июля.",
    roles:["platoon_1_commander"],
    subs:[
      { title:"Сдать рапорта и выписки в СО" },
      { title:"Сдать 3 выписки об исключении (ФЭС, прод. служба, в дело)" },
    ]},

  { epicIdx:6, sortOrder:3, status:"todo", priority:"medium",
    title:"Сдача МНИ при увольнении (июль — 16 комплектов)",
    roles:["security_officer"],
    subs:[
      { title:"Сдача ПЭВМ (в комплекте: сумка, мышь, ЗУ)" },
      { title:"Сдача USB" },
      { title:"Сдача электронных пропусков" },
    ]},

  { epicIdx:6, sortOrder:4, status:"todo", priority:"critical", dueDate:"2026-07-15",
    title:"Приём молодого пополнения (июль)",
    roles:["security_officer","sergeant_major"],
    subs:[
      { title:"Рапорт на автомобильный транспорт" },
      { title:"Фотографирование воинской команды" },
      { title:"Медицинский осмотр" },
      { title:"Сделать копии паспорта и военного билета" },
      { title:"Собрать и подготовить военные билеты и паспорта (бирки, жетоны)" },
      { title:"Собрать ВУ, загран. паспорта, дипломы, ПЭК, УПК, маршрутные листы" },
      { title:"Занести ПЭК в журнал учёта" },
      { title:"Подготовить рапорт на сдачу документов" },
      { title:"Проверить вещевое имущество (ведомость, аттестат, акт)" },
      { title:"Проверить наличие банковских карт у прибывших" },
      { title:"Заполнить заявления для Алушты и сдать в отдел кадров" },
      { title:"Сдать в строевой отдел рапорт на все виды довольствия" },
      { title:"Сдать в прод. службу 2 рапорта на котловое довольствие (до 12:00)" },
      { title:"Подготовить 4 выписки о включении в ВАС" },
      { title:"Определить спальные места, место хранения личных вещей" },
      { title:"Выдать постельное бельё, провести инструктаж" },
      { title:"Организовать питание и помывку" },
      { title:"Провести первичную беседу, установить связь с родителями" },
      { title:"Составить рапорт о назначении на должность" },
      { title:"Получить в лазарете профилактические лекарства" },
    ]},

  { epicIdx:6, sortOrder:5, status:"todo", priority:"high", dueDate:"2026-07-31",
    title:"Организация 2 этапа ПМП (июль)",
    roles:["duty_officer"],
    subs:[
      { title:"Назначить дату барьерного осмотра" },
      { title:"Начать дезинфекцию помещений" },
      { title:"Провести барьерный медицинский осмотр" },
      { title:"Провести проф-псих тестирование" },
      { title:"Провести КПЗ по БВС (вводный, первичный, 12 тем ТБ)" },
      { title:"Спланировать изоляцию, подготовить расписание" },
      { title:"Провести профессиональные собеседования (16 чел.)" },
      { title:"Предварительное распределение научных руководителей" },
      { title:"Разработка Боевого листа на призыв" },
      { title:"Фотографирование личного состава" },
      { title:"Подготовка анкет на оформление 3 формы допуска" },
      { title:"Подготовка подписок о неразглашении" },
      { title:"Подать рапорт о назначении на должности" },
      { title:"Заполнить электронную книгу алфавитного учёта" },
      { title:"Оформить служебные карточки" },
      { title:"Согласовать выдачу банковских карт" },
    ]},

  { epicIdx:6, sortOrder:6, status:"todo", priority:"high", dueDate:"2026-07-20",
    title:"Доклад в ГУС и ГОМУ о результатах набора МП (июль)",
    roles:["company_commander","platoon_2_commander"],
    subs:[
      { title:"Телеграмма в ГОМУ" },
      { title:"Данные в ГОМУ и для ВНК ГУС" },
      { title:"Письмо-доклад для НГУС" },
      { title:"Отправить 2-е экз. именных списков в ВК субъектов" },
    ]},

  { epicIdx:6, sortOrder:7, status:"todo", priority:"medium",
    title:"Проведение собеседований с ННИЦ и НИЦ для распределения м/п (июль)",
    roles:["platoon_1_commander","platoon_2_commander"] },

  { epicIdx:6, sortOrder:8, status:"todo", priority:"high", dueDate:"2026-07-31",
    title:"Рассылка в ВУЗы (89 субъектов) — июль",
    roles:["platoon_1_commander"] },

  { epicIdx:6, sortOrder:9, status:"todo", priority:"high", dueDate:"2026-07-15",
    title:"Подготовка агитационных приказов и документов (июль, 1-15)",
    roles:["platoon_1_commander"],
    subs:[
      { title:"Подготовить приказ на агитацию НР" },
      { title:"Подготовить план мероприятий по агитации, заверенный у НВАС" },
      { title:"Подготовить и направить в ДиД предложения в состав комиссии в ТП ЭРА" },
      { title:"Отправить заявку на выдачу удостоверений в ГУС (pdf, doc)" },
      { title:"Отправить план отбора в ГУС (pdf, doc)" },
      { title:"Приказ на присягу прикомандированных" },
    ]},

  { epicIdx:6, sortOrder:10, status:"todo", priority:"medium", dueDate:"2026-07-20",
    title:"Мобилизационная тренировка (14-20 июля)",
    roles:["company_commander","sergeant_major"],
    subs:[
      { title:"Составить частный план мероприятий" },
      { title:"Рапорт на уточнение списков оповещения" },
      { title:"Уточнение документации ПУ" },
      { title:"Смена суточного наряда" },
    ]},

  { epicIdx:6, sortOrder:11, status:"todo", priority:"medium",
    title:"Подготовка индивидуальных заданий и личных планов по ПДП на 2 семестр (июль)",
    roles:["platoon_1_commander","platoon_2_commander"] },

  { epicIdx:6, sortOrder:12, status:"todo", priority:"medium", dueDate:"2026-07-20",
    title:"Подготовка к проведению ОВП на 6 в/г (20 июля)",
    roles:["platoon_1_commander","deputy_commander"],
    subs:[
      { title:"Подготовить приказ о проведении общевойсковой подготовки" },
      { title:"Расписание" },
      { title:"Оружие, размещение, экипировка" },
    ]},

  { epicIdx:6, sortOrder:13, status:"todo", priority:"medium",
    title:"Внесение данных по увольнению и призыву в документацию УЛС (июль)",
    roles:["platoon_1_commander","deputy_commander"],
    subs:[
      { title:"Книга алфавитного учёта" },
      { title:"Книга УЛС (Форма № 1)" },
      { title:"Именные списки взводов (Форма №1-а)" },
      { title:"Книга ШДУ (Форма № 4)" },
      { title:"ШДК, ШДС" },
      { title:"Донесение 47 ОМУ о составе численности л/с" },
    ]},

  { epicIdx:6, sortOrder:14, status:"todo", priority:"low",
    title:"Ежемесячные сверки и контроли (июль)",
    roles:["company_commander","security_officer"],
    subs:[
      { title:"Мобилизационная неделя: расписаться в ГрОМР" },
      { title:"Мобилизационная неделя: подготовить рапорт (сдать в четверг)" },
      { title:"Сверка личных планов постоянного состава" },
      { title:"Сверка служебных карточек (ЗКВ-2)" },
      { title:"Сверка листов бесед (ЗКВ-2)" },
      { title:"Подготовка ИРС" },
      { title:"Дисциплинарная практика за месяц" },
    ]},

  // ══ АВГУСТ ══════════════════════════════════════════════════════════════════
  { epicIdx:7, sortOrder:0, status:"todo", priority:"critical", dueDate:"2026-08-05",
    title:"МВТФ «Армия» — участие и командировочные документы (1-5 августа)",
    roles:["platoon_2_commander"],
    subs:[
      { title:"Подготовка командировочных документов (КВ-2)" },
    ]},

  { epicIdx:7, sortOrder:1, status:"todo", priority:"high",
    title:"Мероприятия по плану общевойсковой подготовки (август, 1-30)",
    roles:["security_officer"] },

  { epicIdx:7, sortOrder:2, status:"todo", priority:"medium", dueDate:"2026-08-20",
    title:"Приказ о закреплении научных руководителей (август, 1-20)",
    roles:["platoon_2_commander"] },

  { epicIdx:7, sortOrder:3, status:"todo", priority:"medium", dueDate:"2026-08-20",
    title:"Подготовка перечня направлений научной деятельности операторов для ГУС (август)",
    roles:["platoon_2_commander"] },

  { epicIdx:7, sortOrder:4, status:"todo", priority:"medium", dueDate:"2026-08-10",
    title:"Подготовка индивидуальных заданий и личных планов по ПДП на 1 семестр (август)",
    roles:["platoon_2_commander"] },

  { epicIdx:7, sortOrder:5, status:"todo", priority:"high", dueDate:"2026-08-20",
    title:"Подготовка к стрельбам (август, 1-20)",
    roles:["security_officer","platoon_2_commander"],
    subs:[
      { title:"Приказ на проведение стрельб (1-10.08)" },
      { title:"Подготовить 7 выписок из приказа (123, 6, 5 каф., НР-2)" },
      { title:"Изучение материальной части" },
      { title:"Изучение требований безопасности" },
      { title:"Изучение упражнений и нормативов" },
      { title:"Практическая тренировка в выполнении нормативов" },
      { title:"Зачёт на допуск к практическим стрельбам" },
      { title:"Получить имущество по накладным согласно приказу" },
      { title:"Заявка на оружие и б/п (по рапорту)" },
      { title:"Транспорт и организация приёма пищи" },
    ]},

  { epicIdx:7, sortOrder:6, status:"todo", priority:"critical", dueDate:"2026-08-20",
    title:"Организация стрельб (20 августа, во взаимодействии с 10 кафедрой)",
    roles:["security_officer","platoon_2_commander"],
    subs:[
      { title:"Оружие, магазины, подсумки" },
      { title:"Учебные ПМ и учебные б/п (ПМ, АК)" },
      { title:"Ком. ящик (КЯ-83), станок прицельный (ПС-51)" },
      { title:"Шлема, бронежилеты" },
      { title:"Ведомости ТБ, форма 9а (раздатка), форма 4/арт" },
      { title:"Ведомость допуска л/с к стрельбам с АК и ПМ" },
      { title:"Ведомости учёта результатов стрельб" },
      { title:"Ведомости сдачи нормативов (1,2,13,14,16)" },
    ]},

  { epicIdx:7, sortOrder:7, status:"todo", priority:"medium", dueDate:"2026-08-20",
    title:"Занятия по метанию гранаты (БХ танков, упр. 6, 7) — август",
    roles:["security_officer"] },

  { epicIdx:7, sortOrder:8, status:"todo", priority:"medium", dueDate:"2026-08-28",
    title:"Направить в ГУС перечень направлений научных исследований на МП (25-28 августа)",
    roles:["platoon_1_commander"] },

  { epicIdx:7, sortOrder:9, status:"todo", priority:"medium", dueDate:"2026-08-20",
    title:"Рассылка в ВУЗы (89 субъектов) — август (1-20)",
    roles:["platoon_1_commander"] },

  { epicIdx:7, sortOrder:10, status:"todo", priority:"high", dueDate:"2026-08-20",
    title:"Подготовка командировочных документов на агитацию (август, 1-20)",
    roles:["company_commander"],
    subs:[
      { title:"Командировочные удостоверения (согласовать с НФЭС)" },
      { title:"Удостоверения на право ознакомления" },
      { title:"Проекты соглашений" },
      { title:"Письма в ВУЗы для взаимодействия" },
      { title:"Печать памяток и агитационных материалов (х200)" },
    ]},

  { epicIdx:7, sortOrder:11, status:"todo", priority:"high", dueDate:"2026-08-20",
    title:"Инструктаж убывающих в командировку и убытие (20 августа)",
    roles:["company_commander","platoon_2_commander"] },

  { epicIdx:7, sortOrder:12, status:"todo", priority:"high", dueDate:"2026-08-31",
    title:"Еженедельный доклад в ГУС о результатах агитации (август, 20-31)",
    description:"По четвергам.",
    roles:["company_commander"] },

  { epicIdx:7, sortOrder:13, status:"todo", priority:"critical", dueDate:"2026-08-20",
    title:"Подготовка к проведению Присяги (август, 1-20)",
    roles:["security_officer","deputy_commander"],
    subs:[
      { title:"Выписка из приказа о проведении Присяги" },
      { title:"Рапорт на получение оружия на тренировки и церемонию" },
      { title:"Сценарий" },
      { title:"Списки посетителей" },
      { title:"Списки и расписки для суточного увольнения" },
      { title:"Справки о прохождении службы" },
      { title:"Подготовка к встрече родителей (порядок, чай, презентация)" },
      { title:"Практическая подготовка МП, тренировка, генеральная репетиция" },
    ]},

  { epicIdx:7, sortOrder:14, status:"todo", priority:"critical", dueDate:"2026-08-30",
    title:"Торжественная церемония приведения к Присяге (последняя суббота августа/сентября)",
    roles:["company_commander"] },

  { epicIdx:7, sortOrder:15, status:"todo", priority:"medium",
    title:"Передача нарядов и ротных обязанностей между призывами (август, 1-31)",
    roles:["sergeant_major"],
    subs:[
      { title:"Составление графика стажировок в наряде" },
      { title:"Актуализация и уточнение ротных обязанностей" },
    ]},

  { epicIdx:7, sortOrder:16, status:"todo", priority:"medium",
    title:"Активация пропусков и выдача МНИ (24 комплекта) — август",
    roles:["security_officer","platoon_2_commander"],
    subs:[
      { title:"Активация пропусков в ЦОИ (ЗКВ-2)" },
      { title:"Выдача ПЭВМ 24 комплекта (сумка, мышь, ЗУ)" },
      { title:"Выдача USB и электронных пропусков" },
    ]},

  { epicIdx:7, sortOrder:17, status:"todo", priority:"low",
    title:"Ежемесячные сверки и контроли (август)",
    roles:["platoon_2_commander","security_officer"],
    subs:[
      { title:"Мобилизационная неделя: расписаться в ГрОМР (КНР)" },
      { title:"Мобилизационная неделя: подготовить рапорт" },
      { title:"Сверка личных планов постоянного состава (КВ-2)" },
      { title:"Сверка служебных карточек (ЗКВ-2)" },
      { title:"Сверка листов бесед (ЗКВ-2)" },
      { title:"Уточнение плана публикаций (КВ-2)" },
      { title:"Подготовка ИРС (КВ-2)" },
      { title:"Проверка индивидуальных планов (КВ)" },
      { title:"Проверка боевой подготовки (ЗКВ-1,2)" },
      { title:"Проверка стенной печати (КВ-2, ЗКВ-2)" },
      { title:"Дисциплинарная практика за месяц (ЗКВ-2)" },
    ]},

  { epicIdx:7, sortOrder:18, status:"todo", priority:"medium",
    title:"Подведение итогов роты за август и публикация новостей",
    roles:["duty_officer"] },

  // ══ СЕНТЯБРЬ ════════════════════════════════════════════════════════════════
  { epicIdx:8, sortOrder:0, status:"todo", priority:"medium",
    title:"Квартальная проверка ЗГТ (сентябрь, 1-30)",
    roles:["platoon_1_commander"] },

  { epicIdx:8, sortOrder:1, status:"todo", priority:"medium",
    title:"Квартальная проверка в моб. группе (сентябрь, 1-30)",
    roles:["company_commander"] },

  { epicIdx:8, sortOrder:2, status:"todo", priority:"high", dueDate:"2026-09-25",
    title:"Еженедельный доклад в ГУС о результатах агитации (сентябрь, 1-25)",
    description:"По четвергам.",
    roles:["company_commander"] },

  { epicIdx:8, sortOrder:3, status:"todo", priority:"high", dueDate:"2026-09-25",
    title:"Формирование базы анкет кандидатов (сентябрь, 1-25)",
    roles:["company_commander"],
    subs:[
      { title:"Сбор сведений по результатам агитации" },
      { title:"Обработка писем на почте" },
      { title:"Обработка новых заявок" },
      { title:"Опрос кандидатов с предыдущего призыва" },
      { title:"Мониторинг Telegram" },
      { title:"Ежедневная публикация новостей (по плану канала)" },
    ]},

  { epicIdx:8, sortOrder:4, status:"todo", priority:"medium",
    title:"Личное ознакомление с анкетами и собеседования по телефону (сентябрь)",
    roles:["company_commander"] },

  { epicIdx:8, sortOrder:5, status:"todo", priority:"critical", dueDate:"2026-09-28",
    title:"Формирование документов для ВНК и ДИМК (сентябрь)",
    roles:["company_commander"],
    subs:[
      { title:"Рейтинговый список (20-25.09)" },
      { title:"Протокол" },
      { title:"Оценочная ведомость" },
      { title:"Согласование и отправка в ВНК и ДИМК (25-28.09)" },
    ]},

  { epicIdx:8, sortOrder:6, status:"todo", priority:"medium",
    title:"Передача ротных обязанностей и нарядов (сентябрь, 1-30)",
    roles:["sergeant_major","duty_officer"] },

  { epicIdx:8, sortOrder:7, status:"todo", priority:"high", dueDate:"2026-09-15",
    title:"Отправка плана увольнения в запас в ОМУ ЛВО (сентябрь, 1-15)",
    roles:["deputy_commander"] },

  { epicIdx:8, sortOrder:8, status:"todo", priority:"high",
    title:"Подготовка документов на увольнение в запас (сентябрь)",
    roles:["deputy_commander"],
    subs:[
      { title:"Таблица очерёдности увольнения" },
      { title:"Маршруты следования и предписания" },
      { title:"Список допусков, инструктаж о неразглашении в ЗГТ" },
      { title:"Заключения в ЗГ, список с приказами в ДП ЗГТ" },
      { title:"Рапорта на исключение из ВАС в СО" },
      { title:"Рапорта на снятие с довольствия в СО" },
      { title:"Ведомость выдачи ВПД с маршрутами" },
      { title:"Ведомость и журнал инструктажа л/с" },
      { title:"Журнал выдачи ПЭК, записи в ВБ и УПК" },
      { title:"Рапорт на ВПД с таблицей увольнения" },
      { title:"Справки о прохождении службы, фото, грамоты, письма" },
      { title:"Дембельский альбом, таблица трудоустройства" },
    ]},

  { epicIdx:8, sortOrder:9, status:"todo", priority:"medium", dueDate:"2026-09-10",
    title:"Занятие по требованиям РД и оформлению отчётов (сентябрь, 1-10)",
    roles:["platoon_2_commander"] },

  { epicIdx:8, sortOrder:10, status:"todo", priority:"medium",
    title:"Проведение беседы по трудоустройству (сентябрь, 1-30)",
    roles:["company_commander"] },

  { epicIdx:8, sortOrder:11, status:"todo", priority:"low",
    title:"Мобилизационная неделя и ежемесячные сверки (сентябрь)",
    roles:["company_commander","platoon_2_commander","security_officer"],
    subs:[
      { title:"Расписаться в ГрОМР (КНР)" },
      { title:"Подготовить рапорт (сдать в ГрОМР в четверг)" },
      { title:"Сверка личных планов постоянного состава (КВ-2)" },
      { title:"Сверка служебных карточек (ЗКВ-2)" },
      { title:"Сверка листов бесед (ЗКВ-2)" },
      { title:"Уточнение плана публикаций (КВ-2)" },
      { title:"Подготовка ИРС (КВ-2)" },
      { title:"Проверка боевой подготовки (ЗКВ-1,2)" },
      { title:"Проверка стенной печати (КВ-2, ЗКВ-2)" },
      { title:"Дисциплинарная практика за месяц" },
      { title:"Актуализация списка ВУЗов" },
      { title:"Подготовка соглашений" },
      { title:"Сверка ПЭК, УПК, ВБ" },
    ]},

  { epicIdx:8, sortOrder:12, status:"todo", priority:"medium",
    title:"Подведение итогов роты за сентябрь",
    roles:["duty_officer"] },

  // ══ ОКТЯБРЬ ═════════════════════════════════════════════════════════════════
  { epicIdx:9, sortOrder:0, status:"todo", priority:"critical", dueDate:"2026-10-08",
    title:"Квартальная проверка ВНК ГУС за 3 квартал (06-08 октября)",
    roles:["platoon_2_commander"],
    subs:[
      { title:"Проверить реализацию рекомендаций за 2 квартал" },
      { title:"Подготовить проект Акта" },
      { title:"Подготовить справку-доклад по полученным указаниям и рекомендациям" },
    ]},

  { epicIdx:9, sortOrder:1, status:"todo", priority:"high", dueDate:"2026-10-25",
    title:"Отправка писем в ВК на кандидатов 1 этапа (октябрь, 1-25)",
    roles:["deputy_commander"] },

  { epicIdx:9, sortOrder:2, status:"todo", priority:"low",
    title:"Мобилизационная неделя и ежемесячные сверки (октябрь)",
    roles:["company_commander","platoon_2_commander","security_officer"],
    subs:[
      { title:"Расписаться в ГрОМР (КНР)" },
      { title:"Подготовить рапорт (сдать в ГрОМР в четверг)" },
      { title:"Сверка личных планов постоянного состава (КВ-2)" },
      { title:"Сверка служебных карточек (ЗКВ-2)" },
      { title:"Сверка листов бесед (ЗКВ-2)" },
      { title:"Уточнение плана публикаций / проверка статей (КВ-2)" },
      { title:"Подготовка ИРС (КВ-2)" },
      { title:"Проверка индивидуальных планов (КВ)" },
      { title:"Проверка боевой подготовки (ЗКВ-1,2)" },
      { title:"Уточнение тетрадей ПДП (КВ-2)" },
      { title:"Проверка стенной печати (КВ-2, ЗКВ-2)" },
      { title:"Дисциплинарная практика за месяц (ЗКВ-2)" },
      { title:"Актуализация списка ВУЗов (КВ-2)" },
      { title:"Подготовка соглашений (КВ-2)" },
      { title:"Сверка ПЭК, УПК, ВБ (ЗКВ-1)" },
    ]},

  { epicIdx:9, sortOrder:3, status:"todo", priority:"medium",
    title:"Подведение итогов роты за октябрь",
    roles:["duty_officer"] },

  // ══ НОЯБРЬ ══════════════════════════════════════════════════════════════════
  { epicIdx:10, sortOrder:0, status:"todo", priority:"critical", dueDate:"2026-11-01",
    title:"Оформление документов на торжественное увольнение в запас (01 ноября)",
    roles:["research_officer","platoon_1_commander"],
    subs:[
      { title:"Приказ об увольнении (в последнюю субботу месяца) — КО-2" },
      { title:"Приказ на звания (по рапорту) — КО-2" },
      { title:"Сценарий торжественного увольнения в запас — КО-2" },
      { title:"Печать и оформление грамот, писем, фото, фотоальбома — КО-2" },
      { title:"Рапорт на выдачу ВПД, таблица очерёдности" },
      { title:"Выдать ВПД под подпись, организовать покупку билетов" },
      { title:"Список военных комиссариатов, план защиты годовых отчётов" },
      { title:"Предписания и ведомость инструктажа" },
      { title:"Справки о прохождении службы для увольняемых" },
      { title:"Рапорта о снятии с довольствия и исключении из ВАС" },
      { title:"Выписки из приказов, ведомость о неразглашении ССГТ" },
      { title:"Заключения об осведомлённости" },
      { title:"Заполнить и заверить записи в ВБ и УПК" },
      { title:"Квитки об отсутствии задолженностей в библиотеке" },
      { title:"Акты о сдаче ПЭВМ, USB и пропусков" },
    ]},

  { epicIdx:10, sortOrder:1, status:"todo", priority:"high", dueDate:"2026-11-15",
    title:"Работа с кандидатами на приём МП (ноябрь, 01-15)",
    roles:["platoon_2_commander"],
    subs:[
      { title:"Обзвон кандидатов на предмет прохождения призыва (01.11)" },
      { title:"Уточнение списков второго этапа с ГОМУ (01.11)" },
      { title:"Приказ о приёме молодого пополнения (01.11)" },
      { title:"Публикация результатов 2-го этапа отбора (15.11)" },
    ]},

  { epicIdx:10, sortOrder:2, status:"todo", priority:"medium", dueDate:"2026-11-01",
    title:"Сбор сведений старших воинских команд с кафедр (01 ноября)",
    roles:["deputy_commander"] },

  { epicIdx:10, sortOrder:3, status:"todo", priority:"high", dueDate:"2026-11-10",
    title:"Подготовка к круглому столу (10 ноября)",
    roles:["platoon_1_commander"],
    subs:[
      { title:"Подготовка информационного письма" },
      { title:"Сбор материалов выступающих" },
      { title:"Рапорт на пропуск посетителей" },
      { title:"Список участников, подготовка сценария" },
      { title:"Рапорт на помещение (ЗУС)" },
      { title:"Подготовка грамот и дипломов" },
      { title:"Подготовка раздаточных материалов и бейджей" },
      { title:"Подготовка помещений (гардероб, туалет, чайная зона)" },
    ]},

  { epicIdx:10, sortOrder:4, status:"todo", priority:"high", dueDate:"2026-11-15",
    title:"Подготовка командировочных документов на призыв (15 ноября)",
    roles:["deputy_commander"],
    subs:[
      { title:"Командировочные удостоверения" },
      { title:"Доверенности" },
      { title:"Письма о сокращении сопровождения" },
      { title:"Печать памяток и агитационных материалов" },
      { title:"ВПД" },
    ]},

  { epicIdx:10, sortOrder:5, status:"todo", priority:"high", dueDate:"2026-11-15",
    title:"Подготовка к защите годовых отчётов (15 ноября)",
    roles:["platoon_1_commander"],
    subs:[
      { title:"Проверка годовых отчётов" },
      { title:"Проверка презентаций" },
      { title:"Предварительное заслушивание" },
      { title:"Сбор электронных версий годовых отчётов и презентаций" },
    ]},

  { epicIdx:10, sortOrder:6, status:"todo", priority:"medium", dueDate:"2026-11-20",
    title:"Уточнение информации с СП о ходе призыва кандидатов (20 ноября)",
    roles:["deputy_commander"],
    subs:[
      { title:"Адреса и сроки отправки" },
      { title:"Сокращение команды (по письмам)" },
    ]},

  { epicIdx:10, sortOrder:7, status:"todo", priority:"low",
    title:"Мобилизационная неделя и ежемесячные сверки (ноябрь)",
    roles:["company_commander","platoon_2_commander","security_officer"],
    subs:[
      { title:"Расписаться в ГрОМР (20.11)" },
      { title:"Подготовить рапорт (сдать в ГрОМР в четверг)" },
      { title:"Сверка личных планов постоянного состава (20.11)" },
      { title:"Сверка служебных карточек (20.11)" },
      { title:"Сверка листов бесед (20.11)" },
      { title:"Уточнение плана публикаций (20.11)" },
      { title:"Подготовка ИРС (20.11)" },
      { title:"Проверка боевой подготовки (25.11)" },
      { title:"Уточнение тетрадей ПДП (КВ-2)" },
      { title:"Дисциплинарная практика (25.11)" },
      { title:"Актуализация списка ВУЗов (25.11)" },
      { title:"Сверка ПЭК, УПК, ВБ (ЗКВ-1)" },
    ]},

  { epicIdx:10, sortOrder:8, status:"todo", priority:"high", dueDate:"2026-11-28",
    title:"Организация мероприятий круглого стола (28 ноября)",
    roles:["platoon_1_commander"],
    subs:[
      { title:"Пропуск по спискам и встреча посетителей" },
      { title:"Организация кофе-брейка" },
      { title:"Подготовка мультимедиа" },
      { title:"Подготовка грамот и дипломов" },
      { title:"Пригласить сотрудников НИЦ" },
    ]},

  { epicIdx:10, sortOrder:9, status:"todo", priority:"high", dueDate:"2026-11-29",
    title:"Тренировка торжественного увольнения (29 ноября)",
    roles:["platoon_1_commander","research_officer"],
    subs:[
      { title:"Подготовка стола (со скатертью)" },
      { title:"Организация музыкального сопровождения" },
      { title:"Подготовка выписок из приказов, погон, значков, грамот, фотографий" },
      { title:"Согласовать список посетителей (с паспортными данными)" },
    ]},

  { epicIdx:10, sortOrder:10, status:"todo", priority:"critical", dueDate:"2026-11-30",
    title:"Проведение торжественного увольнения в запас (30 ноября)",
    roles:["platoon_1_commander","sergeant_major"],
    subs:[
      { title:"Пропуск по спискам и встреча посетителей" },
      { title:"Организация экскурсии для посетителей" },
      { title:"Организация чайной зоны" },
    ]},

  { epicIdx:10, sortOrder:11, status:"todo", priority:"critical", dueDate:"2026-11-30",
    title:"Инструктаж старших воинских команд и отправка в командировку (30 ноября)",
    roles:["company_commander","platoon_1_commander","platoon_2_commander"],
    subs:[
      { title:"Подготовка командировочных документов" },
      { title:"Подготовка памяток и ведомость инструктажа" },
      { title:"Доклад в ГОМУ о проведении инструктажа (телеграмма)" },
    ]},

  { epicIdx:10, sortOrder:12, status:"todo", priority:"medium", dueDate:"2026-11-25",
    title:"Подведение итогов роты за ноябрь (25 ноября)",
    roles:["duty_officer"] },

  // ══ ДЕКАБРЬ ═════════════════════════════════════════════════════════════════
  { epicIdx:11, sortOrder:0, status:"todo", priority:"medium", dueDate:"2026-12-05",
    title:"Подготовка графика отпусков на следующий год (01-05 декабря)",
    roles:["company_commander"] },

  { epicIdx:11, sortOrder:1, status:"todo", priority:"medium", dueDate:"2026-12-10",
    title:"Распределение ответственности на праздники (01-10 декабря)",
    roles:["company_commander"] },

  { epicIdx:11, sortOrder:2, status:"todo", priority:"high", dueDate:"2026-12-10",
    title:"Снятие с довольствия увольняемых в запас (декабрь, 01-10)",
    roles:["platoon_2_commander"],
    subs:[
      { title:"Сдать рапорта и выписки в СО и прод. службу" },
      { title:"Сдать 4 выписки об исключении (ФЭС, ОК, прод. служба, в дело)" },
    ]},

  { epicIdx:11, sortOrder:3, status:"todo", priority:"medium",
    title:"Сдача МНИ при увольнении (декабрь — 16 комплектов)",
    roles:["security_officer"],
    subs:[
      { title:"Сдача ПЭВМ (в комплекте: сумка, мышь, ЗУ)" },
      { title:"Сдача USB" },
      { title:"Сдача электронных пропусков" },
    ]},

  { epicIdx:11, sortOrder:4, status:"todo", priority:"high", dueDate:"2026-12-10",
    title:"Подготовка к инвентаризации (01-10 декабря)",
    roles:["company_commander","sergeant_major"],
    subs:[
      { title:"Инвентаризация техники" },
      { title:"Инвентаризация КЭС" },
      { title:"Инвентаризация ЗГТ" },
    ]},

  { epicIdx:11, sortOrder:5, status:"todo", priority:"medium", dueDate:"2026-12-12",
    title:"Ознакомление с 2С (в кабинете 5125б) — 12 декабря",
    roles:["company_commander","platoon_1_commander","platoon_2_commander"] },

  { epicIdx:11, sortOrder:6, status:"todo", priority:"low", dueDate:"2026-12-10",
    title:"Рапорта на выплаты, документы по ФП (1-10 декабря)",
    roles:["company_commander"],
    subs:[
      { title:"Рапорт на выплату за командование личным составом" },
      { title:"Рапорт на выплату за работу с ССГТ" },
      { title:"Рапорт на ежемесячную премию" },
      { title:"Рапорт на годовую премию (1010)" },
      { title:"Подготовка документов по ФП (рапорта ЗКВ, КО, копии книжек)" },
      { title:"Подготовка к сдаче на классность" },
    ]},

  { epicIdx:11, sortOrder:7, status:"todo", priority:"medium", dueDate:"2026-12-10",
    title:"Квартальная проверка в моб. группе (декабрь, 1-10)",
    roles:["company_commander"] },

  { epicIdx:11, sortOrder:8, status:"todo", priority:"medium", dueDate:"2026-12-10",
    title:"Квартальная проверка службы ЗГТ (декабрь, 1-10)",
    roles:["security_officer"] },

  { epicIdx:11, sortOrder:9, status:"todo", priority:"critical", dueDate:"2026-12-15",
    title:"Приём молодого пополнения (декабрь, 1-15)",
    roles:["company_commander","sergeant_major"],
    subs:[
      { title:"Рапорт на автомобильный транспорт" },
      { title:"Фотографирование воинской команды, медицинский осмотр" },
      { title:"Копии паспортов и военных билетов (бирки, жетоны)" },
      { title:"Собрать ВУ, загран. паспорта, дипломы, ПЭК, УПК, маршрутные листы" },
      { title:"Занести ПЭК в журнал учёта" },
      { title:"Подготовить рапорт на сдачу документов" },
      { title:"Проверить вещевое имущество (ведомость, аттестат, акт)" },
      { title:"Проверить наличие банковских карт у прибывших" },
      { title:"Заполнить заявления для Алушты и сдать в отдел кадров" },
      { title:"Сдать в строевой отдел рапорт на все виды довольствия" },
      { title:"Сдать в прод. службу рапорта на котловое довольствие (до 12:00)" },
      { title:"Подготовить 4 выписки о включении в ВАС" },
      { title:"Определить спальные места, выдать постельное бельё" },
      { title:"Провести инструктаж, организовать питание и помывку" },
      { title:"Провести первичную беседу, создать родительский чат" },
      { title:"Составить рапорт о назначении на должность" },
      { title:"Получить в лазарете профилактические лекарства" },
    ]},

  { epicIdx:11, sortOrder:10, status:"todo", priority:"high", dueDate:"2026-12-15",
    title:"Доклад в ГУС и ГОМУ о результатах набора МП (15 декабря)",
    roles:["platoon_2_commander"],
    subs:[
      { title:"Отправить 2-е экз. именных списков в ВК субъектов" },
      { title:"Телеграмма в ГОМУ" },
      { title:"Данные в ГОМУ и для ВНК ГУС" },
      { title:"Письмо-доклад для НГУС" },
    ]},

  { epicIdx:11, sortOrder:11, status:"todo", priority:"high", dueDate:"2026-12-15",
    title:"Внесение данных по увольнению и призыву в документацию УЛС (15 декабря)",
    roles:["platoon_2_commander"],
    subs:[
      { title:"Книга алфавитного учёта" },
      { title:"Книга УЛС (Форма № 1)" },
      { title:"Именные списки взводов (Форма №1-а)" },
      { title:"Книга ШДУ (Форма № 4)" },
      { title:"ШДК, ШДС" },
      { title:"Донесение 47 ОМУ о составе численности л/с (КВ-1)" },
    ]},

  { epicIdx:11, sortOrder:12, status:"todo", priority:"medium", dueDate:"2026-12-15",
    title:"Подготовка агитационных приказов и документов (15 декабря)",
    roles:["platoon_2_commander"],
    subs:[
      { title:"Подготовить приказ на агитацию НР и ВПО ВАС" },
      { title:"Подготовить план мероприятий по агитации, заверенный у НВАС" },
      { title:"Подготовить предложения в состав комиссии в Технополис ЭРА" },
      { title:"Отправить заявку на выдачу удостоверений в ГУС (pdf, doc)" },
    ]},

  { epicIdx:11, sortOrder:13, status:"todo", priority:"high", dueDate:"2026-12-30",
    title:"Организация 2 этапа ПМП (декабрь, 15-30)",
    roles:["duty_officer","platoon_1_commander"],
    subs:[
      { title:"Провести барьерный медицинский осмотр" },
      { title:"Провести проф-псих тестирование" },
      { title:"Провести КПЗ по БВС (12 тем ТБ, фотоотчёт)" },
      { title:"Провести профессиональные собеседования (16 чел.)" },
      { title:"Предварительное распределение научных руководителей" },
      { title:"Разработка Боевого листа на призыв" },
      { title:"Подготовить ведомость допуска в бассейн" },
      { title:"Фотографирование личного состава" },
      { title:"Подготовка анкет на оформление 3 формы допуска" },
      { title:"Подготовка подписок о неразглашении" },
      { title:"Подать рапорт о назначении на должности" },
      { title:"Заполнить электронную книгу алфавитного учёта" },
      { title:"Оформить служебные карточки" },
      { title:"Согласовать выдачу банковских карт" },
    ]},

  { epicIdx:11, sortOrder:14, status:"todo", priority:"medium", dueDate:"2026-12-30",
    title:"Выдача МНИ (24 комплекта) — 30 декабря",
    roles:["platoon_1_commander","security_officer"],
    subs:[
      { title:"Выдача ПЭВМ (в комплекте: сумка, мышь, ЗУ)" },
      { title:"Выдача USB" },
      { title:"Выдача электронных пропусков" },
    ]},

  { epicIdx:11, sortOrder:15, status:"todo", priority:"low", dueDate:"2026-12-18",
    title:"Ежемесячные сверки и контроли (декабрь, 18)",
    roles:["platoon_1_commander","security_officer"],
    subs:[
      { title:"Сверка личных планов постоянного состава (18.12)" },
      { title:"Сверка служебных карточек (18.12)" },
      { title:"Сверка листов бесед (18.12)" },
      { title:"Уточнение плана публикаций / проверка статей (18.12, КВ-1)" },
      { title:"Подготовка ИРС (18.12, КВ-1)" },
      { title:"Проверка индивидуальных планов КВ-1,2 (18.12)" },
      { title:"Проверка боевой подготовки ЗКВ-1,2 (18.12)" },
      { title:"Проверка стенной печати КНР (18.12)" },
      { title:"Дисциплинарная практика за месяц (18.12)" },
    ]},

  { epicIdx:11, sortOrder:16, status:"todo", priority:"medium", dueDate:"2026-12-18",
    title:"Подведение итогов роты за декабрь (18 декабря)",
    roles:["duty_officer"] },

  { epicIdx:11, sortOrder:17, status:"todo", priority:"medium", dueDate:"2026-12-31",
    title:"Организация Нового года (15-30 декабря)",
    roles:["duty_officer","sergeant_major"],
    subs:[
      { title:"Ёлка" },
      { title:"Стол (во взаимодействии со столовой)" },
      { title:"Сценарий программы" },
      { title:"Распределение нарядов и увольнений" },
      { title:"Культурный досуг" },
    ]},
];

// ─── SEED ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("🌱 Запуск сида — Годовой план 2026...");

  // Очистка в обратном порядке (FK)
  await db.delete(taskAssignees);
  await db.delete(subtasks);
  await db.delete(tasks);
  await db.delete(epics);
  await db.delete(users);
  console.log("🗑  Предыдущие данные очищены.");

  const insertedUsers = await db.insert(users).values(USER_SEEDS).returning({ id: users.id, role: users.role });
  const roleToId = new Map<string, number>(insertedUsers.map(u => [u.role, u.id]));
  console.log(`👤 Пользователей: ${insertedUsers.length}`);

  const insertedEpics = await db.insert(epics).values(EPIC_SEEDS).returning({ id: epics.id });
  console.log(`📅 Эпиков (месяцев): ${insertedEpics.length}`);

  let tCnt = 0, stCnt = 0, aCnt = 0;

  for (const ts of TASK_SEEDS) {
    const epicId = insertedEpics[ts.epicIdx].id;
    const [t] = await db.insert(tasks).values({
      epicId, title: ts.title, description: ts.description,
      status: ts.status, priority: ts.priority,
      dueDate: ts.dueDate, sortOrder: ts.sortOrder,
    }).returning({ id: tasks.id });
    tCnt++;

    if (ts.subs?.length) {
      await db.insert(subtasks).values(
        ts.subs.map((s, idx) => ({
          taskId: t.id, title: s.title,
          isCompleted: s.isCompleted ?? false, sortOrder: idx,
        }))
      );
      stCnt += ts.subs.length;
    }

    for (const role of ts.roles) {
      const userId = roleToId.get(role);
      if (userId) {
        await db.insert(taskAssignees).values({ taskId: t.id, userId }).onConflictDoNothing();
        aCnt++;
      }
    }
  }

  console.log("─".repeat(46));
  console.log(`✅ Задач:      ${tCnt}`);
  console.log(`📋 Подзадач:   ${stCnt}`);
  console.log(`👥 Назначений: ${aCnt}`);
  console.log("─".repeat(46));
  console.log("🎉 Сид завершён!");
}

seed().catch(err => { console.error("❌ Ошибка:", err); process.exit(1); });