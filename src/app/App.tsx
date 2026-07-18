import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  BarChart3,
  BrainCircuit,
  Boxes,
  Cloud,
  Bookmark,
  CircleHelp,
  Cpu,
  Database,
  FileText,
  GitBranch,
  Grid2X2,
  LayoutGrid,
  Library,
  ListChecks,
  Moon,
  Network,
  Folder,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Files,
  ListCollapse,
  ListTree,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sun,
  Tag,
  Terminal,
  X,
} from "lucide-react";
import { BrowserQuickGraphAdapter, filterItemsByDataMode } from "../adapters/browser";
import { LocalApiQuickGraphAdapter } from "../adapters/local-api";
import { AdapterStatusDialog } from "../components/AdapterStatusDialog";
import { ContextQuickView } from "../components/ContextQuickView";
import type { SortDirection } from "../components/CompactListHeader";
import { DataCenterDialog } from "../components/DataCenterDialog";
import { EntryViewToggle } from "../components/EntryViewToggle";
import { ItemDrawer } from "../components/ItemDrawer";
import { OnboardingTour, type OnboardingTourStepPreparation } from "../components/OnboardingTour";
import type {
  BrowserDataMode,
  CatalogItem,
  ContextFileOverview,
  ContextOverview,
  ContextTarget,
  AdapterHealth,
  QuickGraphAdapter,
  QuickGraphBootstrap,
  UsageSummary,
} from "../domain";
import {
  ALL_CATALOG_FILTER,
  Catalog,
  type CatalogFilter,
  type CatalogFilterOption,
  type CatalogSort,
  deduplicateCatalogItems,
  filterCatalogItemsByFilters,
  getCatalogFilterOptions,
  isCatalogFilterAvailable,
  isOwnedSkillCatalogItem,
  isThirdPartyCatalogItem,
  OWNED_CATALOG_FILTER,
  reconcileCatalogFilters,
  THIRD_PARTY_CATALOG_FILTER,
  defaultCatalogSortDirection,
  sortCatalogItems,
} from "../features/catalog";
import {
  AppBuilderGuide,
  isGuideSkillItem,
  type AppBuilderWorkflowId,
} from "../features/app-builder";
import { MyApps } from "../features/apps";
import {
  areFiltersActive,
  branchOptionsWithItems,
  buildSidebarSectionIds,
  CollapsedNavButton,
  compactExternalCategoryLabel,
  deriveSidebarActiveFilters,
  deriveSidebarCategoryOptions,
  memorySystemCount,
  memoryToolCount,
  NavigationOption,
  ownedCategoryBranches,
  SidebarSection,
  sortCatalogItemsByName,
} from "../features/navigation";
import { ContextMonitor } from "../features/context-monitor";
import { ContextOptimizer } from "../features/context-optimizer";
import { ModelExplorer } from "../features/models";
import { MemoryHub, type MemoryFocus } from "../features/memory";
import { leastUsedItems, LeastUsed, UsageInsights } from "../features/usage";
import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  clampSidebarWidth,
  readActiveView,
  readAppBuilderWorkflow,
  readCatalogView,
  readDataMode,
  readExpandedSidebarAreas,
  readQuickAccessExpanded,
  readQuickAccessItemIds,
  remapQuickAccessItemId as remapStoredQuickAccessItemId,
  readSetupComplete,
  readSidebarCollapsed,
  readSidebarWidth,
  readTheme,
  writeCatalogView,
  writeActiveView,
  writeAppBuilderWorkflow,
  writeDataMode,
  writeExpandedSidebarAreas,
  writeOnboardingComplete,
  writeQuickAccessExpanded,
  writeQuickAccessItemIds,
  writeSetupComplete,
  writeSidebarCollapsed,
  writeSidebarWidth,
  writeTheme,
  type CatalogViewPreference,
  type AppViewPreference,
  type AppBuilderWorkflowPreference,
  type ThemePreference,
  type RuntimeProfile,
} from "../lib/preferences";

function catalogSelectionLabel(filters: readonly CatalogFilter[]): string {
  if (filters.length === 0) return ALL_CATALOG_FILTER.label;

  const category = filters.find((filter) => filter.kind === "category");
  const group = filters.find((filter) => filter.kind === "group");
  const type = filters.find((filter) => filter.kind === "type");
  const platform = filters.find((filter) => filter.kind === "command-platform");
  const commandCategory = filters.find((filter) => filter.kind === "command-category");

  const baseLabel = category
    ? category.group === "Commands & Regeln"
      ? category.category
      : `${category.group} / ${category.category}`
    : group?.label
      ?? type?.label
      ?? filters.find((filter) => !["owned", "third-party"].includes(filter.kind))?.label
      ?? filters[0].label;

  const detailLabels = [platform?.label, commandCategory?.label].filter(
    (label): label is string => Boolean(label && label !== baseLabel),
  );
  return [baseLabel, ...detailLabels].join(" / ");
}

function maxSidebarWidthForViewport(): number {
  if (typeof window === "undefined") return MAX_SIDEBAR_WIDTH;
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, window.innerWidth - 420));
}

function constrainSidebarWidth(width: number): number {
  return Math.min(clampSidebarWidth(width), maxSidebarWidthForViewport());
}

interface AppProps {
  adapter: QuickGraphAdapter;
  onSwitchProfile?: (profile: RuntimeProfile, mode?: BrowserDataMode) => void;
}

type NavigationQuickAccessTarget =
  | {
      id: string;
      label: string;
      meta: "Ansicht" | "Workflow";
      view: AppViewPreference;
      focus?: AppBuilderWorkflowId | null;
    }
  | {
      id: string;
      label: string;
      meta: "Katalog" | "Bereich";
      filters: readonly CatalogFilter[];
    };

type QuickAccessEntry =
  | { id: string; label: string; meta: string; item: CatalogItem }
  | { id: string; label: string; meta: NavigationQuickAccessTarget["meta"]; target: NavigationQuickAccessTarget };

const NAVIGATION_VIEW_TARGETS: readonly NavigationQuickAccessTarget[] = [
  { id: "nav:view:catalog", label: "Katalog", meta: "Ansicht", view: "catalog" },
  { id: "nav:view:apps", label: "Meine Apps", meta: "Ansicht", view: "apps" },
  { id: "nav:view:usage", label: "Most Used", meta: "Ansicht", view: "usage" },
  { id: "nav:view:least-used", label: "Least Used", meta: "Ansicht", view: "least-used" },
  { id: "nav:view:context", label: "Kontextampeln", meta: "Ansicht", view: "context" },
  { id: "nav:view:memory", label: "Memory", meta: "Ansicht", view: "memory" },
  { id: "nav:view:models", label: "Modelle", meta: "Ansicht", view: "models" },
  { id: "nav:view:app-builder", label: "Apps bauen & migrieren", meta: "Workflow", view: "app-builder" },
];

