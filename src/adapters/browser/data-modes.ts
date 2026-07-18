import type { BrowserDataMode, CatalogItem } from "../../domain";
import { DISTRIBUTION_BROWSER_DATA_MODES } from "../../data/public-catalog";

export const BROWSER_DATA_MODES: readonly BrowserDataMode[] = DISTRIBUTION_BROWSER_DATA_MODES;

export function filterItemsByDataMode(
  items: readonly CatalogItem[],
  mode: BrowserDataMode,
): CatalogItem[] {
  switch (mode) {
    case "quickgraph":
      return [...items];
    case "demo":
      return items.filter((item) => item.source === "demo");
    case "own":
      return items.filter((item) => item.source === "browser-import");
    case "virgin":
      return [];
  }
}
