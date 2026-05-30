/**
 * @file layout.tsx — app/(main)
 * Updated v4: Integrates SidebarProvider and collapsible MainContent.
 */
import { Suspense } from "react";
import { Sidebar, SidebarProvider, MainContent } from "@/widgets/sidebar/Sidebar";
import { getAllEpics, getAllEpicsWithTasks } from "@/entities/epic/epicRepository";
import { getAllUsers } from "@/entities/user/userRepository";
import { OfflineHydrator } from "@/shared/store/StoreHydrator";
import { RoleHydrator } from "@/shared/store/RoleHydrator";
import { getAllRoles } from "@/entities/role/roleRepository";
import { PrefsApplicator } from "@/shared/ui/PrefsApplicator";
import { SyncOrchestrator } from "@/shared/store/SyncOrchestrator";
import { RealtimeProvider } from "@/shared/store/RealtimeProvider";
import { auth } from "@/shared/lib/auth";
import { hasLinkedProfile, requiresPasswordChange } from "@/shared/lib/auth-access";
import { filterEpicsByAccess, filterRolesByAccess, filterUsersByAccess, resolveAccessScope, summarizeEpics } from "@/shared/lib/access-scope";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function SidebarLoader() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  if (session?.user && requiresPasswordChange(session.user)) {
    return (
      <>
        <RoleHydrator roles={[]} />
        <Sidebar epics={[]} users={[]} session={session} isPasswordChangeRequired />
      </>
    );
  }

  if (session?.user && !hasLinkedProfile(session.user)) {
    return (
      <>
        <RoleHydrator roles={[]} />
        <Sidebar epics={[]} users={[]} session={session} />
      </>
    );
  }

  const scope = await resolveAccessScope(session);
  const [epics, epicsWithTasks, users, roles] = await Promise.all([
    scope.isVariableRestricted ? Promise.resolve([]) : getAllEpics(),
    scope.isVariableRestricted ? getAllEpicsWithTasks() : Promise.resolve([]),
    getAllUsers(),
    getAllRoles(),
  ]);
  const visibleEpics = scope.isVariableRestricted ? summarizeEpics(filterEpicsByAccess(epicsWithTasks, scope)) : epics;
  const visibleUsers = filterUsersByAccess(users, scope);
  const visibleRoles = filterRolesByAccess(roles, scope);
  return (
    <>
      <RoleHydrator roles={visibleRoles} />
      <Sidebar epics={visibleEpics} users={visibleUsers} session={session} isVariableRestricted={scope.isVariableRestricted} />
    </>
  );
}

function SidebarSkeleton() {
  return (
    <aside
      className="fixed left-0 top-0 h-screen z-20 flex flex-col overflow-hidden"
      style={{ width: "var(--sidebar-w)" }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, var(--sidebar-top), var(--bg-base))" }}
      />
      <div className="absolute inset-y-0 right-0 w-px bg-(--glass-border)" />
      <div className="relative flex flex-col h-full px-3 pt-4 gap-3 animate-pulse">
        <div className="h-14 rounded-xl mx-2 mb-2" style={{ background: "var(--glass-02)" }} />
        {[1, 2].map((i) => (
          <div key={i} className="h-9 rounded-xl" style={{ background: "var(--glass-01)" }} />
        ))}
        <div className="h-14 rounded-xl mt-1" style={{ background: "var(--glass-01)" }} />
        <div className="flex flex-col gap-1 flex-1 mt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 rounded-xl" style={{ background: "var(--glass-01)", opacity: 1 - i * 0.12 }} />
          ))}
        </div>
        <div className="h-10 rounded-xl mb-2" style={{ background: "var(--glass-01)" }} />
      </div>
    </aside>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <PrefsApplicator />
        <OfflineHydrator />
        <SyncOrchestrator />
        <RealtimeProvider />

        <Suspense fallback={<SidebarSkeleton />}>
          <SidebarLoader />
        </Suspense>

        <MainContent>
          {children}
        </MainContent>
      </div>
    </SidebarProvider>
  );
}
