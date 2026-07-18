import { AppWindow, BarChart3, Check, Database, FileCheck2, Library, LockKeyhole, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CAPABILITY_KEYS, type AdapterHealth, type Capability, type QuickGraphAdapter } from "../domain";

interface AdapterStatusDialogProps {
  adapter: QuickGraphAdapter;
  health: AdapterHealth | null;
  open: boolean;
  onClose: () => void;
  onOpenDataCenter: () => void;
  onRefresh: () => Promise<void>;
}

const CAPABILITY_LABELS: Record<Capability, string> = {
  catalogRead: "Katalog lesen",
  catalogManage: "Katalog verwalten",
  catalogPersist: "Browserdaten speichern",
  contentWrite: "Skill- und Prompt-Inhalte speichern",
  usageRead: "Nutzung auswerten",
  usageWrite: "Nutzung erfassen",
  sourceScan: "Quellen scannen",
  contextRead: "Kontext prüfen",
  contextOptimize: "Kontext optimieren",
  appHealth: "App-Status prüfen",
  appLaunch: "Apps starten",
  modelRefresh: "Modelle aktualisieren",
};

export function AdapterStatusDialog({ adapter, health, open, onClose, onOpenDataCenter, onRefresh }: AdapterStatusDialogProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    headingRef.current?.focus();
    setRefreshing(false);
    setRefreshError(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const healthy = health?.status === "ok";
  const operational = health?.status === "ok" || health?.status === "degraded";
  const isLocalApi = adapter.kind === "local-api";
  const statusDetail = health?.detail ?? (healthy
    ? isLocalApi
      ? "Die LocalAPI ist erreichbar."
      : "Das Browser-Profil ist bereit."
    : health?.status === "degraded"
      ? "Ein Teil der Datenquelle ist derzeit nicht erreichbar."
      : "Die aktuelle Datenquelle ist derzeit nicht erreichbar.");
  const source = isLocalApi
    ? "Die LocalAPI bindet nur an die lokale Loopback-Verbindung. Sie liest ausschließlich konfigurierte, erlaubte Dateiquellen und freigegebene lokale App-Informationen."
    : "Das Browser-Profil verwendet nur diese Browserinstanz: IndexedDB sowie Dateien, die im Data Center ausdrücklich ausgewählt wurden.";
  const limits = isLocalApi
    ? "Keine Netzwerkfreigabe, keine beliebigen Dateipfade und keine Browser-Datenmodi oder Browserimporte. Kontextdateien werden nur nach Backup und ausdrücklicher Bestätigung geschrieben."
    : "Kein Dateisystemzugriff, kein Quellen-Scan und kein lokaler Server. Browserimporte ändern weder die ausgewählten Quelldateien noch den QuickGraph-Checkout.";
  const refreshResult = "Lädt Katalog, Nutzung und Kontextstatus neu. Deine Quell- und Kontextdateien bleiben unverändert.";
  const availableCount = operational
    ? CAPABILITY_KEYS.filter((capability) => adapter.capabilities[capability]).length
    : 0;
  const keyCapabilities = [
    {
      available: adapter.capabilities.catalogRead,
      detail: isLocalApi
        ? adapter.capabilities.catalogManage
          ? "Lokalen Katalog lesen und verwalten"
          : "Katalog aus erlaubten LocalAPI-Quellen lesen"
        : "Katalog dieser Browserinstanz lesen",
      icon: Library,
      label: "Katalog",
    },
    {
      available: adapter.capabilities.contextRead,
      detail: adapter.capabilities.contextOptimize ? "Kontext prüfen und sicher optimieren" : "Importierte Kontextdateien prüfen",
      icon: FileCheck2,
      label: "Kontextdateien",
    },
    {
      available: adapter.capabilities.usageRead,
      detail: "Most Used und Nutzungsmuster auswerten",
      icon: BarChart3,
      label: "Nutzung",
    },
    {
      available: adapter.capabilities.appHealth,
      detail: adapter.capabilities.appLaunch ? "Lokale Apps prüfen und starten" : "Verfügbare App-Informationen prüfen",
      icon: AppWindow,
      label: "Lokale Apps",
    },
  ].filter((item) => operational && item.available);

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await onRefresh();
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Die Daten konnten nicht aktualisiert werden.");
    } finally {
      setRefreshing(false);
    }
  };

  return <div className="dialog-layer" role="presentation" onMouseDown={onClose}>
    <section
      className="adapter-status-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adapter-status-title"
      onMouseDown={(event) => event.stopPropagation()}
      style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", maxHeight: "calc(100vh - 40px)" }}
    >
      <header className="dialog-head">
        <div>
          <span className="dialog-kicker">Systemstatus</span>
          <h2 id="adapter-status-title" ref={headingRef} tabIndex={-1}>{isLocalApi ? "LocalAPI" : "Browser-Profil"}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} title="Systemstatus schließen"><X aria-hidden="true" /><span className="sr-only">Systemstatus schließen</span></button>
      </header>
      <div className="dialog-body adapter-status-body">
        <div className="adapter-status-overview">
          <div className={healthy ? "adapter-status-summary ready" : "adapter-status-summary unavailable"}>
            <span aria-hidden="true" />
            <div>
              <strong>{healthy ? "Bereit" : health?.status === "degraded" ? "Eingeschränkt" : "Nicht verfügbar"}</strong>
              <p>{statusDetail}</p>
            </div>
          </div>
          <p className="adapter-status-purpose">
            <strong>Wofür ist das da?</strong>
            Der Status zeigt, ob QuickGraph seine aktuelle Datenquelle verwenden kann. Aktualisieren lädt deren Stand neu, ohne Dateien zu verändern.
          </p>
        </div>

        <section className="adapter-key-section" aria-labelledby="adapter-key-capabilities-title">
          <h3 id="adapter-key-capabilities-title">Damit kannst du arbeiten</h3>
          <div className="adapter-key-capabilities">
            {keyCapabilities.map(({ detail, icon: Icon, label }) => {
              return <div key={label}>
                <Icon aria-hidden="true" />
                <span><strong>{label}</strong><small>{detail}</small></span>
              </div>;
            })}
          </div>
          {keyCapabilities.length === 0 ? <p className="adapter-capability-unavailable">
            Aktuell keine Funktionen erreichbar. Prüfe die Datenquelle und aktualisiere den Status.
          </p> : null}
        </section>

        <details className="adapter-status-details">
          <summary>Technische Details <small>{availableCount} von {CAPABILITY_KEYS.length} Funktionen verfügbar</small></summary>
          <div className="adapter-status-details-content">
            <p><strong>Datenquelle</strong>{source}</p>
            <p><strong>Sicherheitsgrenze</strong>{limits}</p>
            <div className="adapter-capabilities" aria-label="Vollständiger Funktionsumfang">
              {CAPABILITY_KEYS.map((capability) => {
                const available = operational && adapter.capabilities[capability];
                const Icon = available ? Check : LockKeyhole;
                return <div key={capability} data-available={available}>
                  <Icon aria-hidden="true" />
                  <span>{CAPABILITY_LABELS[capability]}</span>
                  <span className="sr-only">{available ? "Verfügbar" : "Nicht verfügbar"}</span>
                </div>;
              })}
            </div>
          </div>
        </details>

        <footer className="adapter-status-actions">
          <p>{refreshResult}</p>
          <div>
            <button className="secondary-button" type="button" onClick={onOpenDataCenter}>
              <Database aria-hidden="true" /> Data Center
            </button>
            <button className="primary-button" type="button" disabled={refreshing} onClick={() => void refresh()}>
              <RefreshCw aria-hidden="true" /> {refreshing ? "Aktualisiere" : "Aktualisieren"}
            </button>
          </div>
        </footer>
        {refreshError ? <p className="dialog-error" role="alert">{refreshError}</p> : null}
      </div>
    </section>
  </div>;
}
