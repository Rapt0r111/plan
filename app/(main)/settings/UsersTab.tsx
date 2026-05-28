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
import { useState, useCallback, useEffect } from "react";
import type { UserWithMeta, DbRole, DbPersonnelGroup } from "@/shared/types";
import { hexToRoleStyles } from "@/shared/lib/roleStyles";
import { SelectField } from "@/shared/ui/SelectField";
import {
    filterUsersByPersonnelGroup,
    getUserPersonnelGroupKey,
} from "@/shared/lib/personnel-composition";

interface Props {
    initialUsers: UserWithMeta[];
    roles: DbRole[];
    personnelGroups: DbPersonnelGroup[];
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

function getRoleGroupKey(role: DbRole): string {
    return role.personnelGroup?.key ?? role.composition;
}

function getRoleGroupLabel(role: DbRole, groups: DbPersonnelGroup[]): string {
    return role.personnelGroup?.label
        ?? groups.find((group) => group.key === role.composition)?.label
        ?? role.composition;
}

// ─── RoleSelect ───────────────────────────────────────────────────────────────

function RoleSelect({
    value,
    roles,
    personnelGroups,
    onChange,
}: {
    value: number;
    roles: DbRole[];
    personnelGroups: DbPersonnelGroup[];
    onChange: (roleId: number) => void;
}) {
    const current = roles.find((r) => r.id === value);
    const options = roles.map((role) => ({
        value: role.id,
        label: role.label,
        description: getRoleGroupLabel(role, personnelGroups),
        color: role.hex,
    }));

    return (
        <div className="min-w-48 shrink-0">
            <SelectField
                value={value}
                onValueChange={(nextValue) => onChange(Number(nextValue))}
                options={options}
                compact
                accentColor={current?.hex}
                title={current ? `${current.label} - ${getRoleGroupLabel(current, personnelGroups)}` : "Роль"}
            />
        </div>
    );
}

function UserCard({
    user,
    roles,
    personnelGroups,
    onUpdate,
    onDelete,
}: {
    user: UserWithMeta;
    roles: DbRole[];
    personnelGroups: DbPersonnelGroup[];
    onUpdate: (patch: { name?: string; login?: string; roleId?: number }) => void;
    onDelete: () => void;
}) {
    const [editField, setEditField] = useState<"name" | "login" | null>(null);
    const [draft, setDraft] = useState("");
    const groupLabel = user.roleMeta.personnelGroup?.label
        ?? personnelGroups.find((group) => group.key === getUserPersonnelGroupKey(user))?.label
        ?? getUserPersonnelGroupKey(user);

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
                personnelGroups={personnelGroups}
                onChange={(roleId) => onUpdate({ roleId })}
            />

            <span className="text-[11px] px-2 py-1 rounded-full border text-(--text-muted) border-(--glass-border) shrink-0">
                {groupLabel}
            </span>

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

type UnlinkedAccount = {
    id: string;
    name: string;
    login: string | null;
    email: string;
    role: "admin" | "member";
    createdAt: string;
};

function UnlinkedAccountCard({
    account,
    users,
    roles,
    personnelGroups,
    onLinked,
    onCreated,
    onError,
}: {
    account: UnlinkedAccount;
    users: UserWithMeta[];
    roles: DbRole[];
    personnelGroups: DbPersonnelGroup[];
    onLinked: (user: UserWithMeta) => void;
    onCreated: (user: UserWithMeta) => void;
    onError: (message: string) => void;
}) {
    const availableProfiles = users.filter((user) => !user.authUserId);
    const firstProfileId = availableProfiles[0]?.id ?? 0;
    const initialGroup = personnelGroups.find((group) => group.key === "permanent") ?? personnelGroups[0];
    const initialRoleId = roles.find((role) => getRoleGroupKey(role) === initialGroup?.key)?.id ?? roles[0]?.id ?? 0;
    const [profileId, setProfileId] = useState(firstProfileId);
    const [selectedGroupKey, setSelectedGroupKey] = useState(initialGroup?.key ?? (roles[0] ? getRoleGroupKey(roles[0]) : "permanent"));
    const [roleId, setRoleId] = useState(initialRoleId);
    const [loading, setLoading] = useState<"link" | "create" | null>(null);
    const rolesForGroup = roles.filter((role) => getRoleGroupKey(role) === selectedGroupKey);
    const login = account.login ?? account.email.split("@")[0];

    function changeGroup(nextGroupKey: string) {
        setSelectedGroupKey(nextGroupKey);
        setRoleId(roles.find((role) => getRoleGroupKey(role) === nextGroupKey)?.id ?? 0);
    }

    async function linkExisting() {
        if (!profileId) { onError("Выберите профиль для привязки"); return; }
        setLoading("link");
        try {
            const res = await fetch(`/api/auth/unlinked-users/${account.id}/link`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ profileId }),
            });
            const json = await res.json();
            if (!res.ok || !json.data) { onError(json.error ?? "Не удалось привязать аккаунт"); return; }
            onLinked(json.data);
        } catch {
            onError("Сетевая ошибка при привязке аккаунта");
        } finally {
            setLoading(null);
        }
    }

    async function createProfile() {
        if (!roleId) { onError("Выберите роль для нового профиля"); return; }
        setLoading("create");
        try {
            const res = await fetch(`/api/auth/unlinked-users/${account.id}/create-profile`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roleId, name: account.name, login }),
            });
            const json = await res.json();
            if (!res.ok || !json.data) { onError(json.error ?? "Не удалось создать профиль"); return; }
            onCreated(json.data);
        } catch {
            onError("Сетевая ошибка при создании профиля");
        } finally {
            setLoading(null);
        }
    }

    return (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-elevated)", border: "1px solid rgba(251,191,36,0.25)" }}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{account.name}</p>
                    <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>@{login}</p>
                </div>
                <span className="px-2 py-1 rounded-full text-[10px] font-semibold border" style={{ color: account.role === "admin" ? "#a78bfa" : "#fbbf24", borderColor: "var(--glass-border)" }}>
                    {account.role === "admin" ? "admin" : "ожидает"}
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
                <SelectField
                    value={profileId || undefined}
                    onValueChange={(nextValue) => setProfileId(Number(nextValue))}
                    disabled={availableProfiles.length === 0}
                    placeholder="Выбрать существующий профиль"
                    options={availableProfiles.map((user) => ({
                        value: user.id,
                        label: user.name,
                        description: `${user.login} · ${user.roleMeta.label}`,
                        color: user.roleMeta.hex,
                    }))}
                />
                <button
                    onClick={linkExisting}
                    disabled={loading !== null || !profileId}
                    className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                    style={{ background: "var(--glass-02)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}
                >
                    {loading === "link" ? "Привязка..." : "Привязать"}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end pt-2 border-t border-[var(--glass-border)]">
                <SelectField
                    value={selectedGroupKey}
                    onValueChange={changeGroup}
                    options={personnelGroups.map((group) => ({ value: group.key, label: group.label, color: group.color }))}
                />
                <SelectField
                    value={roleId || undefined}
                    onValueChange={(nextValue) => setRoleId(Number(nextValue))}
                    disabled={rolesForGroup.length === 0}
                    placeholder="Роль"
                    options={rolesForGroup.map((role) => ({ value: role.id, label: role.label, description: role.short, color: role.hex }))}
                />
                <button
                    onClick={createProfile}
                    disabled={loading !== null || !roleId}
                    className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                    style={{ background: "var(--accent-glow)", color: "var(--accent-400)", border: "1px solid rgba(139,92,246,0.3)" }}
                >
                    {loading === "create" ? "Создание..." : "Создать профиль"}
                </button>
            </div>
        </div>
    );
}

