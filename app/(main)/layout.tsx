/**
 * @file layout.tsx — app/(main)
 * Fetches epics + users server-side, renders Sidebar + content area.
 * This pattern avoids any client-side waterfall for initial paint.
 */
import { Sidebar } from "@/widgets/sidebar/Sidebar";
import { getAllEpics } from "@/entities/epic/epicRepository";
import { getAllUsers } from "@/entities/user/userRepository";
import { StoreHydrator } from "@/shared/store/StoreHydrator";
import { getEpicById } from "@/entities/epic/epicRepository";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const [epics, users] = await Promise.all([getAllEpics(), getAllUsers()]);

  // Prefetch first epic for store hydration (or all if desired)
  // For now we keep it lightweight — TaskCard handles its own data
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar epics={epics} users={users} />
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