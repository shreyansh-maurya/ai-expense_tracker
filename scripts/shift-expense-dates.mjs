/**
 * Move every expense date by the same number of days so the newest expense lands
 * on a chosen date — by default today, which removes the future-dated rows the
 * imported dataset left behind (its latest month ran a few days ahead).
 *
 * Amounts and categories are never written; the script checksums
 * (id, amountPaise, categoryId) before and after to prove it.
 *
 *   node scripts/shift-expense-dates.mjs                  # dry run, today's date
 *   node scripts/shift-expense-dates.mjs --to=2026-12-31  # dry run, explicit date
 *   node scripts/shift-expense-dates.mjs --apply          # write the new dates
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const DAY_MS = 86_400_000;
const prisma = new PrismaClient();

const toArg = process.argv.find((arg) => arg.startsWith("--to="))?.slice("--to=".length);
const todayISO = new Date().toISOString().slice(0, 10);
const targetISO = toArg ?? todayISO;
const target = new Date(`${targetISO}T00:00:00Z`);

const iso = (date) => new Date(date).toISOString().slice(0, 10);

function checksum(rows) {
  let h = 0;
  for (const row of rows) {
    const s = `${row.id}:${row.amountPaise}:${row.categoryId}`;
    for (let i = 0; i < s.length; i += 1) {
      h = (h * 31 + s.charCodeAt(i)) % 2147483647;
    }
  }
  return h;
}

async function main() {
  if (Number.isNaN(target.getTime())) {
    throw new Error(`Invalid --to date: ${targetISO} (expected YYYY-MM-DD)`);
  }

  const rows = await prisma.expense.findMany({
    select: { id: true, date: true, amountPaise: true, categoryId: true },
  });
  if (rows.length === 0) {
    console.log("No expenses to move.");
    return;
  }

  const dates = rows.map((row) => new Date(row.date).getTime());
  const oldest = new Date(Math.min(...dates));
  const newest = new Date(Math.max(...dates));
  const deltaDays = Math.round((target.getTime() - newest.getTime()) / DAY_MS);
  const before = checksum(rows);

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        rows: rows.length,
        oldest: iso(oldest),
        newest: iso(newest),
        target: iso(target),
        deltaDays,
        newOldest: iso(new Date(oldest.getTime() + deltaDays * DAY_MS)),
        newNewest: iso(new Date(newest.getTime() + deltaDays * DAY_MS)),
        checksumBefore: before,
      },
      null,
      1
    )
  );

  if (!APPLY || deltaDays === 0) {
    if (deltaDays === 0) console.log("Newest expense is already on the target date — nothing to do.");
    await prisma.$disconnect();
    return;
  }

  const updates = rows.map((row) => ({
    id: row.id,
    date: new Date(new Date(row.date).getTime() + deltaDays * DAY_MS),
  }));

  for (let i = 0; i < updates.length; i += 200) {
    const chunk = updates.slice(i, i + 200);
    await prisma.$transaction(
      chunk.map((u) => prisma.expense.update({ where: { id: u.id }, data: { date: u.date } }))
    );
  }

  const after = await prisma.expense.findMany({
    select: { id: true, date: true, amountPaise: true, categoryId: true },
  });
  const afterDates = after.map((row) => new Date(row.date).getTime());

  console.log(
    JSON.stringify(
      {
        moved: updates.length,
        oldest: iso(new Date(Math.min(...afterDates))),
        newest: iso(new Date(Math.max(...afterDates))),
        checksumAfter: checksum(after),
        amountsAndCategoriesUnchanged: checksum(after) === before,
      },
      null,
      1
    )
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error.message ?? error);
  await prisma.$disconnect();
  process.exit(1);
});