export function App({ adapter, onSwitchProfile }: AppProps) {
  const runtimeProfile: RuntimeProfile = adapter.kind === "browser" ? "browser" : "local-api";
  const startsWithSetup = !readSetupComplete(runtimeProfile);
  const [bootstrap, setBootstrap] = useState<QuickGraphBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<CatalogFilter[]>([]);
  const [sort, setSort] = useState<CatalogSort>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [view, setView] = useState<CatalogViewPreference>(readCatalogView);
  const [theme, setTheme] = useState<ThemePreference>(readTheme);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [sidebarWidth, setSidebarWidth] = useState(() => constrainSidebarWidth(readSidebarWidth()));
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [expandedAreaIds, setExpandedAreaIds] = useState(readExpandedSidebarAreas);
  const [dataMode, setDataMode] = useState<BrowserDataMode>(readDataMode);
  const [dataCenterOpen, setDataCenterOpen] = useState(startsWithSetup);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppViewPreference>(readActiveView);
  const [appBuilderFocus, setAppBuilderFocus] = useState<AppBuilderWorkflowId | null>(readAppBuilderWorkflow);
  const [memoryFocus, setMemoryFocus] = useState<MemoryFocus>("overview");
  const [quickAccessItemIds, setQuickAccessItemIds] = useState(readQuickAccessItemIds);
  const [quickAccessExpanded, setQuickAccessExpanded] = useState(readQuickAccessExpanded);
  const quickAccessItemIdsRef = useRef(quickAccessItemIds);
  const [health, setHealth] = useState<AdapterHealth | null>(null);
  const [adapterStatusOpen, setAdapterStatusOpen] = useState(false);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [contextOverview, setContextOverview] = useState<ContextOverview | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [optimizationFile, setOptimizationFile] = useState<ContextFileOverview | null>(null);
  const [quickViewTarget, setQuickViewTarget] = useState<ContextTarget | null>(null);
  const [quickViewReturnsToDataCenter, setQuickViewReturnsToDataCenter] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const loadGenerationRef = useRef(0);
  const usageLoadGenerationRef = useRef(0);
  const itemLoadGenerationRef = useRef(0);
  const sidebarResizingRef = useRef(false);

  const browserDataAdapter = useMemo(
    () => adapter instanceof BrowserQuickGraphAdapter ? adapter : null,
    [adapter],
  );

  const load = useCallback(async (): Promise<boolean> => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setError(null);
    setUsageLoading(true);
    setContextLoading(true);
    setUsageError(null);
    setContextError(null);
    try {
      await adapter.initialize();
      const data = await adapter.getBootstrap();
      if (generation !== loadGenerationRef.current) return false;
      setBootstrap(data);
      setLoading(false);

      const healthRequest = adapter.getHealth()
        .then((nextHealth) => {
          if (generation === loadGenerationRef.current) setHealth(nextHealth);
        })
        .catch(() => {
          if (generation === loadGenerationRef.current) {
            setHealth({ status: "unavailable", adapter: adapter.kind });
          }
        });
      const usageRequest = adapter.getUsageSummary()
        .then((nextSummary) => {
          if (generation === loadGenerationRef.current) setUsageSummary(nextSummary);
        })
        .catch((usageLoadError: unknown) => {
          if (generation === loadGenerationRef.current) {
            setUsageError(errorMessage(usageLoadError, "Nutzungsdaten konnten nicht geladen werden."));
          }
        })
        .finally(() => {
          if (generation === loadGenerationRef.current) setUsageLoading(false);
        });
      const contextRequest = adapter.getContextOverview()
        .then((overview) => {
          if (generation === loadGenerationRef.current) setContextOverview(overview);
        })
        .catch((contextLoadError: unknown) => {
          if (generation === loadGenerationRef.current) {
            setContextError(errorMessage(contextLoadError, "Kontextstatus konnte nicht geladen werden."));
          }
        })
        .finally(() => {
          if (generation === loadGenerationRef.current) setContextLoading(false);
        });

      await Promise.allSettled([healthRequest, usageRequest, contextRequest]);
      if (generation !== loadGenerationRef.current) return false;
      return true;
    } catch (loadError) {
      if (generation !== loadGenerationRef.current) return false;
      setError(loadError instanceof Error ? loadError.message : "QuickGraph konnte nicht geladen werden.");
      setHealth({ status: "unavailable", adapter: adapter.kind });
      return false;
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [adapter]);

  const loadUsage = useCallback(async () => {
    const generation = ++usageLoadGenerationRef.current;
    setUsageLoading(true);
    setUsageError(null);
    try {
      const nextSummary = await adapter.getUsageSummary(true);
      if (generation !== usageLoadGenerationRef.current) return;
      setUsageSummary(nextSummary);
    } catch (usageLoadError) {
      if (generation !== usageLoadGenerationRef.current) return;
      setUsageError(errorMessage(usageLoadError, "Nutzungsdaten konnten nicht geladen werden."));
    } finally {
      if (generation !== usageLoadGenerationRef.current) return;
      setUsageLoading(false);
    }
  }, [adapter]);

  const loadContext = useCallback(async (): Promise<ContextOverview | null> => {
    setContextLoading(true);
    setContextError(null);
    try {
      const overview = await adapter.getContextOverview();
      setContextOverview(overview);
      return overview;
    } catch (contextLoadError) {
      setContextError(errorMessage(contextLoadError, "Kontextstatus konnte nicht geladen werden."));
      return null;
    } finally {
      setContextLoading(false);
    }
  }, [adapter]);

  const refreshCatalog = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshNotice(null);
    try {
      if (adapter.capabilities.sourceScan) {
        setRefreshNotice("Quellen werden gescannt und der Katalog wird neu aufgebaut …");
        const scan = await adapter.scanSources();
        setRefreshNotice(`${scan.indexed} Einträge aus ${scan.sources.length} Quellen aktualisiert.`);
      } else {
        setRefreshNotice("Öffentlicher Katalog und lokale Browserdaten werden neu geladen …");
      }
      const refreshed = await load();
      if (!refreshed) return;
      setRefreshNotice((current) => current?.includes("aktualisiert")
        ? current
        : "Öffentlicher Katalog und lokale Browserdaten wurden neu geladen.");
    } catch (scanError) {
      setError(errorMessage(scanError, "Quellen konnten nicht aktualisiert werden."));
    } finally {
      setRefreshing(false);
    }
  }, [adapter, load, refreshing]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeTheme(theme);
  }, [theme]);

  useEffect(() => {
    const keepSidebarInsideViewport = () => {
      setSidebarWidth((current) => constrainSidebarWidth(current));
    };
    window.addEventListener("resize", keepSidebarInsideViewport);
    return () => window.removeEventListener("resize", keepSidebarInsideViewport);
  }, []);

  useEffect(() => {
    const focusGlobalSearch = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const shortcutPressed = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slashPressed = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (!shortcutPressed && !slashPressed) return;

      event.preventDefault();
      setActiveView("catalog");
      writeActiveView("catalog");
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    };

    window.addEventListener("keydown", focusGlobalSearch);
    return () => window.removeEventListener("keydown", focusGlobalSearch);
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (filterPopoverRef.current?.contains(event.target as Node)) return;
      setFiltersOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [filtersOpen]);

  const modeItems = useMemo(() => {
    const items = bootstrap?.items ?? [];
    return deduplicateCatalogItems(
      adapter.kind !== "browser" ? items : filterItemsByDataMode(items, dataMode),
    );
  }, [adapter.kind, bootstrap, dataMode]);

  const filterOptions = useMemo(() => getCatalogFilterOptions(modeItems), [modeItems]);
  const ownedItemCount = useMemo(() => modeItems.filter(isOwnedSkillCatalogItem).length, [modeItems]);
  const thirdPartyItemCount = useMemo(() => modeItems.filter(isThirdPartyCatalogItem).length, [modeItems]);
  const pluginItemCount = useMemo(() => modeItems.filter(isPluginCatalogItem).length, [modeItems]);
  const promptItemCount = useMemo(() => modeItems.filter((item) => item.type === "prompt").length, [modeItems]);
  const mcpItemCount = useMemo(() => modeItems.filter((item) => item.type === "mcp-server").length, [modeItems]);
  const appItemCount = useMemo(() => modeItems.filter((item) => item.type === "app").length, [modeItems]);
  const commandItemCount = useMemo(() => modeItems.filter((item) => item.kind === "command").length, [modeItems]);
  const ruleItemCount = useMemo(() => modeItems.filter((item) => item.kind === "rule").length, [modeItems]);
  const workflowItemCount = useMemo(
    () => modeItems.filter((item) => item.type === "workflow" || item.kind === "workflow" || item.group === "Workflows").length,
    [modeItems],
  );
  const {
    pluginCategoryOptions,
    workflowCategoryOptions,
    visibleSkillCategoryOptions,
    visiblePromptCategoryOptions,
    ownedCategoryOptions,
  } = useMemo(
    () => deriveSidebarCategoryOptions(filterOptions, modeItems, isPluginCategory),
    [filterOptions, modeItems],
  );
  const navigationQuickAccessTargets = useMemo<NavigationQuickAccessTarget[]>(() => [
    ...NAVIGATION_VIEW_TARGETS,
    {
      id: navigationFiltersQuickAccessId([OWNED_CATALOG_FILTER]),
      label: "Alle eigenen Skills",
      meta: "Katalog",
      filters: [OWNED_CATALOG_FILTER],
    },
    {
      id: navigationFiltersQuickAccessId([THIRD_PARTY_CATALOG_FILTER]),
      label: "Alle externen Skills",
      meta: "Katalog",
      filters: [THIRD_PARTY_CATALOG_FILTER],
    },
    ...[...filterOptions.types, ...filterOptions.groups, ...filterOptions.categories].map(({ filter }) => ({
      id: navigationFiltersQuickAccessId([filter]),
      label: filter.label,
      meta: "Bereich" as const,
      filters: [filter],
    })),
    ...ownedCategoryOptions.map(({ group, category }) => {
      const categoryFilter: CatalogFilter = {
        id: `category:${group}\u0000${category}`,
        kind: "category",
        group,
        category,
        label: category,
      };
      const filters = [OWNED_CATALOG_FILTER, categoryFilter];
      return {
        id: navigationFiltersQuickAccessId(filters),
        label: category,
        meta: "Bereich" as const,
        filters,
      };
    }),
  ], [filterOptions.categories, filterOptions.groups, filterOptions.types, ownedCategoryOptions]);
  const navigationQuickAccessTargetsById = useMemo(
    () => new Map(navigationQuickAccessTargets.map((target) => [target.id, target])),
    [navigationQuickAccessTargets],
  );
  const sidebarSectionIds = useMemo(
    () => buildSidebarSectionIds(
      { pluginCategoryOptions, workflowCategoryOptions, visibleSkillCategoryOptions, visiblePromptCategoryOptions, ownedCategoryOptions },
      filterOptions.commandCategories,
    ),
    [filterOptions.commandCategories, ownedCategoryOptions, pluginCategoryOptions, visiblePromptCategoryOptions, visibleSkillCategoryOptions, workflowCategoryOptions],
  );
  const leastUsedItemCount = useMemo(
    () => leastUsedItems(modeItems, usageSummary, "all", "least").length,
    [modeItems, usageSummary],
  );
  const filteredItems = useMemo(
    () => filterCatalogItemsByFilters(modeItems, query, selectedFilters),
    [modeItems, query, selectedFilters],
  );
  const scopedItems = useMemo(
    () => filterCatalogItemsByFilters(modeItems, "", selectedFilters),
    [modeItems, selectedFilters],
  );
  const scopedUsageSummary = useMemo(
    () => usageForCatalogScope(usageSummary, scopedItems),
    [scopedItems, usageSummary],
  );
  const visibleItems = useMemo(
    () => sortCatalogItems(filteredItems, sort, usageSummary, sortDirection),
    [filteredItems, sort, sortDirection, usageSummary],
  );
  const quickAccessEntries = useMemo<QuickAccessEntry[]>(() => {
    const itemsById = new Map(modeItems.map((item) => [item.id, item]));
    const entries: QuickAccessEntry[] = [];
    for (const quickAccessId of quickAccessItemIds) {
      const item = itemsById.get(quickAccessId);
      if (item) {
        entries.push({ id: item.id, label: item.name, meta: quickAccessMeta(item), item });
        continue;
      }
      const target = navigationQuickAccessTargetsById.get(quickAccessId);
      if (target) entries.push({ id: target.id, label: target.label, meta: target.meta, target });
    }
    return entries;
  }, [modeItems, navigationQuickAccessTargetsById, quickAccessItemIds]);

  useEffect(() => {
    setSelectedFilters((current) => current.filter((filter) => isCatalogFilterAvailable(filter, modeItems)));
  }, [modeItems]);

  useEffect(() => {
    const isActiveGuideItem = activeView === "app-builder" && selectedItem && isGuideSkillItem(selectedItem);
    if (selectedItem && !isActiveGuideItem && !modeItems.some((item) => item.id === selectedItem.id)) {
      setSelectedItem(null);
    }
  }, [activeView, modeItems, selectedItem]);

  const updateView = (nextView: CatalogViewPreference) => {
    setView(nextView);
    writeCatalogView(nextView);
  };

  const updateCatalogSort = (nextSort: CatalogSort) => {
    setSortDirection((current) => nextSort === sort
      ? (current === "asc" ? "desc" : "asc")
      : defaultCatalogSortDirection(nextSort));
    setSort(nextSort);
  };

  const closeItemDrawer = useCallback(() => {
    itemLoadGenerationRef.current += 1;
    setSelectedItem(null);
  }, []);

  const expandSidebarForNavigation = () => {
    if (!sidebarCollapsed) return;
    setSidebarCollapsed(false);
    writeSidebarCollapsed(false);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      writeSidebarCollapsed(next);
      return next;
    });
  };

  const updateSidebarWidth = (width: number, persist = false) => {
    const next = constrainSidebarWidth(width);
    setSidebarWidth(next);
    if (persist) writeSidebarWidth(next);
  };

  const startSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (sidebarCollapsed) return;
    event.preventDefault();
    sidebarResizingRef.current = true;
    setSidebarResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!sidebarResizingRef.current) return;
    updateSidebarWidth(event.clientX);
  };

  const finishSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!sidebarResizingRef.current) return;
    sidebarResizingRef.current = false;
    setSidebarResizing(false);
    updateSidebarWidth(event.clientX, true);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const cancelSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!sidebarResizingRef.current) return;
    sidebarResizingRef.current = false;
    setSidebarResizing(false);
    writeSidebarWidth(sidebarWidth);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resizeSidebarWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let nextWidth: number | null = null;
    if (event.key === "ArrowLeft") nextWidth = sidebarWidth - 16;
    if (event.key === "ArrowRight") nextWidth = sidebarWidth + 16;
    if (event.key === "Home") nextWidth = MIN_SIDEBAR_WIDTH;
    if (event.key === "End") nextWidth = maxSidebarWidthForViewport();
    if (nextWidth === null) return;
    event.preventDefault();
    updateSidebarWidth(nextWidth, true);
  };

  const openItem = async (item: CatalogItem) => {
    const generation = ++itemLoadGenerationRef.current;
    setSelectedItem(item);
    try {
      const currentItem = await adapter.getItem(item.id);
      if (generation !== itemLoadGenerationRef.current) return;
      setSelectedItem(currentItem ?? item);
    } catch (openError) {
      if (generation !== itemLoadGenerationRef.current) return;
      setError(errorMessage(openError, "Der aktuelle Eintrag konnte nicht geladen werden."));
    }
  };

  const openGuideSkill = (item: CatalogItem) => {
    itemLoadGenerationRef.current += 1;
    setSelectedItem(item);
  };

  const toggleQuickAccessId = useCallback((quickAccessId: string) => {
    const next = new Set(quickAccessItemIdsRef.current);
    const adding = !next.has(quickAccessId);
    if (adding) {
      next.delete(quickAccessId);
      const prioritized = persistQuickAccessIds(new Set([quickAccessId, ...next]));
      quickAccessItemIdsRef.current = prioritized;
      setQuickAccessItemIds(prioritized);
      setQuickAccessExpanded(true);
      writeQuickAccessExpanded(true);
      if (sidebarCollapsed) {
        setSidebarCollapsed(false);
        writeSidebarCollapsed(false);
      }
      return;
    }
    next.delete(quickAccessId);
    const persisted = persistQuickAccessIds(next);
    quickAccessItemIdsRef.current = persisted;
    setQuickAccessItemIds(persisted);
  }, [sidebarCollapsed]);

  const toggleQuickAccess = useCallback((item: CatalogItem) => {
    toggleQuickAccessId(item.id);
  }, [toggleQuickAccessId]);

  const remapQuickAccessItemId = useCallback((previousItemId: string, nextItemId: string) => {
    const current = quickAccessItemIdsRef.current;
    if (!current.has(previousItemId) || previousItemId === nextItemId) return;
    const persisted = persistQuickAccessIds(remapStoredQuickAccessItemId(current, previousItemId, nextItemId));
    quickAccessItemIdsRef.current = persisted;
    setQuickAccessItemIds(persisted);
  }, []);

  const updateActiveView = (nextView: AppViewPreference, expandSidebar = true) => {
    if (expandSidebar) expandSidebarForNavigation();
    setActiveView(nextView);
    writeActiveView(nextView);
  };

  const openAppBuilderWorkflow = (focus: AppBuilderWorkflowId | null = null) => {
    setAppBuilderFocus(focus);
    writeAppBuilderWorkflow(focus as AppBuilderWorkflowPreference | null);
    updateActiveView("app-builder");
  };

  const selectAppBuilderWorkflow = (workflow: AppBuilderWorkflowId) => {
    setAppBuilderFocus(workflow);
    writeAppBuilderWorkflow(workflow);
  };

  const openMyApps = (expandSidebar = true) => {
    if (expandSidebar) expandSidebarForNavigation();
    setQuery("");
    setSelectedFilters([]);
    updateActiveView("apps", expandSidebar);
  };

  const selectCatalogFilter = (nextFilter: CatalogFilter, expandSidebar = true) => {
    if (expandSidebar) expandSidebarForNavigation();
    setQuery("");
    setSelectedFilters(nextFilter.kind === "all" ? [] : [nextFilter]);
    if (activeView !== "catalog") updateActiveView("catalog", expandSidebar);
  };

  const selectCatalogFilters = (nextFilters: readonly CatalogFilter[]) => {
    expandSidebarForNavigation();
    setQuery("");
    setSelectedFilters([...nextFilters]);
    if (activeView !== "catalog") updateActiveView("catalog");
  };

  const selectUsageView = (nextView: "usage" | "least-used", expandSidebar = true) => {
    if (expandSidebar) expandSidebarForNavigation();
    setQuery("");
    setSelectedFilters([]);
    updateActiveView(nextView, expandSidebar);
  };

  const openQuickAccessEntry = (entry: QuickAccessEntry) => {
    if ("item" in entry) {
      void openItem(entry.item);
      return;
    }
    if ("view" in entry.target) {
      if (entry.target.view === "app-builder") openAppBuilderWorkflow(entry.target.focus ?? null);
      else if (entry.target.view === "apps") openMyApps();
      else {
      updateActiveView(entry.target.view);
      if (entry.target.view === "catalog") selectCatalogFilter(ALL_CATALOG_FILTER);
      }
      return;
    }
    selectCatalogFilters(entry.target.filters);
  };

  const selectPopoverFilter = (nextFilter: CatalogFilter) => {
    expandSidebarForNavigation();
    setSelectedFilters((current) => reconcileCatalogFilters(modeItems, current, nextFilter));
    if (!isCatalogScopedView(activeView)) updateActiveView("catalog");
  };

  const toggleArea = (areaId: string) => {
    setExpandedAreaIds((current) => {
      const next = new Set(current);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      writeExpandedSidebarAreas(next);
      return next;
    });
  };

  const toggleQuickAccessPanel = () => {
    if (sidebarCollapsed) {
      expandSidebarForNavigation();
      if (!quickAccessExpanded) {
        setQuickAccessExpanded(true);
        writeQuickAccessExpanded(true);
      }
      return;
    }
    setQuickAccessExpanded((current) => {
      const next = !current;
      writeQuickAccessExpanded(next);
      return next;
    });
  };

  const toggleAllSidebarSections = () => {
    const allExpanded = sidebarSectionIds.every((sectionId) => expandedAreaIds.has(sectionId)) && quickAccessExpanded;
    const next = allExpanded ? new Set<string>() : new Set(sidebarSectionIds);
    setExpandedAreaIds(next);
    writeExpandedSidebarAreas(next);
    setQuickAccessExpanded(!allExpanded);
    writeQuickAccessExpanded(!allExpanded);
  };

  const updateDataMode = (nextMode: BrowserDataMode) => {
    setDataMode(nextMode);
    writeDataMode(nextMode);
  };

  const closeTour = useCallback(() => {
    setTourOpen(false);
    setDataCenterOpen(false);
    setQuickViewTarget(null);
    setOptimizationFile(null);
    setSelectedItem(null);
    writeOnboardingComplete(true, runtimeProfile);
  }, [runtimeProfile]);

  const closeDataCenter = useCallback(() => {
    writeSetupComplete(runtimeProfile, true);
    setDataCenterOpen(false);
  }, [runtimeProfile]);

  const closeQuickView = useCallback(() => {
    setQuickViewTarget(null);
    if (quickViewReturnsToDataCenter) setDataCenterOpen(true);
    setQuickViewReturnsToDataCenter(false);
  }, [quickViewReturnsToDataCenter]);

  const prepareTourStep = useCallback((step: OnboardingTourStepPreparation) => {
    const opensDataCenter = ["data-center", "data-modes", "imports", "local-catalog-export"].includes(step.id);
    setDataCenterOpen(opensDataCenter);

    const contextTarget = step.id === "context-claude"
      ? "claude"
      : step.id === "context-memory"
        ? "memory"
        : step.id === "context-agents"
          ? "codex"
          : null;
    setQuickViewTarget(contextTarget);

    const optimizerFile = step.id === "context-optimizer"
      ? contextOverview?.files.find((file) => file.target === "claude") ?? contextOverview?.files[0] ?? null
      : null;
    setOptimizationFile(optimizerFile);

    const opensDrawer = step.id === "drawer";
    setSelectedItem(opensDrawer ? visibleItems[0] ?? modeItems[0] ?? null : null);

    const nextView = ["context-monitor", "context-optimizer"].includes(step.id)
      ? "context"
      : ["catalog", "search", "view-mode", "filter", "drawer"].includes(step.id)
        ? "catalog"
        : null;
    if (nextView) {
      setActiveView(nextView);
      writeActiveView(nextView);
    }
  }, [contextOverview, modeItems, visibleItems]);

  const closeOptimizer = useCallback(() => {
    setOptimizationFile(null);
  }, []);

  const itemCount = bootstrap ? visibleItems.length : 0;
  const selectedFilterIds = new Set(selectedFilters.map((filter) => filter.id));
  const activeLabel = catalogSelectionLabel(selectedFilters);
  const showCatalogScope = isCatalogScopedView(activeView);
  const AdapterIcon = adapter.kind === "browser" ? Database : Cloud;
  const contextFiles = new Map(contextOverview?.files.map((file) => [file.target, file]) ?? []);
  const appsById = new Map(bootstrap?.apps.map((app) => [app.id, app]) ?? []);
  const adapterReady = health?.status === "ok";
  const refreshTitle = adapter.kind === "browser" ? "Katalog aktualisieren" : "Quellen und Katalog aktualisieren";
  const localCatalogExporter = adapter instanceof LocalApiQuickGraphAdapter
    ? () => adapter.exportCatalog()
    : undefined;
  const quickAccessVisible = quickAccessExpanded && !sidebarCollapsed;
  const allSidebarSectionsExpanded = sidebarSectionIds.every((sectionId) => expandedAreaIds.has(sectionId))
    && (quickAccessEntries.length === 0 || quickAccessExpanded);
  const typeFilter = (type: CatalogItem["type"]) => filterOptions.types.find(
    ({ filter }) => filter.kind === "type" && filter.type === type,
  );
  const groupFilter = (group: string) => filterOptions.groups.find(
    ({ filter }) => filter.kind === "group" && filter.group === group,
  );
  const categoriesForGroup = (group: string) => filterOptions.categories.filter(
    ({ filter }) => filter.kind === "category" && filter.group === group,
  );
  const workflowGroupOption = groupFilter("Workflows");
  const builtInCategoryOptions = categoriesForGroup("Commands & Regeln").filter(
    ({ filter }) => filter.kind === "category" && ["Commands", "Regeln"].includes(filter.category),
  );
  const builtInCommandOption = builtInCategoryOptions.find(
    ({ filter }) => filter.kind === "category" && filter.category === "Commands",
  );
  const builtInRuleOption = builtInCategoryOptions.find(
    ({ filter }) => filter.kind === "category" && filter.category === "Regeln",
  );
  const commandCategoryOptions = filterOptions.commandCategories;
  const commandPlatformOptions = ["Claude Code", "Codex", "Gemeinsam"].flatMap((commandPlatform) =>
    filterOptions.commandPlatforms.filter(
      ({ filter }) => filter.kind === "command-platform" && filter.commandPlatform === commandPlatform,
    ),
  );

  const renderSidebarSection = (
    id: string,
    label: string,
    count: number,
    icon: ReactNode | null,
    children: ReactNode,
    hasActiveChild = false,
    onActivate?: () => void,
  ) => <SidebarSection
    key={id}
    id={id}
    label={label}
    count={count}
    icon={icon}
    hasActiveChild={hasActiveChild}
    onActivate={onActivate}
    expanded={expandedAreaIds.has(id) && !sidebarCollapsed}
    onToggle={() => {
      if (sidebarCollapsed) expandSidebarForNavigation();
      else toggleArea(id);
    }}
  >{children}</SidebarSection>;

  const renderNavigationOption = (
    quickAccessId: string,
    label: string,
    active: boolean,
    onClick: () => void,
    count?: ReactNode,
    icon?: ReactNode,
  ) => <NavigationOption
    key={quickAccessId}
    quickAccessId={quickAccessId}
    label={label}
    active={active}
    onClick={onClick}
    count={count}
    icon={icon}
    quickAccessIds={quickAccessItemIds}
    onToggle={toggleQuickAccessId}
  />;

  const renderCollapsedNavButton = (
    id: string,
    label: string,
    icon: ReactNode,
    active: boolean,
    onClick: () => void,
  ) => <CollapsedNavButton
    key={id}
    id={id}
    label={label}
    icon={icon}
    active={active}
    onSelect={() => {
      expandSidebarForNavigation();
      onClick();
    }}
  />;

  const catalogActive = activeView === "catalog" && selectedFilters.length === 0;
  const {
    appsFilterActive,
    commandsActive,
    rulesActive,
    pluginsActive,
    mcpActive,
    promptsActive,
    skillsActive,
    workflowsActive,
  } = deriveSidebarActiveFilters(selectedFilters, isPluginCategory);
  const appsCatalogActive = activeView === "catalog" && appsFilterActive;
  const ownedSkillsActive = selectedFilters.some((filter) => filter.kind === "owned");
  const externalSkillsActive = skillsActive && !ownedSkillsActive;

  const chooseCollapsedFilter = (option?: CatalogFilterOption) => {
    if (!option) return;
    selectCatalogFilter(option.filter, false);
  };

  const renderNavigationRail = (className: string) => <div className={className} aria-label="Kompaktnavigation">
    <div className="sidebar-rail-group">
      {quickAccessEntries.length ? <button
        aria-expanded="false"
        aria-label="Schnellzugriff öffnen"
        className="sidebar-rail-button"
        onClick={toggleQuickAccessPanel}
        title="Schnellzugriff öffnen"
        type="button"
      >
        <Bookmark aria-hidden="true" />
      </button> : null}
      {renderCollapsedNavButton("catalog", "Katalog", <Library aria-hidden="true" />, catalogActive, () => { updateActiveView("catalog", false); selectCatalogFilter(ALL_CATALOG_FILTER, false); })}
      {renderCollapsedNavButton("usage", "Most Used", <BarChart3 aria-hidden="true" />, activeView === "usage", () => selectUsageView("usage", false))}
      {renderCollapsedNavButton("least-used", "Least Used", <BarChart3 aria-hidden="true" />, activeView === "least-used", () => selectUsageView("least-used", false))}
      {renderCollapsedNavButton("context", "Kontextampeln", <Files aria-hidden="true" />, activeView === "context", () => updateActiveView("context", false))}
      {renderCollapsedNavButton("memory", "Memory", <BrainCircuit aria-hidden="true" />, activeView === "memory", () => updateActiveView("memory", false))}
      {renderCollapsedNavButton("models", "Modelle", <Boxes aria-hidden="true" />, activeView === "models", () => updateActiveView("models", false))}
    </div>
    <div className="sidebar-rail-divider" />
    <div className="sidebar-rail-group">
      {renderCollapsedNavButton("skills", "Skills", <Folder aria-hidden="true" />, skillsActive, () => chooseCollapsedFilter(groupFilter("Skills")))}
      {renderCollapsedNavButton("prompts", "Prompts", <FileText aria-hidden="true" />, promptsActive, () => chooseCollapsedFilter(typeFilter("prompt")))}
      {renderCollapsedNavButton("plugins", "Plugins", <Plug aria-hidden="true" />, pluginsActive, () => chooseCollapsedFilter(groupFilter("Plugins")))}
      {renderCollapsedNavButton("apps", "Meine Apps", <Grid2X2 aria-hidden="true" />, activeView === "apps", () => openMyApps(false))}
      {renderCollapsedNavButton("commands", "Commands", <Terminal aria-hidden="true" />, commandsActive, () => chooseCollapsedFilter(builtInCommandOption))}
      {renderCollapsedNavButton("rules", "Regeln", <ListChecks aria-hidden="true" />, rulesActive, () => chooseCollapsedFilter(builtInRuleOption))}
      {renderCollapsedNavButton("mcp", "MCP Servers", <Cpu aria-hidden="true" />, mcpActive, () => chooseCollapsedFilter(typeFilter("mcp-server")))}
      {renderCollapsedNavButton("workflows", "Workflows", <GitBranch aria-hidden="true" />, workflowsActive, () => chooseCollapsedFilter(typeFilter("workflow") ?? workflowGroupOption))}
      {renderCollapsedNavButton("app-builder", "Apps bauen & migrieren", <GitBranch aria-hidden="true" />, activeView === "app-builder", () => openAppBuilderWorkflow())}
    </div>
  </div>;

  const renderItemLeaves = (items: readonly CatalogItem[]) => <>{sortCatalogItemsByName(items)
    .map((item) => renderNavigationOption(
      item.id,
      item.name,
      selectedItem?.id === item.id,
      () => void openItem(item),
    ))}</>;

  const renderFilteredBranch = (
    id: string,
    label: string,
    filters: readonly CatalogFilter[],
    children?: ReactNode,
  ) => {
    const items = sortCatalogItemsByName(filterCatalogItemsByFilters(modeItems, "", filters));
    return renderSidebarSection(
      id,
      label,
      items.length,
      null,
      children ?? renderItemLeaves(items),
      areFiltersActive(filters, selectedFilters),
      () => selectCatalogFilters(filters),
    );
  };

  const renderCategoryBranches = (
    idPrefix: string,
    baseFilters: readonly CatalogFilter[],
    options: readonly CatalogFilterOption[],
    labelForOption: (option: CatalogFilterOption) => string = (option) => option.filter.label,
  ) => <>{branchOptionsWithItems(modeItems, baseFilters, options)
    .map((option) => renderFilteredBranch(
      `branch:${idPrefix}:${option.filter.id}`,
      labelForOption(option),
      [...baseFilters, option.filter],
    ))}</>;

  return (
    <div
      className={[
        "quickgraph",
        sidebarCollapsed ? "sidebar-collapsed" : "",
        sidebarResizing ? "sidebar-resizing" : "",
      ].filter(Boolean).join(" ")}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <header className="application-header">
        <div className="sidebar-identity" data-tour="brand">
          <Network className="brand-mark" aria-hidden="true" />
          <span className="brand-copy">
            <span className="brand-title">QuickGraph</span>
            <span className="brand-signature">by mitra</span>
          </span>
          <button
            className="icon-button sidebar-toggle"
            type="button"
            onClick={toggleSidebar}
            data-tour="sidebar-toggle"
            title={sidebarCollapsed ? "Seitenleiste öffnen" : "Seitenleiste schließen"}
          >
            {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            <span className="sr-only">{sidebarCollapsed ? "Seitenleiste öffnen" : "Seitenleiste schließen"}</span>
          </button>
        </div>

        <div className="topbar">
        <div />

        <div className="top-actions">
          {(["claude", "memory", "codex"] as ContextTarget[]).map((target) => {
            const file = contextFiles.get(target);
            const label = target === "claude" ? "CLAUDE.md" : target === "memory" ? "MEMORY.md" : "AGENTS.md";
            const status = contextError ? "red" : file?.status ?? "missing";
            return <button
              className="header-status-chip"
              data-status={status}
              key={target}
              type="button"
              onClick={() => setQuickViewTarget(target)}
              title={`${label}: ${statusLabel(status)}`}
              data-tour={target === "codex" ? "context-agents" : `context-${target}`}
            ><span aria-hidden="true" />{label}</button>;
          })}
          <button
            className="icon-button"
            type="button"
            onClick={() => setDataCenterOpen(true)}
            title="Data Center öffnen"
            data-tour="data-center"
          >
            <Database aria-hidden="true" />
            <span className="sr-only">Data Center öffnen</span>
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setTourOpen(true)}
            title="Kurztour öffnen"
            data-tour="tour"
          >
            <CircleHelp aria-hidden="true" />
            <span className="sr-only">Kurztour öffnen</span>
          </button>
          <button className="adapter-chip" data-status={adapterReady ? "green" : health?.status === "degraded" ? "yellow" : "red"} type="button" onClick={() => setAdapterStatusOpen(true)} title="LocalAPI- und Systemstatus öffnen" data-tour="local-api">
            <span className="adapter-status-dot" aria-hidden="true" />
            <AdapterIcon aria-hidden="true" />
            {adapter.kind === "browser" ? "Browser" : "LocalAPI"}
          </button>
          <a
            className="header-report-link"
            href="/graphify-out/GRAPH_REPORT.md"
            rel="noreferrer"
            target="_blank"
            title="Bereinigten Katalogbericht öffnen"
            data-tour="report"
          >
            Report<ExternalLink aria-hidden="true" />
          </a>
          <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Helles Design" : "Dunkles Design"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
            <span className="sr-only">
              {theme === "dark" ? "Helles Design" : "Dunkles Design"}
            </span>
          </button>
          <button className="icon-button" type="button" onClick={() => void refreshCatalog()} disabled={loading || refreshing} title={refreshTitle} data-tour="refresh" aria-busy={refreshing}>
            <RefreshCw className={refreshing ? "is-spinning" : undefined} aria-hidden="true" />
            <span className="sr-only">{refreshTitle}</span>
          </button>
        </div>
        </div>
      </header>

      {refreshNotice ? <div className="refresh-notice" role="status">{refreshNotice}</div> : null}

      <div className="app-layout">
        <aside className="sidebar" aria-label="Katalognavigation" data-tour="sidebar">
          {renderNavigationRail("sidebar-mobile-rail")}
          <nav className="sidebar-desktop-nav">
            {sidebarCollapsed ? renderNavigationRail("sidebar-icon-rail") : <>
            <div className="sidebar-outline-toolbar">
              <span>Navigation</span>
              <button
                className="sidebar-global-action"
                type="button"
                onClick={toggleAllSidebarSections}
                aria-expanded={allSidebarSectionsExpanded}
                title={allSidebarSectionsExpanded ? "Alle Navigationsgruppen zuklappen" : "Alle Navigationsgruppen aufklappen"}
              >
                {allSidebarSectionsExpanded ? <ListCollapse aria-hidden="true" /> : <ListTree aria-hidden="true" />}
                <span>{allSidebarSectionsExpanded ? "Alle zuklappen" : "Alle aufklappen"}</span>
              </button>
            </div>

            {quickAccessEntries.length ? <section className="sidebar-quick-access" aria-labelledby="sidebar-quick-access-title">
              <h2 id="sidebar-quick-access-title">Gespeichert</h2>
              <button
                className="nav-item sidebar-quick-access-toggle"
                type="button"
                onClick={toggleQuickAccessPanel}
                aria-expanded={quickAccessVisible}
                aria-controls="sidebar-quick-access-items"
                title={`Schnellzugriff ${quickAccessVisible ? "schließen" : "öffnen"}`}
              >
                <span className="nav-label"><Bookmark aria-hidden="true" /><span className="nav-text">Lesezeichen</span></span>
                <span className="sidebar-quick-access-meta"><small>{quickAccessEntries.length}</small>{quickAccessVisible ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</span>
              </button>
              {quickAccessVisible ? <div className="sidebar-area-children sidebar-quick-access-items" id="sidebar-quick-access-items">
                {quickAccessEntries.map((entry) => <div className="sidebar-quick-access-entry" key={entry.id}>
                  <button
                    className="sidebar-area-child sidebar-quick-access-child"
                    type="button"
                    onClick={() => openQuickAccessEntry(entry)}
                    title={`${entry.label} öffnen`}
                  >
                    <Bookmark aria-hidden="true" />
                    <span>{entry.label}</span>
                    <small>{entry.meta}</small>
                  </button>
                  <button
                    className="sidebar-quick-access-remove"
                    type="button"
                    onClick={() => toggleQuickAccessId(entry.id)}
                    aria-label={`${entry.label} aus Lesezeichen entfernen`}
                    title="Lesezeichen entfernen"
                  ><X aria-hidden="true" /></button>
                </div>)}
              </div> : null}
            </section> : null}

            {renderSidebarSection("section:find", "Entdecken", 3, <LayoutGrid aria-hidden="true" />, <div className="sidebar-nested-sections">
              {renderNavigationOption("nav:view:catalog", "Katalog", activeView === "catalog" && selectedFilters.length === 0, () => { updateActiveView("catalog"); selectCatalogFilter(ALL_CATALOG_FILTER); }, modeItems.length, <Library aria-hidden="true" />)}
              {renderNavigationOption("nav:view:usage", "Most Used", activeView === "usage", () => selectUsageView("usage"), usageSummary?.summary.totalEvents ?? 0, <BarChart3 aria-hidden="true" />)}
              {renderNavigationOption("nav:view:least-used", "Least Used", activeView === "least-used", () => selectUsageView("least-used"), leastUsedItemCount, <BarChart3 aria-hidden="true" />)}
            </div>, ["catalog", "usage", "least-used"].includes(activeView))}

            {renderSidebarSection("section:mine", "Meine Inhalte", 2, <Folder aria-hidden="true" />, <div className="sidebar-nested-sections">
              {renderSidebarSection(
                "area:owned-skills",
                "Eigene Skills",
                ownedItemCount,
                <Folder aria-hidden="true" />,
                <>{ownedCategoryBranches(ownedCategoryOptions).map(({ category, filters }) => renderFilteredBranch(
                  `branch:owned-skills:${category}`,
                  category,
                  [OWNED_CATALOG_FILTER, ...filters],
                ))}</>,
                ownedSkillsActive,
                () => selectCatalogFilter(OWNED_CATALOG_FILTER, false),
              )}

              {renderSidebarSection("area:apps", "Meine Apps", appItemCount, <Grid2X2 aria-hidden="true" />,
                null,
                activeView === "apps",
                () => openMyApps(false),
              )}
            </div>, ownedSkillsActive || activeView === "apps" || appsCatalogActive)}

            {renderSidebarSection("section:catalog", "Katalog-Inhalte", 7, <Folder aria-hidden="true" />, <div className="sidebar-nested-sections">
              {groupFilter("Skills") ? renderSidebarSection(
                "area:skills",
                "Externe Skills",
                thirdPartyItemCount,
                <Folder aria-hidden="true" />,
                renderCategoryBranches("skills:external", [THIRD_PARTY_CATALOG_FILTER], visibleSkillCategoryOptions, (option) => compactExternalCategoryLabel(option.filter.kind === "category" ? option.filter.category : option.filter.label)),
                externalSkillsActive,
                () => selectCatalogFilter(THIRD_PARTY_CATALOG_FILTER, false),
              ) : null}

              {typeFilter("prompt") ? renderSidebarSection("area:prompts", "Prompts", promptItemCount, <FileText aria-hidden="true" />,
                visiblePromptCategoryOptions.length
                  ? renderCategoryBranches("prompts", [typeFilter("prompt")!.filter], visiblePromptCategoryOptions)
                  : renderItemLeaves(filterCatalogItemsByFilters(modeItems, "", [typeFilter("prompt")!.filter])),
                promptsActive,
                () => selectCatalogFilter(typeFilter("prompt")!.filter, false),
              ) : null}

              {groupFilter("Plugins") ? renderSidebarSection("area:plugins", "Plugins", pluginItemCount, <Plug aria-hidden="true" />,
                renderCategoryBranches("plugins", [groupFilter("Plugins")!.filter], pluginCategoryOptions, (option) => option.filter.kind === "category" ? option.filter.category.replace(/\s+Plugin$/i, "") : option.filter.label),
                pluginsActive,
                () => selectCatalogFilter(groupFilter("Plugins")!.filter, false),
              ) : null}

              {builtInCommandOption ? renderSidebarSection(
                "area:commands",
                "Commands",
                commandItemCount,
                <Terminal aria-hidden="true" />,
                commandPlatformOptions.length
                  ? <>{commandPlatformOptions.map((option) => renderFilteredBranch(
                    `branch:commands:${option.filter.id}`,
                    option.filter.label,
                    [builtInCommandOption.filter, option.filter],
                    renderCategoryBranches(
                      `commands:${option.filter.id}`,
                      [builtInCommandOption.filter, option.filter],
                      commandCategoryOptions,
                    ),
                  ))}</>
                  : renderItemLeaves(filterCatalogItemsByFilters(modeItems, "", [builtInCommandOption.filter])),
                commandsActive,
                () => selectCatalogFilter(builtInCommandOption.filter, false),
              ) : null}

              {builtInRuleOption ? renderSidebarSection(
                "area:rules",
                "Regeln",
                ruleItemCount,
                <ListChecks aria-hidden="true" />,
                renderItemLeaves(filterCatalogItemsByFilters(modeItems, "", [builtInRuleOption.filter])),
                rulesActive,
                () => selectCatalogFilter(builtInRuleOption.filter, false),
              ) : null}

              {typeFilter("mcp-server") ? renderSidebarSection(
                "area:mcp",
                "MCP Servers",
                mcpItemCount,
                <Cpu aria-hidden="true" />,
                renderItemLeaves(filterCatalogItemsByFilters(modeItems, "", [typeFilter("mcp-server")!.filter])),
                mcpActive,
                () => selectCatalogFilter(typeFilter("mcp-server")!.filter, false),
              ) : null}

              {renderSidebarSection("area:workflows", "Workflows", workflowItemCount + 1, <GitBranch aria-hidden="true" />, <>
                {renderNavigationOption("nav:view:app-builder", "Apps bauen & migrieren", activeView === "app-builder", () => openAppBuilderWorkflow())}
                {typeFilter("workflow") ? renderFilteredBranch(
                  "branch:workflows:all",
                  "Weitere Workflows",
                  [typeFilter("workflow")!.filter],
                  renderCategoryBranches("workflows", [typeFilter("workflow")!.filter], workflowCategoryOptions),
                ) : workflowGroupOption ? renderFilteredBranch(
                  "branch:workflows:all",
                  "Weitere Workflows",
                  [workflowGroupOption.filter],
                  renderCategoryBranches("workflows", [workflowGroupOption.filter], workflowCategoryOptions),
                ) : null}
              </>, workflowsActive)}
            </div>, externalSkillsActive || appsCatalogActive || commandsActive || rulesActive || pluginsActive || mcpActive || promptsActive || workflowsActive)}

            {renderSidebarSection("section:system", "System & Status", 3, <BrainCircuit aria-hidden="true" />, <div className="sidebar-nested-sections">
              {renderNavigationOption("nav:view:context", "Kontextampeln", activeView === "context", () => updateActiveView("context"), `${contextOverview?.summary.available ?? 0}/3`, <Files aria-hidden="true" />)}
              {renderSidebarSection("area:memory", "Memory", memorySystemCount(modeItems), <BrainCircuit aria-hidden="true" />, <div className="sidebar-nested-sections">
                {renderNavigationOption("nav:view:memory", "Übersicht", activeView === "memory" && memoryFocus === "overview", () => { setMemoryFocus("overview"); updateActiveView("memory"); })}
                {renderNavigationOption("nav:view:memory:gbrain", "GBrain", activeView === "memory" && memoryFocus === "gbrain", () => { setMemoryFocus("gbrain"); updateActiveView("memory"); }, memoryToolCount(modeItems, ["setup-gbrain", "sync-gbrain"]))}
                {renderNavigationOption("nav:view:memory:obsidian", "Obsidian", activeView === "memory" && memoryFocus === "obsidian", () => { setMemoryFocus("obsidian"); updateActiveView("memory"); }, memoryToolCount(modeItems, ["obsidian-lessons"]))}
                {renderNavigationOption("nav:view:memory:graphify", "Graphify", activeView === "memory" && memoryFocus === "graphify", () => { setMemoryFocus("graphify"); updateActiveView("memory"); }, memoryToolCount(modeItems, ["graphify"]))}
              </div>, activeView === "memory", () => updateActiveView("memory"))}
              {renderNavigationOption("nav:view:models", "Modelle", activeView === "models", () => updateActiveView("models"), "OR", <Boxes aria-hidden="true" />)}
            </div>, ["context", "models", "memory"].includes(activeView))}
            </>}
          </nav>
        </aside>

        <div
          className="sidebar-resize-handle"
          role="separator"
          aria-label="Seitenleiste horizontal vergrößern oder verkleinern"
          aria-orientation="vertical"
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={maxSidebarWidthForViewport()}
          aria-valuenow={sidebarWidth}
          aria-valuetext={`${sidebarWidth} Pixel`}
          tabIndex={sidebarCollapsed ? -1 : 0}
          title="Seitenleiste ziehen oder mit den Pfeiltasten anpassen"
          onPointerDown={startSidebarResize}
          onPointerMove={moveSidebarResize}
          onPointerUp={finishSidebarResize}
          onPointerCancel={cancelSidebarResize}
          onKeyDown={resizeSidebarWithKeyboard}
        />

        <main className="catalog-main">
          {showCatalogScope ? <section className={activeView === "catalog" ? "catalog-scope catalog-header-scope" : "catalog-scope"} aria-label="Katalogbereiche" data-tour="filters">
            <div className="catalog-scope-toolbar">
              <nav className="catalog-tabs" aria-label="Katalogbereiche">
                <CatalogFilterButton filter={ALL_CATALOG_FILTER} count={modeItems.length} selectedIds={selectedFilterIds} onSelect={selectCatalogFilter} />
                {filterOptions.groups.map(({ filter, count }) => {
                  if (filter.kind !== "group") return null;
                  if (filter.group === "Commands & Regeln") return [
                    builtInCommandOption ? <CatalogFilterButton key={builtInCommandOption.filter.id} filter={builtInCommandOption.filter} count={commandItemCount} selectedIds={selectedFilterIds} onSelect={selectCatalogFilter} /> : null,
                    builtInRuleOption ? <CatalogFilterButton key={builtInRuleOption.filter.id} filter={builtInRuleOption.filter} count={ruleItemCount} selectedIds={selectedFilterIds} onSelect={selectCatalogFilter} /> : null,
                  ];
                  return <CatalogFilterButton key={filter.id} filter={filter} count={count} selectedIds={selectedFilterIds} onSelect={selectCatalogFilter} />;
                })}
              </nav>
              <div className="filter-popover-shell" ref={filterPopoverRef}>
                <button
                  className={filtersOpen ? "filter-trigger active" : "filter-trigger"}
                  type="button"
                  onClick={() => setFiltersOpen((current) => !current)}
                  aria-expanded={filtersOpen}
                  aria-controls="catalog-filter-popover"
                >
                  <SlidersHorizontal aria-hidden="true" />
                  Filter
                  {selectedFilters.length ? <span className="filter-count">{selectedFilters.length}</span> : null}
                </button>
                {filtersOpen ? <div className="filter-popover" id="catalog-filter-popover" role="dialog" aria-label="Katalog filtern">
                  <div className="filter-popover-heading">
                    <strong>Filter</strong>
                    {selectedFilters.length ? <button type="button" onClick={() => selectPopoverFilter(ALL_CATALOG_FILTER)}>Zurücksetzen</button> : null}
                  </div>
                  {ownedItemCount > 0 ? <div className="catalog-filter-group">
                    <span className="catalog-filter-label">Auswahl</span>
                    <CatalogFilterButton filter={OWNED_CATALOG_FILTER} count={ownedItemCount} selectedIds={selectedFilterIds} onSelect={selectPopoverFilter} />
                  </div> : null}
                  <CatalogFilterGroup label="Typen" options={filterOptions.types} selectedIds={selectedFilterIds} onSelect={selectPopoverFilter} />
                  <CatalogFilterGroup label="Bereiche" options={filterOptions.categories} selectedIds={selectedFilterIds} onSelect={selectPopoverFilter} />
                </div> : null}
              </div>
            </div>
            {commandsActive && commandPlatformOptions.length ? <nav className="catalog-platform-tabs" aria-label="Command-Plattform">
              <span className="catalog-platform-label">Plattform</span>
              {commandPlatformOptions.map(({ filter, count }) => <CatalogFilterButton
                key={filter.id}
                filter={filter}
                count={count}
                selectedIds={selectedFilterIds}
                onSelect={(platformFilter) => builtInCommandOption
                  ? selectCatalogFilters([builtInCommandOption.filter, platformFilter])
                  : selectCatalogFilter(platformFilter)}
              />)}
            </nav> : null}
            {selectedFilters.length ? <div className="active-filter-summary">
              <Tag aria-hidden="true" />
              <span>Aktiv: {selectedFilters.map((filter) => filter.label).join(", ")}</span>
              <button type="button" onClick={() => selectPopoverFilter(ALL_CATALOG_FILTER)}>Filter zurücksetzen</button>
            </div> : null}
          </section> : null}
          {activeView === "catalog" ? <>
          <div className="catalog-heading" data-tour="catalog">
            <div>
              <p>QuickGraph Katalog</p>
              <h1>{activeLabel}</h1>
            </div>
            <div className="catalog-controls">
              <div className={query ? "global-search catalog-search has-query" : "global-search catalog-search"} data-tour="search">
                <Search aria-hidden="true" />
                <label className="sr-only" htmlFor="catalog-search">Katalog durchsuchen</label>
                <input
                  id="catalog-search"
                  ref={searchInputRef}
                  type="search"
                  placeholder="Skills, Prompts und Apps durchsuchen"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query ? (
                  <button type="button" onClick={() => setQuery("")} title="Suche leeren">
                    <X aria-hidden="true" />
                    <span className="sr-only">Suche leeren</span>
                  </button>
                ) : (
                  <kbd>⌘/Ctrl K</kbd>
                )}
              </div>
              <span className="result-count">{itemCount} {itemCount === 1 ? "Eintrag" : "Einträge"}</span>
              <label className="catalog-sort">
                <span className="sr-only">Katalog sortieren</span>
                <select value={sort} onChange={(event) => updateCatalogSort(event.target.value as CatalogSort)} aria-label="Katalog sortieren">
                  <option value="name">Name</option>
                  <option value="description">Beschreibung</option>
                  <option value="newest">Neueste</option>
                  <option value="most-used">Most Used</option>
                  <option value="category">Kategorie</option>
                  <option value="owner">Owner</option>
                  <option value="length">Umfang</option>
                </select>
              </label>
              <EntryViewToggle view={view} onChange={updateView} label="Katalogansicht" />
            </div>
          </div>

          {filterOptions.kinds.length > 1 ? <nav className="catalog-kind-filter" aria-label="Nach Typ filtern">
            <span className="catalog-kind-label">Typ</span>
            {filterOptions.kinds.map(({ filter, count }) => <CatalogFilterButton
              key={filter.id}
              filter={filter}
              count={count}
              selectedIds={selectedFilterIds}
              onSelect={selectPopoverFilter}
            />)}
          </nav> : null}

          {loading ? <CatalogLoading /> : null}
          {!loading && error ? <AdapterError message={error} onRetry={async () => { await load(); }} /> : null}
          {!loading && !error && bootstrap ? (
            <Catalog
              items={visibleItems}
              view={view}
              onSelect={openItem}
              sort={sort}
              sortDirection={sortDirection}
              onSort={updateCatalogSort}
              quickAccessItemIds={quickAccessItemIds}
              onToggleQuickAccess={toggleQuickAccess}
              emptyTitle={adapter.kind === "browser" && dataMode === "virgin" ? "Virgin ist leer" : undefined}
              emptyDetail={
                adapter.kind === "browser" && dataMode === "virgin"
                  ? "Gespeicherte Einträge bleiben erhalten und erscheinen in anderen Datenmodi."
                  : undefined
              }
              onResetFilters={query.trim() || selectedFilters.length ? () => selectCatalogFilter(ALL_CATALOG_FILTER) : undefined}
            />
          ) : null}
          </> : null}
          {activeView === "apps" ? <MyApps
            items={modeItems}
            metadataByKey={appsById}
            onOpenApp={openItem}
            onAddApp={() => setDataCenterOpen(true)}
            view={view}
            onViewChange={updateView}
            quickAccessItemIds={quickAccessItemIds}
            onToggleQuickAccess={toggleQuickAccess}
          /> : null}
          {activeView === "usage" ? <UsageInsights
            summary={scopedUsageSummary}
            items={scopedItems}
            loading={usageLoading}
            error={usageError}
            onRefresh={loadUsage}
            onSelect={openItem}
            view={view}
            onViewChange={updateView}
          /> : null}
          {activeView === "least-used" ? <LeastUsed
            summary={scopedUsageSummary}
            items={scopedItems}
            loading={usageLoading}
            error={usageError}
            onRefresh={loadUsage}
            onSelect={openItem}
            view={view}
            onViewChange={updateView}
            quickAccessItemIds={quickAccessItemIds}
            onToggleQuickAccess={toggleQuickAccess}
          /> : null}
          {activeView === "context" ? <section data-tour="context-monitor"><ContextMonitor
            adapter={adapter}
            overview={contextOverview}
            loading={contextLoading}
            error={contextError}
            onRefresh={loadContext}
            onOpenDataCenter={() => setDataCenterOpen(true)}
            onOptimize={setOptimizationFile}
            view={view}
            onViewChange={updateView}
          /></section> : null}
          {activeView === "memory" ? <MemoryHub
            items={modeItems}
            contextOverview={contextOverview}
            focus={memoryFocus}
            onFocusChange={setMemoryFocus}
            onOpenContext={() => updateActiveView("context")}
            onOpenItem={openItem}
          /> : null}
          {activeView === "models" ? <ModelExplorer adapter={adapter} view={view} onViewChange={updateView} /> : null}
          {activeView === "app-builder" ? <AppBuilderGuide
            items={modeItems}
            onOpenSkill={openGuideSkill}
            focus={appBuilderFocus}
            onWorkflowChange={selectAppBuilderWorkflow}
          /> : null}
        </main>
      </div>

      <ItemDrawer
        adapter={adapter}
        app={selectedItem?.kind === "app" ? appsById.get(selectedItem.key) : null}
        item={selectedItem}
        inQuickAccess={selectedItem ? quickAccessItemIds.has(selectedItem.id) : false}
        onToggleQuickAccess={selectedItem && !isGuideSkillItem(selectedItem) ? toggleQuickAccess : undefined}
        onCatalogItemRenamed={remapQuickAccessItemId}
        onClose={closeItemDrawer}
        onCatalogChanged={async (updatedItem) => {
          if (updatedItem) setSelectedItem(updatedItem);
          await load();
        }}
      />
      <ContextOptimizer
        adapter={adapter}
        file={optimizationFile}
        onClose={closeOptimizer}
        onRefresh={loadContext}
      />
      <ContextQuickView
        file={quickViewTarget ? contextFiles.get(quickViewTarget) ?? null : null}
        open={quickViewTarget !== null}
        onClose={closeQuickView}
        onRefresh={async () => { await loadContext(); }}
        onOptimize={(file) => {
          setQuickViewTarget(null);
          setQuickViewReturnsToDataCenter(false);
          setOptimizationFile(file);
        }}
        onOpenDataCenter={() => {
          setQuickViewTarget(null);
          setQuickViewReturnsToDataCenter(false);
          setDataCenterOpen(true);
        }}
      />
      <DataCenterDialog
        adapter={browserDataAdapter}
        activeProfile={runtimeProfile}
        canSwitchProfile={Boolean(onSwitchProfile)}
        confirmLabel={startsWithSetup ? "Bestätigen und App starten" : "Einstellungen übernehmen"}
        contextOverview={contextOverview}
        onLocalCatalogExport={localCatalogExporter}
        onOpenContextFile={(target) => {
          setDataCenterOpen(false);
          setQuickViewReturnsToDataCenter(true);
          setQuickViewTarget(target);
        }}
        onOpenContextMonitor={() => {
          closeDataCenter();
          updateActiveView("context");
        }}
        onSwitchProfile={onSwitchProfile}
        items={bootstrap?.items ?? []}
        mode={dataMode}
        open={dataCenterOpen}
        onClose={closeDataCenter}
        onDataChanged={async () => { await load(); }}
        onModeChange={updateDataMode}
      />
      <AdapterStatusDialog
        adapter={adapter}
        health={health}
        open={adapterStatusOpen}
        onClose={() => setAdapterStatusOpen(false)}
        onOpenDataCenter={() => {
          setAdapterStatusOpen(false);
          setDataCenterOpen(true);
        }}
        onRefresh={async () => { await load(); }}
      />
      <OnboardingTour
        open={tourOpen}
        onClose={closeTour}
        onPrepareStep={prepareTourStep}
        profile={adapter.kind === "browser" ? "browser" : "local-api"}
      />
    </div>
  );
}

