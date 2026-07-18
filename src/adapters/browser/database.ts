import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  DISTRIBUTION_DEMO_ITEMS,
  PUBLIC_CATALOG_ITEMS,
  PUBLIC_CATALOG_SNAPSHOT_AT,
} from "../../data/public-catalog";
import type { CatalogItem, CatalogItemKind, ContextTarget } from "../../domain";

export const QUICKGRAPH_DB_NAME = "quickgraph";
export const QUICKGRAPH_DB_VERSION = 2;

export const QUICKGRAPH_STORES = [
  "items",
  "contextRevisions",
  "contextOperations",
  "usageDaily",
  "backups",
  "externalCache",
  "meta",
] as const;

export interface ContextRevisionRecord {
  id: string;
  target: ContextTarget;
  content: string;
  createdAt: string;
  source: "demo" | "imported";
  sourceName: string;
  checksum: string;
}

export interface ContextOperationRecord {
  id: string;
  target: ContextTarget;
  revisionId: string;
  revisionChecksum: string;
  before: string;
  sourceName: string;
  preview: string;
  previewChecksum: string;
  backupId: string;
  createdAt: string;
  expiresAt: string;
  feedback?: string;
}

export interface UsageDailyRecord {
  date: string;
  itemId: string;
  count: number;
  actions: Record<"open" | "copy" | "invoke", number>;
  updatedAt: string;
}

export interface BackupRecord {
  id: string;
  aggregate: string;
  createdAt: string;
  payload: unknown;
}

export interface ExternalCacheRecord {
  key: string;
  provider: string;
  expiresAt: string;
  payload: unknown;
}

export interface MetaRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

interface QuickGraphDatabase extends DBSchema {
  items: {
    key: string;
    value: CatalogItem;
    indexes: {
      "by-category": string;
      "by-kind": CatalogItemKind;
    };
  };
  contextRevisions: {
    key: string;
    value: ContextRevisionRecord;
    indexes: {
      "by-created-at": string;
      "by-target": ContextTarget;
    };
  };
  contextOperations: {
    key: string;
    value: ContextOperationRecord;
    indexes: {
      "by-expires-at": string;
      "by-target": ContextTarget;
    };
  };
  usageDaily: {
    key: [string, string];
    value: UsageDailyRecord;
    indexes: {
      "by-date": string;
      "by-item": string;
    };
  };
  backups: {
    key: string;
    value: BackupRecord;
    indexes: {
      "by-aggregate": string;
      "by-created-at": string;
    };
  };
  externalCache: {
    key: string;
    value: ExternalCacheRecord;
    indexes: {
      "by-expires-at": string;
      "by-provider": string;
    };
  };
  meta: {
    key: string;
    value: MetaRecord;
  };
}

export type QuickGraphDatabaseHandle = IDBPDatabase<QuickGraphDatabase>;

export function openQuickGraphDatabase(
  databaseName = QUICKGRAPH_DB_NAME,
): Promise<QuickGraphDatabaseHandle> {
  return openDB<QuickGraphDatabase>(databaseName, QUICKGRAPH_DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const items = database.createObjectStore("items", { keyPath: "id" });
        items.createIndex("by-category", "category");
        items.createIndex("by-kind", "kind");

        const revisions = database.createObjectStore("contextRevisions", {
          keyPath: "id",
        });
        revisions.createIndex("by-created-at", "createdAt");
        revisions.createIndex("by-target", "target");

        const usage = database.createObjectStore("usageDaily", {
          keyPath: ["date", "itemId"],
        });
        usage.createIndex("by-date", "date");
        usage.createIndex("by-item", "itemId");

        const backups = database.createObjectStore("backups", { keyPath: "id" });
        backups.createIndex("by-aggregate", "aggregate");
        backups.createIndex("by-created-at", "createdAt");

        const cache = database.createObjectStore("externalCache", { keyPath: "key" });
        cache.createIndex("by-expires-at", "expiresAt");
        cache.createIndex("by-provider", "provider");

        database.createObjectStore("meta", { keyPath: "key" });
      }

      if (oldVersion < 2) {
        const operations = database.createObjectStore("contextOperations", {
          keyPath: "id",
        });
        operations.createIndex("by-expires-at", "expiresAt");
        operations.createIndex("by-target", "target");
      }
    },
  });
}

export async function seedDemoItems(
  database: QuickGraphDatabaseHandle,
): Promise<void> {
  const seededAt = new Date().toISOString();
  const transaction = database.transaction(["items", "meta"], "readwrite");
  const items = DISTRIBUTION_DEMO_ITEMS;
  const expectedIds = new Set(items.map((item) => item.id));
  const itemStore = transaction.objectStore("items");

  let cursor = await itemStore.openCursor();
  while (cursor) {
    if (cursor.value.source === "demo" && !expectedIds.has(cursor.value.id)) await cursor.delete();
    cursor = await cursor.continue();
  }
  for (const item of items) {
    if (!(await itemStore.get(item.id))) await itemStore.put(item);
  }
  await transaction.objectStore("meta").put({
    key: "bootstrap",
    value: { source: "neutral-demo", itemCount: items.length },
    updatedAt: seededAt,
  });
  await transaction.done;
}

