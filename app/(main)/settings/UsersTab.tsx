"use client";
/**
 * @file UsersTab.tsx — app/(main)/settings
 *
 * CRUD для пользователей.
 * - Список карточек с аватаром, именем, логином, ролью
 * - Inline-редактирование имени и логина
 * - Смена роли через dropdown
 * - Создание нового пользователя
 * - Оптимистичные обновления через локальный стейт + rollback
 */
import { useState, useCallback } from "react";
import type { UserWithMeta, DbRole } from "@/shared/types";
import { hexToRoleStyles } from "@/shared/lib/roleStyles";

interface Props {
    initialUsers: UserWithMeta[];
    roles: DbRole[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function generateInitials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .map((w) => w[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

function AvatarCircle({ initials, hex, size = 32 }: { initials: string; hex: string; size?: number }) {
    return (
        <div
            className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
            style={{ width: size, height: size, fontSize: size * 0.35, backgroundColor: hex }}
        >
            {initials}
        </div>
    );
}

// ─── RoleSelect ───────────────────────────────────────────────────────────────

function RoleSelect({
    value,
    roles,
    onChange,
}: {
    value: number;
    roles: DbRole[];
    onChange: (roleId: number) => void;
}) {
    const current = roles.find((r) => r.id === value);
    const styles = current ? hexToRoleStyles(current.hex) : {};

    return (
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="appearance-none pl-3 pr-7 py-1 rounded-full text-xs font-medium border outline-none cursor-pointer transition-colors"
                style={{
                    ...styles,
                    backgroundImage: "none",
                }}
            >
                {roles.map((r) => (
                    <option key={r.id} value={r.id} style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>
                        {r.label}
                    </option>
                ))}
            </select>
            <svg
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3"
                viewBox="0 0 12 12" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round"
                style={{ color: current?.hex ?? "var(--text-muted)" }}
            >
                <path d="M2 4l4 4 4-4" />
            </svg>
        </div>
    );
}

// ─── UserCard ─────────────────────────────────────────────────────────────────

function UserCard({
    user,
    roles,
    onUpdate,
    onDelete,
}: {
    user: UserWithMeta;
    roles: DbRole[];
    onUpdate: (patch: { name?: string; login?: string; roleId?: number }) => void;
    onDelete: () => void;
}) {
    const [editField, setEditField] = useState<"name" | "login" | null>(null);
    const [draft, setDraft] = useState("");

    const startEdit = (field: "name" | "login") => {
        setDraft(field === "name" ? user.name : user.login);
        setEditField(field);
    };

    const saveField = (field: "name" | "login") => {
        setEditField(null);
        const val = draft.trim();
        const original = field === "name" ? user.name : user.login;
        if (val && val !== original) onUpdate({ [field]: val });
    };

    return (
        <div
            className="rounded-xl p-4 flex items-center gap-4 group"
            style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
                borderLeft: `3px solid ${user.roleMeta.hex}`,
            }}
        >
            {/* Avatar */}
            <AvatarCircle initials={user.initials} hex={user.roleMeta.hex} size={36} />

            {/* Name + login */}
            <div className="flex-1 min-w-0 space-y-1">
                {/* Name */}
                {editField === "name" ? (
                    <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => saveField("name")}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setEditField(null);
                        }}
                        className="w-full text-sm font-medium bg-[var(--glass-01)] border border-[var(--accent-500)] rounded px-2 py-0.5 outline-none"
                        style={{ color: "var(--text-primary)" }}
                    />
                ) : (
                    <button
                        onClick={() => startEdit("name")}
                        className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-400)] transition-colors group/n flex items-center gap-1"
                    >
                        {user.name}
                        <span className="opacity-0 group-hover/n:opacity-40 text-xs">✎</span>
                    </button>
                )}

                {/* Login */}
                {editField === "login" ? (
                    <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => saveField("login")}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setEditField(null);
                        }}
                        className="w-full text-xs bg-[var(--glass-01)] border border-[var(--accent-500)] rounded px-2 py-0.5 outline-none font-mono"
                        style={{ color: "var(--text-muted)" }}
                    />
                ) : (
                    <button
                        onClick={() => startEdit("login")}
                        className="text-xs font-mono text-(--text-muted) hover:text-[var(--text-secondary)] transition-colors group/l flex items-center gap-1"
                    >
                        @{user.login}
                        <span className="opacity-0 group-hover/l:opacity-40 text-[10px]">✎</span>
                    </button>
                )}
            </div>

            {/* Role selector */}
            <RoleSelect
                value={user.roleId}
                roles={roles}
                onChange={(roleId) => onUpdate({ roleId })}
            />

            {/* Initials badge */}
            <span
                className="text-xs font-bold font-mono w-8 text-center shrink-0 rounded-lg py-0.5"
                style={hexToRoleStyles(user.roleMeta.hex)}
            >
                {user.initials}
            </span>

            {/* Delete */}
            <button
                onClick={onDelete}
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-(--text-muted) hover:text-red-400 hover:bg-red-500/10"
                title="Удалить пользователя"
            >
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                    strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8" />
                </svg>
            </button>
        </div>
    );
}

