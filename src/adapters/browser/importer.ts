import { parseDocument } from "yaml";
import {
  CATALOG_ITEM_TYPES,
  type CatalogItem,
  type CatalogItemKind,
  type CatalogItemType,
  type CatalogIllustration,
  type CatalogProvenance,
} from "../../domain";
import { isSafeSkillIllustrationPath } from "../../lib/public-asset";

export const MAX_MARKDOWN_BYTES = 1_000_000;
export const MAX_CATALOG_BYTES = 8_000_000;
export const MAX_CATALOG_ITEMS = 500;
export const MAX_USAGE_DAILY_ENTRIES = 50_000;

export interface LocalImportFile {
  name: string;
  size: number;
  lastModified?: number;
  text(): Promise<string>;
}

export interface ImportedUsageDaily {
  date: string;
  itemId: string;
  count: number;
}

export interface ParsedImportBatch {
  items: CatalogItem[];
  usageDaily: ImportedUsageDaily[];
  hasUsageData: boolean;
}

export type ImportErrorCode =
  | "unsupported-file"
  | "empty-file"
  | "oversized-file"
  | "malformed-markdown"
  | "malformed-yaml"
  | "malformed-json"
  | "invalid-item"
  | "duplicate-item"
  | "too-many-items";

export class ImportValidationError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    readonly fileName: string,
    message: string,
  ) {
    super(`${fileName}: ${message}`);
    this.name = "ImportValidationError";
  }
}

const KINDS = new Set<CatalogItemKind>([
  "skill",
  "prompt",
  "mcp",
  "app",
  "workflow",
  "command",
  "rule",
]);
const TYPES = new Set<CatalogItemType>(CATALOG_ITEM_TYPES);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(
  value: unknown,
  field: string,
  fileName: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ImportValidationError(
      "invalid-item",
      fileName,
      `Feld „${field}“ muss ein nicht-leerer Text sein.`,
    );
  }
  return value.trim();
}

function optionalString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return slug || "imported-item";
}

function normalizeTags(value: unknown, fileName: string): string[] {
  if (value === undefined) return [];
  const tags = typeof value === "string" ? value.split(",") : value;
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) {
    throw new ImportValidationError(
      "invalid-item",
      fileName,
      "Feld „tags“ muss Text oder eine Liste aus Texten sein.",
    );
  }
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 30);
}

function assertFileSize(file: LocalImportFile, limit: number): void {
  if (file.size <= 0) {
    throw new ImportValidationError("empty-file", file.name, "Die Datei ist leer.");
  }
  if (file.size > limit) {
    throw new ImportValidationError(
      "oversized-file",
      file.name,
      `Die Datei überschreitet das Limit von ${Math.round(limit / 1_000_000)} MB.`,
    );
  }
}

function dateFromFile(file: LocalImportFile, now: string): string {
  if (!file.lastModified) return now;
  const date = new Date(file.lastModified);
  return Number.isNaN(date.getTime()) ? now : date.toISOString();
}

function normalizeProvenance(
  value: unknown,
  illustrationValue?: unknown,
): Pick<CatalogItem, "provenance" | "illustration"> {
  const raw = asRecord(value);
  if (!raw) return {};
  const classification = raw.classification;
  const confidence = raw.confidence;
  if (
    !["first_party", "third_party", "derived", "conflict", "unknown"].includes(String(classification))
    || !["high", "medium", "low"].includes(String(confidence))
  ) return {};
  const provenance: CatalogProvenance = {
    classification: classification as CatalogProvenance["classification"],
    confidence: confidence as CatalogProvenance["confidence"],
  };
  for (const field of ["providerLabel", "license"] as const) {
    if (typeof raw[field] === "string" && raw[field].trim()) provenance[field] = raw[field].trim();
  }
  for (const field of ["homepage", "repository"] as const) {
    if (typeof raw[field] === "string" && raw[field].startsWith("https://")) provenance[field] = raw[field].trim();
  }
  const rawIllustration = asRecord(illustrationValue ?? raw.illustration);
  let illustration: CatalogIllustration | undefined;
  if (
    rawIllustration
    && typeof rawIllustration.src === "string"
    && isSafeSkillIllustrationPath(rawIllustration.src)
    && typeof rawIllustration.alt === "string"
    && ["official-logo", "official-icon", "site-preview", "neutral"].includes(String(rawIllustration.kind))
  ) {
    illustration = {
      src: rawIllustration.src,
      alt: rawIllustration.alt.trim(),
      kind: rawIllustration.kind as CatalogIllustration["kind"],
    };
  }
  return { provenance, ...(illustration ? { illustration } : {}) };
}

