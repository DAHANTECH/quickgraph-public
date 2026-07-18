import { CatalogContentConflictError, summarizeContext, unsupported } from "../../domain";
import type {
  AdapterHealth,
  AppHealth,
  AppLaunchResult,
  CapabilityFlags,
  CatalogContentUpdateRequest,
  CatalogContentUpdateResult,
  CatalogItem,
  CatalogTransfer,
  CatalogTransferSource,
  ContextConfirmRequest,
  ContextFileOverview,
  ContextOverview,
  ContextPrepareRequest,
  ContextPrepareResult,
  ContextTarget,
  ModelRefreshResult,
  OperationReceipt,
  QuickGraphAdapter,
  QuickGraphBootstrap,
  ScanSourcesResult,
  UsageEvent,
  UsageSummary,
} from "../../domain";
import type { components, paths } from "../../lib/api-types";
import { PUBLIC_CATALOG_ITEMS } from "../../data/public-catalog";
import { isSafeSkillIllustrationPath } from "../../lib/public-asset";

type ApiSchema<Name extends keyof components["schemas"]> = components["schemas"][Name];
type BootstrapResponse = ApiSchema<"BootstrapResponse">;
type CatalogItemResponse = ApiSchema<"CatalogItem">;
type ContextTargetsResponse = ApiSchema<"ContextTargetsResponse">;
type ContextPrepareRequestPayload = ApiSchema<"ContextPrepareRequest">;
type ContextPrepareResponse = ApiSchema<"ContextPrepareResponse">;
type ContextConfirmRequestPayload = ApiSchema<"ContextConfirmRequest">;
type ContextConfirmResponse = ApiSchema<"ContextConfirmResponse">;
type HealthResponse = ApiSchema<"HealthResponse">;
type ScanSourcesRequest = ApiSchema<"ScanSourcesRequest">;
type ScanSourcesResponse = ApiSchema<"ScanSourcesResponse">;
type UsageSummaryResponse = ApiSchema<"UsageSummaryResponse">;
type ModelSnapshotResponse = ApiSchema<"ModelSnapshotResponse">;
type ModelRefreshResponse = ApiSchema<"ModelRefreshResponse">;
type AppHealthResponse = ApiSchema<"AppHealthResponse">;
type AppLaunchResponse = ApiSchema<"AppLaunchResponse">;
type CatalogRenameRequest = ApiSchema<"CatalogRenameRequest">;
type CatalogRenameResponse = ApiSchema<"CatalogRenameResponse">;
type CatalogDeleteRequest = ApiSchema<"CatalogDeleteRequest">;
type CatalogContentUpdateRequestPayload = ApiSchema<"CatalogContentUpdateRequest">;
type CatalogContentUpdateResponse = ApiSchema<"CatalogContentUpdateResponse">;

export const LOCAL_API_CAPABILITIES: CapabilityFlags = Object.freeze({
  catalogRead: true,
  catalogManage: false,
  catalogPersist: false,
  contentWrite: false,
  usageRead: true,
  usageWrite: false,
  sourceScan: true,
  contextRead: true,
  contextOptimize: true,
  appHealth: true,
  appLaunch: false,
  modelRefresh: true,
});

export class LocalApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "LocalApiError";
  }
}

export class LocalApiQuickGraphAdapter implements QuickGraphAdapter, CatalogTransferSource {
  readonly kind = "local-api" as const;
  private capabilityFlags: CapabilityFlags = LOCAL_API_CAPABILITIES;

  constructor(
    private readonly baseUrl = "",
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly requestTimeoutMs = 10_000,
  ) {}

  get capabilities(): CapabilityFlags {
    return this.capabilityFlags;
  }

  async initialize(): Promise<void> {
    await this.getHealth();
  }

  async getHealth(): Promise<AdapterHealth> {
    const response = await this.request<HealthResponse>(API_PATHS.health);
    return { status: response.status, adapter: response.adapter };
  }

  async getBootstrap(): Promise<QuickGraphBootstrap> {
    const response = await this.request<BootstrapResponse>(API_PATHS.bootstrap);
    this.capabilityFlags = Object.freeze({
      ...LOCAL_API_CAPABILITIES,
      catalogManage: response.capabilities.catalogManage.available === true,
      contentWrite: response.capabilities.catalogContentWrite.available === true,
      appLaunch: response.capabilities.appLaunching.available === true,
    });
    return {
      items: mergeLocalAndPublicCatalogItems(response.items.map(normalizeCatalogItem)),
      apps: response.apps.map((app) => ({
        id: app.id,
        name: app.name,
        type: app.type,
        category: app.category,
        description: app.description,
        available: app.available,
        launchConfigured: app.launchConfigured,
        url: app.url,
        pathHint: app.pathHint,
        stack: app.stack,
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        screenshot: app.screenshot,
        screenshotLabel: app.screenshotLabel,
      })),
      generatedAt: requireResponseField(
        response.generatedAt,
        API_PATHS.bootstrap,
        "generatedAt",
      ),
    };
  }

