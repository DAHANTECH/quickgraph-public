import type { BrowserDataMode } from "../domain";
import { DISTRIBUTION_BROWSER_DATA_MODES } from "../data/public-catalog";

export type ThemePreference = "dark" | "light";
export type CatalogViewPreference = "grid" | "list";
export type AppViewPreference = "catalog" | "apps" | "usage" | "least-used" | "context" | "memory" | "models" | "app-builder";
export type AppBuilderWorkflowPreference = "clone-site" | "classic-site" | "app-dashboard" | "wordpress-plugin";
export type RuntimeProfile = "browser" | "local-api";

const KEYS = {
  theme: "quickgraph.preference.theme",
  view: "quickgraph.preference.catalog-view",
  sidebar: "quickgraph.preference.sidebar-collapsed",
  sidebarWidth: "quickgraph.preference.sidebar-width",
  sidebarAreas: "quickgraph.preference.sidebar-expanded-areas-v2",
  dataMode: "quickgraph.preference.data-mode",
  onboarding: "quickgraph.preference.onboarding-complete",
  setup: "quickgraph.preference.setup-complete",
  activeView: "quickgraph.preference.active-view",
  appBuilderWorkflow: "quickgraph.preference.app-builder-workflow",
  quickAccessItems: "quickgraph.preference.quick-access-items",
  quickAccessExpanded: "quickgraph.preference.quick-access-expanded",
} as const;

export const DEFAULT_SIDEBAR_WIDTH = 232;
export const MIN_SIDEBAR_WIDTH = 220;
export const MAX_SIDEBAR_WIDTH = 420;

function readPreference<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The UI remains usable when preference storage is unavailable.
  }
}

export function readTheme(): ThemePreference {
  const systemTheme: ThemePreference = window.matchMedia?.("(prefers-color-scheme: light)")
    .matches
    ? "light"
    : "dark";
  return readPreference(KEYS.theme, ["dark", "light"], systemTheme);
}

export function writeTheme(theme: ThemePreference): void {
  writePreference(KEYS.theme, theme);
}

export function readCatalogView(): CatalogViewPreference {
  return readPreference(KEYS.view, ["grid", "list"], "grid");
}

export function writeCatalogView(view: CatalogViewPreference): void {
  writePreference(KEYS.view, view);
}

export function readSidebarCollapsed(): boolean {
  return readPreference(KEYS.sidebar, ["true", "false"], "false") === "true";
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  writePreference(KEYS.sidebar, String(collapsed));
}

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_SIDEBAR_WIDTH;
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)));
}

export function readSidebarWidth(): number {
  try {
    const stored = localStorage.getItem(KEYS.sidebarWidth);
    return stored === null ? DEFAULT_SIDEBAR_WIDTH : clampSidebarWidth(Number(stored));
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
}

export function writeSidebarWidth(width: number): void {
  writePreference(KEYS.sidebarWidth, String(clampSidebarWidth(width)));
}

export function readExpandedSidebarAreas(): Set<string> {
  try {
    const stored = localStorage.getItem(KEYS.sidebarAreas);
    if (stored === null) return new Set(["section:views", "section:memory", "section:areas"]);
    const value = JSON.parse(stored);
    return new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);
  } catch {
    return new Set();
  }
}

export function writeExpandedSidebarAreas(areas: ReadonlySet<string>): void {
  writePreference(KEYS.sidebarAreas, JSON.stringify([...areas]));
}

export function readDataMode(): BrowserDataMode {
  return readPreference(
    KEYS.dataMode,
    DISTRIBUTION_BROWSER_DATA_MODES,
    "quickgraph",
  );
}

export function writeDataMode(mode: BrowserDataMode): void {
  writePreference(KEYS.dataMode, mode);
}

function profileKey(key: string, profile: RuntimeProfile): string {
  return `${key}.${profile}`;
}

export function readOnboardingComplete(profile?: RuntimeProfile): boolean {
  if (!profile) return readPreference(KEYS.onboarding, ["true", "false"], "false") === "true";
  const legacyComplete = readPreference(KEYS.onboarding, ["true", "false"], "false");
  return readPreference(profileKey(KEYS.onboarding, profile), ["true", "false"], legacyComplete) === "true";
}

export function writeOnboardingComplete(complete: boolean, profile?: RuntimeProfile): void {
  writePreference(profile ? profileKey(KEYS.onboarding, profile) : KEYS.onboarding, String(complete));
}

export function readSetupComplete(profile: RuntimeProfile): boolean {
  const legacyComplete = readPreference(KEYS.onboarding, ["true", "false"], "false");
  return readPreference(profileKey(KEYS.setup, profile), ["true", "false"], legacyComplete) === "true";
}

export function writeSetupComplete(profile: RuntimeProfile, complete: boolean): void {
  writePreference(profileKey(KEYS.setup, profile), String(complete));
}

export function readActiveView(): AppViewPreference {
  return readPreference(KEYS.activeView, ["catalog", "apps", "usage", "least-used", "context", "memory", "models", "app-builder"], "catalog");
}

export function writeActiveView(view: AppViewPreference): void {
  writePreference(KEYS.activeView, view);
}

export function readAppBuilderWorkflow(): AppBuilderWorkflowPreference | null {
  const workflow = readPreference(
    KEYS.appBuilderWorkflow,
    ["clone-site", "classic-site", "app-dashboard", "wordpress-plugin", ""] as const,
    "",
  );
  return workflow === "" ? null : workflow;
}

export function writeAppBuilderWorkflow(workflow: AppBuilderWorkflowPreference | null): void {
  writePreference(KEYS.appBuilderWorkflow, workflow ?? "");
}

export function readQuickAccessItemIds(): Set<string> {
  try {
    const value = JSON.parse(localStorage.getItem(KEYS.quickAccessItems) ?? "[]");
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0));
  } catch {
    return new Set();
  }
}

export function writeQuickAccessItemIds(itemIds: ReadonlySet<string>): void {
  writePreference(KEYS.quickAccessItems, JSON.stringify([...itemIds]));
}

export function readQuickAccessExpanded(): boolean {
  return readPreference(KEYS.quickAccessExpanded, ["true", "false"], "true") === "true";
}

export function writeQuickAccessExpanded(expanded: boolean): void {
  writePreference(KEYS.quickAccessExpanded, String(expanded));
}

export function remapQuickAccessItemId(
  itemIds: ReadonlySet<string>,
  previousItemId: string,
  nextItemId: string,
): Set<string> {
  if (!itemIds.has(previousItemId) || previousItemId === nextItemId) return new Set(itemIds);
  return new Set([...itemIds].map((itemId) => itemId === previousItemId ? nextItemId : itemId));
}
