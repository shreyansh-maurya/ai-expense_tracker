import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { ServiceError } from "@/lib/services/errors";

/**
 * The sign-in feature touches Prisma, the cookie jar and redirects, so this suite
 * swaps in an in-memory Prisma stand-in plus a fake request cookie jar. Password
 * hashing and session tokens are the real implementations; only storage is faked.
 */
const fake = vi.hoisted(() => {
  type User = { id: string; email: string; name: string | null; passwordHash: string };
  type Session = { id: string; userId: string; expiresAt: Date };
  type Row = Record<string, unknown>;
  type Call = { model: string; method: string; args: unknown };

  const state = {
    users: [] as User[],
    sessions: [] as Session[],
    categories: [] as Row[],
    expenses: [] as Row[],
    recurringExpenses: [] as Row[],
    budgets: [] as Row[],
    wishlistItems: [] as Row[],
    calls: [] as Call[],
  };

  const record = (model: string, method: string, args: unknown) => {
    state.calls.push({ model, method, args });
  };

  const moveOwnership = (rows: Row[], from: string, to: string) => {
    let count = 0;
    for (const row of rows) {
      if (row.userId === from) {
        row.userId = to;
        count += 1;
      }
    }
    return { count };
  };

  /** Models that are scoped only by `userId` for the legacy-data handover. */
  const owned = (model: string, rows: Row[]) => ({
    updateMany: async ({ where, data }: { where: { userId: string }; data: { userId: string } }) => {
      record(model, "updateMany", { where, data });
      return moveOwnership(rows, where.userId, data.userId);
    },
  });

  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) => {
        record("user", "findUnique", { where });
        return (
          state.users.find((user) =>
            where.email !== undefined ? user.email === where.email : user.id === where.id
          ) ?? null
        );
      },
      findMany: async (args: unknown) => {
        record("user", "findMany", args);
        return state.users.map((user) => ({ id: user.id, email: user.email }));
      },
      create: async ({
        data,
      }: {
        data: { email: string; name?: string | null; passwordHash: string };
      }) => {
        record("user", "create", { data });
        const user: User = {
          id: `usr_${state.users.length + 1}`,
          email: data.email,
          name: data.name ?? null,
          passwordHash: data.passwordHash,
        };
        state.users.push(user);
        return { id: user.id, email: user.email, name: user.name };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        record("user", "delete", { where });
        const index = state.users.findIndex((user) => user.id === where.id);
        if (index >= 0) state.users.splice(index, 1);
        return {};
      },
    },
    session: {
      create: async ({ data }: { data: Session }) => {
        record("session", "create", { data });
        state.sessions.push({ ...data });
        return data;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        record("session", "findUnique", { where });
        const session = state.sessions.find((row) => row.id === where.id);
        if (!session) return null;
        const user = state.users.find((row) => row.id === session.userId);
        return {
          ...session,
          user: user ? { id: user.id, email: user.email, name: user.name } : null,
        };
      },
      deleteMany: async ({ where }: { where: { id: string } }) => {
        record("session", "deleteMany", { where });
        let count = 0;
        for (let i = state.sessions.length - 1; i >= 0; i -= 1) {
          if (state.sessions[i].id === where.id) {
            state.sessions.splice(i, 1);
            count += 1;
          }
        }
        return { count };
      },
    },
    category: {
      createMany: async ({ data }: { data: Row[] }) => {
        record("category", "createMany", { data });
        state.categories.push(...data.map((row) => ({ ...row })));
        return { count: data.length };
      },
      updateMany: async ({ where, data }: { where: { userId: string }; data: { userId: string } }) => {
        record("category", "updateMany", { where, data });
        return moveOwnership(state.categories, where.userId, data.userId);
      },
    },
    expense: owned("expense", state.expenses),
    recurringExpense: owned("recurringExpense", state.recurringExpenses),
    budget: owned("budget", state.budgets),
    wishlistItem: owned("wishlistItem", state.wishlistItems),
    $transaction: async (operations: Promise<unknown>[]) => {
      record("$transaction", "run", { count: operations.length });
      return Promise.all(operations);
    },
  };

  return { prisma, state };
});

const jar = vi.hoisted(() => {
  const store = new Map<string, { value: string; options?: Record<string, unknown> }>();
  return { store };
});

vi.mock("@/lib/db", () => ({ prisma: fake.prisma }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const entry = jar.store.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      jar.store.set(name, { value, options });
    },
    delete: (name: string) => {
      jar.store.delete(name);
    },
  }),
}));

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  })
);

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

