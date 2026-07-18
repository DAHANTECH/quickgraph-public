import { Check, FileClock, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  ContextFileOverview,
  ContextOverview,
  ContextPrepareResult,
  QuickGraphAdapter,
} from "../../domain";
import { buildContextDiff, contextMetrics, type ContextDiffKind } from "./context-diff";

interface ContextOptimizerProps {
  adapter: QuickGraphAdapter;
  file: ContextFileOverview | null;
  onClose: () => void;
  onRefresh: () => Promise<ContextOverview | null>;
}

type OptimizerPhase = "idle" | "preparing" | "prepared" | "confirming" | "completed" | "error";

export function ContextOptimizer({ adapter, file, onClose, onRefresh }: ContextOptimizerProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [phase, setPhase] = useState<OptimizerPhase>("idle");
  const [feedback, setFeedback] = useState("");
  const [prepared, setPrepared] = useState<ContextPrepareResult | null>(null);
  const [draft, setDraft] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [after, setAfter] = useState<ContextFileOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    headingRef.current?.focus();
    setPhase("idle");
    setFeedback("");
    setPrepared(null);
    setDraft("");
    setIsConfirmed(false);
    setAfter(null);
    setError(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [file?.target, onClose]);

  if (!file) return null;

  const prepare = async () => {
    setPhase("preparing");
    setError(null);
    try {
      const result = await adapter.prepareContext(file.target, feedback.trim() ? { feedback: feedback.trim() } : {});
      setPrepared(result);
      setDraft(result.preview);
      setIsConfirmed(false);
      setAfter(null);
      setPhase("prepared");
    } catch (prepareError) {
      setError(messageFor(prepareError, "Die Vorschau konnte nicht vorbereitet werden."));
      setPhase("error");
    }
  };

  const confirm = async () => {
    if (!prepared || !isConfirmed) return;
    setPhase("confirming");
    setError(null);
    try {
      await adapter.confirmContext(file.target, {
        prepareId: prepared.prepareId,
        ...(feedback.trim() ? { feedback: feedback.trim() } : {}),
        draft,
      });
      const overview = await onRefresh();
      const refreshedFile = overview?.files.find((entry) => entry.target === file.target);
      if (!refreshedFile) {
        throw new ReloadVerificationError("Die Änderung wurde nicht als Erfolg bestätigt, weil der Kontext nicht neu geladen werden konnte.");
      }
      if (refreshedFile.content !== draft) {
        throw new ReloadVerificationError("Die Änderung wurde nicht als Erfolg bestätigt, weil der neu geladene Kontext nicht dem bestätigten Entwurf entspricht.");
      }
      setAfter(refreshedFile);
      setPhase("completed");
    } catch (confirmError) {
      setPrepared(null);
      setIsConfirmed(false);
      setError(messageFor(confirmError, "Die vorbereitete Änderung konnte nicht angewendet oder geprüft werden."));
      setPhase("error");
    }
  };

  const busy = phase === "preparing" || phase === "confirming";
  const diff = prepared ? buildContextDiff(prepared.before, draft) : [];
  const beforeMetrics = prepared ? contextMetrics(prepared.before) : null;
  const draftMetrics = prepared ? contextMetrics(draft) : null;
  return (
    <div className="dialog-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="context-optimizer-dialog"
        data-tour="context-optimizer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-optimizer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-head">
          <div>
            <span className="dialog-kicker"><Sparkles aria-hidden="true" /> Sicherheitsvorschau</span>
            <h2 id="context-optimizer-title" ref={headingRef} tabIndex={-1}>{file.name} optimieren</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Optimierung schließen">
            <X aria-hidden="true" />
            <span className="sr-only">Optimierung schließen</span>
          </button>
        </header>

        <div className="dialog-body context-optimizer-body">
          <p className="context-optimizer-intro">
            Ablauf: Sicherung und Analyse vorbereiten, die Vorschau prüfen, optionales Feedback ergänzen und erst dann ausdrücklich bestätigen. {adapter.kind === "browser"
              ? "Das Browser-Profil erstellt dabei ausschließlich eine lokale Revision mit Sicherung in IndexedDB; die ausgewählte Quelldatei bleibt unverändert und kann nur über das Data Center exportiert werden."
              : "Die LocalAPI schreibt eine lokale Kontextdatei ausschließlich nach vorhandener Sicherung und dieser ausdrücklichen Bestätigung."}
          </p>

          {!prepared ? (
            <>
              <section className="context-optimizer-methods" aria-labelledby="context-optimizer-methods-title">
                <h3 id="context-optimizer-methods-title">Verwendete Methoden</h3>
                <ul>
                  <li>Sicherung der aktuellen Revision</li>
                  <li>Vorher-Analyse und vorbereiteter Entwurf</li>
                  <li>Zeilenbasierter Vorher/Nachher-Diff</li>
                  <li>Prüfung von Prepare-ID, Ablaufzeit und Quellstand beim Schreiben</li>
                </ul>
              </section>
              <button className="primary-button" type="button" disabled={busy || phase === "completed"} onClick={() => void prepare()}>
                <FileClock aria-hidden="true" />
                {phase === "preparing" ? "Vorschau wird vorbereitet" : "Vorschau + Sicherung vorbereiten"}
              </button>
            </>
          ) : (
            <>
              <div className="dialog-notice context-prepare-notice">
                <FileClock aria-hidden="true" />
                <span>Sicherung {shortId(prepared.backupId)} erstellt. Diese Vorschau verfällt um {formatTime(prepared.expiresAt)}.</span>
              </div>
              <section className="context-optimization-report" aria-labelledby="context-optimization-report-title">
                <h3 id="context-optimization-report-title">Analysebericht</h3>
                <dl className="context-optimization-metrics">
                  <div>
                    <dt>Vorher</dt>
                    <dd>{formatMetrics(beforeMetrics)}</dd>
                  </div>
                  <div>
                    <dt>Entwurf</dt>
                    <dd>{formatMetrics(draftMetrics, beforeMetrics)}</dd>
                  </div>
                  <div>
                    <dt>Sicherung</dt>
                    <dd>{shortId(prepared.backupId)}</dd>
                  </div>
                  <div>
                    <dt>Quelle</dt>
                    <dd>{file.source}</dd>
                  </div>
                </dl>
              </section>
              <section className="context-diff-summary" aria-label="Diff-Legende">
                <h3>Vorher/Nachher-Diff</h3>
                <p className="context-diff-legend">
                  <span className="context-diff-legend-item context-diff-legend-item--removed">Entfernt</span>
                  <span aria-hidden="true"> · </span>
                  <span className="context-diff-legend-item context-diff-legend-item--added">Hinzugefügt</span>
                </p>
              </section>
              <div className="context-compare context-diff" aria-label="Farbdifferenz zwischen Vorher und Entwurf">
                <section className="context-diff-column context-diff-column--before">
                  <h3>Vorher</h3>
                  <pre className="context-diff-lines">
                    {diff.map((row, index) => <DiffLine key={`before-${index}`} row={row} side="before" />)}
                  </pre>
                </section>
                <section className="context-diff-column context-diff-column--after">
                  <h3>Entwurf</h3>
                  <pre className="context-diff-lines">
                    {diff.map((row, index) => <DiffLine key={`after-${index}`} row={row} side="after" />)}
                  </pre>
                </section>
              </div>
              <label className="context-draft-label" htmlFor="context-optimization-draft">
                Bearbeitbarer Entwurf
                <textarea
                  id="context-optimization-draft"
                  value={draft}
                  disabled={busy || phase === "completed"}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setIsConfirmed(false);
                  }}
                  rows={12}
                />
              </label>
              <label className="context-feedback-label" htmlFor="context-optimization-feedback">
                Optionales Feedback vor der Bestätigung
                <textarea
                  id="context-optimization-feedback"
                  value={feedback}
                  disabled={busy}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="Zum Beispiel: Bitte bei der nächsten Prüfung besonders auf Wiederholungen achten"
                  rows={3}
                />
              </label>
              {phase !== "completed" ? <label className="context-confirmation-label" htmlFor="context-optimization-confirmation">
                <input
                  id="context-optimization-confirmation"
                  type="checkbox"
                  checked={isConfirmed}
                  disabled={busy}
                  onChange={(event) => setIsConfirmed(event.target.checked)}
                />
                <span>Ich habe Sicherung, Bericht und Diff geprüft und bestätige genau diesen Entwurf.</span>
              </label> : null}
              {phase !== "completed" ? <div className="context-optimizer-actions">
                <button className="secondary-button" type="button" disabled={busy} onClick={() => { setPrepared(null); setPhase("idle"); }}>
                  Vorschau verwerfen
                </button>
                <button className="primary-button" type="button" disabled={busy || !isConfirmed} onClick={() => void confirm()}>
                  <Check aria-hidden="true" />
                  {phase === "confirming" ? "Änderung wird angewendet" : "Änderung bestätigen und anwenden"}
                </button>
              </div> : null}
            </>
          )}

          {phase === "completed" ? (
            <div className="dialog-message context-optimizer-success" role="status">
              <Check aria-hidden="true" />
              <span>
                Änderung angewendet. {after ? `Jetzt ${after.lines.toLocaleString("de-DE")} Zeilen, ca. ${after.tokens.toLocaleString("de-DE")} Tokens, Status ${statusLabel(after.status)}.` : "Der Kontext wurde neu geladen."}
              </span>
            </div>
          ) : null}
          {error ? <div className="dialog-error" role="alert">{error}</div> : null}
        </div>
      </section>
    </div>
  );
}

