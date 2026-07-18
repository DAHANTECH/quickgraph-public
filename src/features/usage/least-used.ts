import type { CatalogItem, UsageSummary } from "../../domain";
import type { SortDirection } from "../../components/CompactListHeader";
import { usageEntriesForPeriod, type UsagePeriod } from "./usage";

export const LOW_USAGE_MAX = 2;

export type LeastUsedSort = "least" | "name" | "description" | "category";

export interface LeastUsedItem {
  item: CatalogItem;
  count: number;
}

export function leastUsedItems(
  items: readonly CatalogItem[],
  summary: UsageSummary | null,
  period: UsagePeriod,
  sort: LeastUsedSort,
  direction: SortDirection = defaultLeastUsedSortDirection(sort),
): LeastUsedItem[] {
  if (!summary) return [];

  const counts = new Map<string, number>();
  for (const entry of usageEntriesForPeriod(summary.daily, period)) {
    counts.set(entry.itemId, (counts.get(entry.itemId) ?? 0) + entry.count);
  }

  return items
    .filter((item) => item.type === "skill" || item.type === "prompt")
    .map((item) => ({ item, count: counts.get(item.id) ?? 0 }))
    .filter(({ count }) => count <= LOW_USAGE_MAX)
    .sort((left, right) => {
      let difference = 0;
      if (sort === "least") {
        difference = left.count - right.count;
      }
      if (sort === "category") {
        difference = left.item.category.localeCompare(right.item.category, "de");
      }
      if (sort === "description") difference = left.item.description.localeCompare(right.item.description, "de");
      if (sort === "name") difference = left.item.name.localeCompare(right.item.name, "de");
      if (difference !== 0) return direction === "asc" ? difference : -difference;
      return left.item.name.localeCompare(right.item.name, "de");
    });
}

export function defaultLeastUsedSortDirection(_sort: LeastUsedSort): SortDirection {
  return "asc";
}
