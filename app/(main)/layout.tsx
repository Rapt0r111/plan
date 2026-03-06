/**
 * @file layout.tsx — app/(main)
 *
 * THEME v4:
 *  SidebarSkeleton gradient now uses var(--sidebar-top) instead of
 *  hardcoded `from-[#0c0d1e]`. Both dark and light values defined in globals.css.
 */
import { Suspense } from "react";
import { Sidebar } from "@/widgets/sidebar/Sidebar";
import { getAllEpics } from "@/entities/epic/epicRepository";
import { getAllUsers } from "@/entities/user/userRepository";
import { getAllRoles } from "@/entities/role/roleRepository";
async function SidebarLoader() {
  const [epics, users, roles] = await Promise.all([
    getAllEpics(),
    getAllUsers(),
    getAllRoles(),   // ← добавлено
  ]);
  return (
    <>
      <Sidebar epics={epics} users={users} />
    </>
  );
}

function SidebarSkeleton() {
  return (
    <aside
      className="fixed left-0 top-0 h-screen z-20 flex flex-col overflow-hidden"
      style={{ width: "var(--sidebar-w)" }}
    >
      {/* Deep background — uses CSS var for theme support */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, var(--sidebar-top), var(--bg-base))" }}
      />
      <div className="absolute inset-y-0 right-0 w-px bg-[var(--glass-border)]" />

      <div className="relative flex flex-col h-full px-3 pt-4 gap-3 animate-pulse">
        {/* Logo placeholder */}
        <div
          className="h-14 rounded-xl mx-2 mb-2"
          style={{ background: "var(--glass-02)" }}
        />
        {/* Nav items */}
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-9 rounded-xl"
            style={{ background: "var(--glass-01)" }}
          />
        ))}
        {/* Progress block */}
        <div
          className="h-14 rounded-xl mt-1"
          style={{ background: "var(--glass-01)" }}
        />
        {/* Epic list items */}
        <div className="flex flex-col gap-1 flex-1 mt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-9 rounded-xl"
              style={{
                background: "var(--glass-01)",
                opacity: 1 - i * 0.12,
              }}
            />
          ))}
        </div>
        {/* Footer */}
        <div
          className="h-10 rounded-xl mb-2"
          style={{ background: "var(--glass-01)" }}
        />
      </div>
    </aside>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense fallback={<SidebarSkeleton />}>
        <SidebarLoader />
      </Suspense>

      <main
        className="flex-1 flex flex-col overflow-hidden"
        style={{ marginLeft: "var(--sidebar-w)" }}
      >
        {/* Top ambient glow */}
        <div className="pointer-events-none fixed top-0 left-(--sidebar-w) right-0 h-64 bg-linear-to-b from-[rgba(139,92,246,0.04)] to-transparent z-0" />
        <div className="flex-1 overflow-y-auto relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}