function DiffLine({ row, side }: { row: ReturnType<typeof buildContextDiff>[number]; side: "before" | "after" }) {
  const content = side === "before" ? row.before : row.after;
  const line = side === "before" ? row.beforeLine : row.afterLine;
  return (
    <span
      className={`context-diff-line ${diffLineClass(row.kind, side)}`}
      data-diff-kind={row.kind}
    >
      <span className="context-diff-line-number" aria-hidden="true">{line ?? ""}</span>
      <code>{content ?? ""}</code>
      {"\n"}
    </span>
  );
}

function diffLineClass(kind: ContextDiffKind, side: "before" | "after"): string {
  if (kind === "unchanged") return "context-diff-line--unchanged";
  if (kind === "changed") return side === "before" ? "context-diff-line--removed" : "context-diff-line--added";
  return `context-diff-line--${kind}`;
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function shortId(id: string): string {
  return id.length <= 20 ? id : `${id.slice(0, 19)}…`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "in Kürze" : date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: ContextFileOverview["status"]): string {
  return status === "green" ? "grün" : status === "yellow" ? "gelb" : "rot";
}

function formatMetrics(metrics: ReturnType<typeof contextMetrics> | null, previous?: ReturnType<typeof contextMetrics> | null): string {
  if (!metrics) return "Nicht verfügbar";
  const difference = previous ? ` (${formatDelta(metrics.lines - previous.lines)} Zeilen, ${formatDelta(metrics.tokens - previous.tokens)} Tokens)` : "";
  return `${metrics.lines.toLocaleString("de-DE")} Zeilen, ${metrics.chars.toLocaleString("de-DE")} Zeichen, ca. ${metrics.tokens.toLocaleString("de-DE")} Tokens${difference}`;
}

function formatDelta(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE")}`;
}

class ReloadVerificationError extends Error {}