// ─── CreateUserForm ────────────────────────────────────────────────────────────

function CreateUserForm({
    roles,
    onCreated,
    onCancel,
}: {
    roles: DbRole[];
    onCreated: (user: UserWithMeta) => void;
    onCancel: () => void;
}) {
    const [form, setForm] = useState({
        name: "",
        login: "",
        roleId: roles[0]?.id ?? 0,
        initials: "",
    });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit() {
        if (!form.name.trim()) { setErr("Введите имя"); return; }
        if (!form.login.trim()) { setErr("Введите логин"); return; }
        if (!form.roleId) { setErr("Выберите роль"); return; }

        setLoading(true);
        setErr(null);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    login: form.login.trim(),
                    roleId: form.roleId,
                    initials: form.initials.trim().toUpperCase().slice(0, 2) || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) { setErr(json.error ?? "Ошибка создания"); return; }

            const role = roles.find((r) => r.id === form.roleId)!;
            const user: UserWithMeta = {
                ...json.data,
                roleMeta: role,
            };
            onCreated(user);
        } catch {
            setErr("Сетевая ошибка");
        } finally {
            setLoading(false);
        }
    }

    const previewInitials = form.initials.trim().toUpperCase().slice(0, 2) || generateInitials(form.name);
    const previewRole = roles.find((r) => r.id === form.roleId);

    return (
        <div
            className="rounded-xl p-4 space-y-4"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--accent-500)" }}
        >
            {/* Preview */}
            <div className="flex items-center gap-3 pb-3 border-b border-[var(--glass-border)]">
                {previewRole && (
                    <AvatarCircle initials={previewInitials || "?"} hex={previewRole.hex} size={40} />
                )}
                <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                        {form.name.trim() || "Имя пользователя"}
                    </p>
                    <p className="text-xs font-mono text-(--text-muted)">
                        @{form.login.trim() || "login"}
                    </p>
                </div>
            </div>

            {err && (
                <p className="text-xs text-red-400 px-1">{err}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
                <Field
                    label="Полное имя"
                    value={form.name}
                    onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                    placeholder="Иван Иванов"
                />
                <Field
                    label="Логин"
                    value={form.login}
                    onChange={(v) => setForm((f) => ({ ...f, login: v }))}
                    placeholder="i.ivanov"
                    mono
                />
                <div>
                    <label className="text-xs text-(--text-muted) block mb-1">Роль</label>
                    <select
                        value={form.roleId}
                        onChange={(e) => setForm((f) => ({ ...f, roleId: Number(e.target.value) }))}
                        className="w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-500)] transition-colors"
                    >
                        {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                    </select>
                </div>
                <Field
                    label="Аббревиатура (авто)"
                    value={form.initials}
                    onChange={(v) => setForm((f) => ({ ...f, initials: v.toUpperCase().slice(0, 2) }))}
                    placeholder={generateInitials(form.name) || "ИИ"}
                />
            </div>

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
    label, value, onChange, placeholder, mono = false,
}: {
    label: string; value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    mono?: boolean;
}) {
    return (
        <div>
            <label className="text-xs text-(--text-muted) block mb-1">{label}</label>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`w-full bg-[var(--glass-01)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-(--text-muted) outline-none focus:border-[var(--accent-500)] transition-colors ${mono ? "font-mono" : ""}`}
            />
        </div>
    );
}

// ─── UsersTab ─────────────────────────────────────────────────────────────────

