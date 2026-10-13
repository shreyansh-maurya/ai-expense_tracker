import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CategorySeed = { name: string; color: string; icon: string; keywords: string };

const CATEGORIES: CategorySeed[] = [
  { name: "Food & Dining", color: "#f97316", icon: "UtensilsCrossed", keywords: "swiggy, zomato, restaurant, cafe, dominos, pizza, mcdonald, starbucks, chaat, dhaba, biryani, kfc, burger, food" },
  { name: "Groceries", color: "#22c55e", icon: "ShoppingCart", keywords: "bigbasket, blinkit, zepto, dmart, instamart, grocery, kirana, reliance fresh, vegetables, fruits, supermarket" },
  { name: "Transport", color: "#3b82f6", icon: "Car", keywords: "uber, ola, rapido, metro, petrol, fuel, indian oil, parking, toll, fastag, rickshaw, cab" },
  { name: "Bills & Utilities", color: "#eab308", icon: "ReceiptText", keywords: "electricity, bescom, water bill, gas bill, broadband, airtel, jio, vodafone, wifi, recharge, mobile bill, dth, act fibernet" },
  { name: "Rent & Housing", color: "#a855f7", icon: "Home", keywords: "rent, society maintenance, maintenance, landlord, housing" },
  { name: "Shopping", color: "#ec4899", icon: "ShoppingBag", keywords: "amazon, flipkart, myntra, ajio, croma, reliance digital, meesho, decathlon, ikea, nykaa" },
  { name: "Health", color: "#ef4444", icon: "HeartPulse", keywords: "pharmacy, apollo, netmeds, 1mg, hospital, clinic, doctor, diagnostic, lab, medicine" },
  { name: "Entertainment", color: "#8b5cf6", icon: "Clapperboard", keywords: "netflix, prime video, hotstar, spotify, youtube, bookmyshow, pvr, inox, cinema, gaming, steam" },
  { name: "Education", color: "#14b8a6", icon: "GraduationCap", keywords: "udemy, coursera, tuition, school fee, course, books, exam fee, coaching" },
  { name: "Travel", color: "#06b6d4", icon: "Plane", keywords: "makemytrip, goibibo, redbus, oyo, hotel, airbnb, flight, indigo, vistara, air india, trip, vacation" },
  { name: "Personal Care", color: "#f43f5e", icon: "Scissors", keywords: "salon, spa, barber, gym, cult.fit, cultfit, fitness, skincare, cosmetics, parlour" },
  { name: "Investments", color: "#10b981", icon: "TrendingUp", keywords: "sip, mutual fund, zerodha, groww, upstox, stocks, ppf, nps, elss, deposit" },
  { name: "Gifts & Donations", color: "#d946ef", icon: "Gift", keywords: "gift, donation, temple, charity, ngo, festival, birthday" },
  { name: "Other", color: "#64748b", icon: "CircleEllipsis", keywords: "misc, miscellaneous" },
];

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rup = (r: number) => Math.round(r * 100);