export async function seedPublicCatalogItems(
  database: QuickGraphDatabaseHandle,
): Promise<void> {
  const transaction = database.transaction(["items", "meta"], "readwrite");
  const itemStore = transaction.objectStore("items");
  const publicIds = new Set(PUBLIC_CATALOG_ITEMS.map(({ id }) => id));
  const existingItems = await itemStore.getAll();

  for (const item of existingItems) {
    if (item.source === "public-catalog" && !publicIds.has(item.id)) {
      await itemStore.delete(item.id);
    }
  }
  for (const item of PUBLIC_CATALOG_ITEMS) {
    await itemStore.put(item);
  }
  await transaction.objectStore("meta").put({
    key: "public-catalog",
    value: {
      source: "sanitized-public-catalog",
      itemCount: PUBLIC_CATALOG_ITEMS.length,
      snapshotAt: PUBLIC_CATALOG_SNAPSHOT_AT,
    },
    updatedAt: PUBLIC_CATALOG_SNAPSHOT_AT,
  });
  await transaction.done;
}

export async function resetDemoItems(
  database: QuickGraphDatabaseHandle,
): Promise<void> {
  const resetAt = new Date().toISOString();
  const transaction = database.transaction(["items", "meta"], "readwrite");
  const itemStore = transaction.objectStore("items");
  let cursor = await itemStore.openCursor();
  while (cursor) {
    if (cursor.value.source === "demo") await cursor.delete();
    cursor = await cursor.continue();
  }
  for (const item of DISTRIBUTION_DEMO_ITEMS) await itemStore.put(item);
  await transaction.objectStore("meta").put({
    key: "bootstrap",
    value: { source: "neutral-demo", itemCount: DISTRIBUTION_DEMO_ITEMS.length, resetAt },
    updatedAt: resetAt,
  });
  await transaction.done;
}

export async function replaceImportedItems(
  database: QuickGraphDatabaseHandle,
  items: readonly CatalogItem[],
): Promise<void> {
  const incomingIds = new Set<string>();
  for (const item of items) {
    if (item.source !== "browser-import") {
      throw new Error(`Eintrag „${item.name}“ ist kein Browserimport.`);
    }
    if (incomingIds.has(item.id)) {
      throw new Error(`Eintrag „${item.name}“ ist in dieser Auswahl doppelt.`);
    }
    incomingIds.add(item.id);
  }

  const transaction = database.transaction("items", "readwrite");
  for (const item of items) {
    const current = await transaction.store.get(item.id);
    if (current && current.source !== "browser-import") {
      transaction.abort();
      await transaction.done.catch(() => undefined);
      throw new Error(`Eintrag „${item.name}“ kollidiert mit einem geschützten Katalogeintrag.`);
    }
    await transaction.store.put(item);
  }
  await transaction.done;
}

export async function replaceImportedCatalogData(
  database: QuickGraphDatabaseHandle,
  items: readonly CatalogItem[],
  usageDaily: readonly Pick<UsageDailyRecord, "date" | "itemId" | "count">[],
): Promise<void> {
  const incomingIds = new Set<string>();
  for (const item of items) {
    if (item.source !== "browser-import") {
      throw new Error(`Eintrag „${item.name}“ ist kein Browserimport.`);
    }
    if (incomingIds.has(item.id)) {
      throw new Error(`Eintrag „${item.name}“ ist in dieser Auswahl doppelt.`);
    }
    incomingIds.add(item.id);
  }
  const usageKeys = new Set<string>();
  for (const entry of usageDaily) {
    if (!incomingIds.has(entry.itemId)) {
      throw new Error("Nutzungswert referenziert keinen importierten Eintrag.");
    }
    const key = `${entry.date}:${entry.itemId}`;
    if (usageKeys.has(key)) throw new Error("Nutzungswert ist doppelt.");
    usageKeys.add(key);
  }

  const transaction = database.transaction(["items", "usageDaily"], "readwrite");
  const itemStore = transaction.objectStore("items");
  for (const item of items) {
    const current = await itemStore.get(item.id);
    if (current && current.source !== "browser-import") {
      transaction.abort();
      await transaction.done.catch(() => undefined);
      throw new Error(`Eintrag „${item.name}“ kollidiert mit einem geschützten Katalogeintrag.`);
    }
    await itemStore.put(item);
  }

  const usageStore = transaction.objectStore("usageDaily");
  let cursor = await usageStore.openCursor();
  while (cursor) {
    if (incomingIds.has(cursor.value.itemId)) await cursor.delete();
    cursor = await cursor.continue();
  }
  const importedAt = new Date().toISOString();
  for (const entry of usageDaily) {
    await usageStore.put({
      ...entry,
      actions: { open: entry.count, copy: 0, invoke: 0 },
      updatedAt: importedAt,
    });
  }
  await transaction.done;
}

