import snapshot from "./public-catalog.json";
import apps from "./public-apps.json";
import type { AppCatalogMetadata, CatalogItem } from "../domain";

export const PUBLIC_CATALOG_ITEMS = snapshot.items as CatalogItem[];
export const PUBLIC_CATALOG_SNAPSHOT_AT = snapshot.snapshotAt;
export const PUBLIC_CATALOG_POLICY = snapshot.policy;
export const PUBLIC_CATALOG_SUMMARY = snapshot.summary;
export const PUBLIC_CATALOG_APPS = apps as AppCatalogMetadata[];
