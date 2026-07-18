import type { CatalogItem } from "../domain";

/**
 * Kurzes Owner-Label eines Katalogeintrags, abgeleitet ohne zu raten:
 * eigene Einträge zuerst, dann der ausgewiesene Anbieter, sonst die Herkunft.
 */
export function catalogOwnerLabel(item: CatalogItem): string {
  if (item.owned) return "Eigen";
  const provider = item.provenance?.providerLabel?.trim();
  if (provider) return provider;
  return item.origin;
}

/**
 * Anklickbare, im Browser oeffnbare Repository-/Homepage-URL aus der Provenienz.
 * Eigene Skills bekommen keinen oeffentlichen Repo-Link; ein `.git`-Klon-Suffix
 * wird entfernt, damit die Web-URL nicht 404t. Das private erste-Partei-Repo wird
 * bereits im Generator aus dem Public-Katalog entfernt.
 */
export function catalogRepositoryUrl(item: CatalogItem): string | null {
  if (item.owned) return null;
  return normalizeRepositoryUrl(item.provenance?.repository)
    ?? normalizeRepositoryUrl(item.provenance?.homepage);
}

function normalizeRepositoryUrl(value: string | undefined): string | null {
  const url = value?.trim();
  if (!url || !/^https:\/\//i.test(url)) return null;
  return url.replace(/\.git$/i, "");
}
