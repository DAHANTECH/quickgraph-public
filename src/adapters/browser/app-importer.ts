import type { CatalogItem } from "../../domain";
import {
  ImportValidationError,
  type LocalImportFile,
} from "./importer";

export const MAX_APP_MANIFEST_BYTES = 1_000_000;
export const MAX_APP_IMPORTS = 100;

const MAX_MANIFEST_NAME_LENGTH = 214;
const MAX_MANIFEST_DESCRIPTION_LENGTH = 1_000;
const MAX_MANIFEST_VALUE_LENGTH = 256;

type ManifestRecord = Record<string, unknown>;

const STACK_SIGNALS: ReadonlyArray<readonly [string, string]> = [
  ["next", "Next.js"],
  ["react", "React"],
  ["react-dom", "React"],
  ["vite", "Vite"],
  ["vue", "Vue"],
  ["nuxt", "Nuxt"],
  ["svelte", "Svelte"],
  ["@angular/core", "Angular"],
  ["astro", "Astro"],
  ["electron", "Electron"],
  ["typescript", "TypeScript"],
];

function asRecord(value: unknown): ManifestRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as ManifestRecord)
    : null;
}

function normalizedManifestText(
  value: unknown,
  field: string,
  fileName: string,
  maximumLength: number,
): string {
  if (typeof value !== "string") {
    throw new ImportValidationError(
      "invalid-item",
      fileName,
      `Feld „${field}“ muss ein Text sein.`,
    );
  }
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) {
    throw new ImportValidationError(
      "invalid-item",
      fileName,
      `Feld „${field}“ darf nicht leer sein.`,
    );
  }
  if (text.length > maximumLength) {
    throw new ImportValidationError(
      "invalid-item",
      fileName,
      `Feld „${field}“ ist zu lang.`,
    );
  }
  return text;
}

function optionalManifestText(
  value: unknown,
  field: string,
  fileName: string,
  maximumLength = MAX_MANIFEST_VALUE_LENGTH,
): string | undefined {
  if (value === undefined) return undefined;
  return normalizedManifestText(value, field, fileName, maximumLength);
}

function stableKey(packageName: string): string {
  const key = packageName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return key || "imported-app";
}

function assertSelectedManifestFile(file: LocalImportFile): void {
  if (!Number.isSafeInteger(file.size) || file.size < 0) {
    throw new ImportValidationError(
      "invalid-item",
      file.name,
      "Die Dateigröße ist ungültig.",
    );
  }
  if (file.size === 0) {
    throw new ImportValidationError("empty-file", file.name, "Die Datei ist leer.");
  }
  if (file.size > MAX_APP_MANIFEST_BYTES) {
    throw new ImportValidationError(
      "oversized-file",
      file.name,
      `Die Datei überschreitet das Limit von ${MAX_APP_MANIFEST_BYTES / 1_000_000} MB.`,
    );
  }
  if (file.name.toLowerCase() !== "package.json") {
    throw new ImportValidationError(
      "unsupported-file",
      file.name,
      "Erwartet wird eine ausdrücklich ausgewählte package.json-Datei.",
    );
  }
}

async function readManifestText(file: LocalImportFile): Promise<string> {
  const raw = await file.text();
  if (typeof raw !== "string") {
    throw new ImportValidationError(
      "malformed-json",
      file.name,
      "Die Datei enthält keinen lesbaren Text.",
    );
  }
  const byteLength = new TextEncoder().encode(raw).byteLength;
  if (byteLength === 0) {
    throw new ImportValidationError("empty-file", file.name, "Die Datei ist leer.");
  }
  if (byteLength > MAX_APP_MANIFEST_BYTES) {
    throw new ImportValidationError(
      "oversized-file",
      file.name,
      `Die Datei überschreitet das Limit von ${MAX_APP_MANIFEST_BYTES / 1_000_000} MB.`,
    );
  }
  return raw;
}

function packageNames(
  manifest: ManifestRecord,
  field: string,
  fileName: string,
): string[] {
  const value = manifest[field];
  if (value === undefined) return [];
  const dependencies = asRecord(value);
  if (!dependencies) {
    throw new ImportValidationError(
      "invalid-item",
      fileName,
      `Feld „${field}“ muss ein Objekt sein.`,
    );
  }
  for (const [dependency, version] of Object.entries(dependencies)) {
    if (!dependency.trim() || typeof version !== "string" || !version.trim()) {
      throw new ImportValidationError(
        "invalid-item",
        fileName,
        `Feld „${field}“ enthält eine ungültige Abhängigkeit.`,
      );
    }
  }
  return Object.keys(dependencies);
}

