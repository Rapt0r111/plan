"use client";

import { useCallback, useState } from "react";
import type { DbPersonnelGroup } from "@/shared/types";

interface Props {
  initialGroups: DbPersonnelGroup[];
}

function emptyGroup(): Omit<DbPersonnelGroup, "id" | "createdAt" | "updatedAt"> {
  return {
    key: "",
    label: "",
    description: "",
    color: "#8b5cf6",
    sortOrder: 99,
    isActive: true,
  };
}

export function PersonnelGroupsTab({ initialGroups }: Props) {
  const [groups, setGroups] = useState(initialGroups);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyGroup);
  const [error, setError] = useState<string | null>(null);

  const patchGroup = useCallback(async (group: DbPersonnelGroup, patch: Partial<DbPersonnelGroup>) => {
    const snapshot = groups;
    setGroups((cur) => cur.map((item) => item.id === group.id ? { ...item, ...patch } : item));
    try {
      const res = await fetch(`/api/personnel-groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) {
        setGroups(snapshot);
        setError(json.error ?? "Ошибка обновления состава");
      } else {
        setGroups((cur) => cur.map((item) => item.id === group.id ? json.data : item));
      }
    } catch {
      setGroups(snapshot);
      setError("Сетевая ошибка");
    }
  }, [groups]);

  const deleteGroup = useCallback(async (group: DbPersonnelGroup) => {
    const snapshot = groups;
    setGroups((cur) => cur.filter((item) => item.id !== group.id));
    try {
      const res = await fetch(`/api/personnel-groups/${group.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        setGroups(snapshot);
        setError(json.code === "PERSONNEL_GROUP_HAS_ROLES"
          ? "Нельзя удалить состав, пока к нему привязаны роли"
          : json.error ?? "Ошибка удаления состава");
      }
    } catch {
      setGroups(snapshot);
      setError("Сетевая ошибка");
    }
  }, [groups]);

  async function createGroup() {
    if (!draft.key.trim() || !draft.label.trim()) {
      setError("Заполните ключ и название состава");
      return;
    }

    try {
      const res = await fetch("/api/personnel-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          key: draft.key.trim(),
          label: draft.label.trim(),
          description: draft.description?.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Ошибка создания состава");
        return;
      }
      setGroups((cur) => [...cur, json.data].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id));
      setDraft(emptyGroup());
      setCreating(false);
    } catch {
      setError("Сетевая ошибка");
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-xl p-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Составы личного состава</p>
        <p className="text-xs text-(--text-muted) mt-1">
          Эти группы используются страницами задач и личного плана. Роли привязываются к составу, а пользователи наследуют состав через роль.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-3" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      <div className="grid gap-3">
        {groups.map((group) => (
          <div key={group.id} className="rounded-xl p-4 flex items-center gap-3 group" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", borderLeft: `3px solid ${group.color}` }}>
            <input type="color" value={group.color} onChange={(e) => patchGroup(group, { color: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" />
            <div className="flex-1 min-w-0">
              <input
                value={group.label}
                onChange={(e) => patchGroup(group, { label: e.target.value })}
                className="w-full bg-transparent text-sm font-medium text-[var(--text-primary)] outline-none"
              />
              <p className="text-xs font-mono text-(--text-muted)">@{group.key}</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-(--text-muted)">
              <input type="checkbox" checked={group.isActive} onChange={(e) => patchGroup(group, { isActive: e.target.checked })} />
              Активен
            </label>
            <button onClick={() => deleteGroup(group)} className="w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-(--text-muted) hover:text-red-400 hover:bg-red-500/10" title="Удалить состав">
              ×
            </button>
          </div>
        ))}
      </div>

      {creating ? (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--accent-500)" }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ключ" value={draft.key} onChange={(key) => setDraft((cur) => ({ ...cur, key }))} placeholder="reserve" />
            <Field label="Название" value={draft.label} onChange={(label) => setDraft((cur) => ({ ...cur, label }))} placeholder="Резерв" />
            <Field label="Описание" value={draft.description ?? ""} onChange={(description) => setDraft((cur) => ({ ...cur, description }))} placeholder="Краткое описание" />
            <div>
              <label className="text-xs text-(--text-muted) block mb-1">Цвет</label>
              <input type="color" value={draft.color} onChange={(e) => setDraft((cur) => ({ ...cur, color: e.target.value }))} className="w-9 h-9 rounded cursor-pointer border-0 p-0" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createGroup} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--accent-glow)", color: "var(--accent-400)", border: "1px solid rgba(139,92,246,0.3)" }}>Создать</button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-xl text-sm text-(--text-muted)" style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}>Отмена</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all" style={{ border: "1px dashed var(--glass-border)", color: "var(--text-muted)" }}>
          <span className="text-lg leading-none">+</span>
          Добавить состав
        </button>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-(--text-muted) block mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-(--text-muted) outline-none focus:border-[var(--accent-500)] transition-colors"
      />
    </div>
  );
}
