import { BarChart3, ChartLine, ChevronDown, ListFilter, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EntryViewToggle } from "../../components/EntryViewToggle";
import { CompactListHeader, type SortDirection } from "../../components/CompactListHeader";
import type { CatalogItem, UsageSummary } from "../../domain";
import type { CatalogViewPreference } from "../../lib/preferences";
import {
  aggregateUsage,
  availableUsagePeriods,
  filterUsageRows,
  usageColorIndex,
  usageFilters,
  usageTrendForPeriod,
  type UsageFilter,
  type UsagePeriod,
  USAGE_PERIODS,
} from "./usage";

interface UsageInsightsProps {
  summary: UsageSummary | null;
  items: readonly CatalogItem[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onSelect: (item: CatalogItem) => void;
  view: CatalogViewPreference;
  onViewChange: (view: CatalogViewPreference) => void;
}

const PERIOD_LABELS: Record<UsagePeriod, string> = {
  "30d": "30D",
  "3m": "3M",
  "6m": "6M",
  year: "Jahr",
  all: "Alle",
};

type UsageViewMode = "bars" | "line";
type UsageSort = "name" | "description" | "category" | "usage";
const ALL_FILTER: UsageFilter = { id: "all", kind: "all" };
const DEFAULT_RANKING_SIZE = 8;
const GROUP_SUMMARY_SIZE = 5;

export function UsageInsights({
  summary,
  items,
  loading,
  error,
  onRefresh,
  onSelect,
  view,
  onViewChange,
}: UsageInsightsProps) {
  const [period, setPeriod] = useState<UsagePeriod>("all");
  const [viewMode, setViewMode] = useState<UsageViewMode>("bars");
  const [filter, setFilter] = useState<UsageFilter>(ALL_FILTER);
  const [showAllRows, setShowAllRows] = useState(false);
  const [sort, setSort] = useState<UsageSort>("usage");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const availablePeriods = useMemo(
    () => availableUsagePeriods(summary?.daily ?? []),
    [summary],
  );
  const aggregation = useMemo(
    () => summary ? aggregateUsage(summary, items, period) : null,
    [items, period, summary],
  );
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const filters = useMemo(() => usageFilters(aggregation?.rows ?? []), [aggregation]);
  const filteredRows = useMemo(
    () => aggregation ? filterUsageRows(aggregation.rows, filter) : [],
    [aggregation, filter],
  );
  const sortedRows = useMemo(() => [...filteredRows].sort((left, right) => {
    let difference = 0;
    if (sort === "usage") difference = left.count - right.count;
    if (sort === "name") difference = left.name.localeCompare(right.name, "de");
    if (sort === "description") difference = left.description.localeCompare(right.description, "de");
    if (sort === "category") difference = (left.category ?? left.group ?? "").localeCompare(right.category ?? right.group ?? "", "de");
    if (difference !== 0) return sortDirection === "asc" ? difference : -difference;
    return left.name.localeCompare(right.name, "de");
  }), [filteredRows, sort, sortDirection]);
  const trend = useMemo(
    () => summary ? usageTrendForPeriod(summary.daily, period, new Set(filteredRows.map((row) => row.itemId))) : null,
    [filteredRows, period, summary],
  );
  const maximum = filteredRows.reduce((current, row) => Math.max(current, row.count), 0);
  const filteredEvents = filteredRows.reduce((total, row) => total + row.count, 0);
  const visibleRows = showAllRows ? sortedRows : sortedRows.slice(0, DEFAULT_RANKING_SIZE);
  const topFiveShare = concentrationShare(filteredRows, 5, filteredEvents);
  const topTenShare = concentrationShare(filteredRows, 10, filteredEvents);

  useEffect(() => {
    const isAvailable = filter.kind === "all" || filters.some((group) =>
      group.filter.id === filter.id || group.categories.some((category) => category.filter.id === filter.id),
    );
    if (!isAvailable) setFilter(ALL_FILTER);
  }, [filter, filters]);

  useEffect(() => setShowAllRows(false), [filter, period]);

  const updateSort = (nextSort: UsageSort) => {
    setSortDirection((current) => nextSort === sort
      ? (current === "asc" ? "desc" : "asc")
      : nextSort === "usage" ? "desc" : "asc");
    setSort(nextSort);
  };

  return (
    <section aria-labelledby="usage-title">
      <div className="catalog-heading insights-heading">
        <div>
          <p>Nutzungsdaten aus {summary?.write.persistence === "local-scanner" ? "dem lokalen Scanner" : "diesem Browser"}</p>
          <h1 id="usage-title">Most Used</h1>
        </div>
        <div className="insights-actions">
          <div className="period-control" role="group" aria-label="Nutzungszeitraum">
            {USAGE_PERIODS.map((value) => (
              <button
                className={period === value ? "active" : ""}
                disabled={!availablePeriods.has(value)}
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                aria-pressed={period === value}
              >
                {PERIOD_LABELS[value]}
              </button>
            ))}
          </div>
          <div className="usage-view-toggle view-toggle" role="group" aria-label="Diagrammtyp">
            <button
              className={viewMode === "bars" ? "active" : ""}
              type="button"
              onClick={() => setViewMode("bars")}
              aria-label="Balkendiagramm anzeigen"
              aria-pressed={viewMode === "bars"}
              title="Balkendiagramm"
            >
              <BarChart3 aria-hidden="true" />
              <span className="sr-only">Balkendiagramm</span>
            </button>
            <button
              className={viewMode === "line" ? "active" : ""}
              type="button"
              onClick={() => setViewMode("line")}
              aria-label="Liniendiagramm anzeigen"
              aria-pressed={viewMode === "line"}
              title="Liniendiagramm"
            >
              <ChartLine aria-hidden="true" />
              <span className="sr-only">Liniendiagramm</span>
            </button>
          </div>
          <EntryViewToggle view={view} onChange={onViewChange} />
          <button className="icon-button" type="button" disabled={loading} onClick={() => void onRefresh()} title="Nutzung neu laden">
            <RefreshCw className={loading ? "is-spinning" : undefined} aria-hidden="true" />
            <span className="sr-only">Nutzung neu laden</span>
          </button>
        </div>
      </div>

      {loading && summary ? <div className="usage-refresh-status" role="status">
        <RefreshCw className="is-spinning" aria-hidden="true" />
        Claude-Code- und Codex-Sessions werden neu gescannt. Die bisherigen Werte bleiben sichtbar.
      </div> : null}
      {loading && !summary ? <UsageLoading /> : null}
      {!loading && error && !summary ? <InsightsError message={error} onRefresh={onRefresh} /> : null}
      {error && summary ? <div className="dialog-error usage-inline-error" role="alert">{error}</div> : null}
      {aggregation ? (
        <>
          <div className="usage-summary-bar">
            <div className="insight-totals" aria-label="Summen im gewählten Zeitraum">
              <div><strong>{formatNumber(aggregation.totalEvents)}</strong><span>Aufrufe</span></div>
              <div><strong>{formatNumber(aggregation.distinctItems)}</strong><span>Einträge</span></div>
              <div><strong>{formatNumber(aggregation.trackedDays)}</strong><span>Tage</span></div>
              <div><strong>{topFiveShare}%</strong><span>Top 5</span></div>
              <div><strong>{topTenShare}%</strong><span>Top 10</span></div>
            </div>
            {aggregation.rows.length > 0 ? (
              <UsageFilters filters={filters} selected={filter} total={aggregation.totalEvents} onChange={setFilter} />
            ) : null}
          </div>

          {aggregation.rows.length === 0 ? (
            <div className="empty-state usage-empty">
              <BarChart3 aria-hidden="true" />
              <strong>Noch keine Nutzung in diesem Zeitraum</strong>
              <span>{summary?.write.persistence === "local-scanner"
                ? "Der lokale Scanner wertet echte Skill-Aufrufe aus den lokalen Claude-Code- und Codex-Sessionarchiven aus. Für diesen Zeitraum wurden keine Treffer gefunden."
                : "Im Browserprofil wurden für diesen Zeitraum noch keine Öffnungen, Kopier- oder Aufrufaktionen erfasst."}</span>
            </div>
          ) : (
            <div className="usage-overview-grid">
              <section className="usage-primary-panel" aria-labelledby={viewMode === "bars" ? "usage-ranking-title" : "usage-trend-title"}>
                {viewMode === "line" ? (
                  <UsageTrendChart trend={trend} total={filteredEvents} />
                ) : (
                  <>
                    <header className="usage-panel-heading">
                      <div>
                        <h2 id="usage-ranking-title">Top Skills</h2>
                        <span>{filterLabel(filter)}</span>
                      </div>
                      <span>{formatNumber(filteredEvents)} Aufrufe</span>
                    </header>
                    <div className={showAllRows ? "usage-ranking compact-entry-list expanded" : "usage-ranking compact-entry-list"} data-entry-view={view} role="list" aria-label="Meistgenutzte Einträge">
                      {view === "list" ? <CompactListHeader
                        activeSort={sort}
                        className="usage-list-header"
                        columns={[
                          { key: "name", label: "Name" },
                          { key: "description", label: "Beschreibung" },
                          { key: "category", label: "Kategorie" },
                          { key: "usage", label: "Nutzung" },
                        ]}
                        direction={sortDirection}
                        leadingSpacer
                        onSort={updateSort}
                      /> : null}
                      {visibleRows.map((row, index) => {
                        const item = itemById.get(row.itemId);
                        return (
                          <button
                            className="usage-row compact-entry-row"
                            data-usage-color={usageColorIndex(row.group)}
                            disabled={!item}
                            key={row.itemId}
                            type="button"
                            onClick={() => item && onSelect(item)}
                            role="listitem"
                          >
                            <span className="usage-rank">{index + 1}</span>
                            <span className="usage-item-copy">
                              <strong>{row.name}</strong>
                            </span>
                            <span className="usage-description">{row.description}</span>
                            <span className="usage-category">{row.category ?? row.group ?? "-"}</span>
                            <span className="usage-bar-track" aria-hidden="true">
                              <span style={{ width: `${maximum ? Math.max(3, row.count / maximum * 100) : 0}%` }} />
                            </span>
                            <strong className="usage-count">{formatNumber(row.count)}</strong>
                            <span className="usage-share">{formatShare(row.count, filteredEvents)}</span>
                          </button>
                        );
                      })}
                    </div>
                    {filteredRows.length > DEFAULT_RANKING_SIZE ? (
                      <button className="usage-show-all" type="button" onClick={() => setShowAllRows((current) => !current)}>
                        {showAllRows ? `Auf Top ${DEFAULT_RANKING_SIZE} reduzieren` : `Alle ${formatNumber(filteredRows.length)} anzeigen`}
                      </button>
                    ) : null}
                  </>
                )}
              </section>
              <aside className="usage-secondary-panels" aria-label="Ergänzende Nutzungsanalysen">
                <UsageGroupSummary filters={filters} selected={filter} onChange={setFilter} />
                {viewMode === "bars" ? <UsageTrendChart compact trend={trend} total={filteredEvents} /> : (
                  <UsageTopList rows={filteredRows.slice(0, 5)} total={filteredEvents} />
                )}
              </aside>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

function UsageFilters({
  filters,
  selected,
  total,
  onChange,
}: {
  filters: ReturnType<typeof usageFilters>;
  selected: UsageFilter;
  total: number;
  onChange: (filter: UsageFilter) => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const selectFilter = (nextFilter: UsageFilter) => {
    onChange(nextFilter);
    menuRef.current?.removeAttribute("open");
  };

  return <details className="usage-filter-menu" ref={menuRef}>
    <summary>
      <ListFilter aria-hidden="true" />
      <span>Filter</span>
      <em>{filterLabel(selected)}</em>
      <ChevronDown aria-hidden="true" />
    </summary>
    <div className="usage-filters" aria-label="Gruppen und Kategorien filtern">
      <button
        className={selected.kind === "all" ? "usage-filter-pill active" : "usage-filter-pill"}
        type="button"
        onClick={() => selectFilter(ALL_FILTER)}
        aria-pressed={selected.kind === "all"}
      >
        Alle <em>{formatNumber(total)}</em>
      </button>
      {filters.map(({ filter: group, count, categories }) => <div className="usage-filter-group" key={group.id}>
        <button
          className={selected.id === group.id ? "usage-filter-pill active" : "usage-filter-pill"}
          data-usage-color={usageColorIndex(group.group)}
          type="button"
          onClick={() => selectFilter(group)}
          aria-pressed={selected.id === group.id}
        >
          {group.group} <em>{formatNumber(count)}</em>
        </button>
        {categories.map(({ filter: category, count: categoryCount }) => (
          <button
            className={selected.id === category.id ? "usage-filter-pill usage-category-pill active" : "usage-filter-pill usage-category-pill"}
            data-usage-color={usageColorIndex(category.group)}
            key={category.id}
            type="button"
            onClick={() => selectFilter(category)}
            aria-pressed={selected.id === category.id}
          >
            {category.category} <em>{formatNumber(categoryCount)}</em>
          </button>
        ))}
      </div>)}
    </div>
  </details>;
}

function UsageGroupSummary({
  filters,
  selected,
  onChange,
}: {
  filters: ReturnType<typeof usageFilters>;
  selected: UsageFilter;
  onChange: (filter: UsageFilter) => void;
}) {
  const assignments = filters
    .flatMap((group) => [group, ...group.categories])
    .sort((left, right) => right.count - left.count)
    .slice(0, GROUP_SUMMARY_SIZE);
  const maximum = assignments[0]?.count ?? 0;
  return <section className="usage-group-summary" aria-labelledby="usage-groups-title">
    <header className="usage-panel-heading">
      <div>
        <h2 id="usage-groups-title">Häufigste Zuordnungen</h2>
        <span>Klick filtert die Rangliste</span>
      </div>
    </header>
    <div className="usage-group-list">
      {assignments.map(({ filter, count }) => <button
        className={selected.id === filter.id ? "active" : ""}
        data-usage-color={usageColorIndex(filter.group)}
        key={filter.id}
        type="button"
        onClick={() => onChange(selected.id === filter.id ? ALL_FILTER : filter)}
        aria-pressed={selected.id === filter.id}
      >
        <span>{filter.kind === "group" ? filter.group : filter.category}</span>
        <span className="usage-group-bar" aria-hidden="true"><i style={{ width: `${maximum ? count / maximum * 100 : 0}%` }} /></span>
        <strong>{formatNumber(count)}</strong>
      </button>)}
    </div>
  </section>;
}

function UsageTopList({ rows, total }: { rows: ReturnType<typeof filterUsageRows>; total: number }) {
  return <section className="usage-top-list" aria-labelledby="usage-top-list-title">
    <header className="usage-panel-heading">
      <div><h2 id="usage-top-list-title">Top 5</h2><span>Konzentration der Nutzung</span></div>
    </header>
    <ol>{rows.map((row) => <li key={row.itemId}>
      <span>{row.name}</span><strong>{formatShare(row.count, total)}</strong>
    </li>)}</ol>
  </section>;
}

function UsageTrendChart({ trend, total, compact = false }: {
  trend: ReturnType<typeof usageTrendForPeriod> | null;
  total: number;
  compact?: boolean;
}) {
  if (!trend || trend.points.length === 0) {
    return <div className="usage-trend-empty" role="status">Für diese Auswahl liegen keine Tageswerte vor.</div>;
  }

  const maximum = Math.max(...trend.points.map((point) => point.count), 1);
  const width = compact ? 360 : 720;
  const height = compact ? 108 : 168;
  const margin = { top: 20, right: 14, bottom: 28, left: 34 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const points = trend.points.map((point, index) => {
    const x = trend.points.length === 1 ? margin.left + chartWidth / 2 : margin.left + index / (trend.points.length - 1) * chartWidth;
    const y = margin.top + chartHeight - point.count / maximum * chartHeight;
    return { point, x, y };
  });
  const valueLabel = trend.points.length === 1 ? "Wert" : "Werte";
  const description = `${trend.label}: ${trend.points.length} ${valueLabel} mit insgesamt ${formatNumber(total)} Aufrufen.`;
  const pointsDescription = trend.points.map((point) => `${point.date}: ${formatNumber(point.count)}`).join(", ");
  const previous = trend.points.at(-2)?.count;
  const latest = trend.points.at(-1)?.count ?? 0;
  const delta = previous === undefined ? null : latest - previous;
  const deltaPercent = previous ? Math.round(delta! / previous * 100) : null;
  const latestIsIncomplete = isCurrentTrendBucket(trend.points.at(-1)?.date, trend.label);
  const areaPoints = `${margin.left},${margin.top + chartHeight} ${points.map(({ x, y }) => `${x},${y}`).join(" ")} ${margin.left + chartWidth},${margin.top + chartHeight}`;
  const ticks = [...new Set([0, Math.round(maximum / 2), maximum])];

  return <figure className={compact ? "usage-trend compact" : "usage-trend"}>
    <header className="usage-panel-heading">
      <div><h2 id="usage-trend-title">Trend</h2><span>{trend.label}</span></div>
      <strong className={latestIsIncomplete || delta === null ? "neutral" : delta >= 0 ? "positive" : "negative"}>
        {latestIsIncomplete
          ? `${formatNumber(latest)} aktuell`
          : delta === null
            ? "Noch kein Vergleich"
            : `${delta >= 0 ? "+" : ""}${formatNumber(delta)}${deltaPercent === null ? "" : ` · ${deltaPercent >= 0 ? "+" : ""}${deltaPercent}%`}`}
      </strong>
    </header>
    <ol className="sr-only" aria-label="Datenpunkte des Liniendiagramms">
      {trend.points.map((point) => <li key={point.date}>{point.date}: {formatNumber(point.count)}</li>)}
    </ol>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${description} ${pointsDescription}.`}>
      {ticks.map((tick) => {
        const y = margin.top + chartHeight - tick / maximum * chartHeight;
        return <g className="usage-trend-grid" key={tick}>
          <line x1={margin.left} y1={y} x2={margin.left + chartWidth} y2={y} />
          <text x={margin.left - 7} y={y + 3}>{formatNumber(tick)}</text>
        </g>;
      })}
      <polygon className="usage-trend-area" points={areaPoints} />
      <polyline className="usage-trend-line" points={points.map(({ x, y }) => `${x},${y}`).join(" ")} />
      {points.map(({ point, x, y }, index) => <g className="usage-trend-point" key={point.date}>
        <circle className="usage-trend-dot" cx={x} cy={y} r={compact ? 3 : 4}><title>{`${point.date}: ${formatNumber(point.count)}`}</title></circle>
        {(trend.points.length <= (compact ? 4 : 8)) ? <text className="usage-trend-value" x={x} y={Math.max(11, y - 7)}>{formatNumber(point.count)}</text> : null}
        {shouldShowTrendLabel(index, trend.points.length, compact) ? (
          <text
            className={`usage-trend-label${index === 0 ? " first" : index === trend.points.length - 1 ? " last" : ""}`}
            x={x}
            y={height - 7}
          >{formatTrendDate(point.date, trend.label)}</text>
        ) : null}
      </g>)}
    </svg>
    {!compact ? <figcaption>{description}</figcaption> : null}
  </figure>;
}

function UsageLoading() {
  return <div className="usage-ranking" aria-busy="true" aria-label="Nutzung wird geladen">
    {Array.from({ length: 5 }, (_, index) => <div className="usage-row compact-entry-row usage-row-skeleton" key={index} />)}
  </div>;
}

function InsightsError({ message, onRefresh }: { message: string; onRefresh: () => Promise<void> }) {
  return <div className="adapter-error" role="alert">
    <strong>Nutzungsdaten nicht verfügbar</strong>
    <p>{message}</p>
    <button className="secondary-button" type="button" onClick={() => void onRefresh()}>
      <RefreshCw aria-hidden="true" /> Erneut laden
    </button>
  </div>;
}

function formatNumber(value: number): string {
  return value.toLocaleString("de-DE");
}

function concentrationShare(rows: readonly { count: number }[], limit: number, total: number): number {
  if (total === 0) return 0;
  return Math.round(rows.slice(0, limit).reduce((sum, row) => sum + row.count, 0) / total * 100);
}

function formatShare(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${(value / total * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })}%`;
}

function filterLabel(filter: UsageFilter): string {
  if (filter.kind === "all") return "Alle Zuordnungen";
  return filter.kind === "group" ? filter.group : filter.category;
}

function shouldShowTrendLabel(index: number, total: number, compact: boolean): boolean {
  if (total <= (compact ? 4 : 8)) return true;
  return index === 0 || index === total - 1 || index === Math.floor((total - 1) / 2);
}

function formatTrendDate(value: string, label: "Tageswerte" | "Wochenwerte" | "Monatswerte"): string {
  const date = new Date(`${value.length === 7 ? `${value}-01` : value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  if (isCurrentTrendBucket(value, label)) {
    if (label === "Tageswerte") return "Heute";
    if (label === "Wochenwerte") return "Diese Woche";
  }
  if (value.length === 7) {
    const label = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
    const now = new Date();
    return value === now.toISOString().slice(0, 7) ? `${label} bis heute` : label;
  }
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(date);
}

function isCurrentTrendBucket(value: string | undefined, label: "Tageswerte" | "Wochenwerte" | "Monatswerte"): boolean {
  if (!value) return false;
  const now = new Date();
  if (label === "Monatswerte") return value === now.toISOString().slice(0, 7);
  if (label === "Tageswerte") return value === now.toISOString().slice(0, 10);

  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  return value === weekStart.toISOString().slice(0, 10);
}