function deriveStack(manifest: ManifestRecord, fileName: string): string[] {
  const packages = new Set<string>();
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    for (const dependency of packageNames(manifest, field, fileName)) {
      packages.add(dependency);
    }
  }

  const detected = new Set<string>();
  for (const [dependency, label] of STACK_SIGNALS) {
    if (packages.has(dependency)) detected.add(label);
  }
  const packageManager = optionalManifestText(
    manifest.packageManager,
    "packageManager",
    fileName,
  );
  if (packageManager) detected.add(packageManager.split("@")[0] || packageManager);
  return detected.size > 0 ? [...detected] : ["JavaScript"];
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`]/g, "\\$&");
}

function metadataContent(
  name: string,
  description: string,
  packageName: string,
  version: string | undefined,
  stack: readonly string[],
): string {
  return [
    `# ${escapeMarkdown(name)}`,
    "",
    escapeMarkdown(description),
    "",
    "## Manifest metadata",
    `- Package: \`${escapeMarkdown(packageName)}\``,
    ...(version ? [`- Version: \`${escapeMarkdown(version)}\``] : []),
    `- Stack: ${stack.map(escapeMarkdown).join(", ")}`,
    "",
    "Imported from the explicitly selected package.json metadata only.",
  ].join("\n");
}

function updatedAtFromFile(file: LocalImportFile, now: string): string {
  if (!file.lastModified) return now;
  const date = new Date(file.lastModified);
  return Number.isNaN(date.getTime()) ? now : date.toISOString();
}

/**
 * Parses one explicitly selected package.json without inspecting its folder or scripts.
 */
export async function parseAppManifest(
  file: LocalImportFile,
  now = new Date().toISOString(),
): Promise<CatalogItem> {
  assertSelectedManifestFile(file);

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readManifestText(file));
  } catch (error) {
    if (error instanceof ImportValidationError) throw error;
    throw new ImportValidationError(
      "malformed-json",
      file.name,
      "Die Datei enthält kein gültiges JSON.",
    );
  }

  const manifest = asRecord(parsed);
  if (!manifest) {
    throw new ImportValidationError(
      "malformed-json",
      file.name,
      "Die package.json muss ein Objekt sein.",
    );
  }

  const name = normalizedManifestText(
    manifest.name,
    "name",
    file.name,
    MAX_MANIFEST_NAME_LENGTH,
  );
  const description = manifest.description === undefined
    ? `Package manifest for ${name}.`
    : normalizedManifestText(
      manifest.description,
      "description",
      file.name,
      MAX_MANIFEST_DESCRIPTION_LENGTH,
    );
  const version = optionalManifestText(manifest.version, "version", file.name);
  const stack = deriveStack(manifest, file.name);
  const key = stableKey(name);

  return {
    id: `import:app:${key}`,
    key,
    type: "app",
    kind: "app",
    name,
    description,
    category: "Importiert",
    group: "Apps",
    origin: file.name,
    source: "browser-import",
    tags: stack.map((entry) => entry.toLowerCase()),
    content: metadataContent(name, description, name, version, stack),
    updatedAt: updatedAtFromFile(file, now),
  };
}

/**
 * Parses selected app manifests and rejects duplicate IDs or protected catalog collisions.
 */
export async function parseAppImportFiles(
  files: readonly LocalImportFile[],
  existingItems: readonly CatalogItem[] = [],
  now = new Date().toISOString(),
): Promise<CatalogItem[]> {
  if (files.length > MAX_APP_IMPORTS) {
    throw new ImportValidationError(
      "too-many-items",
      "package.json",
      `Es dürfen höchstens ${MAX_APP_IMPORTS} App-Manifeste importiert werden.`,
    );
  }

  const imported: CatalogItem[] = [];
  for (const file of files) {
    imported.push(await parseAppManifest(file, now));
  }

  const importedIds = new Set<string>();
  const protectedIds = new Set(
    existingItems
      .filter((item) => item.source !== "browser-import")
      .map((item) => item.id),
  );
  for (const item of imported) {
    if (importedIds.has(item.id)) {
      throw new ImportValidationError(
        "duplicate-item",
        item.origin,
        `„${item.name}“ ist in dieser Auswahl doppelt.`,
      );
    }
    if (protectedIds.has(item.id)) {
      throw new ImportValidationError(
        "duplicate-item",
        item.origin,
        `„${item.name}“ kollidiert mit einem geschützten Katalogeintrag.`,
      );
    }
    importedIds.add(item.id);
  }
  return imported;
}
