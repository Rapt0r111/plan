// features/command-palette/model/fuzzy.ts

export type CommandCategory = "navigation" | "epic" | "action" | "team" | "task";

export interface CommandItem {
  id: string;
  category: CommandCategory;
  label: string;
  description?: string;
  icon: string;
  color?: string;
  keywords?: string[];
  onSelect: () => void;
}

function trigrams(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i <= s.length - 3; i++) set.add(s.slice(i, i + 3));
  return set;
}

export function scoreFuzzy(query: string, item: CommandItem): number {
  if (!query) return 100;
  const q = query.toLowerCase().trim();
  const label    = item.label.toLowerCase();
  const desc     = (item.description ?? "").toLowerCase();
  const keywords = (item.keywords ?? []).join(" ").toLowerCase();
  const haystack = `${label} ${desc} ${keywords}`;

  if (label.startsWith(q))   return 95 + (q.length / label.length) * 5;
  if (label.includes(q))     return 70 + (q.length / label.length) * 10;
  if (haystack.includes(q))  return 45;

  const qt = trigrams(q);
  const lt = trigrams(label);
  const inter = [...qt].filter((t) => lt.has(t)).length;
  const union = new Set([...qt, ...lt]).size;
  const jaccard = union > 0 ? inter / union : 0;
  return jaccard > 0.1 ? Math.round(jaccard * 35) : 0;
}

// ── Task-specific scorer ──────────────────────────────────────────────────────
// Separate from scoreFuzzy — works on raw strings, not CommandItem shape.
// Higher weight for title prefix/exact matches, lower for description matches.

export function scoreTaskQuery(
  query: string,
  title: string,
  description: string | null | undefined,
): number {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return 0;

  const t = title.toLowerCase();
  const d = (description ?? "").toLowerCase();

  if (t.startsWith(q))  return 95;
  if (t.includes(q))    return 75;
  if (d.includes(q))    return 45;

  // Trigram fallback for fuzzy matching (e.g. typos)
  const qt = trigrams(q);
  const tt = trigrams(t);
  if (qt.size === 0) return 0;
  const inter = [...qt].filter((x) => tt.has(x)).length;
  const union = new Set([...qt, ...tt]).size;
  const j = union > 0 ? inter / union : 0;
  return j > 0.15 ? Math.round(j * 55) : 0;
}

export const CATEGORY_ORDER: CommandCategory[] = [
  "navigation",
  "epic",
  "task",   // ← new — appears above generic actions
  "action",
  "team",
];

export const CATEGORY_LABEL: Record<CommandCategory, string> = {
  navigation: "Навигация",
  epic:       "Эпики",
  task:       "Задачи",   // ← new
  action:     "Действия",
  team:       "Команда",
};