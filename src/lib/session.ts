import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db";
import { instances, users, type User } from "@/db/schema";

export type OnboardedUser = User & { timezone: string };

/** The signed-in user, or redirect to the sign-in page. */
export const requireUser = cache(async (): Promise<User> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/");
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) redirect("/");
  return user;
});

/** The signed-in user with a timezone set, or redirect to onboarding. */
export async function requireOnboardedUser(): Promise<OnboardedUser> {
  const user = await requireUser();
  if (!user.timezone) redirect("/onboarding");
  return user as OnboardedUser;
}

/** The user's active instance, created on first use. */
export async function getActiveInstance(userId: string) {
  const where = and(eq(instances.userId, userId), isNull(instances.endedAt));
  const existing = await db.query.instances.findFirst({ where });
  if (existing) return existing;
  const count = (await db.select({ id: instances.id }).from(instances).where(eq(instances.userId, userId))).length;
  await db
    .insert(instances)
    .values({ userId, name: `Instance ${count + 1}` })
    .onConflictDoNothing();
  return (await db.query.instances.findFirst({ where }))!;
}
