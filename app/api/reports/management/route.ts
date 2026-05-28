import { NextResponse } from "next/server";
import { getManagementOverview, recordReportExport } from "@/entities/management/managementRepository";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const scope = await requireWorkspaceAccess();
    const session = scope.session;
    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "csv";
    const overview = await getManagementOverview(new Date(), scope);
    await recordReportExport({
      type: "management",
      format,
      filters: Object.fromEntries(url.searchParams.entries()),
      createdByUserId: session.user.id,
    });

    if (format === "html") {
      return new NextResponse(renderHtmlReport(overview), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="taskflow-management-report.html"`,
        },
      });
    }

    return new NextResponse(renderCsvReport(overview), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="taskflow-management-report.csv"`,
      },
    });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

function renderCsvReport(overview: Awaited<ReturnType<typeof getManagementOverview>>) {
  const lines = [
    ["metric", "value"],
    ["total_tasks", overview.kpi.totalTasks],
    ["open_tasks", overview.kpi.openTasks],
    ["completed_tasks", overview.kpi.completedTasks],
    ["completion_rate", `${overview.kpi.completionRate}%`],
    ["attention_required", overview.kpi.attentionRequired],
    [],
    ["attention_task", "risk", "priority", "due_date", "epic"],
    ...overview.attentionQueue.map((item) => [
      item.title,
      item.riskLabel,
      item.priority,
      item.dueDate ?? "",
      item.epicTitle,
    ]),
    [],
    ["user", "board_open", "operative_open", "overdue", "total_open"],
    ...overview.workload.map((item) => [
      item.user.name,
      item.boardOpen,
      item.operativeOpen,
      item.overdue,
      item.totalOpen,
    ]),
  ];
  return "\uFEFF" + lines.map((line) => line.map(csvEscape).join(";")).join("\n");
}

function renderHtmlReport(overview: Awaited<ReturnType<typeof getManagementOverview>>) {
  const rows = overview.attentionQueue
    .map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.riskLabel)}</td><td>${item.priority}</td><td>${item.dueDate ?? ""}</td><td>${escapeHtml(item.epicTitle)}</td></tr>`)
    .join("");
  return `<!doctype html>
<html lang="ru"><meta charset="utf-8"><title>TaskFlow Management Report</title>
<style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#111827}table{border-collapse:collapse;width:100%;margin-top:16px}td,th{border:1px solid #d1d5db;padding:8px;text-align:left}.kpi{display:flex;gap:12px}.card{border:1px solid #d1d5db;border-radius:12px;padding:12px}</style>
<h1>TaskFlow: управленческий отчет</h1>
<p>Сформирован: ${overview.generatedAt}</p>
<div class="kpi"><div class="card">Открыто: ${overview.kpi.openTasks}</div><div class="card">Выполнено: ${overview.kpi.completionRate}%</div><div class="card">Требует внимания: ${overview.kpi.attentionRequired}</div></div>
<h2>Очередь внимания</h2>
<table><thead><tr><th>Задача</th><th>Риск</th><th>Приоритет</th><th>Срок</th><th>Эпик</th></tr></thead><tbody>${rows}</tbody></table>
</html>`;
}

function csvEscape(value: unknown) {
  const str = String(value ?? "");
  return /[;"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char] ?? char));
}
