import { Check, Copy, Download, Eye, FileText, FileType2, Pencil, Printer, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EntryViewToggle } from "../../components/EntryViewToggle";
import { CompactListHeader, type SortDirection } from "../../components/CompactListHeader";
import type { ContextFileOverview, ContextOverview, ContextStatus, ContextTarget, QuickGraphAdapter } from "../../domain";
import type { CatalogViewPreference } from "../../lib/preferences";
import { downloadDetail, printDetailAsPdf } from "../detail";

interface ContextMonitorProps {
  adapter: QuickGraphAdapter;
  overview: ContextOverview | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<unknown>;
  onOpenDataCenter: () => void;
  onOptimize: (file: ContextFileOverview) => void;
  view: CatalogViewPreference;
  onViewChange: (view: CatalogViewPreference) => void;
}

const TARGETS: ReadonlyArray<{
  target: ContextTarget;
  name: ContextFileOverview["name"];
  detail: string;
}> = [
  { target: "claude", name: "CLAUDE.md", detail: "Claude Projektregeln" },
  { target: "memory", name: "MEMORY.md", detail: "Kuratierter Arbeitskontext" },
  { target: "codex", name: "AGENTS.md", detail: "Codex Arbeitsregeln" },
];

type ContextSort = "name" | "status" | "tokens" | "actions";
const CONTEXT_STATUS_ORDER: Record<ContextStatus, number> = { green: 0, yellow: 1, red: 2 };

