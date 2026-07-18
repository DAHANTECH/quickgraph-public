import type { CatalogItem, UsageSummary, UsageSummaryDaily } from "../../domain";

export const USAGE_PERIODS = ["30d", "3m", "6m", "year", "all"] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];

export interface RankedUsageItem {
  itemId: string;
  name: string;
  description: string;
  count: number;
  group?: string;
  category?: string;
}

export interface UsageAggregation {
  rows: RankedUsageItem[];
  totalEvents: number;
  distinctItems: number;
  trackedDays: number;
}

export type UsageFilter =
  | { id: "all"; kind: "all" }
  | { id: string; kind: "group"; group: string }
  | { id: string; kind: "category"; group: string; category: string };

export interface UsageCategoryFilter {
  filter: Extract<UsageFilter, { kind: "category" }>;
  count: number;
}

export interface UsageGroupFilter {
  filter: Extract<UsageFilter, { kind: "group" }>;
  count: number;
  categories: UsageCategoryFilter[];
}

export interface UsageTrendPoint {
  date: string;
  count: number;
}

export interface UsageTrend {
  label: "Tageswerte" | "Wochenwerte" | "Monatswerte";
  points: UsageTrendPoint[];
}

function startOfPeriod(period: UsagePeriod, now: Date): Date | null {
  if (period === "all") return null;
  if (period === "year") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const start = new Date(now);
  if (period === "30d") start.setUTCDate(start.getUTCDate() - 29);
  if (period === "3m") start.setUTCMonth(start.getUTCMonth() - 3);
  if (period === "6m") start.setUTCMonth(start.getUTCMonth() - 6);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function usageEntriesForPeriod(
  daily: readonly UsageSummaryDaily[],
  period: UsagePeriod,
  now = new Date(),
): UsageSummaryDaily[] {
  const start = startOfPeriod(period, now);
  if (!start) return [...daily];
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  return daily.filter((entry) => {
    const date = new Date(`${entry.date}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date >= start && date <= end;
  });
}

export function aggregateUsage(
  summary: UsageSummary,
  items: readonly CatalogItem[],
  period: UsagePeriod,
  now = new Date(),
): UsageAggregation {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const counts = new Map<string, number>();
  const entries = usageEntriesForPeriod(summary.daily, period, now);
  for (const entry of entries) {
    counts.set(entry.itemId, (counts.get(entry.itemId) ?? 0) + entry.count);
  }

  const rows = [...counts.entries()]
    .map(([itemId, count]) => {
      const item = itemById.get(itemId);
      return {
        itemId,
        name: item?.name ?? itemId,
        description: item?.description ?? "Nicht mehr im aktuellen Katalog",
        count,
        group: item?.group.trim() || undefined,
        category: item?.category.trim() || undefined,
      };
    })
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "de"));

  return {
    rows,
    totalEvents: rows.reduce((total, row) => total + row.count, 0),
    distinctItems: rows.length,
    trackedDays: new Set(entries.map((entry) => entry.date)).size,
  };
}

export function usageFilters(rows: readonly RankedUsageItem[]): UsageGroupFilter[] {
  const groups = new Map<string, { count: number; categories: Map<string, number> }>();

  for (const row of rows) {
    if (!row.group) continue;
    const group = groups.get(row.group) ?? { count: 0, categories: new Map<string, number>() };
    group.count += row.count;
    if (row.category) {
      group.categories.set(row.category, (group.categories.get(row.category) ?? 0) + row.count);
    }
    groups.set(row.group, group);
  }

  return [...groups.entries()]
    .map(([group, value]) => ({
      filter: { id: `group:${group}`, kind: "group" as const, group },
      count: value.count,
      categories: [...value.categories.entries()]
        .map(([category, count]) => ({
          filter: { id: `category:${group}:${category}`, kind: "category" as const, group, category },
          count,
        }))
        .sort((left, right) => right.count - left.count || left.filter.category.localeCompare(right.filter.category, "de")),
    }))
    .sort((left, right) => right.count - left.count || left.filter.group.localeCompare(right.filter.group, "de"));
}

export function filterUsageRows(
  rows: readonly RankedUsageItem[],
  filter: UsageFilter,
): RankedUsageItem[] {
  if (filter.kind === "all") return [...rows];
  if (filter.kind === "group") return rows.filter((row) => row.group === filter.group);
  return rows.filter((row) => row.group === filter.group && row.category === filter.category);
}

export function usageTrendForPeriod(
  daily: readonly UsageSummaryDaily[],
  period: UsagePeriod,
  itemIds: ReadonlySet<string>,
  now = new Date(),
): UsageTrend {
  const label = period === "30d" ? "Tageswerte" : period === "3m" ? "Wochenwerte" : "Monatswerte";
  const counts = new Map<string, number>();

  for (const entry of usageEntriesForPeriod(daily, period, now)) {
    if (!itemIds.has(entry.itemId)) continue;
    const bucket = trendBucket(entry.date, label);
    if (!bucket) continue;
    counts.set(bucket, (counts.get(bucket) ?? 0) + entry.count);
  }

  return {
    label,
    points: [...counts.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((left, right) => left.date.localeCompare(right.date)),
  };
}

export function usageColorIndex(group: string | undefined): number {
  if (!group) return 0;
  let hash = 0;
  for (const character of group) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 6;
}

export function availableUsagePeriods(
  daily: readonly UsageSummaryDaily[],
  now = new Date(),
): ReadonlySet<UsagePeriod> {
  return new Set(
    USAGE_PERIODS.filter((period) =>
      period === "all" || usageEntriesForPeriod(daily, period, now).length > 0,
    ),
  );
}

function trendBucket(date: string, label: UsageTrend["label"]): string | null {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (label === "Tageswerte") return date;
  if (label === "Monatswerte") return date.slice(0, 7);

  const weekStart = new Date(parsed);
  const offset = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - offset);
  return weekStart.toISOString().slice(0, 10);
}
