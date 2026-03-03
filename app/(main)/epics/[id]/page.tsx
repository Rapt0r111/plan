import { notFound } from "next/navigation";
import { getEpicById } from "@/entities/epic/epicRepository";
import { Header } from "@/widgets/header/Header";
import { EpicDetailClient } from "./EpicDetailClient";

export default async function EpicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const epic = await getEpicById(Number(id));
  if (!epic) notFound();

  const pct =
    epic.progress.total > 0
      ? Math.round((epic.progress.done / epic.progress.total) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full">
      <Header
        title={epic.title}
        subtitle={`${epic.progress.done}/${epic.progress.total} задач · ${pct}% выполнено`}
        actions={
          <span
            className="text-xs font-mono px-2 py-1 rounded-lg border"
            style={{
              background: `${epic.color}18`,
              color: epic.color,
              borderColor: `${epic.color}40`,
            }}
          >
            {pct}%
          </span>
        }
      />
      <EpicDetailClient epic={epic} />
    </div>
  );
}