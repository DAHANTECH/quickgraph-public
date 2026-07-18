import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Activity,
  BarChart3,
  Columns3,
  Database,
  FileText,
  Filter,
  FolderInput,
  LayoutGrid,
  List,
  Menu,
  Network,
  PanelLeftClose,
  PanelRightOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { DISTRIBUTION_SUPPORTS_DEMO } from "../data/public-catalog";
import "./OnboardingTour.css";

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
  onPrepareStep?: (step: OnboardingTourStepPreparation) => void;
  profile: "browser" | "local-api";
}

export interface OnboardingTourStepPreparation {
  id: TourStepId;
  anchors: readonly string[];
}

type TourStepId =
  | "catalog"
  | "search"
  | "view-mode"
  | "sidebar"
  | "sidebar-toggle"
  | "filter"
  | "data-center"
  | "data-modes"
  | "imports"
  | "local-catalog-export"
  | "context-claude"
  | "context-memory"
  | "context-agents"
  | "context-monitor"
  | "context-optimizer"
  | "local-api"
  | "refresh"
  | "report"
  | "drawer";

interface TourStep extends OnboardingTourStepPreparation {
  icon: typeof LayoutGrid;
  title: string;
  detail: string;
}

interface TourPosition {
  left: number;
  top: number;
  placement: "above" | "below" | "fallback";
  spotlight: { height: number; left: number; top: number; width: number } | null;
}

const EDGE_GAP = 12;
const POPOVER_GAP = 16;
const SPOTLIGHT_GAP = 8;
const BROWSER_DATA_MODE_SUMMARY = DISTRIBUTION_SUPPORTS_DEMO
  ? "QuickGraph, Eigene Inhalte, Demo und Virgin"
  : "QuickGraph, Eigene Inhalte und Virgin";

const START_STEPS: TourStep[] = [
  { id: "catalog", anchors: ["catalog", "brand"], icon: LayoutGrid, title: "Katalog", detail: "Der Katalog bündelt Skills, Prompts, MCP-Server, Regeln, Apps und Workflows an einem Ort." },
  { id: "search", anchors: ["search"], icon: Search, title: "Suche", detail: "Suche über Namen, Beschreibungen und Tags. Die Treffer bleiben auf den aktiven Bereich begrenzt." },
  { id: "view-mode", anchors: ["view-mode"], icon: Columns3, title: "Kacheln und Liste", detail: "Wechsle zwischen kompakter Kartenansicht und einer vergleichbaren Listenansicht." },
  { id: "sidebar", anchors: ["sidebar"], icon: Menu, title: "Seitenleiste", detail: "Die Seitenleiste führt durch Katalogbereiche, Nutzungsansichten und Kontextstatus." },
  { id: "sidebar-toggle", anchors: ["sidebar-toggle"], icon: PanelLeftClose, title: "Seitenleiste einklappen", detail: "Klappe die Navigation ein, wenn du mehr Raum für Suche, Filter und Ergebnisse brauchst." },
  { id: "filter", anchors: ["filter", "filters"], icon: Filter, title: "Filter", detail: "Filtere nach Inhaltstypen und Bereichen, ohne die zugrunde liegenden Daten zu verändern." },
];

const END_STEPS: TourStep[] = [
  { id: "context-claude", anchors: ["context-quick-view", "context-claude"], icon: FileText, title: "CLAUDE.md", detail: "Öffne Claude-Projektregeln als Volltext und prüfe Zeilen-, Zeichen- und Token-Schätzung." },
  { id: "context-memory", anchors: ["context-quick-view", "context-memory"], icon: FileText, title: "MEMORY.md", detail: "Öffne den kuratierten Arbeitskontext getrennt von Katalog- und Nutzungsdaten." },
  { id: "context-agents", anchors: ["context-quick-view", "context-agents"], icon: FileText, title: "AGENTS.md", detail: "Öffne Codex-Arbeitsregeln als eigene Kontextquelle und prüfe ihren aktuellen Status." },
  { id: "context-monitor", anchors: ["context-monitor"], icon: Activity, title: "Statusmonitoring", detail: "Die Ampel zeigt kompakt, beobachten oder zu lang. Öffne die Vollansicht, bevor du etwas optimierst." },
  { id: "context-optimizer", anchors: ["context-optimizer", "context-monitor"], icon: ShieldCheck, title: "Sicher optimieren", detail: "Zuerst erstellt QuickGraph Backup und Analyse, dann siehst du die Vorschau. Optionales Feedback und eine explizite Bestätigung folgen erst danach." },
  { id: "local-api", anchors: ["local-api"], icon: Network, title: "LocalAPI", detail: "Das private Profil arbeitet ausschließlich über die lokale Loopback-Verbindung und nur mit konfigurierten, erlaubten Quellen." },
  { id: "refresh", anchors: ["refresh"], icon: RefreshCw, title: "Aktualisieren", detail: "Aktualisiere den Katalog. Mit LocalAPI werden dabei die erlaubten Quellen erneut gescannt, im Browser-Profil werden lokale Daten neu geladen." },
  { id: "report", anchors: ["report"], icon: BarChart3, title: "Report", detail: "Der Report verdichtet den bereinigten Katalog zu prüfbaren Hinweisen für die weitere Arbeit." },
  { id: "drawer", anchors: ["drawer", "drawers"], icon: PanelRightOpen, title: "Drawer", detail: "Die Tour öffnet jetzt einen echten Eintrag mit Volltext, Kopierfunktion und den jeweils erlaubten Aktionen." },
];

