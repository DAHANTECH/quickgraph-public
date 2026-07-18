import { ExternalLink, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EntryViewToggle } from "../../components/EntryViewToggle";
import { CompactListHeader, type SortDirection } from "../../components/CompactListHeader";
import type { QuickGraphAdapter } from "../../domain";
import type { CatalogViewPreference } from "../../lib/preferences";
import "./ModelExplorer.css";
import {
  MODEL_SETUPS,
  MODEL_SORTS,
  MODEL_USE_CASES,
  calculateUseCaseCost,
  comparisonModels,
  defaultComparisonSelection,
  findModels,
  modelProviders,
  normalizeModelCatalog,
  preferredModels,
  scoreModelFit,
  toggleComparisonSelection,
  type Model,
  type ModelCatalog,
  type ModelSort,
  type ModelUseCaseId,
} from "./models";

const MAX_VISIBLE_MODELS = 80;
const TAGS = ["all", "coding", "cheap", "long-context", "million-context", "vision", "tools", "reasoning", "structured", "free", "premium"] as const;

const SORT_LABELS: Record<ModelSort, string> = {
  name: "Name",
  description: "Beschreibung",
  score: "Empfehlung",
  cost: "Kosten",
  context: "Kontext",
  provider: "Provider",
};

const LINKOUTS = [
  ["OpenRouter Einstellungen", "https://openrouter.ai/settings"],
  ["Modelle auswählen", "https://openrouter.ai/workspaces/default/routing"],
  ["Rankings", "https://openrouter.ai/rankings"],
  ["Usage & Workspace", "https://openrouter.ai/workspaces/default"],
  ["Logs", "https://openrouter.ai/logs?tab=sessions"],
  ["API Keys", "https://openrouter.ai/keys"],
  ["Model Catalog", "https://openrouter.ai/models"],
] as const;

interface ModelExplorerProps {
  adapter: QuickGraphAdapter;
  view: CatalogViewPreference;
  onViewChange: (view: CatalogViewPreference) => void;
}

