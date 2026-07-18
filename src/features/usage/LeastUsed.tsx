import { useEffect, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, MessageSquareText, RefreshCw, Sparkles } from "lucide-react";
import { EntryViewToggle } from "../../components/EntryViewToggle";
import { CompactListHeader, type SortDirection } from "../../components/CompactListHeader";
import type { CatalogItem, UsageSummary } from "../../domain";
import type { CatalogViewPreference } from "../../lib/preferences";
import { availableUsagePeriods, type UsagePeriod, USAGE_PERIODS } from "./usage";
import { defaultLeastUsedSortDirection, leastUsedItems, LOW_USAGE_MAX, type LeastUsedSort } from "./least-used";

interface LeastUsedProps {
  summary: UsageSummary | null;
  items: readonly CatalogItem[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onSelect: (item: CatalogItem) => void;
  view: CatalogViewPreference;
  onViewChange: (view: CatalogViewPreference) => void;
  quickAccessItemIds?: ReadonlySet<string>;
  onToggleQuickAccess?: (item: CatalogItem) => void;
}

const PERIOD_LABELS: Record<UsagePeriod, string> = {
  "30d": "30D",
  "3m": "3M",
  "6m": "6M",
  year: "Jahr",
  all: "Alle",
};

const SORT_LABELS: Record<LeastUsedSort, string> = {
  least: "Niedrigste Nutzung",
  name: "Name",
  description: "Beschreibung",
  category: "Kategorie",
};

export function LeastUsed({
  summary,
  items,
  loading,
  error,
  onRefresh,
  onSelect,
  view,
  onViewChange,
  quickAccessItemIds = new Set<string>(),
  onToggleQuickAccess,
}: LeastUsedProps) {
  const [period, setPeriod] = useState<UsagePeriod>("all");
  const [sort, setSort] = useState<LeastUsedSort>("least");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const availablePeriods = useMemo(() => availableUsagePeriods(summary?.daily ?? []), [summary]);
  useEffect(() => {
    if (!availablePeriods.has(period)) setPeriod("all");
  }, [availablePeriods, period]);
  const rows = useMemo(() => leastUsedItems(items, summary, period, sort, sortDirection), [items, period, sort, sortDirection, summary]);
  const neverUsed = rows.filter((row) => row.count === 0).length;
  const updateSort = (nextSort: LeastUsedSort) => {
    setSortDirection((current) => nextSort === sort
      ? (current === "asc" ? "desc" : "asc")
      : defaultLeastUsedSortDirection(nextSort));
    setSort(nextSort);
  };

  return <section aria-labelledby="least-used-title">
    <div className="catalog-heading insights-heading">
      <div>
        <p>Nutzungsdaten aus {summary?.write.persistence === "local-scanner" ? "dem lokalen Scanner" : "diesem Browser"}</p>
        <h1 id="least-used-title">Least Used</h1>
      </div>
      <div className="insights-actions">
        <div className="period-control" role="group" aria-label="Nutzungszeitraum">
          {USAGE_PERIODS.map((value) => <button
            className={period === value ? "active" : ""}
            disabled={!availablePeriods.has(value)}
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            aria-pressed={period === value}
          >{PERIOD_LABELS[value]}</button>)}
        </div>
        <label className="catalog-sort">
          <span className="sr-only">Wenig genutzte Einträge sortieren</span>
          <select value={sort} onChange={(event) => updateSort(event.target.value as LeastUsedSort)} aria-label="Wenig genutzte Einträge sortieren">
            {(Object.keys(SORT_LABELS) as LeastUsedSort[]).map((value) => <option key={value} value={value}>{SORT_LABELS[value]}</option>)}
          </select>
        </label>
        <EntryViewToggle view={view} onChange={onViewChange} />
        <button className="icon-button" type="button" onClick={() => void onRefresh()} title="Nutzung neu laden">
          <RefreshCw aria-hidden="true" />
          <span className="sr-only">Nutzung neu laden</span>
        </button>
      </div>
    </div>

    {loading ? <div className="usage-ranking" aria-busy="true" aria-label="Nutzung wird geladen" /> : null}
    {!loading && error ? <div className="adapter-error" role="alert"><strong>Nutzungsdaten nicht verfügbar</strong><p>{error}</p></div> : null}
    {!loading && !error && summary ? <>
      <div className="insight-totals" aria-label="Wenig genutzte Einträge">
        <div><span>Einträge</span><strong>{formatNumber(rows.length)}</strong></div>
        <div><span>Nie genutzt</span><strong>{formatNumber(neverUsed)}</strong></div>
        <div><span>Schwelle</span><strong>≤ {LOW_USAGE_MAX}</strong></div>
      </div>
      {rows.length ? <div className={`least-used-list${view === "list" ? " catalog-list compact-entry-list" : ""}`} data-entry-view={view} role="list" aria-label="Wenig genutzte Einträge">
        {view === "list" ? <CompactListHeader
          activeSort={sort}
          className="least-used-list-header"
          columns={[
            { key: "name", label: "Name" },
            { key: "description", label: "Beschreibung" },
            { key: "category", label: "Kategorie" },
            { key: "least", label: "Nutzung" },
          ]}
          direction={sortDirection}
          leadingSpacer
          onSort={updateSort}
        /> : null}
        {rows.map(({ item, count }) => view === "list" ? <LeastUsedListRow
          key={item.id}
          item={item}
          count={count}
          bookmarked={quickAccessItemIds.has(item.id)}
          onSelect={onSelect}
          onToggleQuickAccess={onToggleQuickAccess}
        /> : <LeastUsedGridRow
          key={item.id}
          item={item}
          count={count}
          bookmarked={quickAccessItemIds.has(item.id)}
          onSelect={onSelect}
          onToggleQuickAccess={onToggleQuickAccess}
        />)}
      </div> : <div className="empty-state"><strong>Keine wenig genutzten Einträge</strong><span>Im gewählten Zeitraum liegt kein Eintrag bei höchstens zwei Aufrufen.</span></div>}
    </> : null}
  </section>;
}

interface LeastUsedRowProps {
  item: CatalogItem;
  count: number;
  bookmarked: boolean;
  onSelect: (item: CatalogItem) => void;
  onToggleQuickAccess?: (item: CatalogItem) => void;
}

function LeastUsedListRow({ item, count, bookmarked, onSelect, onToggleQuickAccess }: LeastUsedRowProps) {
  const canBookmark = Boolean(onToggleQuickAccess);

  return <article className="catalog-row compact-entry-row" role="listitem">
    <button className="catalog-item-open" type="button" aria-label={`${item.name} öffnen`} onClick={() => onSelect(item)}>
      <LeastUsedItemIcon item={item} />
      <span className="item-main">
        <span className="item-title-line"><strong>{item.name}</strong></span>
        <span className="item-description">{item.description}</span>
        <span className="item-tags"><span>{item.category}</span></span>
        <span className="item-meta"><span>{usageLabel(count)}</span></span>
      </span>
    </button>
    {canBookmark ? <BookmarkButton item={item} bookmarked={bookmarked} onToggle={onToggleQuickAccess!} /> : null}
  </article>;
}

function LeastUsedGridRow({ item, count, bookmarked, onSelect, onToggleQuickAccess }: LeastUsedRowProps) {
  const canBookmark = Boolean(onToggleQuickAccess);

  return <article role="listitem" style={{ position: "relative" }}>
    <button
      className="least-used-row"
      type="button"
      onClick={() => onSelect(item)}
      style={canBookmark ? { paddingRight: "46px" } : undefined}
    >
      <span className="least-used-copy"><strong>{item.name}</strong><small>{item.group} · {item.category}</small></span>
      <span className="least-used-count">{usageLabel(count)}</span>
    </button>
    {canBookmark ? <BookmarkButton item={item} bookmarked={bookmarked} onToggle={onToggleQuickAccess!} /> : null}
  </article>;
}

function LeastUsedItemIcon({ item }: { item: CatalogItem }) {
  return <span className="item-token" data-tone={item.kind === "skill" ? "blue" : "pink"} aria-hidden="true">
    {item.kind === "skill" ? <Sparkles size={15} /> : <MessageSquareText size={15} />}
  </span>;
}

function BookmarkButton({ item, bookmarked, onToggle }: { item: CatalogItem; bookmarked: boolean; onToggle: (item: CatalogItem) => void }) {
  return <button
    className={bookmarked ? "catalog-quick-access active" : "catalog-quick-access"}
    type="button"
    aria-pressed={bookmarked}
    aria-label={bookmarked ? `${item.name} aus dem Schnellzugriff entfernen` : `${item.name} zum Schnellzugriff hinzufügen`}
    title={bookmarked ? "Aus Schnellzugriff entfernen" : "Zum Schnellzugriff hinzufügen"}
    onClick={() => onToggle(item)}
  >
    {bookmarked ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
  </button>;
}

function usageLabel(count: number): string {
  return count === 0 ? "Nie genutzt" : `${count} Aufrufe`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("de-DE");
}