function stepsFor(profile: OnboardingTourProps["profile"]): TourStep[] {
  const dataSteps: TourStep[] = profile === "browser" ? [
    { id: "data-center", anchors: ["data-center-dialog", "data-center"], icon: Database, title: "Data Center", detail: "Im Data Center werden Datenmodus, explizite Importe, Exporte und lokale Wartung getrennt verwaltet." },
    { id: "data-modes", anchors: ["data-modes"], icon: List, title: "Datenmodi", detail: `${BROWSER_DATA_MODE_SUMMARY} ändern nur die sichtbare Auswahl. Gespeicherte Browserdaten bleiben bestehen.` },
    { id: "imports", anchors: ["imports"], icon: FolderInput, title: "Importe", detail: "Markdown, Katalog-JSON und App-Manifeste werden nur nach deiner Dateiauswahl browserlokal eingelesen." },
  ] : [
    { id: "data-center", anchors: ["data-center-dialog", "data-center"], icon: Database, title: "Data Center", detail: "Hier wechselst du zwischen privater LocalAPI und Browsermodi, öffnest Kontextampeln und exportierst deinen bereinigten Katalog." },
    { id: "data-modes", anchors: ["data-modes"], icon: List, title: "Datenquelle und Modus", detail: `LocalAPI lädt erlaubte lokale Quellen automatisch. ${BROWSER_DATA_MODE_SUMMARY} laufen getrennt im Browserprofil.` },
    { id: "local-catalog-export", anchors: ["local-catalog-export", "data-center-dialog"], icon: FolderInput, title: "Katalog exportieren", detail: "Exportiere einen bereinigten persönlichen Katalog ohne Dateipfade, Kontextdateien oder Session-Inhalte für das Browser-Profil." },
  ];
  return [...START_STEPS, ...dataSteps, ...END_STEPS];
}