export function ModelExplorer({ adapter, view, onViewChange }: ModelExplorerProps) {
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<ModelSort>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [useCaseId, setUseCaseId] = useState<ModelUseCaseId>("codex-daily");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const catalogRequestRef = useRef(0);

  const loadCatalog = useCallback(async () => {
    const request = ++catalogRequestRef.current;
    try {
      setError(null);
      const nextCatalog = normalizeModelCatalog(await adapter.getModelCatalog());
      if (request !== catalogRequestRef.current) return;
      setCatalog(nextCatalog);
    } catch (loadError) {
      if (request !== catalogRequestRef.current) return;
      setError(loadError instanceof Error ? loadError.message : "Modelldaten sind nicht verfügbar.");
    }
  }, [adapter]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!catalog) return;
    const known = new Set(catalog.models.map((model) => model.id));
    setSelectedIds((current) => selectionInitialized
      ? new Set([...current].filter((modelId) => known.has(modelId)))
      : defaultComparisonSelection(catalog.models));
    if (!selectionInitialized) setSelectionInitialized(true);
  }, [catalog, selectionInitialized]);

  const models = catalog?.models ?? [];
  const providers = useMemo(() => modelProviders(models), [models]);
  const filtered = useMemo(() => {
    const rows = findModels(models, { query, provider, tag }, sort, useCaseId);
    return sortDirection === defaultModelSortDirection(sort) ? rows : rows.reverse();
  }, [models, provider, query, sort, sortDirection, tag, useCaseId]);
  const recommendations = useMemo(
    () => preferredModels(models, { query, provider, tag }, useCaseId),
    [models, provider, query, tag, useCaseId],
  );
  const compare = useMemo(
    () => comparisonModels(models, selectedIds, useCaseId),
    [models, selectedIds, useCaseId],
  );
  const cheapest = useMemo(
    () => [...models]
      .filter((model) => calculateUseCaseCost(model, useCaseId) !== null)
      .sort((left, right) => (calculateUseCaseCost(left, useCaseId) ?? Infinity) - (calculateUseCaseCost(right, useCaseId) ?? Infinity))[0] ?? null,
    [models, useCaseId],
  );

  const clearFilters = () => {
    setQuery("");
    setProvider("all");
    setTag("all");
  };

  const toggleSelection = (modelId: string) => {
    setSelectedIds((current) => toggleComparisonSelection(current, modelId));
  };

  const updateSort = (nextSort: ModelSort) => {
    setSortDirection((current) => nextSort === sort
      ? (current === "asc" ? "desc" : "asc")
      : defaultModelSortDirection(nextSort));
    setSort(nextSort);
  };

  const refresh = async () => {
    if (!adapter.capabilities.modelRefresh || refreshing) return;
    setRefreshing(true);
    setRefreshStatus("OpenRouter-Daten werden von der offiziellen API geladen …");
    try {
      setError(null);
      await adapter.refreshModels();
      await loadCatalog();
      setRefreshStatus("Modelldaten wurden aktualisiert.");
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "Modelldaten konnten nicht aktualisiert werden.";
      setError(message);
      setRefreshStatus(`Aktualisierung fehlgeschlagen: ${message}`);
    } finally {
      setRefreshing(false);
    }
  };

  return <section className="model-explorer" aria-labelledby="model-explorer-title">
    <header className="catalog-heading model-heading">
      <div>
        <p>OpenRouter Snapshot</p>
        <h1 id="model-explorer-title">OpenRouter</h1>
        <span className="model-subtitle">
          {catalog ? `${catalog.modelCount} Modelle · Stand ${formatTimestamp(catalog.fetchedAt)}` : "Modellkatalog wird geladen"}
        </span>
      </div>
      <div className="model-header-actions">
        <EntryViewToggle view={view} onChange={onViewChange} />
        {adapter.capabilities.modelRefresh ? <button className="secondary-button model-refresh" type="button" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw aria-hidden="true" /> {refreshing ? "Aktualisiere …" : "Modelldaten aktualisieren"}
        </button> : null}
        <nav className="model-linkouts" aria-label="OpenRouter öffnen">
          {LINKOUTS.map(([label, href]) => <a href={href} key={href} rel="noreferrer" target="_blank">
            {label}<ExternalLink aria-hidden="true" />
          </a>)}
        </nav>
      </div>
    </header>

    {error ? <div className="adapter-error" role="alert"><strong>OpenRouter-Snapshot nicht verfügbar</strong><p>{error}</p></div> : null}
    {!catalog && !error ? <div className="model-loading" aria-busy="true">OpenRouter-Daten werden geladen …</div> : null}
    {catalog ? <>
      <div className="model-summary" aria-label="OpenRouter Übersicht">
        <div><span>Modelle</span><strong>{formatInteger(models.length)}</strong></div>
        <div><span>Sichtbar</span><strong>{formatInteger(filtered.length)}</strong></div>
        <div><span>Ausgewählt</span><strong>{formatInteger(compare.length)}</strong></div>
        <div><span>Günstigster Fit</span><strong>{cheapest ? trimProvider(cheapest.name) : "n/a"}</strong></div>
      </div>
      <p className="model-usecase-note"><strong>{MODEL_USE_CASES[useCaseId].label}:</strong> {MODEL_USE_CASES[useCaseId].note} Kostenannahme: {formatInteger(MODEL_USE_CASES[useCaseId].input)} Input- und {formatInteger(MODEL_USE_CASES[useCaseId].output)} Output-Tokens, inklusive 5,5 % OpenRouter-Credit-Fee.</p>
      {refreshStatus ? <p className="model-sync-status" role="status">{refreshStatus}</p> : null}

      <div className="model-toolbar" aria-label="Modelle filtern">
        <label className="model-search">
          <span className="model-search-icon" aria-hidden="true"><Search /></span>
          <input aria-label="Modelle durchsuchen" className="model-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Modell, Provider, Capability" type="search" />
          {query ? <button type="button" title="Suche leeren" onClick={() => setQuery("")}><X aria-hidden="true" /><span className="sr-only">Suche leeren</span></button> : null}
        </label>
        <label>
          <span>Usecase</span>
          <select value={useCaseId} onChange={(event) => setUseCaseId(event.target.value as ModelUseCaseId)}>
            {Object.entries(MODEL_USE_CASES).map(([id, useCase]) => <option key={id} value={id}>{useCase.label}</option>)}
          </select>
        </label>
        <label>
          <span>Provider</span>
          <select value={provider} onChange={(event) => setProvider(event.target.value)}>
            <option value="all">Alle Provider</option>
            {providers.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>Sortierung</span>
          <select value={sort} onChange={(event) => updateSort(event.target.value as ModelSort)}>
            {MODEL_SORTS.map((value) => <option key={value} value={value}>{SORT_LABELS[value]}</option>)}
          </select>
        </label>
        <button className="secondary-button model-reset" type="button" onClick={clearFilters}>
          <SlidersHorizontal aria-hidden="true" /> Filter zurücksetzen
        </button>
      </div>
      <div className="model-tag-row" aria-label="Modelle nach Eigenschaft filtern">
        {TAGS.map((value) => <button
          className={tag === value ? "active" : ""}
          key={value}
          type="button"
          onClick={() => setTag(value)}
          aria-pressed={tag === value}
        >{value === "all" ? "Alle" : value}</button>)}
      </div>

      <div className="model-selection-layout" data-entry-view={view}>
        <section className="model-browser" aria-labelledby="model-browser-title">
          <div className="section-label"><h2 id="model-browser-title">Modelle auswählen</h2><span>{formatInteger(filtered.length)} Treffer, {Math.min(filtered.length, MAX_VISIBLE_MODELS)} angezeigt</span></div>
          <div className={view === "list" ? "model-choice-list compact-entry-list" : "model-choice-list"} data-entry-view={view}>
            {view === "list" ? <CompactListHeader
              activeSort={sort}
              className="model-list-header"
              columns={[
                { key: "name", label: "Modell" },
                { key: "description", label: "Beschreibung" },
                { key: "provider", label: "Provider" },
                { key: "cost", label: "Kosten" },
                { key: "context", label: "Kontext" },
                { key: "score", label: "Fit" },
              ]}
              direction={sortDirection}
              leadingSpacer
              onSort={updateSort}
            /> : null}
            {filtered.slice(0, MAX_VISIBLE_MODELS).map((model) => <ModelChoice
              key={model.id}
              model={model}
              selected={selectedIds.has(model.id)}
              useCaseId={useCaseId}
              onToggle={() => toggleSelection(model.id)}
            />)}
          </div>
        </section>

        <section className="model-compare" aria-labelledby="model-compare-title">
          <div className="section-label"><h2 id="model-compare-title">Vergleich</h2><button type="button" onClick={() => setSelectedIds(new Set())}>Auswahl leeren</button></div>
          {compare.length >= 2 ? <div className="model-compare-scroll"><table>
            <thead><tr><th>Modell</th><th>Fit</th><th>$/M In/Out</th><th>Usecase-Kosten</th><th>Kontext</th><th>Stärken</th></tr></thead>
            <tbody>{compare.map((model) => <tr key={model.id}>
              <th scope="row"><div className="model-compare-name"><span><strong>{model.name}</strong><code>{model.id}</code></span><button type="button" onClick={() => toggleSelection(model.id)} aria-label={`${model.name} aus Vergleich entfernen`}>×</button></div></th>
              <td>{scoreModelFit(model, useCaseId)}/100</td>
              <td>{formatPrice(model.pricing.inputPerMillion)} / {formatPrice(model.pricing.outputPerMillion)}</td>
              <td>{formatCost(calculateUseCaseCost(model, useCaseId))}</td>
              <td>{formatInteger(model.contextLength)}</td>
              <td>{model.tags.slice(0, 7).join(", ") || "-"}</td>
            </tr>)}</tbody>
          </table></div> : <p className="model-empty">Wähle mindestens zwei Modelle aus, dann entsteht hier die Vergleichstabelle.</p>}
        </section>
      </div>

      <section className="model-recommendations" aria-labelledby="model-recommendations-title">
        <div className="section-label"><h2 id="model-recommendations-title">Beste Treffer für diesen Usecase</h2><span>Fit ab 52 Punkten</span></div>
        {recommendations.length ? <div className="model-recommendation-grid">
          {recommendations.map((model) => <button className="model-recommendation" key={model.id} type="button" onClick={() => toggleSelection(model.id)}>
            <strong>{model.name}</strong><code>{model.id}</code><span>{scoreModelFit(model, useCaseId)}/100 · {formatCost(calculateUseCaseCost(model, useCaseId))} je Usecase · {formatInteger(model.contextLength)} Kontext</span>
          </button>)}
        </div> : <p className="model-empty">Keine passenden Treffer im aktuellen Filter.</p>}
      </section>

      <section className="model-setups" aria-labelledby="model-setups-title">
        <div className="section-label"><h2 id="model-setups-title">Setup-Vorschläge</h2></div>
        <div className="model-setup-grid">
          {MODEL_SETUPS.map((setup) => <ModelSetupCard
            key={setup.title}
            models={models}
            setup={setup}
            fallback={filtered}
            onAdd={(modelId) => setSelectedIds((current) => new Set(current).add(modelId))}
          />)}
        </div>
      </section>
      <p className="model-foot">Quelle: {catalog.source ?? "unbekannt"} · Stand: {formatTimestamp(catalog.fetchedAt)}</p>
    </> : null}
  </section>;
}

