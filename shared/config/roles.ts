/**
 * @file roles.ts — shared/config
 *
 * ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ для ролей личного состава.
 *
 * 9 ролей соответствуют seed.ts и schema.ts.
 * Любой компонент, которому нужен цвет/лейбл роли — импортирует отсюда.
 */

export type Role =
  | "company_commander"      // КНР  — Командир научной роты
  | "platoon_1_commander"    // КВ-1 — Командир 1 взвода
  | "platoon_2_commander"    // КВ-2 — Командир 2 взвода
  | "deputy_platoon_1"       // ЗКВ-1 — Зам. командира 1 взвода
  | "deputy_platoon_2"       // ЗКВ-2 — Зам. командира 2 взвода
  | "sergeant_major"         // СР   — Старшина роты
  | "squad_commander_2"      // КО-2 — Командир 2 отделения
  | "security_officer"       // ЗГТ  — Ответственный за ЗГТ
  | "duty_officer";          // ПС   — Постоянный состав (все)

export interface RoleMeta {
  role: Role;
  /** Полное наименование должности */
  label: string;
  /** Аббревиатура (2-4 символа) */
  short: string;
  /** Tailwind background class */
  bgClass: string;
  /** Tailwind text class */
  textClass: string;
  /** Tailwind border class */
  borderClass: string;
  /** HEX-цвет для inline-стилей (аватары, графики) */
  hex: string;
}

export const ROLE_META: Record<Role, RoleMeta> = {
  company_commander: {
    role:        "company_commander",
    label:       "Командир роты",
    short:       "КНР",
    bgClass:     "bg-violet-500/10",
    textClass:   "text-violet-400",
    borderClass: "border-violet-500/20",
    hex:         "#8b5cf6",
  },

  platoon_1_commander: {
    role:        "platoon_1_commander",
    label:       "Командир 1 взвода",
    short:       "КВ-1",
    bgClass:     "bg-sky-500/10",
    textClass:   "text-sky-400",
    borderClass: "border-sky-500/20",
    hex:         "#38bdf8",
  },

  platoon_2_commander: {
    role:        "platoon_2_commander",
    label:       "Командир 2 взвода",
    short:       "КВ-2",
    bgClass:     "bg-blue-500/10",
    textClass:   "text-blue-400",
    borderClass: "border-blue-500/20",
    hex:         "#60a5fa",
  },

  deputy_platoon_1: {
    role:        "deputy_platoon_1",
    label:       "Зам. ком. 1 взвода",
    short:       "ЗКВ-1",
    bgClass:     "bg-cyan-500/10",
    textClass:   "text-cyan-400",
    borderClass: "border-cyan-500/20",
    hex:         "#22d3ee",
  },

  deputy_platoon_2: {
    role:        "deputy_platoon_2",
    label:       "Зам. ком. 2 взвода",
    short:       "ЗКВ-2",
    bgClass:     "bg-teal-500/10",
    textClass:   "text-teal-400",
    borderClass: "border-teal-500/20",
    hex:         "#2dd4bf",
  },

  sergeant_major: {
    role:        "sergeant_major",
    label:       "Старшина роты",
    short:       "СР",
    bgClass:     "bg-amber-500/10",
    textClass:   "text-amber-400",
    borderClass: "border-amber-500/20",
    hex:         "#fbbf24",
  },

  squad_commander_2: {
    role:        "squad_commander_2",
    label:       "Командир 2 отделения",
    short:       "КО-2",
    bgClass:     "bg-orange-500/10",
    textClass:   "text-orange-400",
    borderClass: "border-orange-500/20",
    hex:         "#fb923c",
  },

  security_officer: {
    role:        "security_officer",
    label:       "Ответственный за ЗГТ",
    short:       "ЗГТ",
    bgClass:     "bg-red-500/10",
    textClass:   "text-red-400",
    borderClass: "border-red-500/20",
    hex:         "#f87171",
  },

  duty_officer: {
    role:        "duty_officer",
    label:       "Постоянный состав",
    short:       "ПС",
    bgClass:     "bg-slate-500/10",
    textClass:   "text-slate-400",
    borderClass: "border-slate-500/20",
    hex:         "#94a3b8",
  },
};