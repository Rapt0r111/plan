import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "../shared/db/client";
import {
  accounts,
  authUsers,
  roles,
  users,
} from "../shared/db/schema";
import {
  DEFAULT_VARIABLE_PERSONNEL_PASSWORD,
  VARIABLE_PERSONNEL,
} from "../shared/db/variable-personnel";

function syntheticEmail(login: string) {
  return `${login.toLowerCase()}@local.plan`;
}

function generateBetterAuthId() {
  return randomBytes(24).toString("base64url").slice(0, 32);
}

const [variableRole] = await db
  .select({ id: roles.id })
  .from(roles)
  .where(eq(roles.key, "variable_member"))
  .limit(1);

if (!variableRole) {
  throw new Error("Role variable_member not found. Run migrations/seed roles first.");
}

const passwordHash = await hashPassword(DEFAULT_VARIABLE_PERSONNEL_PASSWORD);
const now = new Date();

const ensured: Array<{ login: string; profileId: number; authUserId: string }> = [];

for (const person of VARIABLE_PERSONNEL) {
  const [existingProfile] = await db
    .select()
    .from(users)
    .where(eq(users.login, person.login))
    .limit(1);

  const [profile] = existingProfile
    ? await db
        .update(users)
        .set({
          name: person.name,
          roleId: variableRole.id,
          initials: person.initials,
          accountStatus: "active",
        })
        .where(eq(users.id, existingProfile.id))
        .returning()
    : await db
        .insert(users)
        .values({
          name: person.name,
          login: person.login,
          roleId: variableRole.id,
          initials: person.initials,
          accountStatus: "active",
        })
        .returning();

  const [existingAuthUser] = await db
    .select()
    .from(authUsers)
    .where(eq(authUsers.login, person.login))
    .limit(1);

  const authUserId = existingAuthUser?.id ?? generateBetterAuthId();
  const email = syntheticEmail(person.login);

  if (existingAuthUser) {
    await db
      .update(authUsers)
      .set({
        name: person.name,
        email,
        profileId: profile.id,
        forcePasswordChange: true,
        banned: false,
        banReason: null,
        banExpires: null,
        updatedAt: now,
      })
      .where(eq(authUsers.id, authUserId));
  } else {
    await db.insert(authUsers).values({
      id: authUserId,
      name: person.name,
      login: person.login,
      profileId: profile.id,
      forcePasswordChange: true,
      banned: false,
      email,
      emailVerified: false,
      role: "member",
      createdAt: now,
      updatedAt: now,
    });
  }

  const [existingCredentialAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, authUserId), eq(accounts.providerId, "credential")))
    .limit(1);

  if (existingCredentialAccount) {
    await db
      .update(accounts)
      .set({
        accountId: authUserId,
        password: passwordHash,
        updatedAt: now,
      })
      .where(eq(accounts.id, existingCredentialAccount.id));
  } else {
    await db.insert(accounts).values({
      id: generateBetterAuthId(),
      accountId: authUserId,
      providerId: "credential",
      userId: authUserId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db
    .update(users)
    .set({ authUserId, accountStatus: "active" })
    .where(eq(users.id, profile.id));

  ensured.push({ login: person.login, profileId: profile.id, authUserId });
}

console.log(`Ensured ${ensured.length} variable personnel accounts.`);
console.table(ensured);
console.log(
  `Default password: ${DEFAULT_VARIABLE_PERSONNEL_PASSWORD}; force password change: enabled`,
);
