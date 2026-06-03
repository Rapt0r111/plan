import { redirect } from "next/navigation";
import { getVariableSectionData } from "@/entities/variable/variableRepository";
import { canAccessVariableSection, getTomorrowKey, toDateKey } from "@/shared/lib/variable-workflows";
import { requireWorkspacePage } from "@/shared/lib/page-auth";
import { Header } from "@/widgets/header/Header";
import { VariablePageClient } from "./VariablePageClient";

export const dynamic = "force-dynamic";

type VariablePageProps = {
  searchParams?: Promise<{ date?: string | string[] }>;
};

function normalizeDate(raw: string | string[] | undefined, fallback: string): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default async function VariablePage({ searchParams }: VariablePageProps) {
  const scope = await requireWorkspacePage();
  if (!canAccessVariableSection(scope)) redirect("/today");

  const params = searchParams ? await searchParams : {};
  const todayDate = toDateKey(new Date());
  const selectedDate = normalizeDate(params.date, toDateKey(addDays(new Date(), -7)));
  const tomorrowDate = getTomorrowKey();
  const data = await getVariableSectionData({ scope, todayDate, selectedDate, tomorrowDate });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header
        title="Переменный состав"
        subtitle={`${data.variableUsers.length} человек · задачи, увал, наряды`}
        actions={
          <div className="rounded-xl px-2.5 py-1.5 text-xs font-semibold" style={{ background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8" }}>
            {scope.isAdmin ? "Режим администратора" : "Мой раздел"}
          </div>
        }
      />
      <VariablePageClient data={data} isAdmin={scope.isAdmin} currentProfileId={scope.profile?.id ?? null} />
    </div>
  );
}