export function ContextMonitor({ adapter, overview, loading, error, onRefresh, onOpenDataCenter, onOptimize, view, onViewChange }: ContextMonitorProps) {
  const [openFile, setOpenFile] = useState<ContextFileOverview | null>(null);
  const [sort, setSort] = useState<ContextSort>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const files = new Map(overview?.files.map((file) => [file.target, file]) ?? []);
  const sortedTargets = [...TARGETS].sort((left, right) => {
    const leftFile = files.get(left.target);
    const rightFile = files.get(right.target);
    let difference = 0;
    if (sort === "name") difference = left.name.localeCompare(right.name, "de");
    if (sort === "status") difference = (leftFile ? CONTEXT_STATUS_ORDER[leftFile.status] : 3) - (rightFile ? CONTEXT_STATUS_ORDER[rightFile.status] : 3);
    if (sort === "tokens") difference = (leftFile?.tokens ?? -1) - (rightFile?.tokens ?? -1);
    if (difference !== 0) return sortDirection === "asc" ? difference : -difference;
    return left.name.localeCompare(right.name, "de");
  });
  const updateSort = (nextSort: ContextSort) => {
    if (nextSort === "actions") return;
    setSortDirection((current) => nextSort === sort ? (current === "asc" ? "desc" : "asc") : "asc");
    setSort(nextSort);
  };

  return (
    <section aria-labelledby="context-title">
      <div className="catalog-heading insights-heading">
        <div>
          <p>{overview?.adapter === "local-api" ? "Lokale Dateiquellen" : "Nur explizit gewählte Browserdateien"}</p>
          <h1 id="context-title">Context</h1>
        </div>
        <div className="insights-actions">
          <EntryViewToggle view={view} onChange={onViewChange} />
          <button className="icon-button" type="button" onClick={() => void onRefresh()} title="Kontext neu laden">
            <RefreshCw aria-hidden="true" />
            <span className="sr-only">Kontext neu laden</span>
          </button>
        </div>
      </div>

      {loading ? <div className={view === "list" ? "context-grid compact-entry-list" : "context-grid"} data-entry-view={view} aria-busy="true">{TARGETS.map(({ target }) => <div className={view === "list" ? "context-panel compact-entry-row skeleton-card" : "context-panel skeleton-card"} key={target} />)}</div> : null}
      {!loading && error ? <div className="adapter-error" role="alert"><strong>Kontextstatus nicht verfügbar</strong><p>{error}</p></div> : null}
      {!loading && !error ? (
        <>
          <div className={view === "list" ? "context-grid compact-entry-list" : "context-grid"} data-entry-view={view}>
            {view === "list" ? <CompactListHeader
              activeSort={sort}
              className="context-list-header"
              columns={[
                { key: "name", label: "Datei" },
                { key: "status", label: "Status" },
                { key: "tokens", label: "Umfang" },
                { key: "actions", label: "Aktionen", sortable: false },
              ]}
              direction={sortDirection}
              onSort={updateSort}
            /> : null}
            {sortedTargets.map(({ target, name, detail }) => {
              const file = files.get(target);
              return (
                <article className={["context-panel", view === "list" ? "compact-entry-row" : "", file ? "" : "context-missing"].filter(Boolean).join(" ")} key={target}>
                  <header>
                    <span className="context-file-identity">
                      <span className="context-file-icon"><FileText aria-hidden="true" /></span>
                      <span><strong>{name}</strong><small>{detail}</small></span>
                    </span>
                    {file ? <StatusBadge status={file.status} /> : <span className="context-unavailable">Nicht geladen</span>}
                  </header>
                  {file ? (
                    <>
                      <dl className="context-metrics">
                        <div><dt>Zeilen</dt><dd>{formatNumber(file.lines)}</dd></div>
                        <div><dt>Zeichen</dt><dd>{formatNumber(file.chars ?? file.content.length)}</dd></div>
                        <div><dt>Tokens ca.</dt><dd>{formatNumber(file.tokens)}</dd></div>
                      </dl>
                      <div className="context-panel-actions">
                        <button className="context-read-button" type="button" onClick={() => setOpenFile(file)}>
                          <Eye aria-hidden="true" /> Volltext lesen
                        </button>
                        {adapter.capabilities.contextOptimize ? (
                          <button className="context-read-button" type="button" onClick={() => onOptimize(file)} title="Erstellt zuerst eine Sicherung und eine sichtbare Optimierungsvorschau">
                            <Sparkles aria-hidden="true" /> Backup + Analyse
                          </button>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="context-missing-copy">
                      <p>Für dieses Ziel liegt keine lesbare Datei vor.</p>
                      {overview?.adapter !== "local-api" ? <button className="secondary-button" type="button" onClick={onOpenDataCenter}>Datei wählen</button> : null}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {overview?.files.length === 0 ? <p className="context-honesty">QuickGraph zeigt keinen Kontext an, solange keine Quelle verfügbar ist.</p> : null}
        </>
      ) : null}
      <ContextReadDrawer
        file={openFile}
        canEdit={adapter.capabilities.contextOptimize}
        onClose={() => setOpenFile(null)}
        onEdit={(file) => {
          setOpenFile(null);
          onOptimize(file);
        }}
      />
    </section>
  );
}

export function StatusBadge({ status }: { status: ContextStatus }) {
  const label = status === "green" ? "Kompakt" : status === "yellow" ? "Beobachten" : "Zu lang";
  return <span className="context-status" data-status={status}><span aria-hidden="true" />{label}</span>;
}

interface ContextReadDrawerProps {
  file: ContextFileOverview | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (file: ContextFileOverview) => void;
}

function ContextReadDrawer({ file, canEdit, onClose, onEdit }: ContextReadDrawerProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copyStatus, setCopyStatus] = useState<"success" | "error" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return;
    headingRef.current?.focus();
    setCopyStatus(null);
    setExportOpen(false);
    setExportStatus(null);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [file, onClose]);
  if (!file) return null;

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  };

  const exportableFile = {
    name: file.name,
    key: file.target,
    category: "Kontextdatei",
    content: file.content,
  };

  const exportContent = (format: "md" | "doc" | "pdf") => {
    if (format === "pdf") {
      setExportStatus(printDetailAsPdf(exportableFile) ? "Druckdialog für PDF geöffnet." : "Popup wurde blockiert.");
    } else {
      downloadDetail(exportableFile, format);
      setExportStatus("Datei exportiert.");
    }
    setExportOpen(false);
  };

  return <div className="drawer-layer" role="presentation" onMouseDown={onClose}>
    <aside className="item-drawer context-drawer" role="dialog" aria-modal="true" aria-labelledby="context-drawer-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="drawer-head">
        <div>
          <span className="drawer-kicker">{file.source === "filesystem" ? "Lokale Dateiquelle" : "Browserlokale Revision"}</span>
          <h2 id="context-drawer-title" tabIndex={-1} ref={headingRef}>{file.name}</h2>
          <p>{formatNumber(file.lines)} Zeilen · ca. {formatNumber(file.tokens)} Tokens</p>
        </div>
        <div className="drawer-actions">
          <button className="icon-button" type="button" onClick={() => void copyContent()} title={copyStatus === "success" ? "Kopiert" : "Inhalt kopieren"}>
            <Copy aria-hidden="true" />
            <span className="sr-only">{copyStatus === "success" ? "Kopiert" : "Inhalt kopieren"}</span>
          </button>
          <div className="drawer-export">
            <button
              aria-expanded={exportOpen}
              aria-haspopup="menu"
              className="icon-button"
              type="button"
              onClick={() => setExportOpen((current) => !current)}
              title="Exportieren"
            >
              <Download aria-hidden="true" />
              <span className="sr-only">Exportieren</span>
            </button>
            {exportOpen ? <div className="drawer-export-menu" role="menu" aria-label="Exportformat wählen">
              <button type="button" role="menuitem" onClick={() => exportContent("md")}><FileText aria-hidden="true" /> Markdown</button>
              <button type="button" role="menuitem" onClick={() => exportContent("doc")}><FileType2 aria-hidden="true" /> Word</button>
              <button type="button" role="menuitem" onClick={() => exportContent("pdf")}><Printer aria-hidden="true" /> PDF</button>
            </div> : null}
          </div>
          {canEdit ? <button className="icon-button" type="button" onClick={() => onEdit(file)} title="Bearbeiten (Backup + Analyse)">
            <Pencil aria-hidden="true" />
            <span className="sr-only">Bearbeiten</span>
          </button> : null}
          <button className="icon-button" type="button" onClick={onClose} title="Volltext schließen"><X aria-hidden="true" /><span className="sr-only">Volltext schließen</span></button>
        </div>
      </header>
      <div className="drawer-body">
        {copyStatus ? <p className="action-state" role="status">{copyStatus === "success" ? <Check aria-hidden="true" /> : null}{copyStatus === "success" ? `${file.name} wurde kopiert.` : `${file.name} konnte nicht kopiert werden.`}</p> : null}
        {exportStatus ? <p className="sr-only" role="status">{exportStatus}</p> : null}
        <pre className="drawer-content">{file.content}</pre>
      </div>
    </aside>
  </div>;
}

function formatNumber(value: number): string {
  return value.toLocaleString("de-DE");
}
