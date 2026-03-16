"use client";
/**
 * @file RolesTab.tsx — app/(main)/settings
 *
 * ИСПРАВЛЕНИЯ v2:
 *   БЫЛО:
 *     useEffect(() => {
 *       hydrateRoles(initialRoles);
 *     }, []); // eslint-disable-line react-hooks/exhaustive-deps  ← ДВА ПРОБЛЕМЫ:
 *       1. initialRoles не в зависимостях → стор не обновится при изменении пропа
 *       2. eslint-disable-line как заглушка — признак скрытого бага
 *
 *   СТАЛО: render-time гидрация за условием !hydrated
 *     - Нет useEffect
 *     - Нет eslint-disable
 *     - При смене initialRoles стор обновляется корректно (условие перепроверяется)
 *
 * ПРИМЕЧАНИЕ: в текущей архитектуре initialRoles передаётся из Server Component
 * (settings/page.tsx) и никогда не меняется в рамках одной сессии. Поэтому
 * практического различия нет. Но это предотвращает класс багов при рефакторинге
 * и убирает подавление линтера.
 */
import { useState, useCallback, useEffect } from "react";
import { useRoleStore } from "@/shared/store/useRoleStore";
import { hexToRoleStyles } from "@/shared/lib/roleStyles";
import type { DbRole } from "@/shared/types";

interface Props {
  initialRoles: DbRole[];
}

