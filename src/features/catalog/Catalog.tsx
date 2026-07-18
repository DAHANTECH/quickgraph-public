import { useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, Check, Copy } from "lucide-react";
import { CompactListHeader, type SortDirection } from "../../components/CompactListHeader";
import { RepoLink } from "../../components/RepoLink";
import type { CatalogIllustration, CatalogItem, CommandPlatform, UsageSummary } from "../../domain";
import { catalogOwnerLabel, catalogRepositoryUrl } from "../../lib/catalog-origin";
import type { CatalogViewPreference } from "../../lib/preferences";

const KIND_LABELS: Record<CatalogItem["kind"], string> = {
  skill: "Skill",
  prompt: "Prompt",
  mcp: "MCP",
  app: "App",
  workflow: "Workflow",
  command: "Command",
  rule: "Regel",
};

const TONES: Record<CatalogItem["kind"], string> = {
  skill: "blue",
  prompt: "pink",
  mcp: "cyan",
  app: "green",
  workflow: "yellow",
  command: "orange",
  rule: "neutral",
};

const TYPE_LABELS: Record<CatalogItem["type"], string> = {
  skill: "Skills",
  workflow: "Workflows",
  prompt: "Prompts",
  "mcp-server": "MCP-Server",
  app: "Apps",
  context: "Kontext",
  model: "Modelle",
  rule: "Regeln",
};

interface CatalogProps {
  items: readonly CatalogItem[];
  view: CatalogViewPreference;
  onSelect: (item: CatalogItem) => void;
  quickAccessItemIds?: ReadonlySet<string>;
  onToggleQuickAccess?: (item: CatalogItem) => void;
  emptyTitle?: string;
  emptyDetail?: string;
  onResetFilters?: () => void;
  sort?: CatalogSort;
  sortDirection?: SortDirection;
  onSort?: (sort: CatalogSort) => void;
}

export type CatalogSort = "name" | "description" | "newest" | "most-used" | "category" | "length" | "owner";

export type CatalogFilter =
  | { id: "all"; kind: "all"; label: "Alle Einträge" }
  | { id: "owned"; kind: "owned"; label: "Meine Skills" }
  | { id: "third-party"; kind: "third-party"; label: "Externe Skills" }
  | { id: string; kind: "type"; label: string; type: CatalogItem["type"] }
  | { id: string; kind: "item-kind"; label: string; itemKind: CatalogItem["kind"] }
  | { id: string; kind: "group"; label: string; group: string }
  | { id: string; kind: "category"; label: string; group: string; category: string }
  | { id: string; kind: "command-category"; label: string; commandCategory: string }
  | { id: string; kind: "command-platform"; label: string; commandPlatform: CommandPlatform };

export interface CatalogFilterOption {
  filter: Exclude<CatalogFilter, { kind: "all" | "owned" | "third-party" }>;
  count: number;
}

export interface CatalogFilterOptions {
  types: CatalogFilterOption[];
  kinds: CatalogFilterOption[];
  groups: CatalogFilterOption[];
  categories: CatalogFilterOption[];
  commandCategories: CatalogFilterOption[];
  commandPlatforms: CatalogFilterOption[];
}

const KIND_FILTER_LABELS: Record<CatalogItem["kind"], string> = {
  skill: "Skills",
  command: "Commands",
  prompt: "Prompts",
  mcp: "MCP-Server",
  workflow: "Workflows",
  rule: "Regeln",
  app: "Apps",
};

const KIND_FILTER_ORDER: readonly CatalogItem["kind"][] = [
  "skill", "command", "prompt", "mcp", "workflow", "rule", "app",
];

export const ALL_CATALOG_FILTER: CatalogFilter = { id: "all", kind: "all", label: "Alle Einträge" };
export const OWNED_CATALOG_FILTER: CatalogFilter = { id: "owned", kind: "owned", label: "Meine Skills" };
export const THIRD_PARTY_CATALOG_FILTER: CatalogFilter = { id: "third-party", kind: "third-party", label: "Externe Skills" };

