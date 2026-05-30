import { redirect } from "next/navigation";
import { Header } from "@/widgets/header/Header";
import { getCurrentSession } from "@/shared/lib/route-auth";
import { getUserWithMetaById } from "@/entities/user/userRepository";
import { getUserPersonnelGroupKey } from "@/shared/lib/personnel-composition";
import { SecurityTab } from "../settings/SecurityTab";

export const dynamic = "force-dynamic";

type SessionProfileUser = {
  profileId?: number | null;
  login?: string | null;
  role?: string | null;
  forcePasswordChange?: boolean | null;
  name: string;
  email: string;
};

export default async function ProfilePage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");

  const authUser = session.user as SessionProfileUser;
  const profile = typeof authUser.profileId === "number"
    ? await getUserWithMetaById(authUser.profileId)
    : null;
  const isAdmin = authUser.role === "admin";
  const forcePasswordChange = authUser.forcePasswordChange === true;
  const isLinked = isAdmin || !!profile;
  const groupLabel = profile?.roleMeta.personnelGroup?.label ?? (profile ? getUserPersonnelGroupKey(profile) : "Не назначен");

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Профиль"
        subtitle={isLinked ? "Аккаунт подключен к рабочему пространству" : "Ожидает назначения администратором"}
        actions={
          <span
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border"
            style={{
              background: isLinked ? "rgba(52,211,153,0.10)" : "rgba(251,191,36,0.10)",
              borderColor: isLinked ? "rgba(52,211,153,0.30)" : "rgba(251,191,36,0.30)",
              color: isLinked ? "#34d399" : "#fbbf24",
            }}
          >
            {isLinked ? "Активен" : "Ожидает"}
          </span>
        }
      />

      <div className="p-6 space-y-6 max-w-4xl">
        {forcePasswordChange ? (
          <div
            className="rounded-2xl p-5 flex items-start gap-4"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}
          >
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(251,191,36,0.14)", color: "#fbbf24" }}>
              🔒
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Требуется сменить пароль</h2>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Администратор установил временный пароль. После входа в систему нужно сразу сменить его, и только после этого станут доступны остальные разделы.
              </p>
            </div>
          </div>
        ) : !isLinked && (
          <div
            className="rounded-2xl p-5 flex items-start gap-4"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}
          >
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(251,191,36,0.14)", color: "#fbbf24" }}>
              ⏳
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Доступ ограничен</h2>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Ваш аккаунт создан, но пока не привязан к постоянному или переменному составу. Рабочие разделы станут доступны после назначения профиля администратором.
              </p>
            </div>
          </div>
        )}

        {forcePasswordChange ? (
          <section className="grid grid-cols-1 gap-6">
            <SecurityTab />
          </section>
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6">
            <div className="space-y-4">
              <div className="rounded-2xl p-5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}>
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white"
                    style={{ background: isAdmin ? "linear-gradient(135deg, #8b5cf6, #a78bfa)" : profile?.roleMeta.hex ?? "#64748b" }}
                  >
                    {authUser.name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U"}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold truncate" style={{ color: "var(--text-primary)" }}>{authUser.name}</h2>
                    <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>@{authUser.login ?? authUser.email.split("@")[0]}</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 text-sm">
                  <InfoRow label="Роль аккаунта" value={isAdmin ? "Администратор" : "Участник"} />
                  <InfoRow label="Профиль состава" value={profile?.name ?? "Не назначен"} />
                  <InfoRow label="Состав" value={groupLabel} />
                  <InfoRow label="Должность / роль" value={profile?.roleMeta.label ?? "Назначает администратор"} />
                </div>
              </div>
            </div>

            <SecurityTab />
          </section>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl px-3 py-2" style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)" }}>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-sm font-medium text-right" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
