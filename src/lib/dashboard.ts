import { prisma } from "@/lib/prisma";
import type { EntryType } from "@/generated/prisma/enums";

export type DashboardPeriod = "week" | "month" | "year";

function periodBounds(period: DashboardPeriod, now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "week") {
    start.setDate(start.getDate() - 6);
  } else if (period === "month") {
    start.setMonth(start.getMonth() - 1);
  } else {
    start.setFullYear(start.getFullYear() - 1);
  }
  return { start, end };
}

function toNumber(n: { toString: () => string } | number) {
  return typeof n === "number" ? n : Number(n.toString());
}

export async function buildDashboardSummary(period: DashboardPeriod) {
  const { start, end } = periodBounds(period);

  const inRange = await prisma.financialRecord.findMany({
    where: { date: { gte: start, lte: end } },
    select: { amount: true, type: true, category: true, date: true },
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryMap = new Map<string, { income: number; expense: number }>();

  for (const r of inRange) {
    const amt = toNumber(r.amount);
    if (r.type === "INCOME") {
      totalIncome += amt;
    } else {
      totalExpense += amt;
    }
    const cur = categoryMap.get(r.category) ?? { income: 0, expense: 0 };
    if (r.type === "INCOME") cur.income += amt;
    else cur.expense += amt;
    categoryMap.set(r.category, cur);
  }

  const allRecords = await prisma.financialRecord.findMany({
    select: { amount: true, type: true },
  });
  let allTimeIncome = 0;
  let allTimeExpense = 0;
  for (const r of allRecords) {
    const amt = toNumber(r.amount);
    if (r.type === "INCOME") allTimeIncome += amt;
    else allTimeExpense += amt;
  }

  const recent = await prisma.financialRecord.findMany({
    orderBy: { date: "desc" },
    take: 8,
    select: {
      id: true,
      amount: true,
      type: true,
      category: true,
      date: true,
      notes: true,
    },
  });

  const trends = await weeklyTrends(period, start, end);

  return {
    period,
    range: { start: start.toISOString(), end: end.toISOString() },
    totals: {
      income: totalIncome,
      expenses: totalExpense,
      net: totalIncome - totalExpense,
    },
    allTime: {
      income: allTimeIncome,
      expenses: allTimeExpense,
      net: allTimeIncome - allTimeExpense,
    },
    byCategory: Object.fromEntries(
      [...categoryMap.entries()].map(([k, v]) => [k, { ...v, net: v.income - v.expense }]),
    ),
    recentActivity: recent.map((r) => ({
      id: r.id,
      date: r.date.toISOString(),
      amount: toNumber(r.amount),
      type: r.type as EntryType,
      category: r.category,
      notes: r.notes,
    })),
    trends,
  };
}

async function weeklyTrends(period: DashboardPeriod, rangeStart: Date, rangeEnd: Date) {
  const buckets: { label: string; start: Date; end: Date }[] = [];
  if (period === "week") {
    for (let i = 0; i < 7; i++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const e = new Date(d);
      e.setHours(23, 59, 59, 999);
      buckets.push({
        label: d.toISOString().slice(0, 10),
        start: d,
        end: e,
      });
    }
  } else if (period === "month") {
    for (let w = 0; w < 4; w++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + w * 7);
      const e = new Date(d);
      e.setDate(e.getDate() + 6);
      e.setHours(23, 59, 59, 999);
      buckets.push({ label: `W${w + 1}`, start: d, end: e });
    }
  } else {
    for (let m = 0; m < 12; m++) {
      const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + m, 1);
      const e = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + m + 1, 0, 23, 59, 59, 999);
      buckets.push({
        label: d.toLocaleString("en", { month: "short" }),
        start: d,
        end: e,
      });
    }
  }

  const results: { label: string; income: number; expense: number; net: number }[] = [];
  for (const b of buckets) {
    if (b.start > rangeEnd) break;
    const rows = await prisma.financialRecord.findMany({
      where: { date: { gte: b.start, lte: b.end > rangeEnd ? rangeEnd : b.end } },
      select: { amount: true, type: true },
    });
    let inc = 0;
    let exp = 0;
    for (const r of rows) {
      const amt = toNumber(r.amount);
      if (r.type === "INCOME") inc += amt;
      else exp += amt;
    }
    results.push({ label: b.label, income: inc, expense: exp, net: inc - exp });
  }
  return results;
}
