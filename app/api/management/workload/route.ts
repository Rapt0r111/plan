import { NextResponse } from "next/server";
import { getManagementOverview } from "@/entities/management/managementRepository";
import { authErrorToResponse, requireWorkspaceAccess } from "@/shared/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const scope = await requireWorkspaceAccess();
    const overview = await getManagementOverview(new Date(), scope);
    return NextResponse.json({ ok: true, data: overview.workload });
  } catch (e) {
    const authErr = authErrorToResponse(e);
    if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: authErr.status });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