function ModelChoice({ model, selected, useCaseId, onToggle }: {
  model: Model;
  selected: boolean;
  useCaseId: ModelUseCaseId;
  onToggle: () => void;
}) {
  return <label className="model-choice">
    <input checked={selected} type="checkbox" onChange={onToggle} />
    <span className="model-choice-main">
      <span className="model-choice-top"><strong>{model.name}</strong></span>
      <span className="model-choice-description">{model.description}</span>
      <code>{model.provider}</code>
      <span className="model-choice-price">
        <span>{formatPrice(model.pricing.inputPerMillion)}/M in</span>
        <span>{formatPrice(model.pricing.outputPerMillion)}/M out</span>
        <span>{formatCost(calculateUseCaseCost(model, useCaseId))} je Usecase</span>
      </span>
      <span className="model-choice-context">{formatInteger(model.contextLength)}</span>
      <em className="model-choice-fit">{scoreModelFit(model, useCaseId)}/100</em>
      <span className="model-tags">{model.tags.slice(0, 5).map((value) => <span key={value}>{value}</span>)}</span>
    </span>
  </label>;
}

function defaultModelSortDirection(sort: ModelSort): SortDirection {
  return sort === "score" || sort === "context" ? "desc" : "asc";
}

function ModelSetupCard({ models, setup, fallback, onAdd }: {
  models: readonly Model[];
  setup: typeof MODEL_SETUPS[number];
  fallback: readonly Model[];
  onAdd: (modelId: string) => void;
}) {
  const byId = new Map(models.map((model) => [model.id, model]));
  const matched = setup.modelIds.flatMap((modelId) => {
    const model = byId.get(modelId);
    return model ? [model] : [];
  });
  const choices = [...matched, ...fallback.filter((model) => !matched.some(({ id }) => id === model.id))].slice(0, 3);
  return <article className="model-setup">
    <h3>{setup.title}</h3><p>{setup.flow}</p>
    <div>{choices.map((model) => <button key={model.id} type="button" onClick={() => onAdd(model.id)}>{trimProvider(model.name)}</button>)}</div>
  </article>;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "unbekannt";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("de-DE");
}

function formatPrice(value: number | null): string {
  return value === null ? "n/a" : `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatCost(value: number | null): string {
  return value === null ? "n/a" : `$${value.toLocaleString("en-US", { maximumFractionDigits: 3 })}`;
}

function formatInteger(value: number): string {
  return value.toLocaleString("de-DE");
}

function trimProvider(name: string): string {
  return name.replace(/^.*?:\s*/, "");
}
