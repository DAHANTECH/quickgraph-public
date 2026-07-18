import type { CatalogFilter } from "../catalog";
import type { IsPluginCategory } from "./sidebar-model";

/** Welche Sidebar-Bereiche laut aktueller Filterauswahl aktiv markiert sind. */
export interface SidebarActiveFilters {
  appsFilterActive: boolean;
  commandsActive: boolean;
  rulesActive: boolean;
  pluginsActive: boolean;
  mcpActive: boolean;
  promptsActive: boolean;
  skillsActive: boolean;
  workflowsActive: boolean;
}

/** Leitet den Aktiv-Status je Sidebar-Bereich rein aus der aktuellen Filterauswahl ab. */
export function deriveSidebarActiveFilters(
  selectedFilters: readonly CatalogFilter[],
  isPluginCategory: IsPluginCategory,
): SidebarActiveFilters {
  const matches = (predicate: (filter: CatalogFilter) => boolean) => selectedFilters.some(predicate);
  return {
    appsFilterActive: matches((filter) =>
      (filter.kind === "type" && filter.type === "app")
      || (filter.kind === "group" && filter.group === "Apps")
      || (filter.kind === "category" && filter.group === "Apps")),
    commandsActive: matches((filter) =>
      (filter.kind === "category" && filter.group === "Commands & Regeln" && filter.category === "Commands")
      || filter.kind === "command-category"
      || filter.kind === "command-platform"),
    rulesActive: matches((filter) =>
      filter.kind === "category" && filter.group === "Commands & Regeln" && filter.category === "Regeln"),
    pluginsActive: matches((filter) =>
      (filter.kind === "group" && filter.group === "Plugins")
      || (filter.kind === "category" && isPluginCategory(filter.group, filter.category))),
    mcpActive: matches((filter) =>
      (filter.kind === "type" && filter.type === "mcp-server")
      || ((filter.kind === "group" || filter.kind === "category") && /mcp/i.test(filter.group))),
    promptsActive: matches((filter) =>
      (filter.kind === "type" && filter.type === "prompt")
      || ((filter.kind === "group" || filter.kind === "category") && filter.group === "Prompts")),
    skillsActive: matches((filter) =>
      (filter.kind === "type" && filter.type === "skill")
      || filter.kind === "owned"
      || filter.kind === "third-party"
      || ((filter.kind === "group" || filter.kind === "category") && filter.group === "Skills")),
    workflowsActive: matches((filter) =>
      (filter.kind === "type" && filter.type === "workflow")
      || ((filter.kind === "group" || filter.kind === "category") && filter.group === "Workflows")),
  };
}
