import { notFound } from "next/navigation";
import { getEpicById } from "@/entities/epic/epicRepository";
import { Header } from "@/widgets/header/Header";
import { EpicDetailClient } from "./EpicDetailClient";
import { Suspense } from "react";
import { requireWorkspacePage } from "@/shared/lib/page-auth";
import { filterEpicsByAccess } from "@/shared/lib/access-scope";

export default async function EpicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireWorkspacePage();
  const { id } = await params;
  const rawEpic = await getEpicById(Number(id));
  const epic = rawEpic ? filterEpicsByAccess([rawEpic], scope)[0] : null;
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
      <Suspense>
        <EpicDetailClient epic={epic} />
      </Suspense>
    </div>
  );
}