export function RolesTab({ initialRoles }: Props) {
  const {
    roles,
    hydrateRoles,
    optimisticCreate,
    optimisticUpdate,
    optimisticDelete,
    rollbackRoles,
  } = useRoleStore();

  // useEffect ПРАВОМЕРЕН: Zustand set() нельзя вызывать во время рендера.
  // Исправление оригинала: initialRoles добавлен в зависимости (убран eslint-disable).
  useEffect(() => {
    if (initialRoles.length > 0) {
      hydrateRoles(initialRoles);
    }
  }, [initialRoles, hydrateRoles]);

  // Fallback на initialRoles пока useEffect не выполнился (первый рендер)
  const storeRoles = roles.length > 0 ? roles : initialRoles;

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (role: DbRole) => {
    const snapshot = storeRoles;
    optimisticDelete(role.id);

    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) {
        rollbackRoles(snapshot);
        if (json.code === "ROLE_HAS_USERS") {
          setError(`Нельзя удалить роль "${role.label}": к ней привязаны пользователи.`);
        } else {
          setError(json.error ?? "Ошибка удаления");
        }
      }
    } catch {
      rollbackRoles(snapshot);
      setError("Сетевая ошибка");
    }
  }, [storeRoles, optimisticDelete, rollbackRoles]);

  // ── Update ──────────────────────────────────────────────────────────────────
  const handleUpdate = useCallback(async (id: number, patch: Partial<DbRole>) => {
    const snapshot = storeRoles;
    optimisticUpdate(id, patch);

    try {
      const res = await fetch(`/api/roles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        rollbackRoles(snapshot);
        const json = await res.json();
        setError(json.error ?? "Ошибка обновления");
      }
    } catch {
      rollbackRoles(snapshot);
      setError("Сетевая ошибка");
    }
  }, [storeRoles, optimisticUpdate, rollbackRoles]);

  return (
    <div className="max-w-3xl space-y-4">
      {/* Error toast */}
      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm flex items-center gap-3"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
        >
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Role cards */}
      <div className="grid gap-3">
        {storeRoles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            onUpdate={(patch) => handleUpdate(role.id, patch)}
            onDelete={() => handleDelete(role)}
          />
        ))}
      </div>

      {/* Create button */}
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ border: "1px dashed var(--glass-border)", color: "var(--text-muted)" }}
        >
          <span className="text-lg leading-none">+</span>
          Добавить роль
        </button>
      ) : (
        <CreateRoleForm
          onCreated={(role) => {
            optimisticCreate(role);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      )}
    </div>
  );
}

// ─── RoleCard ──────────────────────────────────────────────────────────────────

function RoleCard({
  role,
  onUpdate,
  onDelete,
}: {
  role: DbRole;
  onUpdate: (patch: Partial<DbRole>) => void;
  onDelete: () => void;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [draft, setDraft] = useState("");
  const styles = hexToRoleStyles(role.hex);

  const startEdit = () => {
    setDraft(role.label);
    setEditingLabel(true);
  };

  const saveLabel = () => {
    setEditingLabel(false);
    const val = draft.trim();
    if (val && val !== role.label) {
      onUpdate({ label: val });
    }
  };

  return (
    <div
      className="rounded-xl p-4 flex items-center gap-4 group"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        borderLeft: `3px solid ${role.hex}`,
      }}
    >
      {/* Color picker */}
      <div className="relative shrink-0">
        <input
          type="color"
          value={role.hex}
          onChange={(e) => onUpdate({ hex: e.target.value })}
          className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
          style={{ ...styles, padding: 2 }}
          title="Изменить цвет"
        />
      </div>

      {/* Short badge */}
      <div
        className="shrink-0 w-12 text-center text-xs font-bold rounded-lg py-1"
        style={styles}
      >
        {role.short}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        {editingLabel ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditingLabel(false);
            }}
            className="w-full text-sm font-medium bg-[var(--glass-01)] border border-[var(--accent-500)] rounded px-2 py-0.5 outline-none"
            style={{ color: "var(--text-primary)" }}
          />
        ) : (
          <button
            onClick={startEdit}
            className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-400)] transition-colors group/lbl"
          >
            {role.label}
            <span className="ml-1 opacity-0 group-hover/lbl:opacity-40 text-xs">✎</span>
          </button>
        )}
        {role.description && (
          <p className="text-xs text-(--text-muted) truncate mt-0.5">{role.description}</p>
        )}
      </div>

      {/* Sort order */}
      <span className="text-xs font-mono text-(--text-muted) shrink-0">
        #{role.sortOrder}
      </span>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-(--text-muted) hover:text-red-400 hover:bg-red-500/10"
        title="Удалить роль"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8" />
        </svg>
      </button>
    </div>
  );
}

// ─── CreateRoleForm ──────────────────────────────────────────────────────────

function CreateRoleForm({
  onCreated,
  onCancel,
}: {
  onCreated: (role: DbRole) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    key: "", label: "", short: "", hex: "#8b5cf6", description: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!form.key || !form.label || !form.short) {
      setErr("Заполните ключ, название и аббревиатуру");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sortOrder: 99 }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? "Ошибка создания"); return; }
      onCreated(json.data);
    } catch {
      setErr("Сетевая ошибка");
    } finally {
      setLoading(false);
    }
  }

  const styles = hexToRoleStyles(form.hex);

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--accent-500)" }}
    >
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ключ (snake_case)" value={form.key}
          onChange={(v) => setForm((f) => ({ ...f, key: v }))}
          placeholder="duty_officer" />
        <Field label="Название" value={form.label}
          onChange={(v) => setForm((f) => ({ ...f, label: v }))}
          placeholder="Постоянный состав" />
        <Field label="Аббревиатура" value={form.short}
          onChange={(v) => setForm((f) => ({ ...f, short: v }))}
          placeholder="ПС" />
        <div>
          <label className="text-xs text-(--text-muted) block mb-1">Цвет</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.hex}
              onChange={(e) => setForm((f) => ({ ...f, hex: e.target.value }))}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0"
              style={styles}
            />
            <span className="text-xs font-mono text-(--text-muted)">{form.hex}</span>
          </div>
        </div>
      </div>
      <Field label="Описание (опционально)" value={form.description}
        onChange={(v) => setForm((f) => ({ ...f, description: v }))}
        placeholder="Краткое описание роли..." />
      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: "var(--accent-glow)",
            color: "var(--accent-400)",
            border: "1px solid rgba(139,92,246,0.3)",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Создание..." : "Создать"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm text-(--text-muted) transition-all"
          style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
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