// `cache` only matters inside a React render; keep the helper callable in tests.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T) => fn };
});

import {
  LEGACY_EMAIL,
  destroySession,
  getApiUser,
  getSessionUser,
  hashPassword,
  requireUser,
  signIn,
  signUp,
  verifyPassword,
} from "@/lib/auth";

const SESSION_COOKIE = "expense_session";
const PASSWORD = "correct horse battery staple";

async function createUser(
  email: string,
  password = PASSWORD,
  extra: { id?: string; name?: string | null } = {}
) {
  const user = {
    id: extra.id ?? `usr_${fake.state.users.length + 1}`,
    email,
    name: extra.name ?? null,
    passwordHash: await hashPassword(password),
  };
  fake.state.users.push(user);
  return user;
}

function sessionCookie() {
  return jar.store.get(SESSION_COOKIE)?.value;
}

beforeEach(() => {
  for (const key of [
    "users",
    "sessions",
    "categories",
    "expenses",
    "recurringExpenses",
    "budgets",
    "wishlistItems",
    "calls",
  ] as const) {
    fake.state[key].length = 0;
  }
  jar.store.clear();
  redirectMock.mockClear();
});

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const stored = await hashPassword(PASSWORD);
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, stored)).toBe(true);
    expect(await verifyPassword("correct horse battery stapl", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("salts every hash so identical passwords do not collide", async () => {
    const first = await hashPassword(PASSWORD);
    const second = await hashPassword(PASSWORD);
    expect(first).not.toBe(second);
    expect(await verifyPassword(PASSWORD, first)).toBe(true);
    expect(await verifyPassword(PASSWORD, second)).toBe(true);
  });

  it("treats malformed stored hashes as a failed login instead of throwing", async () => {
    for (const stored of ["", "plaintext", "scrypt$onlysalt", "bcrypt$abc$def", "scrypt$$"]) {
      await expect(verifyPassword(PASSWORD, stored)).resolves.toBe(false);
    }
  });
});

