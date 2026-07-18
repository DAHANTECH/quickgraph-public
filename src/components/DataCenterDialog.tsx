import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Database,
  Download,
  Cloud,
  FileJson,
  FileText,
  Files,
  FolderOpen,
  History,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { BrowserQuickGraphAdapter } from "../adapters/browser";
import { DISTRIBUTION_SUPPORTS_DEMO } from "../data/public-catalog";
import type { BrowserDataMode, CatalogItem, CatalogTransfer, ContextOverview, ContextTarget } from "../domain";
import type { RuntimeProfile } from "../lib/preferences";

interface DataCenterDialogProps {
  adapter: BrowserQuickGraphAdapter | null;
  activeProfile: RuntimeProfile;
  canSwitchProfile?: boolean;
  contextOverview?: ContextOverview | null;
  confirmLabel?: string;
  onLocalCatalogExport?: () => Promise<CatalogTransfer>;
  onOpenContextFile?: (target: ContextTarget) => void;
  onOpenContextMonitor?: () => void;
  onSwitchProfile?: (profile: RuntimeProfile, mode?: BrowserDataMode) => void;
  items: readonly CatalogItem[];
  mode: BrowserDataMode;
  open: boolean;
  onClose: () => void;
  onDataChanged: () => Promise<void>;
  onModeChange: (mode: BrowserDataMode) => void;
}

interface LocalFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}

interface LocalDirectoryHandle {
  kind: "directory";
  name: string;
  values(): AsyncIterableIterator<LocalFileHandle | LocalDirectoryHandle>;
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<LocalDirectoryHandle>;
};

const MODE_OPTIONS = ([
  { value: "quickgraph", label: "QuickGraph-Daten", detail: "Öffentlicher Katalog + Importe" },
  { value: "demo", label: "Demo", detail: "Neutrale Beispieldaten" },
  { value: "own", label: "Eigene Daten", detail: "Nur lokale Importe" },
  { value: "virgin", label: "Virgin", detail: "Leerer Katalog ohne Löschung" },
] satisfies ReadonlyArray<{
  value: BrowserDataMode;
  label: string;
  detail: string;
}>).filter((option) => DISTRIBUTION_SUPPORTS_DEMO || option.value !== "demo");

const MAX_DIRECTORY_FILES = 500;

type DestructiveAction = "imports" | "context" | "usage" | "all";

const DESTRUCTIVE_ACTIONS: Record<DestructiveAction, {
  title: string;
  detail: string;
  confirmLabel: string;
}> = {
  imports: {
    title: "Alle importierten Katalogeinträge löschen?",
    detail: DISTRIBUTION_SUPPORTS_DEMO
      ? "Neutrale Demo-Einträge bleiben erhalten."
      : "Der neutrale öffentliche Starter-Katalog bleibt erhalten.",
    confirmLabel: "Ja, Importe löschen",
  },
  context: {
    title: "Alle lokalen Kontextdateien löschen?",
    detail: "CLAUDE.md, MEMORY.md und AGENTS.md werden aus IndexedDB und künftigen Exporten entfernt.",
    confirmLabel: "Ja, Kontextdateien löschen",
  },
  usage: {
    title: "Den gesamten Nutzungsverlauf löschen?",
    detail: "Alle lokal erfassten Öffnen-, Kopieren- und Aufrufen-Ereignisse werden entfernt.",
    confirmLabel: "Ja, Verlauf löschen",
  },
  all: {
    title: "Alle Browserdaten zurücksetzen?",
    detail: DISTRIBUTION_SUPPORTS_DEMO
      ? "Importe, Kontextdateien, Nutzungsverlauf, Sicherungen und Cache werden gelöscht. Die neutrale Demo wird wiederhergestellt."
      : "Importe, Kontextdateien, Nutzungsverlauf, Sicherungen und Cache werden gelöscht. Der neutrale Starter-Katalog bleibt erhalten.",
    confirmLabel: "Ja, Browserdaten zurücksetzen",
  },
};

async function collectDirectoryFiles(
  directory: LocalDirectoryHandle,
  collected: File[] = [],
): Promise<File[]> {
  for await (const handle of directory.values()) {
    if (collected.length >= MAX_DIRECTORY_FILES) {
      throw new Error(`Ordnerauswahl enthält mehr als ${MAX_DIRECTORY_FILES} unterstützte Dateien.`);
    }
    if (handle.kind === "directory") {
      await collectDirectoryFiles(handle, collected);
      continue;
    }
    if (/\.(md|json)$/i.test(handle.name)) collected.push(await handle.getFile());
  }
  return collected;
}

