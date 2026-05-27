import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../shared/db/client";
import { authUsers, users } from "../shared/db/schema";
import { auth } from "../shared/lib/auth";

function syntheticEmail(login: string) {
  return `${login.toLowerCase()}@local.plan`;
}

function temporaryPassword(login: string) {
  return `Temp-${login}-${randomUUID().slice(0, 8)}!`;
}

const profiles = await db.select().from(users).orderBy(users.id);
const createdCredentials: Array<{ login: string; password: string }> = [];
const linked: Array<{ login: string; authUserId: string; mode: "existing" | "created" }> = [];
const skipped: string[] = [];

for (const profile of profiles) {
  if (profile.authUserId) {
    skipped.push(profile.login);
    continue;
  }

  const [existingAuthUser] = await db
    .select()
    .from(authUsers)
    .where(eq(authUsers.login, profile.login))
    .limit(1);

  if (existingAuthUser) {
    await db.update(users)
      .set({ authUserId: existingAuthUser.id, accountStatus: "active" })
      .where(eq(users.id, profile.id));
    await db.update(authUsers)
      .set({ profileId: profile.id, updatedAt: new Date() })
      .where(eq(authUsers.id, existingAuthUser.id));
    linked.push({ login: profile.login, authUserId: existingAuthUser.id, mode: "existing" });
    continue;
  }

  const password = temporaryPassword(profile.login);
  const result = await auth.api.signUpEmail({
    body: {
      email: syntheticEmail(profile.login),
      password,
      name: profile.name,
      login: profile.login,
    },
    asResponse: false,
  });

  const authUserId = result?.user?.id;
  if (!authUserId) {
    throw new Error(`Auth account was not created for ${profile.login}`);
  }

  await db.update(users)
    .set({ authUserId, accountStatus: "active" })
    .where(eq(users.id, profile.id));
  await db.update(authUsers)
    .set({ profileId: profile.id, updatedAt: new Date() })
    .where(eq(authUsers.id, authUserId));

  linked.push({ login: profile.login, authUserId, mode: "created" });
  createdCredentials.push({ login: profile.login, password });
}

console.log("User auth migration complete.");
console.table(linked);

if (skipped.length) {
  console.log(`Skipped already linked profiles: ${skipped.join(", ")}`);
}

if (createdCredentials.length) {
  console.log("Temporary passwords (copy now; they are not saved by this script):");
  console.table(createdCredentials);
}
