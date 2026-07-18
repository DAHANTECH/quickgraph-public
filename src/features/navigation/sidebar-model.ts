import type { CatalogItem } from "../../domain";
import { DISTRIBUTION_COMPACT_CATEGORY_LABELS } from "../../data/public-catalog";
import {
  filterCatalogItemsByFilters,
  isOwnedSkillCatalogItem,
  type CatalogFilter,
  type CatalogFilterOption,
  type CatalogFilterOptions,
} from "../catalog";

/** Prädikat für Plugin-Kategorien; wird injiziert, damit dieses Modul frei von App-Shell-Abhängigkeiten bleibt. */
export type IsPluginCategory = (group: string, category: string) => boolean;

/** Trenner zwischen Gruppe und Kategorie in zusammengesetzten Schlüsseln; muss mit der App-Shell übereinstimmen. */
const CATEGORY_KEY_SEPARATOR = String.fromCharCode(0);

export interface OwnedCategoryOption {
  group: string;
  category: string;
  count: number;
}

/** Die abgeleiteten Kategoriezweige der Sidebar, die die App-Shell direkt rendert. */
export interface SidebarCategoryOptions {
  pluginCategoryOptions: CatalogFilterOption[];
  workflowCategoryOptions: CatalogFilterOption[];
  visibleSkillCategoryOptions: CatalogFilterOption[];
  visiblePromptCategoryOptions: CatalogFilterOption[];
  ownedCategoryOptions: OwnedCategoryOption[];
}