async function main() {
  const demo = process.argv.includes("--demo");

  const byName = new Map<string, string>();
  for (const c of CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { name: c.name },
      update: { color: c.color, icon: c.icon, keywords: c.keywords },
      create: { ...c, isDefault: true },
    });
    byName.set(c.name, cat.id);
  }
  console.log(`Seeded ${CATEGORIES.length} categories.`);
  if (!demo) return;

  const existing = await prisma.expense.count();
  if (existing > 0) {
    console.log("Demo data skipped — expenses already exist.");
    return;
  }

  const rand = mulberry32(42);
  const ri = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T>(arr: readonly T[]): T => arr[ri(0, arr.length - 1)];
  const maybe = (p: number) => rand() < p;
  const cat = (name: string) => byName.get(name)!;

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  type Row = {
    date: Date;
    amountPaise: number;
    categoryId: string;
    paymentMethod: string;
    merchant: string;
    notes?: string;
  };
  const rows: Row[] = [];

  for (let m = 5; m >= 0; m--) {
    const monthStart = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() - m, 1));
    const y = monthStart.getUTCFullYear();
    const mo = monthStart.getUTCMonth();
    const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const maxDay = m === 0 ? todayUTC.getUTCDate() : dim;
    const day = (d: number) => new Date(Date.UTC(y, mo, Math.min(d, maxDay)));

    rows.push({ date: day(3), amountPaise: rup(22000), categoryId: cat("Rent & Housing"), paymentMethod: "NET_BANKING", merchant: "Landlord", notes: "Monthly rent" });
    rows.push({ date: day(5), amountPaise: rup(649), categoryId: cat("Entertainment"), paymentMethod: "CARD", merchant: "Netflix" });
    rows.push({ date: day(7), amountPaise: rup(119), categoryId: cat("Entertainment"), paymentMethod: "UPI", merchant: "Spotify" });
    rows.push({ date: day(10), amountPaise: rup(ri(900, 2600)), categoryId: cat("Bills & Utilities"), paymentMethod: "UPI", merchant: "BESCOM", notes: "Electricity bill" });
    rows.push({ date: day(12), amountPaise: rup(799), categoryId: cat("Bills & Utilities"), paymentMethod: "UPI", merchant: "ACT Fibernet", notes: "Broadband" });
    rows.push({ date: day(15), amountPaise: rup(pick([239, 299, 599])), categoryId: cat("Bills & Utilities"), paymentMethod: "UPI", merchant: "Jio Recharge" });

    for (let i = 0, n = ri(4, 6); i < n; i++)
      rows.push({ date: day(ri(1, 28)), amountPaise: rup(ri(450, 2600)), categoryId: cat("Groceries"), paymentMethod: pick(["CARD", "UPI"]), merchant: pick(["BigBasket", "Zepto", "Blinkit", "DMart", "Instamart"]) });
    for (let i = 0, n = ri(9, 14); i < n; i++)
      rows.push({ date: day(ri(1, 28)), amountPaise: rup(ri(120, 850)), categoryId: cat("Food & Dining"), paymentMethod: pick(["UPI", "UPI", "CARD"]), merchant: pick(["Swiggy", "Zomato", "Cafe Coffee Day", "Dominos", "Meghana Foods", "Chaayos"]) });
    for (let i = 0, n = ri(10, 16); i < n; i++)
      rows.push({ date: day(ri(1, 28)), amountPaise: rup(ri(40, 450)), categoryId: cat("Transport"), paymentMethod: pick(["UPI", "CASH", "CARD"]), merchant: pick(["Uber", "Ola", "Rapido", "Metro Card", "Indian Oil", "Fastag"]) });
    for (let i = 0, n = ri(1, 3); i < n; i++)
      rows.push({ date: day(ri(2, 27)), amountPaise: rup(ri(600, 7500)), categoryId: cat("Shopping"), paymentMethod: "CARD", merchant: pick(["Amazon", "Flipkart", "Myntra", "Croma", "Decathlon"]) });

    if (maybe(0.6)) rows.push({ date: day(ri(1, 26)), amountPaise: rup(ri(200, 1500)), categoryId: cat("Health"), paymentMethod: pick(["UPI", "CARD"]), merchant: pick(["Apollo Pharmacy", "Practo Clinic", "1mg"]) });
    if (maybe(0.5)) rows.push({ date: day(ri(1, 27)), amountPaise: rup(ri(300, 1200)), categoryId: cat("Entertainment"), paymentMethod: "UPI", merchant: pick(["BookMyShow", "PVR Cinemas"]) });
    if (maybe(0.4)) rows.push({ date: day(ri(1, 25)), amountPaise: rup(ri(300, 1500)), categoryId: cat("Personal Care"), paymentMethod: pick(["UPI", "CARD"]), merchant: pick(["Cult.fit", "Green Trends Salon"]) });
    if (maybe(0.3)) rows.push({ date: day(ri(1, 24)), amountPaise: rup(ri(449, 999)), categoryId: cat("Education"), paymentMethod: "CARD", merchant: pick(["Udemy", "Coursera"]) });
    if (maybe(0.25)) rows.push({ date: day(ri(1, 26)), amountPaise: rup(ri(200, 2000)), categoryId: cat("Gifts & Donations"), paymentMethod: pick(["UPI", "CASH"]), merchant: pick(["Temple Donation", "Gift Shop", "GiveIndia"]) });
    if (m === 4 || m === 1) rows.push({ date: day(ri(6, 18)), amountPaise: rup(ri(4500, 18000)), categoryId: cat("Travel"), paymentMethod: "CARD", merchant: pick(["MakeMyTrip", "IRCTC", "OYO Rooms"]) });
    if (maybe(0.5)) rows.push({ date: day(ri(1, 27)), amountPaise: rup(ri(1000, 5000)), categoryId: cat("Investments"), paymentMethod: "NET_BANKING", merchant: "Groww SIP", notes: "Monthly investment" });
  }

  const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const currentKey = key(todayUTC);
  const prevD = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() - 1, 1));
  const prevKey = key(prevD);

  const budgetPlan: Array<[string | null, string, number]> = [
    [null, currentKey, rup(40000)],
    ["Food & Dining", currentKey, rup(8000)],
    ["Groceries", currentKey, rup(7000)],
    ["Transport", currentKey, rup(4000)],
    ["Shopping", currentKey, rup(5000)],
    ["Entertainment", currentKey, rup(2500)],
    ["Bills & Utilities", currentKey, rup(4000)],
    [null, prevKey, rup(40000)],
    ["Food & Dining", prevKey, rup(8000)],
    ["Groceries", prevKey, rup(7000)],
    ["Transport", prevKey, rup(4000)],
  ];

  await prisma.$transaction(
    rows.map((r) =>
      prisma.expense.create({
        data: {
          amountPaise: r.amountPaise,
          date: r.date,
          categoryId: r.categoryId,
          paymentMethod: r.paymentMethod,
          merchant: r.merchant,
          merchantNorm: r.merchant.toLowerCase(),
          notes: r.notes,
          categorizedBy: "USER",
        },
      })
    )
  );

  for (const [catName, month, limitPaise] of budgetPlan) {
    const categoryId = catName ? cat(catName) : null;
    const existingBudget = await prisma.budget.findFirst({ where: { categoryId, month } });
    if (existingBudget) {
      await prisma.budget.update({ where: { id: existingBudget.id }, data: { limitPaise } });
    } else {
      await prisma.budget.create({ data: { categoryId, month, limitPaise } });
    }
  }

  console.log(`Seeded ${rows.length} demo expenses across 6 months and ${budgetPlan.length} budgets.`);

  // Phase C demo: recurring subscriptions starting today. Their first
  // occurrence is materialized the first time a page is opened.
  const recurringSeeds: Array<{
    merchant: string;
    amountPaise: number;
    categoryId: string;
    paymentMethod: string;
    notes: string;
  }> = [
    { merchant: "Netflix", amountPaise: rup(649), categoryId: cat("Entertainment"), paymentMethod: "CARD", notes: "Monthly subscription" },
    { merchant: "Spotify", amountPaise: rup(119), categoryId: cat("Entertainment"), paymentMethod: "UPI", notes: "Monthly subscription" },
  ];
  let recurringCreated = 0;
  for (const t of recurringSeeds) {
    const existingTemplate = await prisma.recurringExpense.findFirst({
      where: { merchant: t.merchant, frequency: "MONTHLY" },
    });
    if (existingTemplate) continue;
    await prisma.recurringExpense.create({
      data: {
        amountPaise: t.amountPaise,
        categoryId: t.categoryId,
        paymentMethod: t.paymentMethod,
        merchant: t.merchant,
        notes: t.notes,
        frequency: "MONTHLY",
        interval: 1,
        startDate: todayUTC,
        nextDate: todayUTC,
      },
    });
    recurringCreated++;
  }
  console.log(`Seeded ${recurringCreated} recurring templates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
