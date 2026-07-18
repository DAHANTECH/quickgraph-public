import type {
  AdapterHealth,
  AppHealth,
  AppLaunchResult,
  CatalogContentUpdateRequest,
  CatalogContentUpdateResult,
  CatalogItem,
  ContextFileOverview,
  ContextConfirmRequest,
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
import { CatalogContentConflictError, contextMetrics, summarizeContext, unsupported } from "../../domain";
import { PUBLIC_CATALOG_APPS } from "../../data/public-catalog";
import {
  deleteContextRevisions,
  deleteImportedItems,
  deleteUsageHistory,
  exportBrowserData,
  openQuickGraphDatabase,
  replaceContextRevisions,
  replaceImportedCatalogData,
  replaceImportedItems,
  resetBrowserOwnedData,
  resetDemoItems,
  seedDemoItems,
  seedPublicCatalogItems,
  type BrowserDataExport,
  type ContextOperationRecord,
  type ContextRevisionRecord,
  type QuickGraphDatabaseHandle,
} from "./database";
import { parseImportBatch, type LocalImportFile } from "./importer";
import { parseAppImportFiles } from "./app-importer";

export const BROWSER_CAPABILITIES = Object.freeze({
  catalogRead: true,
  catalogManage: false,
  catalogPersist: true,
  contentWrite: true,
  usageRead: true,
  usageWrite: true,
  sourceScan: false,
  contextRead: true,
  contextOptimize: true,
  appHealth: false,
  appLaunch: false,
  modelRefresh: false,
});

export class BrowserQuickGraphAdapter implements QuickGraphAdapter {
  readonly kind = "browser" as const;
  readonly capabilities = BROWSER_CAPABILITIES;

  private database: QuickGraphDatabaseHandle | null = null;

  constructor(private readonly databaseName?: string) {}

  async initialize(): Promise<void> {
    const database = await this.getDatabase();
    await seedPublicCatalogItems(database);
    await seedDemoItems(database);
  }

  async getHealth(): Promise<AdapterHealth> {
    await this.getDatabase();
    return {
      status: "ok",
      adapter: this.kind,
      detail: "IndexedDB v2 ist verfügbar.",
    };
  }

  async getBootstrap(): Promise<QuickGraphBootstrap> {
    const database = await this.getDatabase();
    await seedPublicCatalogItems(database);
    await seedDemoItems(database);
    const items = await database.getAll("items");

    return {
      items: items.sort((left, right) => left.name.localeCompare(right.name, "de")),
      apps: PUBLIC_CATALOG_APPS,
      generatedAt: new Date().toISOString(),
      sourceLabel: "Browser · Public catalog + IndexedDB",
    };
  }

  async getItem(id: string): Promise<CatalogItem | null> {
    const item = await (await this.getDatabase()).get("items", id);
    return item ? { ...item, revision: await sha256(item.content) } : null;
  }

  async updateCatalogItemContent(
    request: CatalogContentUpdateRequest,
  ): Promise<CatalogContentUpdateResult> {
    const database = await this.getDatabase();
    const current = await database.get("items", request.itemId);
    if (!current || current.source !== "browser-import" || !["skill", "prompt"].includes(current.kind)) {
      return unsupported(this.kind, "contentWrite");
    }
    const currentRevision = await sha256(current.content);
    if (currentRevision !== request.expectedRevision) {
      throw new CatalogContentConflictError({ ...current, revision: currentRevision });
    }
    const nextRevision = await sha256(request.content);
    const transaction = database.transaction("items", "readwrite");
    const latest = await transaction.store.get(request.itemId);
    if (!latest || latest.source !== "browser-import" || !["skill", "prompt"].includes(latest.kind)) {
      transaction.abort();
      await transaction.done.catch(() => undefined);
      return unsupported(this.kind, "contentWrite");
    }
    if (latest.content !== current.content) {
      transaction.abort();
      await transaction.done.catch(() => undefined);
      throw new CatalogContentConflictError({
        ...latest,
        revision: await sha256(latest.content),
      });
    }
    const updated: CatalogItem = {
      ...latest,
      content: request.content,
      revision: nextRevision,
      updatedAt: new Date().toISOString(),
    };
    await transaction.store.put(updated);
    await transaction.done;
    return { item: updated, backupCreated: false };
  }

  renameCatalogItem(_itemId: string, _newSlug: string): Promise<{ itemId: string }> {
    return unsupported(this.kind, "catalogManage");
  }

  archiveCatalogItem(_itemId: string, _confirmation: "delete"): Promise<void> {
    return unsupported(this.kind, "catalogManage");
  }

  async getUsageSummary(_forceRefresh = false): Promise<UsageSummary> {
    const daily = (await (await this.getDatabase()).getAll("usageDaily"))
      .map(({ date, itemId, count }) => ({ date, itemId, count }))
      .sort((left, right) => left.date.localeCompare(right.date) || left.itemId.localeCompare(right.itemId));
    return {
      adapter: this.kind,
      daily,
      schemaVersion: 1,
      summary: {
        distinctItems: new Set(daily.map((entry) => entry.itemId)).size,
        totalEvents: daily.reduce((total, entry) => total + entry.count, 0),
      },
      write: { accepted: true, persistence: "indexeddb" },
    };
  }

  async getModelCatalog(): Promise<unknown> {
    const response = await fetch("/openrouter-models.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`OpenRouter-Snapshot konnte nicht geladen werden (${response.status}).`);
    }
    return response.json();
  }

  async getContextOverview(): Promise<ContextOverview> {
    const revisions = await (await this.getDatabase()).getAll("contextRevisions");
    const latest = new Map<ContextTarget, ContextRevisionRecord>();
    for (const revision of revisions) {
      const current = latest.get(revision.target);
      if (!current || revision.createdAt > current.createdAt) latest.set(revision.target, revision);
    }
    const files: ContextFileOverview[] = [...latest.values()]
      .map((revision) => {
        const metrics = contextMetrics(revision.content);
        return {
          target: revision.target,
          name: CONTEXT_NAMES[revision.target],
          content: revision.content,
          source: "import" as const,
          ...metrics,
        };
      })
      .sort((left, right) => CONTEXT_ORDER.indexOf(left.target) - CONTEXT_ORDER.indexOf(right.target));
    return {
      adapter: this.kind,
      files,
      schemaVersion: 1,
      summary: summarizeContext(files),
    };
  }

  async recordUsage(event: UsageEvent): Promise<void> {
    const database = await this.getDatabase();
    const date = event.occurredAt.slice(0, 10);
    const transaction = database.transaction("usageDaily", "readwrite");
    const store = transaction.store;
    const key: [string, string] = [date, event.itemId];
    const current = await store.get(key);
    const actions = current?.actions ?? { open: 0, copy: 0, invoke: 0 };

    await store.put({
      date,
      itemId: event.itemId,
      count: (current?.count ?? 0) + 1,
      actions: { ...actions, [event.action]: actions[event.action] + 1 },
      updatedAt: event.occurredAt,
    });
    await transaction.done;
  }

  async importFiles(
    files: readonly LocalImportFile[],
    markAsOwned = false,
  ): Promise<CatalogItem[]> {
    if (files.length === 0) return [];
    const database = await this.getDatabase();
    const parsed = await parseImportBatch(
      files,
      await database.getAll("items"),
      new Date().toISOString(),
      markAsOwned,
    );
    if (parsed.hasUsageData) {
      await replaceImportedCatalogData(database, parsed.items, parsed.usageDaily);
    } else {
      await replaceImportedItems(database, parsed.items);
    }
    return parsed.items;
  }

  async importAppManifests(files: readonly LocalImportFile[]): Promise<CatalogItem[]> {
    if (files.length === 0) return [];
    const database = await this.getDatabase();
    const items = await parseAppImportFiles(
      files,
      await database.getAll("items"),
      new Date().toISOString(),
    );
    await replaceImportedItems(database, items);
    return items;
  }

  async importDirectoryFiles(
    files: readonly LocalImportFile[],
    markSkillsAsOwned = false,
  ): Promise<CatalogItem[]> {
    if (files.length === 0) return [];
    const database = await this.getDatabase();
    const existingItems = await database.getAll("items");
    const manifests = files.filter((file) => file.name.toLocaleLowerCase("de") === "package.json");
    const catalogFiles = files.filter((file) => file.name.toLocaleLowerCase("de") !== "package.json");
    const parsedCatalog = await parseImportBatch(
      catalogFiles,
      existingItems,
      new Date().toISOString(),
      markSkillsAsOwned,
    );
    const catalogItems = parsedCatalog.items;
    const appItems = await parseAppImportFiles(
      manifests,
      [...existingItems, ...catalogItems],
      new Date().toISOString(),
    );
    const imported = [...catalogItems, ...appItems];
    const ids = new Set(imported.map((item) => item.id));
    if (ids.size !== imported.length) {
      throw new Error("Die Ordnerauswahl enthält doppelte Katalogeinträge.");
    }
    if (parsedCatalog.hasUsageData) {
      await replaceImportedCatalogData(database, imported, parsedCatalog.usageDaily);
    } else {
      await replaceImportedItems(database, imported);
    }
    return imported;
  }

  async importContextFiles(files: readonly LocalImportFile[]): Promise<ContextRevisionRecord[]> {
    if (files.length === 0) return [];
    const database = await this.getDatabase();
    const existing = await database.getAll("contextRevisions");
    const latestCreatedAt = existing.reduce(
      (latest, revision) => Math.max(latest, Date.parse(revision.createdAt) || 0),
      0,
    );
    const createdAt = new Date(Math.max(Date.now(), latestCreatedAt + 1)).toISOString();
    const seenTargets = new Set<ContextTarget>();
    const revisions: ContextRevisionRecord[] = [];

    for (const file of files) {
      const normalizedName = file.name.toLocaleUpperCase("de");
      const target = CONTEXT_TARGET_BY_NAME[normalizedName];
      if (!target) throw new Error(`${file.name}: Wähle CLAUDE.md, MEMORY.md oder AGENTS.md.`);
      if (file.size <= 0) throw new Error(`${file.name}: Die Datei ist leer.`);
      if (file.size > 1_000_000) throw new Error(`${file.name}: Die Datei überschreitet das Limit von 1 MB.`);
      if (seenTargets.has(target)) throw new Error(`${file.name}: Dieses Kontextziel ist in der Auswahl doppelt.`);
      seenTargets.add(target);

      const content = await file.text();
      if (!content.trim()) throw new Error(`${file.name}: Die Datei enthält keinen Kontext.`);
      revisions.push({
        id: `context:${target}:${createdAt}:${crypto.randomUUID()}`,
        target,
        content,
        createdAt,
        source: "imported",
        sourceName: file.name,
        checksum: await sha256(content),
      });
    }

    await replaceContextRevisions(database, revisions);
    return revisions;
  }

  async deleteImportedCatalogItems(): Promise<number> {
    return deleteImportedItems(await this.getDatabase());
  }

  async deleteContextFiles(): Promise<number> {
    return deleteContextRevisions(await this.getDatabase());
  }

  async deleteUsageHistory(): Promise<number> {
    return deleteUsageHistory(await this.getDatabase());
  }

  async resetBrowserData(): Promise<void> {
    await resetBrowserOwnedData(await this.getDatabase());
  }

  async resetDemoData(): Promise<void> {
    await resetDemoItems(await this.getDatabase());
  }

  async exportData(): Promise<BrowserDataExport> {
    return exportBrowserData(await this.getDatabase());
  }

  scanSources(): Promise<ScanSourcesResult> {
    return unsupported(this.kind, "sourceScan");
  }

  async prepareContext(
    target: ContextTarget,
    request: ContextPrepareRequest,
  ): Promise<ContextPrepareResult> {
    const database = await this.getDatabase();
    const revision = latestContextRevision(
      (await database.getAllFromIndex("contextRevisions", "by-target", target))
        .filter(({ source }) => source === "imported"),
    );
    if (!revision) throw new Error("Für dieses Ziel ist kein importierter Kontext verfügbar.");

    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + CONTEXT_PREPARE_TTL_MS).toISOString();
    const prepareId = `context-prepare:${crypto.randomUUID()}`;
    const backupId = `context-backup:${crypto.randomUUID()}`;
    const preview = normalizeContextPreview(revision.content);
    const [revisionChecksum, previewChecksum] = await Promise.all([
      sha256(revision.content),
      sha256(preview),
    ]);
    if (revisionChecksum !== revision.checksum) {
      throw new Error("Der importierte Kontext ist inkonsistent und kann nicht vorbereitet werden.");
    }

    const operation: ContextOperationRecord = {
      id: prepareId,
      target,
      revisionId: revision.id,
      revisionChecksum,
      before: revision.content,
      sourceName: revision.sourceName,
      preview,
      previewChecksum,
      backupId,
      createdAt,
      expiresAt,
      ...(request.feedback ? { feedback: request.feedback } : {}),
    };
    const transaction = database.transaction(["backups", "contextOperations"], "readwrite");
    await transaction.objectStore("backups").put({
      id: backupId,
      aggregate: `context:${target}`,
      createdAt,
      payload: { target, revision },
    });
    await transaction.objectStore("contextOperations").put(operation);
    await transaction.done;

    return { prepareId, target, before: revision.content, preview, backupId, expiresAt };
  }

  async confirmContext(
    target: ContextTarget,
    request: ContextConfirmRequest,
  ): Promise<OperationReceipt> {
    const draftChecksum = await sha256(request.draft);
    const database = await this.getDatabase();
    const transaction = database.transaction(["contextOperations", "contextRevisions"], "readwrite");
    const operation = await transaction.objectStore("contextOperations").get(request.prepareId);

    if (!operation || operation.target !== target || !isUnexpired(operation.expiresAt)) {
      await transaction.done;
      throw new Error("Die vorbereitete Kontextoperation ist ungültig oder abgelaufen.");
    }

    const revisions = await transaction.objectStore("contextRevisions").index("by-target").getAll(target);
    const current = latestContextRevision(revisions.filter(({ source }) => source === "imported"));
    if (
      !current
      || current.id !== operation.revisionId
      || current.checksum !== operation.revisionChecksum
      || current.content !== operation.before
    ) {
      await transaction.done;
      throw new Error("Die vorbereitete Kontextoperation ist nicht mehr aktuell.");
    }

    const createdAt = nextRevisionCreatedAt(current.createdAt);
    const revision: ContextRevisionRecord = {
      id: `context:${target}:${createdAt}:${crypto.randomUUID()}`,
      target,
      content: request.draft,
      createdAt,
      source: "imported",
      sourceName: operation.sourceName,
      checksum: draftChecksum,
    };
    const revisionStore = transaction.objectStore("contextRevisions");
    for (const existing of revisions) await revisionStore.delete(existing.id);
    await revisionStore.put(revision);
    await transaction.objectStore("contextOperations").delete(operation.id);
    await transaction.done;

    return { operationId: operation.id, status: "completed" };
  }

  getAppHealth(_appId: string): Promise<AppHealth> {
    return unsupported(this.kind, "appHealth");
  }

  launchApp(_appId: string): Promise<AppLaunchResult> {
    return unsupported(this.kind, "appLaunch");
  }

  refreshModels(): Promise<ModelRefreshResult> {
    return unsupported(this.kind, "modelRefresh");
  }

  async close(): Promise<void> {
    this.database?.close();
    this.database = null;
  }

  private async getDatabase(): Promise<QuickGraphDatabaseHandle> {
    if (!this.database) {
      this.database = await openQuickGraphDatabase(this.databaseName);
    }
    return this.database;
  }
}

