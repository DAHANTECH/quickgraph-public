import type {
  AdapterHealth,
  AdapterKind,
  AppHealth,
  AppLaunchResult,
  CatalogContentUpdateRequest,
  CatalogContentUpdateResult,
  CatalogItem,
  CatalogTransfer,
  ContextConfirmRequest,
  ContextOverview,
  ContextPrepareRequest,
  ContextPrepareResult,
  ContextTarget,
  ModelRefreshResult,
  OperationReceipt,
  QuickGraphBootstrap,
  ScanSourcesResult,
  UsageEvent,
  UsageSummary,
} from "./types";

export const CAPABILITY_KEYS = [
  "catalogRead",
  "catalogManage",
  "catalogPersist",
  "contentWrite",
  "usageRead",
  "usageWrite",
  "sourceScan",
  "contextRead",
  "contextOptimize",
  "appHealth",
  "appLaunch",
  "modelRefresh",
] as const;

export type Capability = (typeof CAPABILITY_KEYS)[number];
export type CapabilityFlags = Readonly<Record<Capability, boolean>>;

export interface QuickGraphAdapter {
  readonly kind: AdapterKind;
  readonly capabilities: CapabilityFlags;

  initialize(): Promise<void>;
  getHealth(): Promise<AdapterHealth>;
  getBootstrap(): Promise<QuickGraphBootstrap>;
  getItem(id: string): Promise<CatalogItem | null>;
  updateCatalogItemContent(request: CatalogContentUpdateRequest): Promise<CatalogContentUpdateResult>;
  renameCatalogItem(itemId: string, newSlug: string): Promise<{ itemId: string }>;
  archiveCatalogItem(itemId: string, confirmation: "delete"): Promise<void>;
  getUsageSummary(forceRefresh?: boolean): Promise<UsageSummary>;
  getModelCatalog(): Promise<unknown>;
  getContextOverview(): Promise<ContextOverview>;
  recordUsage(event: UsageEvent): Promise<void>;
  scanSources(): Promise<ScanSourcesResult>;
  prepareContext(
    target: ContextTarget,
    request: ContextPrepareRequest,
  ): Promise<ContextPrepareResult>;
  confirmContext(
    target: ContextTarget,
    request: ContextConfirmRequest,
  ): Promise<OperationReceipt>;
  getAppHealth(appId: string): Promise<AppHealth>;
  launchApp(appId: string): Promise<AppLaunchResult>;
  refreshModels(): Promise<ModelRefreshResult>;
}

export class CatalogContentConflictError extends Error {
  constructor(readonly currentItem: CatalogItem) {
    super("Die Datei wurde außerhalb von QuickGraph geändert.");
    this.name = "CatalogContentConflictError";
  }
}

export interface CatalogTransferSource {
  exportCatalog(): Promise<CatalogTransfer>;
}

export class UnsupportedCapabilityError extends Error {
  readonly capability: Capability;
  readonly adapterKind: AdapterKind;

  constructor(adapterKind: AdapterKind, capability: Capability) {
    super(`Adapter "${adapterKind}" unterstützt "${capability}" nicht.`);
    this.name = "UnsupportedCapabilityError";
    this.adapterKind = adapterKind;
    this.capability = capability;
  }
}

export function unsupported(
  adapterKind: AdapterKind,
  capability: Capability,
): Promise<never> {
  return Promise.reject(new UnsupportedCapabilityError(adapterKind, capability));
}
