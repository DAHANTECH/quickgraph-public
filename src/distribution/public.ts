import starter from "../data/public-starter-pack.json";
import type { AppCatalogMetadata, BrowserDataMode, CatalogItem } from "../domain";

const EXPECTED_STARTER_KEYS = new Set([
  "brainstorming-helper",
  "code-debugging",
  "code-review",
  "context-audit",
  "project-planning",
  "research-organizer",
  "workflow-retrospective",
  "writing-assistant",
]);

if (
  starter.mode !== "starter"
  || starter.policy !== "public-demo-only"
  || starter.items.length !== EXPECTED_STARTER_KEYS.size
  || starter.items.some((item) => !EXPECTED_STARTER_KEYS.has(item.key))
  || new Set(starter.items.map((item) => item.key)).size !== starter.items.length
) {
  throw new Error("Der neutrale Public-Starter entspricht nicht dem freigegebenen Datenvertrag.");
}

export const PUBLIC_CATALOG_ITEMS: CatalogItem[] = starter.items.map((item) => ({
  id: item.id,
  key: item.key,
  type: "skill",
  kind: "skill",
  name: item.name,
  description: item.description,
  category: item.category,
  group: "Skills",
  origin: "QuickGraph neutral starter",
  source: "public-catalog",
  tags: ["Neutral"],
  content: item.content,
  owned: false,
  invoke: item.invoke,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
}));

export const PUBLIC_CATALOG_SNAPSHOT_AT = starter.generatedAt;
export const PUBLIC_CATALOG_POLICY = Object.freeze({
  metadata: "Only the fixed neutral QuickGraph starter metadata is included.",
  descriptions: "Only the fixed neutral QuickGraph starter descriptions are included.",
  fullText: "Only the fixed neutral QuickGraph starter full text is included.",
  excluded: "Local skills, apps, paths, provenance, profiles, usage, and private assets are excluded.",
});
export const PUBLIC_CATALOG_SUMMARY = Object.freeze({
  itemCount: PUBLIC_CATALOG_ITEMS.length,
  appCount: 0,
  fullTextItemCount: PUBLIC_CATALOG_ITEMS.length,
  metadataOnlyItemCount: 0,
  usageAnalyticsIncluded: false,
  contextFilesIncluded: false,
  sessionDataIncluded: false,
});
export const PUBLIC_CATALOG_APPS: AppCatalogMetadata[] = [];
export const DISTRIBUTION_DEMO_ITEMS: CatalogItem[] = [];
export const DISTRIBUTION_BROWSER_DATA_MODES: readonly BrowserDataMode[] = [
  "quickgraph",
  "own",
  "virgin",
];
export const DISTRIBUTION_SUPPORTS_DEMO = false;
export const DISTRIBUTION_COMPACT_CATEGORY_LABELS: Readonly<Record<string, string>> = {};
export const DISTRIBUTION_APP_GALLERY_FILES: Readonly<
  Record<string, readonly { file: string; label: string }[]>
> = {};