export async function parseMarkdownSkill(
  file: LocalImportFile,
  now = new Date().toISOString(),
  markAsOwned = false,
): Promise<CatalogItem> {
  assertFileSize(file, MAX_MARKDOWN_BYTES);
  if (!file.name.toLocaleLowerCase("de").endsWith(".md")) {
    throw new ImportValidationError(
      "unsupported-file",
      file.name,
      "Erwartet wird eine Markdown-Datei.",
    );
  }

  const raw = await file.text();
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/);
  if (!match) {
    throw new ImportValidationError(
      "malformed-markdown",
      file.name,
      "YAML-Frontmatter zwischen zwei --- Markern fehlt.",
    );
  }

  const document = parseDocument(match[1], { prettyErrors: false });
  if (document.errors.length > 0) {
    throw new ImportValidationError(
      "malformed-yaml",
      file.name,
      document.errors[0]?.message ?? "YAML-Frontmatter ist ungültig.",
    );
  }

  let frontmatter: Record<string, unknown> | null;
  try {
    frontmatter = asRecord(document.toJS({ maxAliasCount: 0 }));
  } catch (error) {
    throw new ImportValidationError(
      "malformed-yaml",
      file.name,
      error instanceof Error ? error.message : "YAML-Frontmatter ist ungültig.",
    );
  }
  if (!frontmatter) {
    throw new ImportValidationError(
      "invalid-item",
      file.name,
      "YAML-Frontmatter muss ein Objekt sein.",
    );
  }

  const name = requiredString(frontmatter.name, "name", file.name);
  const description = requiredString(frontmatter.description, "description", file.name);
  const key = slugify(optionalString(frontmatter.key, name));
  const content = match[2].trim();
  if (!content) {
    throw new ImportValidationError(
      "malformed-markdown",
      file.name,
      "Nach dem Frontmatter fehlt Markdown-Inhalt.",
    );
  }

  return {
    id: `import:skill:${key}`,
    key,
    type: "skill",
    kind: "skill",
    name,
    description,
    category: optionalString(frontmatter.category, "Importiert"),
    group: optionalString(frontmatter.group, "Skills"),
    origin: file.name,
    source: "browser-import",
    tags: normalizeTags(frontmatter.tags, file.name),
    content,
    ...normalizeProvenance(frontmatter.provenance, frontmatter.illustration),
    owned: markAsOwned || frontmatter.owned === true,
    invoke: optionalString(frontmatter.invoke, `/${key}`),
    updatedAt: dateFromFile(file, now),
  };
}

function inferKind(type: CatalogItemType): CatalogItemKind {
  switch (type) {
    case "mcp-server":
      return "mcp";
    case "context":
    case "model":
    case "rule":
      return "rule";
    default:
      return type;
  }
}

