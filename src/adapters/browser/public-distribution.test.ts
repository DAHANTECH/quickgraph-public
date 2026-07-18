import { describe, expect, it, vi } from "vitest";

import { PUBLIC_CATALOG_ITEMS } from "../../data/public-catalog";
import type { CatalogItem } from "../../domain";
import { readDataMode } from "../../lib/preferences";
import { BrowserQuickGraphAdapter } from "./browser-adapter";
import { BROWSER_DATA_MODES } from "./data-modes";
import { deleteQuickGraphDatabase, openQuickGraphDatabase } from "./database";

const EXPECTED_PUBLIC_KEYS = [
  "brainstorming-helper",
  "code-debugging",
  "code-review",
  "context-audit",
  "project-planning",
  "research-organizer",
  "workflow-retrospective",
  "writing-assistant",
];

describe("public browser distribution", () => {
  it("keeps exactly the starter catalog while preserving user imports on upgrade", async () => {
    if (PUBLIC_CATALOG_ITEMS.length !== EXPECTED_PUBLIC_KEYS.length) {
      expect(PUBLIC_CATALOG_ITEMS.length).toBeGreaterThan(500);
      return;
    }

    const databaseName = `quickgraph-public-${crypto.randomUUID()}`;
    const adapter = new BrowserQuickGraphAdapter(databaseName);

    try {
      await adapter.initialize();
      const initial = await adapter.getBootstrap();
      expect(initial.items.map((item) => item.key).sort()).toEqual(EXPECTED_PUBLIC_KEYS);
      expect(initial.items.some((item) => item.source === "demo")).toBe(false);
      expect(BROWSER_DATA_MODES).toEqual(["quickgraph", "own", "virgin"]);
      const preferences = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => preferences.get(key) ?? null,
        setItem: (key: string, value: string) => preferences.set(key, value),
      });
      localStorage.setItem("quickgraph.preference.data-mode", "demo");
      expect(readDataMode()).toBe("quickgraph");

      const database = await openQuickGraphDatabase(databaseName);
      const transaction = database.transaction("items", "readwrite");
      await transaction.store.put(testItem("stale-public", "public-catalog"));
      await transaction.store.put(testItem("stale-demo", "demo"));
      await transaction.store.put(testItem("own-import", "browser-import"));
      await transaction.done;
      database.close();

      const upgraded = await adapter.getBootstrap();
      expect(upgraded.items).toHaveLength(9);
      expect(upgraded.items.find((item) => item.id === "stale-public")).toBeUndefined();
      expect(upgraded.items.find((item) => item.id === "stale-demo")).toBeUndefined();
      expect(upgraded.items.find((item) => item.id === "own-import")?.source).toBe("browser-import");
    } finally {
      vi.unstubAllGlobals();
      await adapter.close();
      await deleteQuickGraphDatabase(databaseName);
    }
  });
});

function testItem(id: string, source: CatalogItem["source"]): CatalogItem {
  return {
    id,
    key: id,
    type: "skill",
    kind: "skill",
    name: id,
    description: "Public distribution regression fixture",
    category: "Test",
    group: "Skills",
    origin: "test",
    source,
    tags: [],
    content: "# Test",
    updatedAt: "2026-07-18T00:00:00.000Z",
  };
}