/** Aggregiert die eigenen Skills zu je einem Zweig pro Gruppe/Kategorie, alphabetisch nach Kategorie. */
export function deriveOwnedCategoryOptions(items: readonly CatalogItem[]): OwnedCategoryOption[] {
  const counts = new Map<string, OwnedCategoryOption>();
  for (const item of items.filter(isOwnedSkillCatalogItem)) {
    const key = `${item.group}${CATEGORY_KEY_SEPARATOR}${item.category}`;
    const current = counts.get(key) ?? { group: item.group, category: item.category, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  return [...counts.values()].sort((left, right) => left.category.localeCompare(right.category, "de"));
}

/** Ein zusammengeführter Kategoriezweig der eigenen Skills. */
export interface OwnedCategoryBranch {
  category: string;
  count: number;
  /** Ein Kategorie-Filter je Gruppe, in der diese Kategorie eigene Skills hat (ODER-verknüpft). */
  filters: CatalogFilter[];
}

/**
 * Führt die aggregierten eigenen Kategorien pro Kategoriename zusammen - über
 * Gruppen hinweg. So erscheint z.B. "Steuer & Finanz" als ein Zweig, auch wenn
 * die Skills teils in group="Skills" und teils in group="Eigene Skills" liegen.
 * Die zusammengeführten Filter werden von filterCatalogItemsByFilters innerhalb
 * der Kategorie-Gruppe ODER-verknüpft.
 */
export function ownedCategoryBranches(owned: readonly OwnedCategoryOption[]): OwnedCategoryBranch[] {
  const byCategory = new Map<string, OwnedCategoryBranch>();
  for (const { group, category, count } of owned) {
    const filter: CatalogFilter = {
      id: `category:${group}${CATEGORY_KEY_SEPARATOR}${category}`,
      kind: "category",
      group,
      category,
      label: category,
    };
    const existing = byCategory.get(category);
    if (existing) {
      existing.count += count;
      existing.filters.push(filter);
    } else {
      byCategory.set(category, { category, count, filters: [filter] });
    }
  }
  return [...byCategory.values()];
}

/** Leitet die sichtbaren Kategoriezweige der Sidebar aus den Filteroptionen und Items ab. */
export function deriveSidebarCategoryOptions(
  filterOptions: CatalogFilterOptions,
  items: readonly CatalogItem[],
  isPluginCategory: IsPluginCategory,
): SidebarCategoryOptions {
  const pluginCategoryOptions = filterOptions.categories.filter(
    ({ filter }) => filter.kind === "category" && isPluginCategory(filter.group, filter.category),
  );
  const skillCategoryOptions = filterOptions.categories.filter(
    ({ filter }) => filter.kind === "category" && filter.group === "Skills",
  );
  const promptCategoryOptions = filterOptions.categories.filter(
    ({ filter }) => filter.kind === "category" && filter.group === "Prompts",
  );
  const workflowCategoryOptions = filterOptions.categories.filter(
    ({ filter }) => filter.kind === "category" && filter.group === "Workflows",
  );
  const visibleSkillCategoryOptions = skillCategoryOptions.filter(
    ({ filter }) => filter.kind === "category"
      && !isPluginCategory(filter.group, filter.category)
      && !["Meine Skills", "Nicht klassifiziert"].includes(filter.category),
  );
  const visiblePromptCategoryOptions = promptCategoryOptions.filter(
    ({ filter }) => filter.kind !== "category"
      || filter.category.toLocaleLowerCase("de") !== "prompts",
  );
  return {
    pluginCategoryOptions,
    workflowCategoryOptions,
    visibleSkillCategoryOptions,
    visiblePromptCategoryOptions,
    ownedCategoryOptions: deriveOwnedCategoryOptions(items),
  };
}

/** Alle ein- und ausklappbaren Sektions-IDs der Sidebar, in der Reihenfolge, in der sie im Baum erscheinen. */
export function buildSidebarSectionIds(
  options: SidebarCategoryOptions,
  commandCategories: readonly CatalogFilterOption[],
): string[] {
  return [
    "section:find",
    "section:mine",
    "section:catalog",
    "section:system",
    "area:memory",
    "area:owned-skills",
    "area:skills",
    "area:prompts",
    "area:plugins",
    "area:apps",
    "area:commands",
    "area:rules",
    "area:mcp",
    "area:workflows",
    ...new Set([
      ...options.ownedCategoryOptions.map(({ category }) => `branch:owned-skills:${category}`),
      ...options.visibleSkillCategoryOptions.map(({ filter }) => `branch:skills:external:${filter.id}`),
      ...options.visiblePromptCategoryOptions.map(({ filter }) => `branch:prompts:${filter.id}`),
      ...options.pluginCategoryOptions.map(({ filter }) => `branch:plugins:${filter.id}`),
      ...commandCategories.map(({ filter }) => `branch:commands:${filter.id}`),
      ...options.workflowCategoryOptions.map(({ filter }) => `branch:workflows:${filter.id}`),
    ]),
  ];
}

/** Ob exakt die gegebene Filtermenge aktuell die aktive Auswahl ist. */
export function areFiltersActive(
  filters: readonly CatalogFilter[],
  selectedFilters: readonly CatalogFilter[],
): boolean {
  if (filters.length !== selectedFilters.length) return false;
  const selectedIds = new Set(selectedFilters.map((filter) => filter.id));
  return filters.every((filter) => selectedIds.has(filter.id));
}

/** Katalog-Items alphabetisch nach Name (de), ohne die Eingabe zu mutieren. */
export function sortCatalogItemsByName(items: readonly CatalogItem[]): CatalogItem[] {
  return items.slice().sort((left, right) => left.name.localeCompare(right.name, "de"));
}

/** Die Kategoriezweig-Optionen, die unter den Basisfiltern mindestens ein Item enthalten. */
export function branchOptionsWithItems(
  items: readonly CatalogItem[],
  baseFilters: readonly CatalogFilter[],
  options: readonly CatalogFilterOption[],
): CatalogFilterOption[] {
  return options.filter(
    (option) => filterCatalogItemsByFilters(items, "", [...baseFilters, option.filter]).length > 0,
  );
}

const COMPACT_EXTERNAL_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  ...DISTRIBUTION_COMPACT_CATEGORY_LABELS,
  "Agent Setup & Optimierung": "Setup",
  "Agent-Steuerung": "Steuerung",
  "Analyse & Visualisierung": "Analyse",
  "Build & Vereinfachung": "Build",
  "Code Debugging": "Debugging",
  "Conversion & Testing": "Conversion",
  "Design & UX": "Design UX",
  "E-Mail & Kommunikation": "E-Mail",
  "Entscheidung & Strategie": "Strategie",
  "Google Workspace": "Google",
  "iOS & Mobile": "iOS",
  "MCP-Entwicklung": "MCP",
  "Production & QA": "QA",
  "Steuer & Finanz": "Finanzen",
  "Video & Media": "Video",
  "WordPress & Security": "Security",
  "Workflow & Dev": "Workflow",
  "Social Media": "Social",
  "Weitere eigene Skills": "Weitere",
};

/** Verkürzt lange Kategorienamen für die kompakte Sidebar-Darstellung. */
export function compactExternalCategoryLabel(category: string): string {
  return COMPACT_EXTERNAL_CATEGORY_LABELS[category]
    ?? category.split(/\s*(?:&|\/)\s*|\s+/u)[0]
    ?? category;
}

function normalizeMemoryToolName(value: string): string {
  return value.trim().toLocaleLowerCase("de").replace(/^\//, "").replace(/\s+/g, "-");
}

/** Zählt Items, deren Key oder Name einem der gegebenen Memory-Tool-Namen entspricht. */
export function memoryToolCount(items: readonly CatalogItem[], names: readonly string[]): number {
  const candidates = new Set(names.map(normalizeMemoryToolName));
  return items.filter(
    (item) => candidates.has(normalizeMemoryToolName(item.key)) || candidates.has(normalizeMemoryToolName(item.name)),
  ).length;
}

/** Zählt, wie viele der bekannten Memory-Systeme (GBrain, Obsidian, Graphify) im Katalog vertreten sind. */
export function memorySystemCount(items: readonly CatalogItem[]): number {
  return [
    memoryToolCount(items, ["setup-gbrain", "sync-gbrain"]) > 0,
    memoryToolCount(items, ["obsidian-lessons"]) > 0,
    memoryToolCount(items, ["graphify"]) > 0,
  ].filter(Boolean).length;
}