const CONTEXT_ORDER: ContextTarget[] = ["claude", "memory", "codex"];
const CONTEXT_PREPARE_TTL_MS = 15 * 60 * 1_000;
const CONTEXT_NAMES: Record<ContextTarget, "CLAUDE.md" | "MEMORY.md" | "AGENTS.md"> = {
  claude: "CLAUDE.md",
  memory: "MEMORY.md",
  codex: "AGENTS.md",
};
const CONTEXT_TARGET_BY_NAME: Record<string, ContextTarget | undefined> = {
  "CLAUDE.MD": "claude",
  "MEMORY.MD": "memory",
  "AGENTS.MD": "codex",
};

async function sha256(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function latestContextRevision(
  revisions: readonly ContextRevisionRecord[],
): ContextRevisionRecord | undefined {
  return revisions.reduce<ContextRevisionRecord | undefined>(
    (latest, revision) => (
      !latest
      || revision.createdAt > latest.createdAt
      || (revision.createdAt === latest.createdAt && revision.id > latest.id)
    ) ? revision : latest,
    undefined,
  );
}

function normalizeContextPreview(content: string): string {
  return `${content
    .replace(/\r\n?|\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\r\n]+$/u, ""))
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/\n+$/, "")}\n`;
}

function isUnexpired(expiresAt: string): boolean {
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function nextRevisionCreatedAt(previousCreatedAt: string): string {
  return new Date(Math.max(Date.now(), (Date.parse(previousCreatedAt) || 0) + 1)).toISOString();
}