export function UsersTab({ initialUsers, roles }: Props) {
    const [localUsers, setLocalUsers] = useState<UserWithMeta[]>(initialUsers);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUpdate = useCallback(
        async (user: UserWithMeta, patch: { name?: string; login?: string; roleId?: number }) => {
            const snapshot = localUsers;

            const newRoleMeta = patch.roleId
                ? (roles.find((r) => r.id === patch.roleId) ?? user.roleMeta)
                : user.roleMeta;

            const optimistic: UserWithMeta = {
                ...user,
                ...patch,
                initials: patch.name ? generateInitials(patch.name) : user.initials,
                roleMeta: newRoleMeta,
            };

            setLocalUsers((prev) => prev.map((u) => (u.id === user.id ? optimistic : u)));

            try {
                const res = await fetch(`/api/users/${user.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(patch),
                });
                const json = await res.json();
                if (!res.ok) {
                    setLocalUsers(snapshot);
                    setError(json.error ?? "Ошибка обновления");
                } else {
                    setLocalUsers((prev) =>
                        prev.map((u) =>
                            u.id === user.id ? { ...optimistic, initials: json.data.initials } : u
                        )
                    );
                }
            } catch {
                setLocalUsers(snapshot);
                setError("Сетевая ошибка");
            }
        },
        [localUsers, roles]
    );

    const handleDelete = useCallback(
        async (user: UserWithMeta) => {
            const snapshot = localUsers;
            setLocalUsers((prev) => prev.filter((u) => u.id !== user.id));

            try {
                const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
                if (!res.ok) {
                    setLocalUsers(snapshot);
                    const json = await res.json();
                    setError(json.error ?? "Ошибка удаления");
                }
            } catch {
                setLocalUsers(snapshot);
                setError("Сетевая ошибка");
            }
        },
        [localUsers]
    );

    return (
        <div className="max-w-3xl space-y-4">
            {/* Stats */}
            <div
                className="flex items-center gap-6 px-4 py-3 rounded-xl"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
            >
                <div>
                    <p className="text-xs text-(--text-muted)">Всего пользователей</p>
                    <p className="text-xl font-bold font-mono" style={{ color: "var(--accent-400)" }}>
                        {localUsers.length}
                    </p>
                </div>
                <div className="w-px h-8 bg-[var(--glass-border)]" />
                {roles.map((role) => {
                    const count = localUsers.filter((u) => u.roleId === role.id).length;
                    if (!count) return null;
                    return (
                        <div key={role.id}>
                            <p className="text-xs text-(--text-muted)">{role.label}</p>
                            <p className="text-lg font-bold font-mono" style={{ color: role.hex }}>
                                {count}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Error toast */}
            {error && (
                <div
                    className="px-4 py-3 rounded-xl text-sm flex items-center gap-3"
                    style={{
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        color: "#f87171",
                    }}
                >
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">
                        ✕
                    </button>
                </div>
            )}

            {/* User list grouped by role */}
            {roles.map((role) => {
                const group = localUsers.filter((u) => u.roleId === role.id);
                if (!group.length) return null;
                return (
                    <div key={role.id}>
                        <div className="flex items-center gap-2 mb-2">
                            <span
                                className="text-xs font-semibold px-2.5 py-0.5 rounded-full border"
                                style={hexToRoleStyles(role.hex)}
                            >
                                {role.label}
                            </span>
                            <span className="text-xs font-mono text-(--text-muted)">{group.length}</span>
                            <div className="flex-1 h-px bg-[var(--glass-border)]" />
                        </div>
                        <div className="space-y-2">
                            {group.map((user) => (
                                <UserCard
                                    key={user.id}
                                    user={user}
                                    roles={roles}
                                    onUpdate={(patch) => handleUpdate(user, patch)}
                                    onDelete={() => handleDelete(user)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Пользователи с ролями, которых нет в списке ролей */}
            {(() => {
                const orphans = localUsers.filter((u) => !roles.find((r) => r.id === u.roleId));
                if (!orphans.length) return null;
                return (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-(--text-muted)">Без роли</span>
                            <div className="flex-1 h-px bg-[var(--glass-border)]" />
                        </div>
                        <div className="space-y-2">
                            {orphans.map((user) => (
                                <UserCard
                                    key={user.id}
                                    user={user}
                                    roles={roles}
                                    onUpdate={(patch) => handleUpdate(user, patch)}
                                    onDelete={() => handleDelete(user)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Create */}
            {!creating ? (
                <button
                    onClick={() => setCreating(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all w-full"
                    style={{ border: "1px dashed var(--glass-border)", color: "var(--text-muted)" }}
                >
                    <span className="text-lg leading-none">+</span>
                    Добавить пользователя
                </button>
            ) : (
                <CreateUserForm
                    roles={roles}
                    onCreated={(user) => {
                        setLocalUsers((prev) => [...prev, user]);
                        setCreating(false);
                    }}
                    onCancel={() => setCreating(false)}
                />
            )}
        </div>
    );
}