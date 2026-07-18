import { useState } from "react";
import { Bookmark, BookmarkCheck, ExternalLink, ImageOff, Monitor, Plus } from "lucide-react";
import { EntryViewToggle } from "../../components/EntryViewToggle";
import { RepoLink } from "../../components/RepoLink";
import type { AppCatalogMetadata, CatalogItem } from "../../domain";
import { catalogOwnerLabel, catalogRepositoryUrl } from "../../lib/catalog-origin";
import type { CatalogViewPreference } from "../../lib/preferences";
import "./MyApps.css";

interface MyAppsProps {
  items: readonly CatalogItem[];
  metadataByKey: ReadonlyMap<string, AppCatalogMetadata>;
  onOpenApp: (item: CatalogItem) => void;
  onAddApp: () => void;
  view: CatalogViewPreference;
  onViewChange: (view: CatalogViewPreference) => void;
  quickAccessItemIds?: ReadonlySet<string>;
  onToggleQuickAccess?: (item: CatalogItem) => void;
}

function AppBookmarkButton({ item, bookmarked, onToggle }: { item: CatalogItem; bookmarked: boolean; onToggle: (item: CatalogItem) => void }) {
  return <button
    className={bookmarked ? "my-app-bookmark active" : "my-app-bookmark"}
    type="button"
    aria-pressed={bookmarked}
    aria-label={bookmarked ? `${item.name} aus dem Schnellzugriff entfernen` : `${item.name} zum Schnellzugriff hinzufügen`}
    title={bookmarked ? "Aus Schnellzugriff entfernen" : "Zum Schnellzugriff hinzufügen"}
    onClick={() => onToggle(item)}
  >
    {bookmarked ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
  </button>;
}

function dateLabel(value: string | undefined): string {
  if (!value) return "Nicht angegeben";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Nicht angegeben" : date.toLocaleDateString("de-DE");
}

/**
 * Normalisiert den App-Screenshot-Pfad auf die vom Web-Build ausgelieferte URL.
 * LocalAPI liefert `assets/app-screenshots/...`, der Public-Build `/app-screenshots/...`.
 */
function resolveAppScreenshot(path: string | undefined): string | undefined {
  return path ? path.replace(/^assets\//, "/") : undefined;
}

function AppPreview({ item, metadata }: { item: CatalogItem; metadata?: AppCatalogMetadata }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = resolveAppScreenshot(metadata?.screenshot) || item.illustration?.src;
  const label = metadata?.screenshotLabel || item.illustration?.alt || `${item.name} Vorschau`;

  return <div className="my-app-preview">
    {image && !imageFailed ? <img src={image} alt={label} onError={() => setImageFailed(true)} /> : <span aria-label={`${item.name} ohne Vorschau`}><ImageOff aria-hidden="true" /></span>}
  </div>;
}

function appMetadata(item: CatalogItem, metadata?: AppCatalogMetadata) {
  return {
    typeLabel: metadata?.type || item.category || "App",
    stack: metadata?.stack || item.tags.join(", ") || "Nicht angegeben",
    status: metadata?.status || (metadata?.available ? "Verfügbar" : "Importiert"),
    changed: dateLabel(metadata?.updatedAt || item.updatedAt),
    owner: catalogOwnerLabel(item),
    repository: catalogRepositoryUrl(item),
  };
}

export function MyApps({ items, metadataByKey, onOpenApp, onAddApp, view, onViewChange, quickAccessItemIds = new Set<string>(), onToggleQuickAccess }: MyAppsProps) {
  const canBookmark = Boolean(onToggleQuickAccess);
  const appItems = items
    .filter((item) => item.type === "app" || item.kind === "app")
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, "de"));

  return <section className="my-apps" aria-labelledby="my-apps-title">
    <header className="catalog-heading my-apps-heading">
      <div>
        <p>App-Inventar</p>
        <h1 id="my-apps-title">Meine Apps</h1>
        <span>{appItems.length} {appItems.length === 1 ? "App" : "Apps"} aus deinem Katalog</span>
      </div>
      <div className="my-apps-actions">
        {appItems.length > 0 ? <EntryViewToggle view={view} onChange={onViewChange} label="App-Ansicht" /> : null}
        <button className="secondary-button" type="button" onClick={onAddApp}>
          <Plus aria-hidden="true" /> App hinzufügen
        </button>
      </div>
    </header>

    {appItems.length === 0 ? <div className="empty-state my-apps-empty">
      <Monitor aria-hidden="true" />
      <strong>Noch keine Apps im Katalog</strong>
      <span>Importiere ein App-Manifest oder einen vorhandenen Katalogeintrag im Data Center.</span>
      <div className="empty-state-actions">
        <button className="secondary-button" type="button" onClick={onAddApp}><Plus aria-hidden="true" /> App hinzufügen</button>
      </div>
    </div> : view === "list" ? <div className="my-apps-list" data-entry-view="list" aria-label="App-Inventar">
      <div className="my-apps-list-head" aria-hidden="true">
        <span></span><span>Name</span><span>Beschreibung</span><span>Typ</span><span>Owner</span><span>Geändert</span>
      </div>
      {appItems.map((item) => {
        const metadata = metadataByKey.get(item.key);
        const info = appMetadata(item, metadata);
        return <article className="my-app-listrow" key={item.id}>
          <button className="my-app-listopen" type="button" onClick={() => onOpenApp(item)}>
            <AppPreview item={item} metadata={metadata} />
            <span className="my-app-listname">{item.name}</span>
            <span className="my-app-listdesc">{item.description}</span>
            <span className="my-app-listcell">{info.typeLabel}</span>
            <span className={item.owned ? "my-app-listcell is-own" : "my-app-listcell"}>{info.owner}</span>
            <span className="my-app-listcell">{info.changed}</span>
          </button>
          {info.repository ? <RepoLink url={info.repository} name={item.name} className="my-app-repo-link" /> : null}
          {canBookmark ? <AppBookmarkButton item={item} bookmarked={quickAccessItemIds.has(item.id)} onToggle={onToggleQuickAccess!} /> : null}
          <button className="my-app-listaction" type="button" onClick={() => onOpenApp(item)} title="Details öffnen" aria-label={`${item.name} Details öffnen`}>
            <ExternalLink aria-hidden="true" />
          </button>
        </article>;
      })}
    </div> : <div className="my-apps-grid" data-entry-view="grid" aria-label="App-Inventar">
      {appItems.map((item) => {
        const metadata = metadataByKey.get(item.key);
        const info = appMetadata(item, metadata);
        return <article className="my-app-card" key={item.id}>
          <button className="my-app-open" type="button" onClick={() => onOpenApp(item)} aria-label={`${item.name} Details öffnen`}>
            <AppPreview item={item} metadata={metadata} />
            <div className="my-app-body">
              <div className="my-app-title"><h2>{item.name}</h2><span className="my-app-type">{info.typeLabel}</span></div>
              <p>{item.description}</p>
              <dl>
                <div><dt>Stack</dt><dd>{info.stack}</dd></div>
                <div><dt>Status</dt><dd>{info.status}</dd></div>
                <div><dt>Owner</dt><dd className={item.owned ? "is-own" : undefined}>{info.owner}</dd></div>
                <div><dt>Geändert</dt><dd>{info.changed}</dd></div>
              </dl>
            </div>
          </button>
          {info.repository ? <RepoLink url={info.repository} name={item.name} className="my-app-repo-link" /> : null}
          {canBookmark ? <AppBookmarkButton item={item} bookmarked={quickAccessItemIds.has(item.id)} onToggle={onToggleQuickAccess!} /> : null}
        </article>;
      })}
    </div>}
  </section>;
}
