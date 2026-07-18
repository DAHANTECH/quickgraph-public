import { Check, Copy, Database, FileText, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ContextFileOverview } from "../domain";

interface ContextQuickViewProps {
  file: ContextFileOverview | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onOptimize: (file: ContextFileOverview) => void;
  onOpenDataCenter?: () => void;
}

const STATUS_COPY: Record<ContextFileOverview["status"], { label: string; detail: string }> = {
  green: {
    label: "Kompakt",
    detail: "Der Kontext liegt im grünen Bereich.",
  },
  yellow: {
    label: "Beobachten",
    detail: "Der Kontext ist noch nutzbar, sollte aber beobachtet werden.",
  },
  red: {
    label: "Zu lang",
    detail: "Der Kontext ist länger als empfohlen und sollte optimiert werden.",
  },
};

export function ContextQuickView({
  file,
  open,
  onClose,
  onRefresh,
  onOptimize,
  onOpenDataCenter,
}: ContextQuickViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!open) return;

    headingRef.current?.focus();
    setCopyStatus(null);
    setRefreshing(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [file?.target, onClose, open]);

  if (!open) return null;

  const copyContent = async () => {
    if (!file) return;

    try {
      await navigator.clipboard.writeText(file.content);
      setCopyStatus(`${file.name} wurde kopiert.`);
    } catch {
      setCopyStatus(`${file.name} konnte nicht kopiert werden.`);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const status = file ? STATUS_COPY[file.status] : null;
  const chars = file?.chars ?? file?.content.length ?? 0;

  return (
    <div className="dialog-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="context-optimizer-dialog context-quick-view-dialog"
        data-tour="context-quick-view"
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-quick-view-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-head">
          <div>
            <span className="dialog-kicker"><FileText aria-hidden="true" /> Kontextdatei</span>
            <h2 id="context-quick-view-title" ref={headingRef} tabIndex={-1}>{file?.name ?? "Kontext nicht geladen"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Kontextansicht schließen">
            <X aria-hidden="true" />
            <span className="sr-only">Kontextansicht schließen</span>
          </button>
        </header>

        <div className="dialog-body context-optimizer-body context-quick-view-body">
          {file && status ? (
            <>
              <div className="context-quick-view-status" data-status={file.status}>
                <span className="context-status" data-status={file.status}><span aria-hidden="true" />{status.label}</span>
                <p>{status.detail}</p>
              </div>
              <dl className="context-metrics context-quick-view-metrics">
                <div><dt>Zeilen</dt><dd>{formatNumber(file.lines)}</dd></div>
                <div><dt>Zeichen</dt><dd>{formatNumber(chars)}</dd></div>
                <div><dt>Tokens ca.</dt><dd>{formatNumber(file.tokens)}</dd></div>
              </dl>
              <pre className="drawer-content context-quick-view-content">{file.content}</pre>
              <div className="context-quick-view-actions">
                <button className="secondary-button" type="button" onClick={() => void refresh()} disabled={refreshing}>
                  <RefreshCw aria-hidden="true" /> {refreshing ? "Aktualisiere" : "Aktualisieren"}
                </button>
                <button className="secondary-button" type="button" onClick={() => void copyContent()}>
                  <Copy aria-hidden="true" /> Inhalt kopieren
                </button>
                <button className="primary-button" type="button" onClick={() => onOptimize(file)} title="Erstellt zuerst eine Sicherung und eine sichtbare Optimierungsvorschau">
                  <Sparkles aria-hidden="true" /> Backup + Analyse
                </button>
              </div>
              {copyStatus ? <p className="dialog-message" role="status">{copyStatus.includes("wurde") ? <Check aria-hidden="true" /> : null}{copyStatus}</p> : null}
            </>
          ) : (
            <div className="context-missing-copy">
              <p>Für diese Kontextdatei liegen keine lesbaren Daten vor.</p>
              <div className="context-quick-view-actions">
                <button className="secondary-button" type="button" onClick={() => void refresh()} disabled={refreshing}>
                  <RefreshCw aria-hidden="true" /> {refreshing ? "Aktualisiere" : "Aktualisieren"}
                </button>
                {onOpenDataCenter ? (
                <button className="secondary-button" type="button" onClick={onOpenDataCenter}>
                  <Database aria-hidden="true" /> Data Center
                </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatNumber(value: number): string {
  return value.toLocaleString("de-DE");
}