describe("signIn", () => {
  it("creates a session for valid credentials and sets an http-only cookie", async () => {
    const user = await createUser("asha@test.local");

    const signedIn = await signIn({ email: "  ASHA@Test.Local ", password: PASSWORD });

    expect(signedIn).toEqual({ id: user.id, email: "asha@test.local", name: null });
    expect(fake.state.sessions).toHaveLength(1);

    const session = fake.state.sessions[0];
    expect(session.userId).toBe(user.id);
    expect(session.id).toMatch(/^[0-9a-f]{64}$/);

    const cookie = jar.store.get(SESSION_COOKIE);
    expect(cookie?.value).toBe(session.id);
    expect(cookie?.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
    });

    const expires = cookie?.options?.expires as Date;
    expect(expires).toBeInstanceOf(Date);
    const days = (expires.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  it("rejects a wrong password without creating a session or cookie", async () => {
    await createUser("asha@test.local");

    await expect(signIn({ email: "asha@test.local", password: "hunter2" })).rejects.toBeInstanceOf(
      ServiceError
    );
    await expect(
      signIn({ email: "asha@test.local", password: "hunter2" })
    ).rejects.toThrow("Email or password is incorrect");

    expect(fake.state.sessions).toHaveLength(0);
    expect(jar.store.has(SESSION_COOKIE)).toBe(false);
  });

  it("answers an unknown email with the same message so accounts cannot be enumerated", async () => {
    const known = await createUser("asha@test.local").then(() =>
      signIn({ email: "asha@test.local", password: "nope" }).catch((error: Error) => error.message)
    );
    const unknown = await signIn({ email: "nobody@test.local", password: PASSWORD }).catch(
      (error: Error) => error.message
    );

    expect(unknown).toBe("Email or password is incorrect");
    expect(unknown).toBe(known);
    expect(fake.state.sessions).toHaveLength(0);
  });

  it("issues a new token for each sign-in and keeps both sessions valid", async () => {
    await createUser("asha@test.local");

    await signIn({ email: "asha@test.local", password: PASSWORD });
    const firstToken = sessionCookie();
    await signIn({ email: "asha@test.local", password: PASSWORD });
    const secondToken = sessionCookie();

    expect(secondToken).not.toBe(firstToken);
    expect(fake.state.sessions.map((session) => session.id).sort()).toEqual(
      [firstToken, secondToken].sort()
    );
  });
});

describe("session lookup", () => {
  it("returns null when no session cookie is present", async () => {
    await createUser("asha@test.local");
    await expect(getSessionUser()).resolves.toBeNull();
    await expect(getApiUser()).resolves.toBeNull();
  });

  it("resolves the signed-in user from a valid token", async () => {
    const user = await createUser("asha@test.local", PASSWORD, { name: "Asha" });
    await signIn({ email: "asha@test.local", password: PASSWORD });

    await expect(getSessionUser()).resolves.toEqual({
      id: user.id,
      email: "asha@test.local",
      name: "Asha",
    });
    await expect(getApiUser()).resolves.toMatchObject({ id: user.id });
  });

  it("ignores tokens that are not in the database", async () => {
    jar.store.set(SESSION_COOKIE, { value: "f".repeat(64) });
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("expires old sessions and deletes the stale row", async () => {
    const user = await createUser("asha@test.local");
    const token = "a".repeat(64);
    fake.state.sessions.push({
      id: token,
      userId: user.id,
      expiresAt: new Date(Date.now() - 1000),
    });
    jar.store.set(SESSION_COOKIE, { value: token });

    await expect(getSessionUser()).resolves.toBeNull();
    expect(fake.state.sessions).toHaveLength(0);
  });

  it("redirects to /login through requireUser when signed out", async () => {
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("returns the user through requireUser when signed in", async () => {
    const user = await createUser("asha@test.local");
    await signIn({ email: "asha@test.local", password: PASSWORD });

    await expect(requireUser()).resolves.toMatchObject({ id: user.id });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("destroySession deletes the row and clears the cookie", async () => {
    await createUser("asha@test.local");
    await signIn({ email: "asha@test.local", password: PASSWORD });
    expect(fake.state.sessions).toHaveLength(1);

    await destroySession();

    expect(fake.state.sessions).toHaveLength(0);
    expect(jar.store.has(SESSION_COOKIE)).toBe(false);
    await expect(getSessionUser()).resolves.toBeNull();
  });
});

describe("signUp", () => {
  it("rejects an email that already has an account, ignoring case", async () => {
    await createUser("asha@test.local");

    await expect(
      signUp({ email: "Asha@Test.Local", password: PASSWORD })
    ).rejects.toThrow("An account with that email already exists");
    expect(fake.state.users).toHaveLength(1);
    expect(fake.state.sessions).toHaveLength(0);
  });

  it("seeds the default categories for a brand new account", async () => {
    const user = await signUp({ email: "New@Example.com", password: PASSWORD, name: " New " });

    expect(user.email).toBe("new@example.com");
    expect(fake.state.categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(fake.state.categories.every((row) => row.userId === user.id)).toBe(true);
    expect(fake.state.categories[0]).toMatchObject({ isDefault: true });
    expect(fake.state.sessions).toHaveLength(1);
  });

  it("hands the pre-accounts data to the first signup and retires the placeholder user", async () => {
    await createUser(LEGACY_EMAIL, PASSWORD, { id: "usr_legacy" });
    fake.state.expenses.push({ id: "exp_1", userId: "usr_legacy" });
    fake.state.recurringExpenses.push({ id: "rec_1", userId: "usr_legacy" });
    fake.state.budgets.push({ id: "bud_1", userId: "usr_legacy" });
    fake.state.wishlistItems.push({ id: "wsh_1", userId: "usr_legacy" });
    fake.state.categories.push({ id: "cat_1", userId: "usr_legacy" });

    const user = await signUp({ email: "asha@test.local", password: PASSWORD });

    expect(fake.state.users.map((row) => row.email)).toEqual(["asha@test.local"]);
    expect(fake.state.expenses.every((row) => row.userId === user.id)).toBe(true);
    expect(fake.state.recurringExpenses.every((row) => row.userId === user.id)).toBe(true);
    expect(fake.state.budgets.every((row) => row.userId === user.id)).toBe(true);
    expect(fake.state.wishlistItems.every((row) => row.userId === user.id)).toBe(true);
    expect(fake.state.categories.map((row) => row.userId)).toEqual([user.id]);
    // The adopted categories are the account's own set, so no starter set is added.
    expect(fake.state.categories).toHaveLength(1);
  });

  it("does not hand over legacy data once a real account exists", async () => {
    await createUser(LEGACY_EMAIL, PASSWORD, { id: "usr_legacy" });
    await createUser("first@test.local", PASSWORD, { id: "usr_first" });
    fake.state.expenses.push({ id: "exp_1", userId: "usr_legacy" });

    const user = await signUp({ email: "second@test.local", password: PASSWORD });

    expect(fake.state.expenses[0].userId).toBe("usr_legacy");
    expect(fake.state.categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(fake.state.categories.every((row) => row.userId === user.id)).toBe(true);
  });
});