function normalizeCatalogItem(
  value: unknown,
  fileName: string,
  index: number,
  now: string,
  markAsOwned: boolean,
): CatalogItem {
  const raw = asRecord(value);
  const label = `${fileName} [${index + 1}]`;
  if (!raw) {
    throw new ImportValidationError("invalid-item", label, "Eintrag muss ein Objekt sein.");
  }
  const name = requiredString(raw.name, "name", label);
  const description = requiredString(raw.description, "description", label);
  const rawType = optionalString(raw.type, "skill") as CatalogItemType;
  if (!TYPES.has(rawType)) {
    throw new ImportValidationError("invalid-item", label, `Unbekannter Typ „${rawType}“.`);
  }
  const rawKind = optionalString(raw.kind, inferKind(rawType)) as CatalogItemKind;
  if (!KINDS.has(rawKind)) {
    throw new ImportValidationError("invalid-item", label, `Unbekannte Art „${rawKind}“.`);
  }
  const key = slugify(optionalString(raw.key, name));
  const importIdentity = slugify(optionalString(raw.transferId, key));
  const content = rawKind === "app"
    ? optionalString(raw.content, "")
    : requiredString(raw.content, "content", label);
  const updatedAtCandidate = optionalString(raw.updatedAt, now);
  const updatedAt = Number.isNaN(Date.parse(updatedAtCandidate)) ? now : updatedAtCandidate;

  return {
    id: `import:${rawKind}:${importIdentity}`,
    key,
    type: rawType,
    kind: rawKind,
    name,
    description,
    category: optionalString(raw.category, "Importiert"),
    group: optionalString(raw.group, "Importiert"),
    ...(typeof raw.commandCategory === "string" && raw.commandCategory.trim()
      ? { commandCategory: raw.commandCategory.trim() }
      : {}),
    ...(raw.commandPlatform === "Claude Code" || raw.commandPlatform === "Codex" || raw.commandPlatform === "Gemeinsam"
      ? { commandPlatform: raw.commandPlatform }
      : {}),
    origin: optionalString(raw.origin, fileName),
    source: "browser-import",
    tags: normalizeTags(raw.tags, label),
    content,
    ...(typeof raw.sourceId === "string" && raw.sourceId.trim() ? { sourceId: raw.sourceId.trim() } : {}),
    ...(typeof raw.relativePath === "string" && raw.relativePath.trim() ? { relativePath: raw.relativePath.trim() } : {}),
    ...normalizeProvenance(raw.provenance, raw.illustration),
    owned: rawKind === "skill" && (markAsOwned || raw.owned === true),
    ...(typeof raw.invoke === "string" && raw.invoke.trim()
      ? { invoke: raw.invoke.trim() }
      : {}),
    updatedAt,
  };
}

async function parseCatalogJsonDetails(
  file: LocalImportFile,
  now = new Date().toISOString(),
  markAsOwned = false,
): Promise<ParsedImportBatch> {
  assertFileSize(file, MAX_CATALOG_BYTES);
  if (!file.name.toLocaleLowerCase("de").endsWith(".json")) {
    throw new ImportValidationError(
      "unsupported-file",
      file.name,
      "Erwartet wird eine JSON-Datei.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new ImportValidationError(
      "malformed-json",
      file.name,
      "Die Datei enthält kein gültiges JSON.",
    );
  }
  const root = asRecord(parsed);
  const items = Array.isArray(parsed) ? parsed : root?.items;
  if (!Array.isArray(items)) {
    throw new ImportValidationError(
      "malformed-json",
      file.name,
      "Erwartet wird ein Array oder ein Objekt mit „items“-Array.",
    );
  }
  if (items.length > MAX_CATALOG_ITEMS) {
    throw new ImportValidationError(
      "too-many-items",
      file.name,
      `Ein Katalog darf höchstens ${MAX_CATALOG_ITEMS} Einträge enthalten.`,
    );
  }
  const normalizedItems = items.map((item, index) => normalizeCatalogItem(
    item,
    file.name,
    index,
    now,
    markAsOwned,
  ));
  if (!root || root.usageDaily === undefined) {
    return { items: normalizedItems, usageDaily: [], hasUsageData: false };
  }
  if (!Array.isArray(root.usageDaily)) {
    throw new ImportValidationError(
      "malformed-json",
      file.name,
      "Feld „usageDaily“ muss eine Liste sein.",
    );
  }
  if (root.usageDaily.length > MAX_USAGE_DAILY_ENTRIES) {
    throw new ImportValidationError(
      "too-many-items",
      file.name,
      `Ein Katalog darf höchstens ${MAX_USAGE_DAILY_ENTRIES} Nutzungswerte enthalten.`,
    );
  }

  const itemIdByTransferId = new Map<string, string>();
  for (const [index, item] of normalizedItems.entries()) {
    const raw = asRecord(items[index]);
    const transferId = slugify(optionalString(raw?.transferId, item.key));
    itemIdByTransferId.set(transferId, item.id);
  }
  const usageDaily = root.usageDaily.map((entry, index) =>
    normalizeUsageDaily(entry, file.name, index, itemIdByTransferId),
  );
  return { items: normalizedItems, usageDaily, hasUsageData: true };
}

