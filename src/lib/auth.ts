import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { ServiceError } from "@/lib/services/errors";

/**
 * Email + password accounts, no third-party auth service.
 *
 * Passwords are scrypt hashes with a per-user salt; sessions are random tokens
 * stored in the database and carried in an http-only cookie, so signing out (or
 * deleting a session row) invalidates them immediately. Every service call takes
 * the user id from this module — never from the client — which is what keeps one
 * account's data invisible to another.
 */

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const SESSION_COOKIE = "expense_session";
const SESSION_DAYS = 30;

/** Rows created before accounts existed are parked here, then adopted by the first signup. */
export const LEGACY_EMAIL = "legacy@local.invalid";

export type SessionUser = { id: string; email: string; name: string | null };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { id: token, userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** The signed-in user for this request, or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { id: token } });
    return null;
  }
  return session.user;
});

/** For pages and server actions: redirects to /login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** API routes can't redirect — they answer 401 instead. */
export async function getApiUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: token } });
  jar.delete(SESSION_COOKIE);
}

async function seedDefaultCategories(userId: string): Promise<void> {
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({
      userId,
      name: c.name,
      color: c.color,
      icon: c.icon,
      keywords: c.keywords,
      isDefault: true,
    })),
  });
}

/**
 * Claim the rows that existed before accounts did, so the person who set the app
 * up keeps their history. Only possible while the placeholder user is the sole
 * account; once real users exist older data stays with whoever owns it.
 */
async function adoptLegacyData(userId: string, legacyId: string): Promise<void> {
  await prisma.$transaction([
    prisma.category.updateMany({ where: { userId: legacyId }, data: { userId } }),
    prisma.expense.updateMany({ where: { userId: legacyId }, data: { userId } }),
    prisma.recurringExpense.updateMany({ where: { userId: legacyId }, data: { userId } }),
    prisma.budget.updateMany({ where: { userId: legacyId }, data: { userId } }),
    prisma.wishlistItem.updateMany({ where: { userId: legacyId }, data: { userId } }),
    prisma.user.delete({ where: { id: legacyId } }),
  ]);
}

export async function signUp(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<SessionUser> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ServiceError("An account with that email already exists");

  const priorUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const adoptable =
    priorUsers.length === 1 && priorUsers[0].email === LEGACY_EMAIL ? priorUsers[0].id : null;

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash: await hashPassword(input.password),
    },
    select: { id: true, email: true, name: true },
  });

  if (adoptable) await adoptLegacyData(user.id, adoptable);
  else await seedDefaultCategories(user.id);

  await startSession(user.id);
  return user;
}

export async function signIn(input: { email: string; password: string }): Promise<SessionUser> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  // Same message either way — never reveal whether an email is registered.
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new ServiceError("Email or password is incorrect");
  }
  await startSession(user.id);
  return { id: user.id, email: user.email, name: user.name };
}