  async exportCatalog(): Promise<CatalogTransfer> {
    const bootstrap = await this.getBootstrap();
    const itemIdsByTransferId = new Map<string, string>();
    const localItems = bootstrap.items.filter((item) => item.source !== "public-catalog");
    const items = localItems.map((item, index) => {
      const transferId = `local-${index + 1}`;
      itemIdsByTransferId.set(item.id, transferId);
      return {
        transferId,
        key: item.key,
        type: item.type,
        kind: item.kind,
        name: item.name,
        description: item.description || "Keine Beschreibung verfügbar.",
        category: item.category,
        group: item.group,
        ...(item.commandCategory ? { commandCategory: item.commandCategory } : {}),
        ...(item.commandPlatform ? { commandPlatform: item.commandPlatform } : {}),
        origin: "Lokaler QuickGraph-Katalog",
        tags: item.tags,
        content: item.content,
        ...(item.provenance ? { provenance: item.provenance } : {}),
        ...(item.illustration ? { illustration: item.illustration } : {}),
        ...(item.invoke ? { invoke: item.invoke } : {}),
        updatedAt: item.updatedAt,
      };
    });
    const usage = await this.getUsageSummary(true);
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      items,
      usageDaily: usage.daily.flatMap((entry) => {
        const transferId = itemIdsByTransferId.get(entry.itemId);
        return transferId
          ? [{ date: entry.date, transferId, count: entry.count }]
          : [];
      }),
    };
  }

  async getItem(id: string): Promise<CatalogItem | null> {
    const publicItem = PUBLIC_CATALOG_ITEMS.find((item) => item.id === id);
    if (publicItem) return publicItem;
    const path = API_PATHS.item.replace("{id}", encodeURIComponent(id));
    const response = await this.request<CatalogItemResponse>(path);
    return normalizeCatalogItem(response);
  }

  async renameCatalogItem(itemId: string, newSlug: string): Promise<{ itemId: string }> {
    const payload: CatalogRenameRequest = { itemId, newSlug };
    const response = await this.request<CatalogRenameResponse>(API_PATHS.catalogRename, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { itemId: response.itemId };
  }

  async archiveCatalogItem(itemId: string, confirmation: "delete"): Promise<void> {
    const payload: CatalogDeleteRequest = { itemId, confirm: confirmation };
    await this.request<void>(API_PATHS.catalogDelete, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateCatalogItemContent(
    request: CatalogContentUpdateRequest,
  ): Promise<CatalogContentUpdateResult> {
    const path = API_PATHS.catalogContent.replace(
      "{id}",
      encodeURIComponent(request.itemId),
    );
    const payload: CatalogContentUpdateRequestPayload = {
      content: request.content,
      expectedRevision: request.expectedRevision,
    };
    try {
      const response = await this.request<CatalogContentUpdateResponse>(path, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      return {
        item: normalizeCatalogItem(response.item),
        backupCreated: response.backupCreated,
      };
    } catch (error) {
      if (error instanceof LocalApiError && error.status === 409) {
        const detail = error.detail as {
          code?: unknown;
          currentItem?: CatalogItemResponse;
        } | undefined;
        if (detail?.code === "revision_conflict" && detail.currentItem) {
          throw new CatalogContentConflictError(
            normalizeCatalogItem(detail.currentItem),
          );
        }
      }
      throw error;
    }
  }

  async getUsageSummary(forceRefresh = false): Promise<UsageSummary> {
    const path = forceRefresh
      ? `${API_PATHS.usageSummary}?refresh=true`
      : API_PATHS.usageSummary;
    const response = await this.request<UsageSummaryResponse>(path);
    return {
      adapter: this.kind,
      daily: response.daily.map((entry) => ({
        date: entry.date,
        itemId: entry.itemId,
        count: entry.count,
      })),
      schemaVersion: response.schemaVersion,
      summary: {
        distinctItems: response.summary.distinctItems,
        totalEvents: response.summary.totalEvents,
      },
      write: response.write ?? {
        accepted: false,
        persistence: "local-scanner",
        reason: "LocalAPI-Antwort enthält keinen Scanner-Schreibstatus.",
      },
    };
  }

  async getContextOverview(): Promise<ContextOverview> {
    const response = await this.request<ContextTargetsResponse>(API_PATHS.context);
    const files: ContextFileOverview[] = response.targets
      .filter((target) => target.available !== false)
      .map((target) => ({
        target: target.target,
        name: CONTEXT_NAMES[target.target],
        content: target.content,
        source: "filesystem",
        lines: target.lines,
        chars: target.characters,
        tokens: target.estimatedTokens,
        status: target.status,
      }));
    return {
      adapter: this.kind,
      files,
      schemaVersion: 1,
      summary: summarizeContext(files),
    };
  }

  recordUsage(event: UsageEvent): Promise<void> {
    void event;
    return unsupported(this.kind, "usageWrite");
  }

  async getModelCatalog(): Promise<unknown> {
    return this.request<ModelSnapshotResponse>(API_PATHS.modelSnapshot);
  }

  async scanSources(): Promise<ScanSourcesResult> {
    const payload: ScanSourcesRequest = { sourceIds: [] };
    const response = await this.request<ScanSourcesResponse>(API_PATHS.sourceScan, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return {
      indexed: response.indexed,
      scannedAt: requireResponseField(
        response.scannedAt,
        API_PATHS.sourceScan,
        "scannedAt",
      ),
      sources: response.sources.map((source) => ({ ...source })),
    };
  }

  async prepareContext(
    target: ContextTarget,
    request: ContextPrepareRequest,
  ): Promise<ContextPrepareResult> {
    const payload: ContextPrepareRequestPayload = request.feedback ? { feedback: request.feedback } : {};
    const response = await this.request<ContextPrepareResponse>(
      API_PATHS.contextPrepare.replace("{target}", target),
      { method: "POST", body: JSON.stringify(payload) },
    );
    return {
      prepareId: response.prepareId,
      target: response.target,
      before: response.before,
      preview: response.preview,
      backupId: response.backupId,
      expiresAt: response.expiresAt,
    };
  }

  async confirmContext(
    target: ContextTarget,
    request: ContextConfirmRequest,
  ): Promise<OperationReceipt> {
    const payload: ContextConfirmRequestPayload = {
      prepareId: request.prepareId,
      draft: request.draft,
      ...(request.feedback ? { feedback: request.feedback } : {}),
    };
    const response = await this.request<ContextConfirmResponse>(
      API_PATHS.contextConfirm.replace("{target}", target),
      { method: "POST", body: JSON.stringify(payload) },
    );
    return { operationId: response.operationId, status: response.status };
  }

  async getAppHealth(appId: string): Promise<AppHealth> {
    const response = await this.request<AppHealthResponse>(
      API_PATHS.appHealth.replace("{app_id}", encodeURIComponent(appId)),
    );
    return {
      id: response.id,
      status: response.status,
      ...(response.url ? { url: response.url } : {}),
    };
  }

  async launchApp(appId: string): Promise<AppLaunchResult> {
    const response = await this.request<AppLaunchResponse>(
      API_PATHS.appLaunch.replace("{app_id}", encodeURIComponent(appId)),
      { method: "POST" },
    );
    return { id: response.id, status: response.status, url: response.url };
  }

  async refreshModels(): Promise<ModelRefreshResult> {
    const response = await this.request<ModelRefreshResponse>(API_PATHS.modelRefresh, {
      method: "POST",
    });
    return { updated: response.updated, refreshedAt: response.refreshedAt };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    const abortController = new AbortController();
    const abortFromCaller = () => abortController.abort(init.signal?.reason);
    if (init.signal?.aborted) abortFromCaller();
    else init.signal?.addEventListener("abort", abortFromCaller, { once: true });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const timeoutSeconds = Math.max(1, Math.ceil(this.requestTimeoutMs / 1_000));
    const timeoutMessage = `LocalAPI antwortete nicht innerhalb von ${timeoutSeconds} ${timeoutSeconds === 1 ? "Sekunde" : "Sekunden"}.`;
    try {
      const request = this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        signal: abortController.signal,
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
      });
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          abortController.abort();
          reject(new LocalApiError(
            timeoutMessage,
            0,
            path,
          ));
        }, this.requestTimeoutMs);
      });
      response = await Promise.race([request, timeout]);
    } catch (error) {
      if (timedOut) {
        throw new LocalApiError(
          timeoutMessage,
          0,
          path,
        );
      }
      if (error instanceof LocalApiError) throw error;
      throw new LocalApiError(
        `LocalAPI ist nicht erreichbar: ${error instanceof Error ? error.message : "Netzwerkfehler"}`,
        0,
        path,
      );
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      init.signal?.removeEventListener("abort", abortFromCaller);
    }

    if (!response.ok) {
      const responseBody = await response.text();
      let detail = responseBody;
      let structuredDetail: unknown;
      try {
        const parsed = JSON.parse(responseBody) as { detail?: unknown };
        structuredDetail = parsed.detail;
        if (typeof parsed.detail === "string") detail = parsed.detail;
        else if (parsed.detail && typeof parsed.detail === "object") {
          const message = (parsed.detail as { message?: unknown }).message;
          if (typeof message === "string") detail = message;
        }
      } catch {
        // Non-JSON errors retain their original response text.
      }
      throw new LocalApiError(
        detail || `LocalAPI antwortete mit HTTP ${response.status}.`,
        response.status,
        path,
        structuredDetail,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

export function mergeLocalAndPublicCatalogItems(localItems: CatalogItem[]): CatalogItem[] {
  const byIdentity = new Map<string, CatalogItem>();
  for (const item of PUBLIC_CATALOG_ITEMS) byIdentity.set(catalogIdentity(item), item);
  for (const item of localItems) byIdentity.set(catalogIdentity(item), item);
  return [...byIdentity.values()].sort(
    (left, right) => left.name.localeCompare(right.name, "de") || left.key.localeCompare(right.key, "de"),
  );
}

function catalogIdentity(item: CatalogItem): string {
  return `${item.kind}:${item.key.trim().toLocaleLowerCase("en-US")}`;
}

const CONTEXT_NAMES = {
  claude: "CLAUDE.md",
  memory: "MEMORY.md",
  codex: "AGENTS.md",
} as const;

const API_PATHS = {
  health: "/api/health",
  bootstrap: "/api/v1/bootstrap",
  context: "/api/v1/context",
  contextPrepare: "/api/v1/context/{target}/prepare",
  contextConfirm: "/api/v1/context/{target}/confirm",
  item: "/api/v1/items/{id}",
  sourceScan: "/api/v1/sources/scan",
  usageSummary: "/api/v1/usage/summary",
  modelSnapshot: "/api/v1/models/snapshot",
  modelRefresh: "/api/v1/models/refresh",
  appHealth: "/api/v1/apps/{app_id}/health",
  appLaunch: "/api/v1/apps/{app_id}/launch",
  catalogRename: "/api/v1/catalog/items/rename",
  catalogDelete: "/api/v1/catalog/items/delete",
  catalogContent: "/api/v1/catalog/items/{id}/content",
} as const satisfies Record<string, keyof paths>;

function normalizeCatalogItem(item: CatalogItemResponse): CatalogItem {
  return {
    id: item.id,
    key: item.key,
    type: item.type,
    kind: item.kind,
    name: item.name,
    description: item.description,
    category: item.category,
    group: item.group,
    ...(item.commandCategory ? { commandCategory: item.commandCategory } : {}),
    ...(item.commandPlatform ? { commandPlatform: item.commandPlatform } : {}),
    origin: item.origin,
    source: item.source,
    tags: item.tags ?? [],
    content: item.content,
    ...(item.sourceId ? { sourceId: item.sourceId } : {}),
    ...(item.relativePath ? { relativePath: item.relativePath } : {}),
    revision: item.revision,
    owned: item.owned === true,
    ...normalizeProvenance(item),
    ...(item.invoke ? { invoke: item.invoke } : {}),
    updatedAt: item.updatedAt,
  };
}

function normalizeProvenance(item: CatalogItemResponse): Pick<CatalogItem, "provenance" | "illustration"> {
  const candidate = item as CatalogItemResponse & {
    provenance?: CatalogItem["provenance"];
    illustration?: CatalogItem["illustration"];
  };
  const provenance = candidate.provenance;
  const illustration = candidate.illustration;
  if (!provenance || !["first_party", "third_party", "derived", "conflict", "unknown"].includes(provenance.classification)) {
    return {};
  }
  const result: Pick<CatalogItem, "provenance" | "illustration"> = {
    provenance: {
      ...provenance,
      ...(provenance.homepage?.startsWith("https://") ? { homepage: provenance.homepage } : { homepage: undefined }),
      ...(provenance.repository?.startsWith("https://") ? { repository: provenance.repository } : { repository: undefined }),
    },
  };
  if (
    illustration
    && isSafeSkillIllustrationPath(illustration.src)
  ) {
    result.illustration = illustration;
  }
  return result;
}

function requireResponseField<T>(
  value: T | null | undefined,
  path: string,
  field: string,
): T {
  if (value === null || value === undefined) {
    throw new LocalApiError(
      `LocalAPI-Antwort für ${path} enthält kein Feld "${field}".`,
      502,
      path,
    );
  }
  return value;
}