export function OnboardingTour({ open, onClose, onPrepareStep, profile }: OnboardingTourProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const popoverRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<TourPosition | null>(null);
  const [step, setStep] = useState(0);
  const steps = useMemo(() => stepsFor(profile), [profile]);

  useEffect(() => {
    if (!open) return;

    setStep(0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;

    const currentStep = steps[step];
    onPrepareStep?.({ id: currentStep.id, anchors: currentStep.anchors });
    let target: HTMLElement | null = null;
    let frame = 0;
    const updatePosition = () => {
      const nextTarget = findVisibleTarget(currentStep.anchors);
      if (nextTarget !== target) {
        target?.removeAttribute("data-tour-active");
        target = nextTarget;
        if (target) {
          target.setAttribute("data-tour-active", "true");
          target.scrollIntoView?.({ behavior: "auto", block: "center", inline: "nearest" });
          focusTarget(target, headingRef.current);
        } else {
          headingRef.current?.focus();
        }
      }
      const nextPosition = createPosition(target, popoverRef.current);
      setPosition((current) => samePosition(current, nextPosition) ? current : nextPosition);
    };
    const schedulePositionUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updatePosition);
    };

    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(updatePosition);
    });
    window.addEventListener("resize", schedulePositionUpdate);
    window.addEventListener("scroll", schedulePositionUpdate, true);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedulePositionUpdate);
    const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(schedulePositionUpdate);
    if (target) observer?.observe(target);
    if (popoverRef.current) observer?.observe(popoverRef.current);
    mutationObserver?.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedulePositionUpdate);
      window.removeEventListener("scroll", schedulePositionUpdate, true);
      observer?.disconnect();
      mutationObserver?.disconnect();
      target?.removeAttribute("data-tour-active");
    };
  }, [onPrepareStep, open, step, steps]);

  if (!open) return null;

  const current = steps[step];
  const Icon = current.icon;
  const isLastStep = step === steps.length - 1;
  const popoverStyle = position ? {
    left: `${position.left}px`,
    top: `${position.top}px`,
  } satisfies CSSProperties : undefined;

  return (
    <div className="onboarding-tour" role="presentation">
      {position?.spotlight ? <div
        aria-hidden="true"
        className="onboarding-tour__spotlight"
        style={{
          height: `${position.spotlight.height}px`,
          left: `${position.spotlight.left}px`,
          top: `${position.spotlight.top}px`,
          width: `${position.spotlight.width}px`,
        }}
      /> : null}
      <section
        ref={popoverRef}
        className="onboarding-tour__popover"
        data-placement={position?.placement ?? "fallback"}
        role="dialog"
        aria-labelledby="tour-title"
        style={popoverStyle}
      >
        <header className="onboarding-tour__header">
          <div>
            <span className="onboarding-tour__kicker">QuickGraph</span>
            <h2 id="tour-title" ref={headingRef} tabIndex={-1}>Kurztour</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Tour überspringen">
            <X aria-hidden="true" />
            <span className="sr-only">Tour überspringen</span>
          </button>
        </header>
        <div className="onboarding-tour__body">
          <div
            className="onboarding-tour__progress"
            role="progressbar"
            aria-label={`Schritt ${step + 1} von ${steps.length}`}
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={step + 1}
          >
            <span style={{ transform: `scaleX(${(step + 1) / steps.length})` }} />
          </div>
          <section className="onboarding-tour__step" aria-live="polite">
            <Icon aria-hidden="true" />
            <div>
              <span>Schritt {step + 1} von {steps.length}</span>
              <h3>{current.title}</h3>
              <p>{current.detail}</p>
              {position?.placement === "fallback" ? <p className="onboarding-tour__fallback">Dieses Element ist in der aktuellen Ansicht nicht sichtbar.</p> : null}
            </div>
          </section>
          <div className="onboarding-tour__actions">
            <button className="secondary-button" type="button" onClick={onClose}>Überspringen</button>
            <button className="secondary-button" type="button" onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))} disabled={step === 0}>
              Zurück
            </button>
            <button className="primary-button" type="button" onClick={() => isLastStep ? onClose() : setStep((currentStep) => currentStep + 1)}>
              {isLastStep ? "Fertig" : "Weiter"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function findVisibleTarget(anchors: readonly string[]): HTMLElement | null {
  for (const anchor of anchors) {
    const candidate = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
    if (candidate && isVisible(candidate)) return candidate;
  }
  return null;
}

function isVisible(element: HTMLElement): boolean {
  if (element.hidden) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function focusTarget(target: HTMLElement, fallback: HTMLHeadingElement | null) {
  if (target.matches("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])")) {
    target.focus({ preventScroll: true });
    return;
  }
  fallback?.focus();
}

function createPosition(target: HTMLElement | null, popover: HTMLElement | null): TourPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const fallbackWidth = Math.min(420, Math.max(280, viewportWidth - EDGE_GAP * 2));
  const fallbackHeight = 340;
  const popoverRect = popover?.getBoundingClientRect();
  const popoverWidth = popoverRect?.width || fallbackWidth;
  const popoverHeight = popoverRect?.height || fallbackHeight;

  if (!target) {
    return {
      left: Math.max(EDGE_GAP, (viewportWidth - popoverWidth) / 2),
      top: Math.max(EDGE_GAP, (viewportHeight - popoverHeight) / 2),
      placement: "fallback",
      spotlight: null,
    };
  }

  const rect = target.getBoundingClientRect();
  const maxLeft = Math.max(EDGE_GAP, viewportWidth - popoverWidth - EDGE_GAP);
  const left = clamp(rect.left + rect.width / 2 - popoverWidth / 2, EDGE_GAP, maxLeft);
  const spaceBelow = viewportHeight - rect.bottom - EDGE_GAP;
  const spaceAbove = rect.top - EDGE_GAP;
  const placement = spaceBelow >= popoverHeight + POPOVER_GAP || spaceBelow >= spaceAbove ? "below" : "above";
  const top = placement === "below"
    ? clamp(rect.bottom + POPOVER_GAP, EDGE_GAP, Math.max(EDGE_GAP, viewportHeight - popoverHeight - EDGE_GAP))
    : clamp(rect.top - popoverHeight - POPOVER_GAP, EDGE_GAP, Math.max(EDGE_GAP, viewportHeight - popoverHeight - EDGE_GAP));

  return {
    left,
    top,
    placement,
    spotlight: {
      height: rect.height + SPOTLIGHT_GAP * 2,
      left: Math.max(0, rect.left - SPOTLIGHT_GAP),
      top: Math.max(0, rect.top - SPOTLIGHT_GAP),
      width: rect.width + SPOTLIGHT_GAP * 2,
    },
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function samePosition(current: TourPosition | null, next: TourPosition): boolean {
  return current?.left === next.left
    && current.top === next.top
    && current.placement === next.placement
    && current.spotlight?.left === next.spotlight?.left
    && current.spotlight?.top === next.spotlight?.top
    && current.spotlight?.width === next.spotlight?.width
    && current.spotlight?.height === next.spotlight?.height;
}