function normalizeUsageDaily(
  value: unknown,
  fileName: string,
  index: number,
  itemIdByTransferId: ReadonlyMap<string, string>,
): ImportedUsageDaily {
  const raw = asRecord(value);
  const label = `${fileName} Nutzung [${index + 1}]`;
  if (!raw) {
    throw new ImportValidationError("invalid-item", label, "Nutzungswert muss ein Objekt sein.");
  }
  const date = requiredString(raw.date, "date", label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) {
    throw new ImportValidationError("invalid-item", label, "Feld „date“ muss ein gültiges ISO-Datum sein.");
  }
  const transferId = slugify(requiredString(raw.transferId, "transferId", label));
  const itemId = itemIdByTransferId.get(transferId);
  if (!itemId) {
    throw new ImportValidationError("invalid-item", label, "Nutzungswert referenziert keinen importierten Eintrag.");
  }
  const count = raw.count;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1 || count > 1_000_000) {
    throw new ImportValidationError("invalid-item", label, "Feld „count“ muss eine positive ganze Zahl sein.");
  }
  return { date, itemId, count };
}

export async function parseCatalogJson(
  file: LocalImportFile,
  now = new Date().toISOString(),
  markAsOwned = false,
): Promise<CatalogItem[]> {
  return (await parseCatalogJsonDetails(file, now, markAsOwned)).items;
}

function validateImportedItems(
  imported: readonly CatalogItem[],
  existingItems: readonly CatalogItem[],
): void {
  const seen = new Set<string>();
  const existingById = new Map(existingItems.map((item) => [item.id, item]));
  for (const item of imported) {
    if (seen.has(item.id)) {
      throw new ImportValidationError(
        "duplicate-item",
        item.origin,
        `„${item.name}“ ist in dieser Auswahl doppelt.`,
      );
    }
    const existing = existingById.get(item.id);
    if (existing && existing.source !== "browser-import") {
      throw new ImportValidationError(
        "duplicate-item",
        item.origin,
        `„${item.name}“ kollidiert mit einem geschützten Katalogeintrag.`,
      );
    }
    seen.add(item.id);
  }
}

function validateUsageDaily(
  usageDaily: readonly ImportedUsageDaily[],
  imported: readonly CatalogItem[],
): void {
  const validItemIds = new Set(imported.map((item) => item.id));
  const seen = new Set<string>();
  for (const entry of usageDaily) {
    if (!validItemIds.has(entry.itemId)) {
      throw new ImportValidationError("invalid-item", "Nutzungsdaten", "Nutzungswert referenziert keinen importierten Eintrag.");
    }
    const key = `${entry.date}:${entry.itemId}`;
    if (seen.has(key)) {
      throw new ImportValidationError("duplicate-item", "Nutzungsdaten", "Nutzungswert ist doppelt.");
    }
    seen.add(key);
  }
}

export async function parseImportBatch(
  files: readonly LocalImportFile[],
  existingItems: readonly CatalogItem[] = [],
  now = new Date().toISOString(),
  markAsOwned = false,
): Promise<ParsedImportBatch> {
  const imported: CatalogItem[] = [];
  const usageDaily: ImportedUsageDaily[] = [];
  let hasUsageData = false;
  for (const file of files) {
    const lowerName = file.name.toLocaleLowerCase("de");
    if (lowerName.endsWith(".md")) {
      imported.push(await parseMarkdownSkill(file, now, markAsOwned));
    } else if (lowerName.endsWith(".json")) {
      const parsed = await parseCatalogJsonDetails(file, now, markAsOwned);
      imported.push(...parsed.items);
      usageDaily.push(...parsed.usageDaily);
      hasUsageData ||= parsed.hasUsageData;
    } else {
      throw new ImportValidationError(
        "unsupported-file",
        file.name,
        "Unterstützt werden Markdown- und JSON-Dateien.",
      );
    }
  }

  validateImportedItems(imported, existingItems);
  validateUsageDaily(usageDaily, imported);
  return { items: imported, usageDaily, hasUsageData };
}

export async function parseImportFiles(
  files: readonly LocalImportFile[],
  existingItems: readonly CatalogItem[] = [],
  now = new Date().toISOString(),
  markAsOwned = false,
): Promise<CatalogItem[]> {
  return (await parseImportBatch(files, existingItems, now, markAsOwned)).items;
}
