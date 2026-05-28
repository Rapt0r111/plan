import { redirect } from "next/navigation";
import { hasLinkedProfile } from "@/shared/lib/auth-access";
import { getCurrentSession } from "@/shared/lib/route-auth";
import { resolveAccessScope } from "@/shared/lib/access-scope";

export async function requireWorkspacePage() {
  const session = await getCurrentSession();
  if (!session?.user) {
    redirect("/login");
  }
  if (session?.user && !hasLinkedProfile(session.user)) {
    redirect("/profile");
  }
  return resolveAccessScope(session);
}