function isCatalogScopedView(view: AppViewPreference): boolean {
  return view === "catalog" || view === "usage" || view === "least-used";
}

function isPluginCategory(group: string, category: string): boolean {
  return /plugin/i.test(group) || /(?:^|\s)plugin$/i.test(category);
}

function isPluginCatalogItem(item: CatalogItem): boolean {
  return item.type === "skill" && isPluginCategory(item.group, item.category);
}

function usageForCatalogScope(
  summary: UsageSummary | null,
  items: readonly CatalogItem[],
): UsageSummary | null {
  if (!summary) return null;
  const itemIds = new Set(items.map((item) => item.id));
  const daily = summary.daily.filter((entry) => itemIds.has(entry.itemId));
  return {
    ...summary,
    daily,
    summary: {
      distinctItems: new Set(daily.map((entry) => entry.itemId)).size,
      totalEvents: daily.reduce((total, entry) => total + entry.count, 0),
    },
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function persistQuickAccessIds(itemIds: Set<string>): Set<string> {
  writeQuickAccessItemIds(itemIds);
  return itemIds;
}

function navigationFiltersQuickAccessId(filters: readonly CatalogFilter[]): string {
  return `nav:filters:${filters.map((filter) => filter.id).join("|")}`;
}

function quickAccessMeta(item: CatalogItem): string {
  if (item.kind === "command") return "Command";
  if (item.kind === "rule") return "Regel";
  if (item.type === "mcp-server") return "MCP";
  if (item.type === "prompt") return "Prompt";
  if (item.type === "app") return "App";
  if (item.type === "workflow") return "Workflow";
  return "Skill";
}

function statusLabel(status: string): string {
  if (status === "green") return "kompakt";
  if (status === "yellow") return "beobachten";
  if (status === "red") return "zu lang oder nicht erreichbar";
  return "nicht geladen";
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
}

interface CatalogFilterGroupProps {
  label: string;
  options: readonly CatalogFilterOption[];
  selectedIds: ReadonlySet<string>;
  onSelect: (filter: CatalogFilter) => void;
}

function CatalogFilterGroup({ label, options, selectedIds, onSelect }: CatalogFilterGroupProps) {
  if (options.length === 0) return null;
  return (
    <div className="catalog-filter-group">
      <span className="catalog-filter-label">{label}</span>
      {options.map(({ filter, count }) => (
        <CatalogFilterButton key={filter.id} filter={filter} count={count} selectedIds={selectedIds} onSelect={onSelect} />
      ))}
    </div>
  );
}

interface CatalogFilterButtonProps {
  filter: CatalogFilter;
  count: number;
  selectedIds: ReadonlySet<string>;
  onSelect: (filter: CatalogFilter) => void;
}

function CatalogFilterButton({ filter, count, selectedIds, onSelect }: CatalogFilterButtonProps) {
  const active = filter.kind === "all" ? selectedIds.size === 0 : selectedIds.has(filter.id);
  return (
    <button
      className={active ? "catalog-filter-button active" : "catalog-filter-button"}
      type="button"
      onClick={() => onSelect(filter)}
      aria-pressed={active}
    >
      <span>{filter.label}</span>
      <small>{count}</small>
    </button>
  );
}

function CatalogLoading() {
  return (
    <div className="catalog-grid" aria-label="Katalog wird geladen" aria-busy="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="catalog-card skeleton-card" key={index} />
      ))}
    </div>
  );
}

interface AdapterErrorProps {
  message: string;
  onRetry: () => Promise<void>;
}

function AdapterError({ message, onRetry }: AdapterErrorProps) {
  return (
    <div className="adapter-error" role="alert">
      <strong>Gewählter Adapter nicht verfügbar</strong>
      <p>{message}</p>
      <button className="secondary-button" type="button" onClick={() => void onRetry()}>
        <RefreshCw aria-hidden="true" />
        Erneut verbinden
      </button>
    </div>
  );
}
