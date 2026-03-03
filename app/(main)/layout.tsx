import { Sidebar } from "@/widgets/sidebar/Sidebar";
import { getAllEpics } from "@/entities/epic/epicRepository";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const epics = await getAllEpics();
  return (
    <div className="flex h-screen">
      <Sidebar epics={epics} />
      <div className="flex-1 ml-60 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}