function triggerJsonDownload(
  payload: unknown,
  filename = `quickgraph-browser-data-${new Date().toISOString().slice(0, 10)}.json`,
): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DataCenterDialog({
  adapter,
  activeProfile,
  canSwitchProfile = false,
  contextOverview,
  confirmLabel = "Einstellungen übernehmen",
  onLocalCatalogExport,
  onOpenContextFile,
  onOpenContextMonitor,
  onSwitchProfile,
  items,
  mode,
  open,
  onClose,
  onDataChanged,
  onModeChange,
}: DataCenterDialogProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<DestructiveAction | null>(null);
  const [pendingProfile, setPendingProfile] = useState<RuntimeProfile>(activeProfile);
  const [pendingMode, setPendingMode] = useState<BrowserDataMode>(mode);
  const [markSkillImportsAsOwned, setMarkSkillImportsAsOwned] = useState(false);
  const supportsDirectoryPicker =
    typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
  const importedCount = useMemo(
    () => items.filter((item) => item.source === "browser-import").length,
    [items],
  );

  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      setPendingAction(null);
      return;
    }
    setPendingProfile(activeProfile);
    setPendingMode(mode);
  }, [activeProfile, mode, open]);

  useEffect(() => {
    if (!pendingAction) return;
    confirmationRef.current?.scrollIntoView?.({ block: "nearest" });
    confirmationRef.current?.focus();
  }, [pendingAction]);

  if (!open) return null;

  const importFiles = async (files: readonly File[]) => {
    if (!adapter || files.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const imported = await adapter.importFiles(files, markSkillImportsAsOwned);
      await onDataChanged();
      onModeChange("own");
      setMessage(`${imported.length} ${imported.length === 1 ? "Eintrag" : "Einträge"} importiert.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const importAppManifests = async (files: readonly File[]) => {
    if (!adapter || files.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const imported = await adapter.importAppManifests(files);
      await onDataChanged();
      onModeChange("own");
      setMessage(`${imported.length} ${imported.length === 1 ? "App" : "Apps"} aus package.json importiert.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "App-Import fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const importContextFiles = async (files: readonly File[]) => {
    if (!adapter || files.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const revisions = await adapter.importContextFiles(files);
      await onDataChanged();
      setMessage(`${revisions.length} ${revisions.length === 1 ? "Kontextdatei" : "Kontextdateien"} lokal gespeichert.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Kontextimport fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const chooseDirectory = async () => {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) return;
    setError(null);
    try {
      const directory = await picker();
      const files = await collectDirectoryFiles(directory);
      if (files.length === 0) {
        setError("Der gewählte Ordner enthält keine Markdown- oder JSON-Dateien.");
        return;
      }
      if (!adapter) return;
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const imported = await adapter.importDirectoryFiles(files, markSkillImportsAsOwned);
        await onDataChanged();
        onModeChange("own");
        setMessage(`${imported.length} ${imported.length === 1 ? "Eintrag" : "Einträge"} aus dem Ordner importiert.`);
      } finally {
        setBusy(false);
      }
    } catch (pickerError) {
      if (pickerError instanceof DOMException && pickerError.name === "AbortError") return;
      setError(pickerError instanceof Error ? pickerError.message : "Ordner konnte nicht gelesen werden.");
    }
  };

  const resetDemo = async () => {
    if (!adapter) return;
    setBusy(true);
    setError(null);
    try {
      await adapter.resetDemoData();
      await onDataChanged();
      onModeChange("demo");
      setMessage("Neutrale Demo wurde zurückgesetzt. Eigene Importe bleiben gespeichert.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Demo-Reset fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    if (!adapter) return;
    setBusy(true);
    setError(null);
    try {
      triggerJsonDownload(await adapter.exportData());
      setMessage("Browserdaten wurden als JSON exportiert.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Export fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const exportLocalCatalog = async () => {
    if (!onLocalCatalogExport) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      triggerJsonDownload(
        await onLocalCatalogExport(),
        `quickgraph-local-catalog-${new Date().toISOString().slice(0, 10)}.json`,
      );
      setMessage("Lokaler Katalog exportiert. Die Datei enthält keine Dateipfade, Kontextdateien oder Session-Inhalte.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Lokaler Katalogexport fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const requestDestructiveAction = (action: DestructiveAction) => {
    setMessage(null);
    setError(null);
    setPendingAction(action);
  };

  const confirmDestructiveAction = async () => {
    if (!adapter || !pendingAction) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      let successMessage: string;
      if (pendingAction === "imports") {
        const deleted = await adapter.deleteImportedCatalogItems();
        successMessage = `${deleted} importierte ${deleted === 1 ? "Katalogeintrag" : "Katalogeinträge"} gelöscht. ${DISTRIBUTION_SUPPORTS_DEMO ? "Demo-Daten" : "Starter-Katalog"} bleibt erhalten.`;
      } else if (pendingAction === "context") {
        const deleted = await adapter.deleteContextFiles();
        successMessage = `${deleted} ${deleted === 1 ? "Kontextdatei" : "Kontextdateien"} gelöscht.`;
      } else if (pendingAction === "usage") {
        const deleted = await adapter.deleteUsageHistory();
        successMessage = `${deleted} ${deleted === 1 ? "Nutzungseintrag" : "Nutzungseinträge"} gelöscht.`;
      } else {
        await adapter.resetBrowserData();
        onModeChange(DISTRIBUTION_SUPPORTS_DEMO ? "demo" : "quickgraph");
        successMessage = DISTRIBUTION_SUPPORTS_DEMO
          ? "Browserdaten wurden zurückgesetzt. Die neutrale Demo ist wieder verfügbar."
          : "Browserdaten wurden zurückgesetzt. Der neutrale Starter-Katalog ist wieder verfügbar.";
      }
      await onDataChanged();
      setMessage(successMessage);
      setPendingAction(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Browserdaten konnten nicht gelöscht werden.");
    } finally {
      setBusy(false);
    }
  };

  const applyDataSelection = () => {
    if (pendingProfile !== activeProfile) {
      onSwitchProfile?.(pendingProfile, pendingProfile === "browser" ? pendingMode : undefined);
    } else if (pendingProfile === "browser" && pendingMode !== mode) {
      onModeChange(pendingMode);
    }
    onClose();
  };

  return (
    <div className="dialog-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="data-dialog"
        data-tour="data-center-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-center-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-head">
          <div>
            <span className="dialog-kicker"><Database aria-hidden="true" /> Daten &amp; Profile</span>
            <h2 id="data-center-title" ref={headingRef} tabIndex={-1}>Data Center</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Data Center schließen">
            <X aria-hidden="true" />
            <span className="sr-only">Data Center schließen</span>
          </button>
        </header>

        <div className="dialog-body">
          <section className="data-section" aria-labelledby="mode-title" data-tour="data-modes">
            <div className="section-heading">
              <div>
                <h3 id="mode-title">Datenquelle und Modus</h3>
                <p>Die Auswahl ändert nur die sichtbare Quelle. Gespeicherte Daten werden nicht gelöscht.</p>
              </div>
              <span>{pendingProfile === "local-api" ? "LocalAPI" : `${items.length} gespeichert`}</span>
            </div>
            <div className="mode-selector" role="radiogroup" aria-label="Datenquelle und Modus">
              {canSwitchProfile ? <button
                type="button"
                role="radio"
                aria-checked={pendingProfile === "local-api"}
                className={pendingProfile === "local-api" ? "active" : ""}
                onClick={() => setPendingProfile("local-api")}
              >
                <strong><Cloud aria-hidden="true" /> LocalAPI</strong>
                <span>Private lokale Quellen und automatische Kontextampeln</span>
              </button> : null}
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={pendingProfile === "browser" && pendingMode === option.value}
                  className={pendingProfile === "browser" && pendingMode === option.value ? "active" : ""}
                  onClick={() => {
                    setPendingProfile("browser");
                    setPendingMode(option.value);
                  }}
                >
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              ))}
            </div>
            {pendingProfile === "local-api" ? <p className="capability-note">
              LocalAPI liest ausschließlich konfigurierte lokale Quellen. Wechsle zu einem Browsermodus, um eigene Dateien auszuwählen, Demo oder Virgin zu verwenden.
            </p> : null}
          </section>

          {!adapter ? (
            <>
              <div className="dialog-notice">
                Dieses private LocalAPI-Profil liest deine explizit erlaubten lokalen Quellen automatisch. Browserimporte bleiben davon getrennt.
              </div>
              <section className="data-section" aria-labelledby="local-context-title" data-tour="context-imports">
                <div className="section-heading">
                  <div>
                    <h3 id="local-context-title">Kontextampeln</h3>
                    <p>CLAUDE.md, MEMORY.md und AGENTS.md aus der lokalen Allowlist überwachen.</p>
                  </div>
                  <span>{contextOverview?.summary.available ?? 0}/3 geladen</span>
                </div>
                <div className="data-actions context-source-actions">
                  {(["claude", "memory", "codex"] as ContextTarget[]).map((target) => {
                    const file = contextOverview?.files.find((entry) => entry.target === target);
                    const label = target === "claude" ? "CLAUDE.md" : target === "memory" ? "MEMORY.md" : "AGENTS.md";
                    return <button
                      className="secondary-button context-source-button"
                      data-status={file?.status ?? "missing"}
                      disabled={!file}
                      key={target}
                      type="button"
                      onClick={() => onOpenContextFile?.(target)}
                    >
                      <span aria-hidden="true" />
                      {label}
                    </button>;
                  })}
                </div>
                <p className="capability-note">
                  Grün bedeutet kompakt, Gelb beobachten, Rot zu lang. Die Ampelübersicht zeigt Volltext, Kennzahlen und den sicheren Backup-und-Analyse-Ablauf.
                </p>
              </section>
              {onLocalCatalogExport ? (
                <section className="data-section" aria-labelledby="local-export-title" data-tour="local-catalog-export">
                  <div className="section-heading">
                    <div>
                      <h3 id="local-export-title">Persönlichen Katalog exportieren</h3>
                      <p>Erstellt eine portable JSON-Datei aus den aktuell indexierten Skills, Prompts, Commands und Apps.</p>
                    </div>
                  </div>
                  <div className="data-actions">
                    <button className="secondary-button" type="button" disabled={busy} onClick={() => void exportLocalCatalog()}>
                      <Download aria-hidden="true" />
                      Katalog exportieren
                    </button>
                  </div>
                  <p className="capability-note">
                    Der Export enthält keine Dateipfade, Kontextdateien oder Session-Inhalte. Er enthält nur aggregierte Nutzungswerte für Most Used. Öffne anschließend das Browser-Profil und wähle im Data Center unter „Lokaler Import“ die exportierte Katalog-JSON. Der Browser liest private Ordner nie selbst.
                  </p>
                </section>
              ) : null}
            </>
          ) : (
            <>
              <section className="data-section" aria-labelledby="import-title" data-tour="imports">
                <div className="section-heading">
                  <div>
                    <h3 id="import-title">Lokaler Import</h3>
                    <p>{importedCount} importierte Einträge in IndexedDB</p>
                  </div>
                </div>
                <label className="data-import-ownership">
                  <input
                    checked={markSkillImportsAsOwned}
                    type="checkbox"
                    disabled={busy}
                    onChange={(event) => setMarkSkillImportsAsOwned(event.target.checked)}
                  />
                  <span>Als eigene Skills einordnen</span>
                </label>
                <div className="data-actions">
                  <label className="secondary-button file-button">
                    <FileText aria-hidden="true" />
                    Markdown wählen
                    <input
                      type="file"
                      accept=".md,text/markdown"
                      multiple
                      disabled={busy}
                      onChange={(event) => {
                        const files = [...(event.currentTarget.files ?? [])];
                        event.currentTarget.value = "";
                        void importFiles(files);
                      }}
                    />
                  </label>
                  <label className="secondary-button file-button">
                    <FolderOpen aria-hidden="true" />
                    App-Manifest wählen
                    <input
                      type="file"
                      accept="package.json,application/json"
                      multiple
                      disabled={busy}
                      onChange={(event) => {
                        const files = [...(event.currentTarget.files ?? [])];
                        event.currentTarget.value = "";
                        void importAppManifests(files);
                      }}
                    />
                  </label>
                  <label className="secondary-button file-button">
                    <FileJson aria-hidden="true" />
                    Katalog-JSON wählen
                    <input
                      type="file"
                      accept=".json,application/json"
                      multiple
                      disabled={busy}
                      onChange={(event) => {
                        const files = [...(event.currentTarget.files ?? [])];
                        event.currentTarget.value = "";
                        void importFiles(files);
                      }}
                    />
                  </label>
                  {supportsDirectoryPicker ? (
                    <button className="secondary-button" type="button" disabled={busy} onClick={() => void chooseDirectory()}>
                      <FolderOpen aria-hidden="true" />
                      Ordner wählen
                    </button>
                  ) : null}
                </div>
                <p className="capability-note">
                  {supportsDirectoryPicker
                    ? "Ordner werden erst nach deiner ausdrücklichen Auswahl rekursiv gelesen. App-Importe lesen ausschließlich ausgewählte package.json-Dateien."
                    : "Dieser Browser kann Ordner nicht rekursiv lesen. Wähle stattdessen einzelne Markdown-, JSON- oder package.json-Dateien."}
                </p>
              </section>

              <section className="data-section" aria-labelledby="context-import-title" data-tour="context-imports">
                <div className="section-heading">
                  <div>
                    <h3 id="context-import-title">Kontextdateien</h3>
                    <p>CLAUDE.md, MEMORY.md oder AGENTS.md gezielt auswählen</p>
                  </div>
                </div>
                <div className="data-actions">
                  <label className="secondary-button file-button">
                    <Files aria-hidden="true" />
                    Kontextdateien wählen
                    <input
                      type="file"
                      accept=".md,text/markdown"
                      multiple
                      disabled={busy}
                      onChange={(event) => {
                        const files = [...(event.currentTarget.files ?? [])];
                        event.currentTarget.value = "";
                        void importContextFiles(files);
                      }}
                    />
                  </label>
                </div>
                <p className="capability-note">
                  Jede Auswahl ersetzt den zuvor gespeicherten Inhalt desselben Kontextziels. Es findet kein Upload statt und die Quelldateien werden nie verändert.
                </p>
              </section>

              <section className="data-section" aria-labelledby="maintenance-title">
                <div className="section-heading">
                  <div>
                    <h3 id="maintenance-title">Wartung</h3>
                    <p>{DISTRIBUTION_SUPPORTS_DEMO
                      ? "Lokale Sicherung und neutrale Beispieldaten"
                      : "Lokale Sicherung und neutraler Starter-Katalog"}</p>
                  </div>
                </div>
                <div className="data-actions">
                  <button className="secondary-button" type="button" disabled={busy} onClick={() => void exportData()}>
                    <Download aria-hidden="true" />
                    Browserdaten exportieren
                  </button>
                  {DISTRIBUTION_SUPPORTS_DEMO ? (
                    <button className="secondary-button" type="button" disabled={busy} onClick={() => void resetDemo()}>
                      <RefreshCw aria-hidden="true" />
                      Demo zurücksetzen
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="data-section" aria-labelledby="delete-title">
                <div className="section-heading">
                  <div>
                    <h3 id="delete-title">Daten löschen</h3>
                    <p>Jede Löschaktion erfordert eine separate Bestätigung.</p>
                  </div>
                </div>
                <div className="data-actions">
                  <button className="secondary-button" type="button" disabled={busy} onClick={() => requestDestructiveAction("imports")}>
                    <Trash2 aria-hidden="true" />
                    Importe löschen
                  </button>
                  <button className="secondary-button" type="button" disabled={busy} onClick={() => requestDestructiveAction("context")}>
                    <Files aria-hidden="true" />
                    Kontextdateien löschen
                  </button>
                  <button className="secondary-button" type="button" disabled={busy} onClick={() => requestDestructiveAction("usage")}>
                    <History aria-hidden="true" />
                    Nutzungsverlauf löschen
                  </button>
                  <button className="secondary-button" type="button" disabled={busy} onClick={() => requestDestructiveAction("all")}>
                    <RotateCcw aria-hidden="true" />
                    Alle Browserdaten zurücksetzen
                  </button>
                </div>

                {pendingAction ? (
                  <div
                    className="dialog-error"
                    role="group"
                    aria-labelledby="delete-confirmation-title"
                    ref={confirmationRef}
                    tabIndex={-1}
                  >
                    <strong id="delete-confirmation-title">{DESTRUCTIVE_ACTIONS[pendingAction].title}</strong>
                    <p>{DESTRUCTIVE_ACTIONS[pendingAction].detail}</p>
                    <div className="data-actions">
                      <button className="secondary-button" type="button" disabled={busy} onClick={() => setPendingAction(null)}>
                        Abbrechen
                      </button>
                      <button className="secondary-button" type="button" disabled={busy} onClick={() => void confirmDestructiveAction()}>
                        <Trash2 aria-hidden="true" />
                        {DESTRUCTIVE_ACTIONS[pendingAction].confirmLabel}
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              {message ? <p className="dialog-message" role="status">{message}</p> : null}
              {error ? <p className="dialog-error" role="alert">{error}</p> : null}
            </>
          )}
        </div>
        <footer className="data-dialog-footer">
          <button className="secondary-button" type="button" onClick={onOpenContextMonitor}>
            <Activity aria-hidden="true" />
            Ampelübersicht öffnen
          </button>
          <button className="primary-button" type="button" disabled={busy} onClick={applyDataSelection}>
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