export async function replaceContextRevisions(
  database: QuickGraphDatabaseHandle,
  revisions: readonly ContextRevisionRecord[],
): Promise<void> {
  const transaction = database.transaction("contextRevisions", "readwrite");
  const targetIndex = transaction.store.index("by-target");
  for (const revision of revisions) {
    const previousKeys = await targetIndex.getAllKeys(revision.target);
    for (const key of previousKeys) await transaction.store.delete(key);
    await transaction.store.put(revision);
  }
  await transaction.done;
}

export async function deleteImportedItems(
  database: QuickGraphDatabaseHandle,
): Promise<number> {
  const transaction = database.transaction("items", "readwrite");
  let deleted = 0;
  let cursor = await transaction.store.openCursor();
  while (cursor) {
    if (cursor.value.source === "browser-import") {
      await cursor.delete();
      deleted += 1;
    }
    cursor = await cursor.continue();
  }
  await transaction.done;
  return deleted;
}

export async function deleteContextRevisions(
  database: QuickGraphDatabaseHandle,
): Promise<number> {
  const transaction = database.transaction("contextRevisions", "readwrite");
  const deleted = await transaction.store.count();
  await transaction.store.clear();
  await transaction.done;
  return deleted;
}

export async function deleteUsageHistory(
  database: QuickGraphDatabaseHandle,
): Promise<number> {
  const transaction = database.transaction("usageDaily", "readwrite");
  const deleted = await transaction.store.count();
  await transaction.store.clear();
  await transaction.done;
  return deleted;
}

export async function resetBrowserOwnedData(
  database: QuickGraphDatabaseHandle,
): Promise<void> {
  const resetAt = new Date().toISOString();
  const transaction = database.transaction(QUICKGRAPH_STORES, "readwrite");

  await Promise.all([
    transaction.objectStore("items").clear(),
    transaction.objectStore("contextRevisions").clear(),
    transaction.objectStore("contextOperations").clear(),
    transaction.objectStore("usageDaily").clear(),
    transaction.objectStore("backups").clear(),
    transaction.objectStore("externalCache").clear(),
    transaction.objectStore("meta").clear(),
  ]);

  for (const item of DISTRIBUTION_DEMO_ITEMS) {
    await transaction.objectStore("items").put(item);
  }
  for (const item of PUBLIC_CATALOG_ITEMS) {
    await transaction.objectStore("items").put(item);
  }
  await transaction.objectStore("meta").put({
    key: "bootstrap",
    value: { source: "neutral-demo", itemCount: DISTRIBUTION_DEMO_ITEMS.length, resetAt },
    updatedAt: resetAt,
  });
  await transaction.objectStore("meta").put({
    key: "public-catalog",
    value: {
      source: "sanitized-public-catalog",
      itemCount: PUBLIC_CATALOG_ITEMS.length,
      snapshotAt: PUBLIC_CATALOG_SNAPSHOT_AT,
    },
    updatedAt: resetAt,
  });
  await transaction.done;
}

export interface BrowserDataExport {
  schemaVersion: 2;
  exportedAt: string;
  items: CatalogItem[];
  contextRevisions: ContextRevisionRecord[];
  contextOperations: ContextOperationRecord[];
  usageDaily: UsageDailyRecord[];
  backups: BackupRecord[];
  externalCache: ExternalCacheRecord[];
  meta: MetaRecord[];
}

export async function exportBrowserData(
  database: QuickGraphDatabaseHandle,
): Promise<BrowserDataExport> {
  const transaction = database.transaction(QUICKGRAPH_STORES, "readonly");
  const [items, contextRevisions, contextOperations, usageDaily, backups, externalCache, meta] =
    await Promise.all([
      transaction.objectStore("items").getAll(),
      transaction.objectStore("contextRevisions").getAll(),
      transaction.objectStore("contextOperations").getAll(),
      transaction.objectStore("usageDaily").getAll(),
      transaction.objectStore("backups").getAll(),
      transaction.objectStore("externalCache").getAll(),
      transaction.objectStore("meta").getAll(),
    ]);
  await transaction.done;
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    items,
    contextRevisions,
    contextOperations,
    usageDaily,
    backups,
    externalCache,
    meta,
  };
}

export function deleteQuickGraphDatabase(databaseName = QUICKGRAPH_DB_NAME): Promise<void> {
  return deleteDB(databaseName);
}