const BRAND_ILLUSTRATION_KINDS: readonly CatalogIllustration["kind"][] = ["official-logo", "official-icon"];

function initials(name: string): string {
  return name
    .split(/[\s-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function shouldRenderBrandAsset(illustration?: CatalogIllustration): illustration is CatalogIllustration {
  return Boolean(illustration?.src && BRAND_ILLUSTRATION_KINDS.includes(illustration.kind));
}

function ItemToken({ item }: { item: CatalogItem }) {
  const [assetFailed, setAssetFailed] = useState(false);
  const illustration = item.illustration;
  const showAsset = !assetFailed && shouldRenderBrandAsset(illustration);

  return (
    <span className="item-token" data-tone={TONES[item.kind]} aria-hidden="true">
      {showAsset ? <img
        className="item-token-image"
        src={illustration.src}
        alt=""
        onError={() => setAssetFailed(true)}
      /> : initials(item.name)}
    </span>
  );
}

export function Catalog({
  items,
  view,
  onSelect,
  quickAccessItemIds = new Set<string>(),
  onToggleQuickAccess,
  emptyTitle = "Keine Einträge gefunden",
  emptyDetail = "Filter oder Suchbegriff liefern aktuell keine Treffer.",
  onResetFilters,
  sort = "name",
  sortDirection = "asc",
  onSort = () => undefined,
}: CatalogProps) {
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);
  const copyResetTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
  }, []);

  const copyCommand = async (item: CatalogItem) => {
    if (item.kind !== "command" || !item.invoke) return;
    try {
      await navigator.clipboard.writeText(item.invoke);
      setCopiedCommandId(item.id);
      if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
      copyResetTimer.current = window.setTimeout(() => setCopiedCommandId(null), 1500);
    } catch {
      setCopiedCommandId(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <strong>{emptyTitle}</strong>
        <span>{emptyDetail}</span>
        {onResetFilters ? <div className="empty-state-actions">
          {onResetFilters ? <button type="button" onClick={onResetFilters}>Filter zurücksetzen</button> : null}
        </div> : null}
      </div>
    );
  }

  return (
    <div className={view === "grid" ? "catalog-grid" : "catalog-list compact-entry-list"} aria-label="Katalogergebnisse" data-tour="drawers">
      {view === "list" ? <CompactListHeader
        activeSort={sort}
        className="catalog-list-header"
        columns={[
          { key: "name", label: "Name" },
          { key: "description", label: "Beschreibung" },
          { key: "category", label: "Kategorie" },
          { key: "owner", label: "Owner" },
          { key: "newest", label: "Aktualisiert" },
        ]}
        direction={sortDirection}
        leadingSpacer
        onSort={onSort}
      /> : null}
      {items.map((item) => {
        const canBookmark = Boolean(onToggleQuickAccess);
        const bookmarked = quickAccessItemIds.has(item.id);
        const canCopyCommand = item.kind === "command" && Boolean(item.invoke);
        const commandCopied = copiedCommandId === item.id;
        const ownerLabel = catalogOwnerLabel(item);
        const repoUrl = catalogRepositoryUrl(item);
        return <article
          className={[
            view === "grid" ? "catalog-card" : "catalog-row compact-entry-row",
            canBookmark ? "has-bookmark-action" : "",
            canCopyCommand ? "has-command-action" : "",
            repoUrl ? "has-repo-action" : "",
          ].filter(Boolean).join(" ")}
          key={item.id}
        >
          <button
            className="catalog-item-open"
            type="button"
            aria-label={`${item.name} öffnen`}
            onClick={() => onSelect(item)}
          >
            <ItemToken item={item} />
            <span className="item-main">
              <span className="item-title-line">
                <strong>{view === "list" && canCopyCommand ? item.invoke : item.name}</strong>
                <small>{KIND_LABELS[item.kind]}</small>
              </span>
              <span className="item-description">{item.description}</span>
              <span className="item-tags">
                <span>{item.group}</span>
                <span>{item.category}</span>
              </span>
              <span className={item.owned ? "item-owner is-own" : "item-owner"}>{ownerLabel}</span>
              <span className="item-meta">
                <span>{new Date(item.updatedAt).toLocaleDateString("de-DE")}</span>
              </span>
            </span>
          </button>
          {repoUrl ? <RepoLink url={repoUrl} name={item.name} /> : null}
          {canCopyCommand ? <button
            className={commandCopied ? "catalog-command-copy success" : "catalog-command-copy"}
            type="button"
            aria-label={commandCopied ? `${item.invoke} kopiert` : `${item.invoke} kopieren`}
            title={commandCopied ? "Kopiert" : "Command kopieren"}
            onClick={() => void copyCommand(item)}
          >
            {commandCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </button> : null}
          {canBookmark ? <button
            className={bookmarked ? "catalog-quick-access active" : "catalog-quick-access"}
            type="button"
            aria-pressed={bookmarked}
            aria-label={bookmarked
              ? `${item.name} aus dem Schnellzugriff entfernen`
              : `${item.name} zum Schnellzugriff hinzufügen`}
            title={bookmarked ? "Aus Schnellzugriff entfernen" : "Zum Schnellzugriff hinzufügen"}
            onClick={() => onToggleQuickAccess?.(item)}
          >
            {bookmarked ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
          </button> : null}
        </article>;
      })}
    </div>
  );
}

export function deduplicateCatalogItems(items: readonly CatalogItem[]): CatalogItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function isOwnedCatalogItem(item: CatalogItem): boolean {
  return item.owned === true;
}

export function isOwnedSkillCatalogItem(item: CatalogItem): boolean {
  return item.type === "skill" && item.group !== "Plugins" && item.owned === true;
}

export function isThirdPartyCatalogItem(item: CatalogItem): boolean {
  return item.type === "skill" && item.group !== "Plugins" && item.owned !== true;
}

export function reconcileCatalogFilters(
  items: readonly CatalogItem[],
  current: readonly CatalogFilter[],
  nextFilter: CatalogFilter,
): CatalogFilter[] {
  if (nextFilter.kind === "all") return [];
  if (current.some((filter) => filter.id === nextFilter.id)) {
    return current.filter((filter) => filter.id !== nextFilter.id);
  }

  const candidate = [...current, nextFilter];
  if (filterCatalogItemsByFilters(items, "", candidate).length > 0) return candidate;

  // The latest explicit choice wins. Keep only older filters that remain compatible.
  return current.reduce<CatalogFilter[]>((compatible, filter) => {
    const attempt = [...compatible, filter];
    return filterCatalogItemsByFilters(items, "", attempt).length > 0 ? attempt : compatible;
  }, [nextFilter]);
}

export function getCatalogFilterOptions(items: readonly CatalogItem[]): CatalogFilterOptions {
  const typeCounts = new Map<CatalogItem["type"], number>();
  const kindCounts = new Map<CatalogItem["kind"], number>();
  const groupCounts = new Map<string, number>();
  const categoryCounts = new Map<string, { group: string; category: string; count: number }>();
  const commandCategoryCounts = new Map<string, number>();
  const commandPlatformCounts = new Map<CommandPlatform, number>();

  for (const item of items) {
    typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
    kindCounts.set(item.kind, (kindCounts.get(item.kind) ?? 0) + 1);
    addCount(groupCounts, item.group);
    if (item.group.trim() && item.category.trim()) {
      const id = `${item.group}\u0000${item.category}`;
      const entry = categoryCounts.get(id) ?? { group: item.group, category: item.category, count: 0 };
      entry.count += 1;
      categoryCounts.set(id, entry);
    }
    if (item.kind === "command" && item.commandCategory?.trim()) {
      addCount(commandCategoryCounts, item.commandCategory);
    }
    if (item.kind === "command" && item.commandPlatform) {
      commandPlatformCounts.set(item.commandPlatform, (commandPlatformCounts.get(item.commandPlatform) ?? 0) + 1);
    }
  }

  return {
    types: [...typeCounts.entries()]
      .map(([type, count]) => ({ filter: { id: `type:${type}`, kind: "type" as const, type, label: TYPE_LABELS[type] }, count }))
      .sort(compareFilterOptions),
    kinds: KIND_FILTER_ORDER
      .filter((itemKind) => (kindCounts.get(itemKind) ?? 0) > 0)
      .map((itemKind) => ({
        filter: { id: `item-kind:${itemKind}`, kind: "item-kind" as const, itemKind, label: KIND_FILTER_LABELS[itemKind] },
        count: kindCounts.get(itemKind) ?? 0,
      })),
    groups: [...groupCounts.entries()]
      .filter(([group, count]) => Boolean(group.trim()) && count > 0)
      .map(([group, count]) => ({ filter: { id: `group:${group}`, kind: "group" as const, group, label: group }, count }))
      .sort(compareFilterOptions),
    categories: [...categoryCounts.values()]
      .filter(({ count }) => count > 0)
      .map(({ group, category, count }) => ({
        filter: { id: `category:${group}\u0000${category}`, kind: "category" as const, group, category, label: `${group} / ${category}` },
        count,
      }))
      .sort(compareFilterOptions),
    commandCategories: [...commandCategoryCounts.entries()]
      .filter(([commandCategory, count]) => Boolean(commandCategory.trim()) && count > 0)
      .map(([commandCategory, count]) => ({
        filter: {
          id: `command-category:${commandCategory}`,
          kind: "command-category" as const,
          commandCategory,
          label: commandCategory,
        },
        count,
      }))
      .sort(compareFilterOptions),
    commandPlatforms: [...commandPlatformCounts.entries()]
      .filter(([, count]) => count > 0)
      .map(([commandPlatform, count]) => ({
        filter: {
          id: `command-platform:${commandPlatform}`,
          kind: "command-platform" as const,
          commandPlatform,
          label: commandPlatform,
        },
        count,
      })),
  };
}

export function isCatalogFilterAvailable(filter: CatalogFilter, items: readonly CatalogItem[]): boolean {
  return filter.kind === "all" || items.some((item) => matchesCatalogFilter(item, filter));
}

export function filterCatalogItems(
  items: readonly CatalogItem[],
  query: string,
  filter: CatalogFilter,
): CatalogItem[] {
  const needle = query.trim().toLocaleLowerCase("de");
  return items.filter((item) => matchesCatalogFilter(item, filter) && (!needle || matchesCatalogSearch(item, needle)));
}

export function filterCatalogItemsByFilters(
  items: readonly CatalogItem[],
  query: string,
  filters: readonly CatalogFilter[],
): CatalogItem[] {
  const activeFilters = filters.filter((filter) => filter.kind !== "all");
  const needle = query.trim().toLocaleLowerCase("de");

  return items.filter((item) => {
    if (needle && !matchesCatalogSearch(item, needle)) return false;
    if (activeFilters.length === 0) return true;

    const ownershipFilters = activeFilters.filter((filter) => filter.kind === "owned" || filter.kind === "third-party");
    const typeFilters = activeFilters.filter((filter) => filter.kind === "type");
    const kindFilters = activeFilters.filter((filter) => filter.kind === "item-kind");
    const groupFilters = activeFilters.filter((filter) => filter.kind === "group");
    const categoryFilters = activeFilters.filter((filter) => filter.kind === "category");
    const commandCategoryFilters = activeFilters.filter((filter) => filter.kind === "command-category");
    const commandPlatformFilters = activeFilters.filter((filter) => filter.kind === "command-platform");

    return (
      (ownershipFilters.length === 0 || ownershipFilters.some((filter) => matchesCatalogFilter(item, filter)))
      && (typeFilters.length === 0 || typeFilters.some((filter) => matchesCatalogFilter(item, filter)))
      && (kindFilters.length === 0 || kindFilters.some((filter) => matchesCatalogFilter(item, filter)))
      && (groupFilters.length === 0 || groupFilters.some((filter) => matchesCatalogFilter(item, filter)))
      && (categoryFilters.length === 0 || categoryFilters.some((filter) => matchesCatalogFilter(item, filter)))
      && (commandCategoryFilters.length === 0 || commandCategoryFilters.some((filter) => matchesCatalogFilter(item, filter)))
      && (commandPlatformFilters.length === 0 || commandPlatformFilters.some((filter) => matchesCatalogFilter(item, filter)))
    );
  });
}

export function sortCatalogItems(
  items: readonly CatalogItem[],
  sort: CatalogSort,
  usageSummary: UsageSummary | null,
  direction: SortDirection = defaultCatalogSortDirection(sort),
): CatalogItem[] {
  const usageCounts = new Map<string, number>();
  for (const entry of usageSummary?.daily ?? []) {
    if (Number.isFinite(entry.count) && entry.count > 0) {
      usageCounts.set(entry.itemId, (usageCounts.get(entry.itemId) ?? 0) + entry.count);
    }
  }

  return [...items].sort((left, right) => {
    let difference = 0;
    if (sort === "most-used") {
      difference = (usageCounts.get(left.id) ?? 0) - (usageCounts.get(right.id) ?? 0);
    }
    if (sort === "newest") {
      difference = timestamp(left) - timestamp(right);
    }
    if (sort === "category") {
      difference = left.category.localeCompare(right.category, "de")
        || left.group.localeCompare(right.group, "de");
    }
    if (sort === "description") {
      difference = left.description.localeCompare(right.description, "de");
    }
    if (sort === "length") {
      difference = itemSize(left) - itemSize(right);
    }
    if (sort === "owner") {
      difference = catalogOwnerLabel(left).localeCompare(catalogOwnerLabel(right), "de");
    }
    if (sort === "name") difference = left.name.localeCompare(right.name, "de");
    if (difference !== 0) return direction === "asc" ? difference : -difference;
    return left.name.localeCompare(right.name, "de");
  });
}

export function defaultCatalogSortDirection(sort: CatalogSort): SortDirection {
  return sort === "newest" || sort === "most-used" || sort === "length" ? "desc" : "asc";
}

function itemSize(item: CatalogItem): number {
  return item.content.length;
}

function addCount(counts: Map<string, number>, value: string): void {
  if (!value.trim()) return;
  counts.set(value, (counts.get(value) ?? 0) + 1);
}

function compareFilterOptions(left: CatalogFilterOption, right: CatalogFilterOption): number {
  return left.filter.label.localeCompare(right.filter.label, "de");
}

function matchesCatalogFilter(item: CatalogItem, filter: CatalogFilter): boolean {
  switch (filter.kind) {
    case "all": return true;
    case "owned": return isOwnedSkillCatalogItem(item);
    case "third-party": return isThirdPartyCatalogItem(item);
    case "type": return item.type === filter.type;
    case "item-kind": return item.kind === filter.itemKind;
    case "group": return item.group === filter.group;
    case "category": return item.group === filter.group && item.category === filter.category;
    case "command-category": return item.kind === "command" && item.commandCategory === filter.commandCategory;
    case "command-platform": return item.kind === "command" && item.commandPlatform === filter.commandPlatform;
  }
}

function matchesCatalogSearch(item: CatalogItem, needle: string): boolean {
  return [item.name, item.key, item.description, item.category, item.group, item.commandCategory ?? "", item.commandPlatform ?? "", ...(item.tags ?? [])]
    .join(" ")
    .toLocaleLowerCase("de")
    .includes(needle);
}

function timestamp(item: CatalogItem): number {
  return Date.parse(item.updatedAt ?? item.createdAt ?? "") || 0;
}