function UnlinkedAccountsPanel({
    accounts,
    users,
    roles,
    personnelGroups,
    onLinked,
    onCreated,
    onError,
}: {
    accounts: UnlinkedAccount[];
    users: UserWithMeta[];
    roles: DbRole[];
    personnelGroups: DbPersonnelGroup[];
    onLinked: (user: UserWithMeta) => void;
    onCreated: (user: UserWithMeta) => void;
    onError: (message: string) => void;
}) {
    if (accounts.length === 0) return null;
    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border" style={{ color: "#fbbf24", borderColor: "rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.08)" }}>
                    Заявки на назначение
                </span>
                <span className="text-xs font-mono text-(--text-muted)">{accounts.length}</span>
                <div className="flex-1 h-px bg-[var(--glass-border)]" />
            </div>
            <div className="space-y-2">
                {accounts.map((account) => (
                    <UnlinkedAccountCard
                        key={account.id}
                        account={account}
                        users={users}
                        roles={roles}
                        personnelGroups={personnelGroups}
                        onLinked={onLinked}
                        onCreated={onCreated}
                        onError={onError}
                    />
                ))}
            </div>
        </section>
    );
}

function CreateUserForm({
    roles,
    personnelGroups,
    onCreated,
    onCancel,
}: {
    roles: DbRole[];
    personnelGroups: DbPersonnelGroup[];
    onCreated: (user: UserWithMeta) => void;
    onCancel: () => void;
}) {
    const initialGroup =
        personnelGroups.find((group) => group.key === "permanent") ??
        personnelGroups[0];
    const initialRoleId =
        roles.find((role) => getRoleGroupKey(role) === initialGroup?.key)?.id ??
        roles[0]?.id ??
        0;
    const [selectedGroupKey, setSelectedGroupKey] = useState(initialGroup?.key ?? (roles[0] ? getRoleGroupKey(roles[0]) : "permanent"));
    const [form, setForm] = useState({
        name: "",
        login: "",
        roleId: initialRoleId,
        initials: "",
        password: "",
    });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const rolesForGroup = roles.filter((role) => getRoleGroupKey(role) === selectedGroupKey);

    function changeGroup(nextGroupKey: string) {
        const nextRoleId = roles.find((role) => getRoleGroupKey(role) === nextGroupKey)?.id ?? 0;
        const groupLabel = personnelGroups.find((group) => group.key === nextGroupKey)?.label ?? nextGroupKey;
        setSelectedGroupKey(nextGroupKey);
        setForm((f) => ({ ...f, roleId: nextRoleId }));
        if (!nextRoleId) {
            setErr(`Сначала добавьте роль: ${groupLabel}.`);
        } else {
            setErr(null);
        }
    }

    async function submit() {
        if (!form.name.trim()) { setErr("Введите имя"); return; }
        if (!form.login.trim()) { setErr("Введите логин"); return; }
        if (!form.roleId) {
            const groupLabel = personnelGroups.find((group) => group.key === selectedGroupKey)?.label ?? selectedGroupKey;
            setErr(`Сначала добавьте роль: ${groupLabel}.`);
            return;
        }

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
                    password: form.password || undefined,
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
                    <label className="text-xs text-(--text-muted) block mb-1">Состав</label>
                    <SelectField
                        value={selectedGroupKey}
                        onValueChange={(nextValue) => changeGroup(nextValue)}
                        options={personnelGroups.map((group) => ({
                            value: group.key,
                            label: group.label,
                            color: group.color,
                        }))}
                    />
                </div>
                <div>
                    <label className="text-xs text-(--text-muted) block mb-1">Роль</label>
                    <SelectField
                        value={form.roleId}
                        onValueChange={(nextValue) => setForm((f) => ({ ...f, roleId: Number(nextValue) }))}
                        disabled={rolesForGroup.length === 0}
                        options={rolesForGroup.map((role) => ({
                            value: role.id,
                            label: role.label,
                            description: role.short,
                            color: role.hex,
                        }))}
                    />
                </div>                <Field
                    label="Временный пароль"
                    value={form.password}
                    onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                    placeholder="минимум 8 символов"
                />

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

export function UsersTab({ initialUsers, roles, personnelGroups }: Props) {
    const [localUsers, setLocalUsers] = useState<UserWithMeta[]>(initialUsers);
    const [unlinkedAccounts, setUnlinkedAccounts] = useState<UnlinkedAccount[]>([]);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [groupFilter, setGroupFilter] = useState<string | "all">("all");
    const visibleUsers =
        groupFilter === "all"
            ? localUsers
            : filterUsersByPersonnelGroup(localUsers, groupFilter);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/unlinked-users")
            .then((res) => res.ok ? res.json() : null)
            .then((json) => {
                if (!cancelled && json?.ok) setUnlinkedAccounts(json.data ?? []);
            })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, []);

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
            <UnlinkedAccountsPanel
                accounts={unlinkedAccounts}
                users={localUsers}
                roles={roles}
                personnelGroups={personnelGroups}
                onLinked={(user) => {
                    setLocalUsers((prev) => prev.map((item) => item.id === user.id ? user : item));
                    setUnlinkedAccounts((prev) => prev.filter((item) => item.id !== user.authUserId));
                }}
                onCreated={(user) => {
                    setLocalUsers((prev) => [...prev, user]);
                    setUnlinkedAccounts((prev) => prev.filter((item) => item.id !== user.authUserId));
                }}
                onError={setError}
            />

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
                    const count = visibleUsers.filter((u) => u.roleId === role.id).length;
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

            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setGroupFilter("all")}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={
                        groupFilter === "all"
                            ? { background: "var(--accent-glow)", color: "var(--accent-400)", border: "1px solid rgba(139,92,246,0.3)" }
                            : { color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }
                    }
                >
                    Все · {localUsers.length}
                </button>
                {personnelGroups.map((item) => {
                    const count = filterUsersByPersonnelGroup(localUsers, item.key).length;
                    return (
                        <button
                            key={item.key}
                            onClick={() => setGroupFilter(item.key)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={
                                groupFilter === item.key
                                    ? { background: "var(--accent-glow)", color: "var(--accent-400)", border: "1px solid rgba(139,92,246,0.3)" }
                                    : { color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }
                            }
                        >
                            {item.label} · {count}
                        </button>
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
                const group = visibleUsers.filter((u) => u.roleId === role.id);
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
                                    personnelGroups={personnelGroups}
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
                const orphans = visibleUsers.filter((u) => !roles.find((r) => r.id === u.roleId));
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
                                    personnelGroups={personnelGroups}
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
                    personnelGroups={personnelGroups}
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
