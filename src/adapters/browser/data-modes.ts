import type { BrowserDataMode, CatalogItem } from "../../domain";

export const BROWSER_DATA_MODES: readonly BrowserDataMode[] = [
  "quickgraph",
  "demo",
  "own",
  "virgin",
];

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
