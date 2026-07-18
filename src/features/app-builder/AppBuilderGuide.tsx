import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Blocks,
  Check,
  CircleAlert,
  Copy,
  GitBranch,
  LayoutDashboard,
  Link2,
  Package,
  PanelRightOpen,
  PanelTop,
  Plus,
} from "lucide-react";
import type { CatalogItem } from "../../domain";
import { PUBLIC_CATALOG_ITEMS } from "../../data/public-catalog";
import "./AppBuilderGuide.css";

const NEW_APP_PROMPT = `Verwende die Fähigkeit /app-foundation und baue eine neue App nach dem App-Fundament:
1. Kläre Ziel, Nutzerflüsse, Datenhoheit, Sicherheitsgrenze und Integrationsweg.
2. Lege PRD, Architektur und Abnahmekriterien vor dem ersten Feature fest.
3. Baue die App zuerst eigenständig als portables Modul mit typisierten Verträgen und Integrationsadapter.
4. Verwende danach für jede Funktion /app-slice. Nutze /ponytail für die kleinste vollständige Lösung. Aktiviere /caveman nicht automatisch: Er kürzt nur die Kommunikation und komprimiert keinen Kontext. Falls ausdrücklich knappe Ausgaben gewünscht sind, verwende /caveman lite nur für den betreffenden Abschnitt und beende den Modus danach mit "stop caveman".
5. Nutze /adaptive-agent-team nur für unabhängige Arbeitsströme. Vor schreibender Parallelisierung braucht die App einen sauberen Basis-Commit, einen Integrationsverantwortlichen und genau einen Integrations-Worktree auf dem projektseitig festgelegten kanonischen Integrationszweig (meist main oder master). Jede schreibende Session erhält einen eigenen codex-Branch, Worktree und disjunkten Schreibbereich.
6. Vor jedem Merge den aktuellen Integrationsstand in den Slice aufnehmen und alle Prüfungen sowie das Review erneut ausführen. Danach einen commitgebundenen Prüfbeleg erzeugen und Merges ausschließlich seriell durch den Integrationsverantwortlichen ausführen.
7. Nach dem Merge auf dem kanonischen Integrationszweig erneut prüfen und erledigte Branches sowie Worktrees aufräumen. Kein Remote-Push ohne ausdrückliche Freigabe.`;

const GUIDE_SKILL_KEYS = [
  "app-foundation",
  "app-migrate",
  "app-slice",
  "ponytail",
  "caveman",
  "adaptive-agent-team",
  "post-mortem-golden-prompt",
] as const;

type GuideSkillKey = (typeof GUIDE_SKILL_KEYS)[number];

const GUIDE_SKILL_ID_PREFIX = "guide:skill:";

export function isGuideSkillItem(item: CatalogItem): boolean {
  return item.id.startsWith(GUIDE_SKILL_ID_PREFIX);
}

const GUIDE_SKILL_TEXTS: Record<GuideSkillKey, { description: string; content: string }> = {
  "app-foundation": {
    description: "Erstellt aus einer Idee oder einem Produktkonzept eine vollständige, modulare App-Grundlage. Der Ablauf enthält drei bewusste Freigabepunkte: gemeinsame Startfragen, Architekturentscheidung und visuelle Markenfreigabe.",
    content: `# Neue App mit dem App-Fundament

## Zweck

Diese Fähigkeit erstellt eine neue App von Anfang an auf einer modularen, wartbaren und übertragbaren Grundlage. Sie verhindert, dass ein kurzlebiger Prototyp unbemerkt zur dauerhaften Produktionsarchitektur wird.

## Vorgehen

1. Ziel, Zielgruppe, Kernabläufe und Umfang klären.
2. Datenmodell, Identität, Speicherung, Schnittstellen und Sicherheitsgrenzen festlegen.
3. Gestaltung und Markenregeln freigeben.
4. Die Technikgrundlage und das eigenständig lauffähige Modulgerüst erstellen.
5. Einen sauberen Basis-Commit und einen einzigen Integrations-Worktree herstellen.
6. Die wichtigsten Funktionen mit /app-slice in getrennten Branches und Worktrees umsetzen.
7. Jede Funktion prüfen und ausschließlich über die serielle Merge-Schleuse übernehmen.

## Ergebnis

Eine eigenständig nutzbare App mit klaren Modulgrenzen, typisierten Verträgen, Prüfungen und einem festgelegten Integrationsweg.`,
  },
  "app-migrate": {
    description: "Überführt eine bestehende App schrittweise auf das App-Fundament. Funktionen, Daten und Abhängigkeiten werden zuerst vollständig erfasst und anschließend nur mit nachgewiesener Parität abgelöst.",
    content: `# Bestehende App sicher migrieren

## Zweck

Diese Fähigkeit migriert eine vorhandene App ohne riskante Komplettumstellung. Alt- und Zielversion bleiben während der Überführung parallel nutzbar.

## Vorgehen

1. Oberflächen, Funktionen, Daten, Abhängigkeiten und Schnittstellen unverändernd erfassen.
2. Eine reproduzierbare Ausgangslage und eine vollständige Paritätsmatrix erstellen.
3. Zielmodule, Datenverantwortung und Integrationsadapter festlegen.
4. Ziel-Shell und Facade als sauberen Integrationsstand sichern.
5. Je Modul einen vollständigen Durchlauf mit /app-slice im eigenen Worktree ausführen.
6. Nur Module mit getrennten Dateien, Routen, Tabellen und Datenverantwortungen parallel bearbeiten.
7. Verhalten, Daten und Nutzerabläufe gegen die Ausgangslage prüfen.
8. Module seriell mergen und erst nach bewiesener Parität umschalten.

## Harte Regel

Keine Produktivdaten verändern und keinen Altbestand entfernen, bevor der Ersatz vollständig geprüft und freigegeben ist.`,
  },
  "app-slice": {
    description: "Setzt genau eine fachlich vollständige Änderung in einer App um. Planung, eigener Git-Arbeitsbaum, Bau, Prüfungen, unabhängige Gegenprüfung und Dokumentation gehören zu einem gemeinsamen Durchlauf.",
    content: `# Eine vollständige Änderung umsetzen

## Zweck

Diese Fähigkeit baut genau einen klar abgegrenzten Funktionsabschnitt. Sie verhindert parallele Wahrheiten, unkontrollierte Nebenumfänge und ungeprüfte Änderungen am Hauptzweig.

## Ablauf

1. Projektregeln, zentrale Dokumentation und Datenmodell lesen.
2. Ziel, Annahmen, Nicht-Ziele und Abnahmekriterien festlegen.
3. Die Änderung in einem registrierten Branch und eigenen Git-Arbeitsbaum umsetzen.
4. Typprüfung, automatische Prüfungen und durchgängige Nutzerprüfung ausführen.
5. Die Änderung unabhängig gegenprüfen und gefundene Ursachenfamilien vollständig beheben.
6. Den aktuellen Hauptstand integrieren und die Prüfungen commitgebunden bestätigen.
7. Ausschließlich über den Integrationsverantwortlichen seriell mergen und danach aufräumen.`,
  },
  ponytail: {
    description: "Reduziert eine Idee auf die kleinste fachlich vollständige und tatsächlich nutzbare Lösung. Überflüssige Abstraktionen, Optionen und Abhängigkeiten werden vor dem Bau entfernt.",
    content: `# Kleinste vollständige Lösung

## Zweck

Ponytail schneidet einen zu großen Plan auf den kleinsten Umfang zurück, der für den Nutzer bereits einen vollständigen Wert liefert.

## Prüffragen

- Welche Funktion ist für das Ziel wirklich unverzichtbar?
- Welche Abhängigkeit kann entfallen?
- Welche Entscheidung kann später getroffen werden?
- Welche Abstraktion löst noch kein aktuelles Problem?
- Wie lässt sich das Ergebnis als ein prüfbarer Teilabschnitt liefern?

Das Ergebnis ist kleiner, aber nicht unvollständig.`,
  },
  caveman: {
    description: "Schaltet einen knappen Kommunikationsstil ein, bis er ausdrücklich beendet wird.",
    content: `# Kommunikation bewusst kürzen

## Zweck

Caveman kürzt Antworten und Ausgaben, ohne technische Genauigkeit zu verlieren. Die Fähigkeit fasst keinen Projektkontext zusammen und ersetzt keine Dokumentation.

## Einsatz

- Nicht automatisch aktivieren.
- Für eine mildere Kürzung gezielt mit /caveman lite einschalten.
- Nach dem betreffenden Abschnitt mit "stop caveman" wieder beenden.
- Bei Sicherheitswarnungen und mehrstufigen Anweisungen Klarheit vor Kürze stellen.

Caveman bleibt aktiv, bis der Modus ausdrücklich beendet wird. Er verkürzt nur die Kommunikation und komprimiert weder Dateien noch Gesprächskontext.`,
  },
  "adaptive-agent-team": {
    description: "Teilt mehrere unabhängige Arbeitsströme gezielt auf geeignete Agenten auf. Der Hauptagent behält Architektur, kritischen Pfad, Zusammenführung und abschließende Prüfung.",
    content: `# Adaptives Agententeam

## Zweck

Diese Fähigkeit beschleunigt Aufgaben, wenn mindestens zwei Arbeitsströme wirklich unabhängig voneinander bearbeitet werden können.

## Regeln

1. Nur klar abgegrenzte Ergebnisse delegieren.
2. So wenige Agenten wie nötig einsetzen.
3. Schreibbereiche und Verantwortungen eindeutig trennen.
4. Für schreibende Agenten getrennte Branches und Worktrees verwenden.
5. Kritische Architektur-, Daten- und Integrationsentscheidungen beim Hauptagenten behalten.
6. Nur der Hauptagent merged seriell in den sauberen Integrations-Worktree.
7. Ergebnisse nicht blind übernehmen, sondern nach dem Merge abschließend prüfen.

Wenn die Koordinationskosten höher als der Zeitgewinn sind, wird ohne Agententeam gearbeitet.`,
  },
  "post-mortem-golden-prompt": {
    description: "Leitet nach Abschluss einer App oder Migration rückblickend den bestmöglichen wiederverwendbaren Arbeitsauftrag ab. Erfasst Entscheidungen, Abhängigkeiten, Fehlerquellen und bewährte Prüfungen.",
    content: `# Rückschau und idealer Arbeitsauftrag

## Zweck

Diese Fähigkeit untersucht nach Abschluss, welcher Arbeitsauftrag die entstandene App mit dem heutigen Wissen von Anfang an zuverlässiger erzeugt hätte.

## Inhalt

- Tatsächliches Ziel und vollständiger Funktionsumfang.
- Richtige Technikgrundlage und Modulgrenzen.
- Benötigte Daten, Abhängigkeiten und Integrationen.
- Fehlversuche und ihre Ursachen.
- Verbindliche Abnahmekriterien und Prüfungen.
- Sinnvolle Reihenfolge der Teilabschnitte.
- Wiederverwendbare Regeln für zukünftige Apps.

Das Ergebnis ist ein präziser deutscher Arbeitsauftrag, keine bloße Zusammenfassung des Projektverlaufs.`,
  },
};

interface AppBuilderGuideProps {
  items: readonly CatalogItem[];
  onOpenSkill: (item: CatalogItem) => void | Promise<void>;
  focus?: AppBuilderWorkflowId | null;
  onWorkflowChange?: (workflow: AppBuilderWorkflowId) => void;
}

export type AppBuilderWorkflowId = "clone-site" | "classic-site" | "app-dashboard" | "wordpress-plugin";

export const APP_BUILDER_WORKFLOWS: ReadonlyArray<{
  id: AppBuilderWorkflowId;
  title: string;
  description: string;
  icon: typeof Copy;
  steps: readonly string[];
  startSkill: GuideSkillKey;
}> = [
  {
    id: "clone-site",
    title: "Website klonen",
    description: "Eine Referenzseite strukturiert nachbauen und visuell auf Parität prüfen.",
    icon: Copy,
    steps: ["Referenz-URL und Zielseite festlegen", "Struktur und visuellen Ausgangspunkt erfassen", "Seite komponentenbasiert nachbauen", "Parität und Darstellung visuell prüfen"],
    startSkill: "app-foundation",
  },
  {
    id: "classic-site",
    title: "Klassische Website",
    description: "Eine klare Marketing- oder Inhaltsseite vom Angebot bis zur visuellen QA umsetzen.",
    icon: PanelTop,
    steps: ["Angebot, Zielgruppe und Inhalte klären", "Informationsarchitektur und Seitenstruktur festlegen", "Seiten und Komponenten umsetzen", "Responsive Darstellung und visuelle QA prüfen"],
    startSkill: "app-foundation",
  },
  {
    id: "app-dashboard",
    title: "App / Dashboard",
    description: "Eine Arbeitsoberfläche neu aufbauen oder einen bestehenden Funktionsbestand kontrolliert migrieren.",
    icon: LayoutDashboard,
    steps: [],
    startSkill: "app-foundation",
  },
  {
    id: "wordpress-plugin",
    title: "WordPress-Plugin",
    description: "Ein abgegrenztes PHP-Plugin für eine vorhandene WordPress-Installation liefern.",
    icon: Package,
    steps: ["Zweck und Installationskontext definieren", "Hooks und Datenvertrag festlegen", "Fokussiertes PHP-Plugin umsetzen", "Auf Staging installieren und verifizieren"],
    startSkill: "app-foundation",
  },
];

interface CopyFeedback {
  message: string;
  tone: "success" | "error";
  prompt: string;
}

export function normalizeMigrationUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function buildMigrationPrompt(sourceUrl: string): string {
  return `Verwende die Fähigkeit /app-migrate und migriere die bestehende App unter ${sourceUrl} nach dem App-Fundament:
1. Arbeite zuerst nur lesend: erfasse Ansichten, Funktionen, Daten, Abhängigkeiten und Integrationen.
2. Erstelle einen reproduzierbaren Ausgangsstand, eine Paritätsmatrix und eine Zielzuordnung. Nichts darf stillschweigend entfallen.
3. Definiere die Ziel-App zuerst eigenständig als portables Modul mit typisierten Verträgen und Integrationsadapter.
4. Verwende pro Modul /app-slice. Nutze /ponytail für die kleinste vollständige Lösung. Aktiviere /caveman nicht automatisch: Er kürzt nur die Kommunikation und komprimiert keinen Kontext. Falls ausdrücklich knappe Ausgaben gewünscht sind, verwende /caveman lite nur für den betreffenden Abschnitt und beende den Modus danach mit "stop caveman".
5. Nutze /adaptive-agent-team nur für unabhängige Arbeitsströme. Vor schreibender Parallelisierung braucht die Ziel-App einen sauberen Basis-Commit, einen Integrationsverantwortlichen und genau einen Integrations-Worktree auf dem projektseitig festgelegten kanonischen Integrationszweig (meist main oder master). Jede schreibende Session erhält einen eigenen codex-Branch, Worktree und disjunkten Schreibbereich.
6. Wiederhole pro Teilabschnitt: bauen, prüfen, gegen die Ausgangslage vergleichen, unabhängig gegenprüfen und korrigieren. Vor jedem Merge den aktuellen Integrationsstand aufnehmen und alle Prüfungen erneut ausführen.
7. Erzeuge danach einen commitgebundenen Prüfbeleg. Nur der Integrationsverantwortliche darf die Module seriell mergen; anschließend auf dem kanonischen Integrationszweig erneut prüfen und erledigte Branches sowie Worktrees aufräumen.
8. Eine Umschaltung ist erst erlaubt, wenn die Paritätsmatrix vollständig und alle Qualitätsprüfungen grün sind. Keine Veränderung der Produktiv-App und kein Remote-Push ohne ausdrückliche Freigabe.
9. Nutze nach dem Abschluss /post-mortem-golden-prompt, um die Erkenntnisse für den nächsten App-Bau festzuhalten.`;
}

export function buildCloneWebsitePrompt(referenceUrl: string, targetUrl: string): string {
  return `Verwende /app-foundation und baue die Website unter ${referenceUrl} als überprüfbaren Ausgangspunkt für die Zielseite ${targetUrl} nach.
1. Analysiere die Referenz zuerst nur lesend: Seitenstruktur, Navigation, Inhalte, Komponenten, Typografie, Farben, Abstände, responsive Zustände und Interaktionen.
2. Dokumentiere, welche Elemente übernommen, angepasst oder bewusst nicht übernommen werden. Kopiere keine geschützten Inhalte oder Markenbestandteile ohne Freigabe.
3. Lege Zielgruppe, Ziel der Zielseite, Technikgrundlage und Abnahmekriterien fest.
4. Baue die Zielseite komponentenbasiert und responsiv. Verwende /app-slice für jeden vollständigen Teilabschnitt.
5. Vergleiche Desktop und Mobil visuell mit der Referenz und dokumentiere Abweichungen. Prüfe Links, Formulare, Barrierefreiheit und Performance.
6. Veröffentliche oder verändere keine bestehende Website ohne ausdrückliche Freigabe.

Referenz: ${referenceUrl}
Zielseite: ${targetUrl}`;
}

export function buildClassicWebsitePrompt(goal: string, audience: string, targetUrl: string | null): string {
  const target = targetUrl ? `\nGeplante Zieladresse: ${targetUrl}` : "";
  return `Verwende /app-foundation und erstelle eine klassische Website.

Ziel: ${goal}
Zielgruppe: ${audience}${target}

1. Kläre Angebot, wichtigste Nutzeraktion, Seitenumfang und benötigte Inhalte.
2. Erstelle Informationsarchitektur, Navigation und Seitenstruktur vor der visuellen Umsetzung.
3. Formuliere klare Inhaltsanforderungen und kennzeichne fehlende Inhalte statt Platzhalter als Fakten auszugeben.
4. Baue die Website komponentenbasiert, responsiv und barrierearm. Verwende /app-slice für vollständige Teilabschnitte.
5. Prüfe Desktop und Mobil, Navigation, Formulare, Links, Performance und visuelle Konsistenz.
6. Veröffentliche nichts ohne ausdrückliche Freigabe.`;
}

export function buildWordPressPluginPrompt(purpose: string, siteUrl: string | null, requirements: string): string {
  const site = siteUrl ? `\nZielinstallation: ${siteUrl}` : "";
  const details = requirements.trim() ? `\nZusätzliche Anforderungen: ${requirements.trim()}` : "";
  return `Verwende /app-foundation und entwickle ein fokussiertes WordPress-Plugin.

Zweck: ${purpose}${site}${details}

1. Kläre Nutzerrolle, WordPress-Version, vorhandene Plugins, Datenverantwortung und Sicherheitsgrenzen.
2. Definiere Hooks, Einstellungen, Berechtigungen, Datenmodell und Deinstallationsverhalten vor der Umsetzung.
3. Baue nur den notwendigen Plugin-Umfang mit WordPress-APIs, Nonces, Capability-Prüfungen und sauberem Escaping.
4. Verwende /app-slice für jede vollständige Funktion und prüfe Aktivierung, Deaktivierung und Fehlerfälle.
5. Installiere zuerst auf Staging und dokumentiere die Verifikation. Keine Produktivinstallation ohne ausdrückliche Freigabe.`;
}

export function AppBuilderGuide({ items, onOpenSkill, focus = null, onWorkflowChange }: AppBuilderGuideProps) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<AppBuilderWorkflowId | null>(focus);
  const [migrationUrl, setMigrationUrl] = useState("");
  const [cloneReferenceUrl, setCloneReferenceUrl] = useState("");
  const [cloneTargetUrl, setCloneTargetUrl] = useState("");
  const [classicGoal, setClassicGoal] = useState("");
  const [classicAudience, setClassicAudience] = useState("");
  const [classicTargetUrl, setClassicTargetUrl] = useState("");
  const [pluginPurpose, setPluginPurpose] = useState("");
  const [pluginSiteUrl, setPluginSiteUrl] = useState("");
  const [pluginRequirements, setPluginRequirements] = useState("");
  const [newAppCopyFeedback, setNewAppCopyFeedback] = useState<CopyFeedback | null>(null);
  const [migrationCopyFeedback, setMigrationCopyFeedback] = useState<CopyFeedback | null>(null);
  const [cloneCopyFeedback, setCloneCopyFeedback] = useState<CopyFeedback | null>(null);
  const [classicCopyFeedback, setClassicCopyFeedback] = useState<CopyFeedback | null>(null);
  const [pluginCopyFeedback, setPluginCopyFeedback] = useState<CopyFeedback | null>(null);
  const migrationCopyGeneration = useRef(0);
  const normalizedUrl = normalizeMigrationUrl(migrationUrl);
  const invalidUrl = migrationUrl.trim().length > 0 && normalizedUrl === null;
  const selectedWorkflow = APP_BUILDER_WORKFLOWS.find((workflow) => workflow.id === selectedWorkflowId) ?? null;
  const skills = useMemo(() => new Map(
    [...PUBLIC_CATALOG_ITEMS, ...items]
      .filter((item) => item.kind === "skill" && GUIDE_SKILL_KEYS.includes(item.key as GuideSkillKey))
      .map((item) => {
        const key = item.key as GuideSkillKey;
        const text = GUIDE_SKILL_TEXTS[key];
        return [key, {
          ...item,
          id: `${GUIDE_SKILL_ID_PREFIX}${key}`,
          group: "Fähigkeiten",
          category: "Arbeitsablauf & Entwicklung",
          origin: "Öffentlicher QuickGraph-Katalog",
          source: "public-catalog",
          owned: false,
          revision: undefined,
          invoke: `/${key}`,
          description: text.description,
          content: text.content,
        } satisfies CatalogItem] as const;
      }),
  ), [items]);

  useEffect(() => {
    setSelectedWorkflowId(focus);
  }, [focus]);

  const selectWorkflow = (workflow: AppBuilderWorkflowId) => {
    setSelectedWorkflowId(workflow);
    onWorkflowChange?.(workflow);
  };

  const copyPrompt = (prompt: string, successMessage: string, showFeedback: (feedback: CopyFeedback) => void) => {
    let write: Promise<void>;
    try {
      write = Promise.resolve(navigator.clipboard.writeText(prompt));
    } catch {
      write = Promise.reject(new Error("Zwischenablage nicht verfügbar"));
    }
    return write.then(
      () => showFeedback({ message: successMessage, tone: "success", prompt }),
      () => showFeedback({ message: "Kopieren ist in diesem Browser nicht verfügbar.", tone: "error", prompt }),
    );
  };

  return <section className="app-builder" aria-labelledby="app-builder-title">
    <header className="catalog-heading app-builder-heading">
      <div>
        <p>Workflow</p>
        <h1 id="app-builder-title">Apps bauen &amp; migrieren</h1>
        <span className="app-builder-subtitle">Wähle den passenden Startpunkt für einen klaren, prüfbaren Ablauf.</span>
      </div>
      <div className="app-builder-principle"><Blocks aria-hidden="true" /><span><strong>Zuerst eigenständig</strong><small>Einfach integrierbar</small></span></div>
    </header>

    <section className="app-builder-workflows" aria-labelledby="app-builder-workflows-title">
      <div className="section-label app-builder-section-label">
        <h2 id="app-builder-workflows-title">Vorhaben wählen</h2>
        <span>Ein Vorhaben zeigt seinen Ablauf direkt darunter.</span>
      </div>
      <div className="app-builder-workflow-grid" role="group" aria-label="Vorhaben auswählen">
        {APP_BUILDER_WORKFLOWS.map((workflow) => {
          const WorkflowIcon = workflow.icon;
          const selected = selectedWorkflowId === workflow.id;
          const detailsId = `app-builder-workflow-details-${workflow.id}`;
          return <article className={`app-builder-workflow-card${selected ? " active" : ""}`} key={workflow.id}>
            <button
              className="app-builder-workflow-select"
              type="button"
              id={`app-builder-workflow-${workflow.id}`}
              aria-pressed={selected}
              aria-expanded={selected}
              aria-controls={detailsId}
              onClick={() => selectWorkflow(workflow.id)}
            >
              <span className="app-builder-workflow-icon"><WorkflowIcon aria-hidden="true" /></span>
              <span><strong>{workflow.title}</strong><small>{workflow.description}</small></span>
            </button>
            <button
              className="app-builder-workflow-open"
              type="button"
              disabled={!skills.get(workflow.startSkill)}
              aria-label={`Empfohlenen Start /${workflow.startSkill} in der rechten Detailansicht öffnen`}
              onClick={() => {
                const skill = skills.get(workflow.startSkill);
                if (skill) void onOpenSkill(skill);
              }}
            >
              <PanelRightOpen aria-hidden="true" />
              <span>Empfohlener Start <code>/{workflow.startSkill}</code></span>
            </button>
          </article>;
        })}
      </div>
    </section>

    {selectedWorkflow ? <section
      className="app-builder-workflow-detail"
      id={`app-builder-workflow-details-${selectedWorkflow.id}`}
      aria-labelledby="app-builder-selected-workflow-title"
      aria-live="polite"
    >
      <div className="section-label app-builder-section-label">
        <h2 id="app-builder-selected-workflow-title">{selectedWorkflow.title}</h2>
        <span>{selectedWorkflow.description}</span>
      </div>
      <WorkflowDiagram workflow={selectedWorkflow} />
      {selectedWorkflow.id === "clone-site" ? <WebsiteCloneDetails
        skills={skills}
        onOpenSkill={onOpenSkill}
        referenceUrl={cloneReferenceUrl}
        targetUrl={cloneTargetUrl}
        feedback={cloneCopyFeedback}
        onReferenceUrlChange={(value) => { setCloneReferenceUrl(value); setCloneCopyFeedback(null); }}
        onTargetUrlChange={(value) => { setCloneTargetUrl(value); setCloneCopyFeedback(null); }}
        onCopy={() => {
          const reference = normalizeMigrationUrl(cloneReferenceUrl);
          const target = normalizeMigrationUrl(cloneTargetUrl);
          if (!reference || !target) return;
          void copyPrompt(buildCloneWebsitePrompt(reference, target), "Website-Auftrag kopiert.", setCloneCopyFeedback);
        }}
      /> : selectedWorkflow.id === "classic-site" ? <ClassicWebsiteDetails
        skills={skills}
        onOpenSkill={onOpenSkill}
        goal={classicGoal}
        audience={classicAudience}
        targetUrl={classicTargetUrl}
        feedback={classicCopyFeedback}
        onGoalChange={(value) => { setClassicGoal(value); setClassicCopyFeedback(null); }}
        onAudienceChange={(value) => { setClassicAudience(value); setClassicCopyFeedback(null); }}
        onTargetUrlChange={(value) => { setClassicTargetUrl(value); setClassicCopyFeedback(null); }}
        onCopy={() => {
          if (!classicGoal.trim() || !classicAudience.trim()) return;
          const target = classicTargetUrl.trim() ? normalizeMigrationUrl(classicTargetUrl) : null;
          if (classicTargetUrl.trim() && !target) return;
          void copyPrompt(buildClassicWebsitePrompt(classicGoal.trim(), classicAudience.trim(), target), "Website-Auftrag kopiert.", setClassicCopyFeedback);
        }}
      /> : selectedWorkflow.id === "app-dashboard" ? <AppDashboardDetails
        skills={skills}
        onOpenSkill={onOpenSkill}
        migrationUrl={migrationUrl}
        invalidUrl={invalidUrl}
        normalizedUrl={normalizedUrl}
        newAppCopyFeedback={newAppCopyFeedback}
        migrationCopyFeedback={migrationCopyFeedback}
        onMigrationUrlChange={(value) => {
          setMigrationUrl(value);
          migrationCopyGeneration.current += 1;
          setMigrationCopyFeedback(null);
        }}
        onCopyNewApp={() => void copyPrompt(NEW_APP_PROMPT, "Neubau-Auftrag kopiert.", setNewAppCopyFeedback)}
        onCopyMigration={() => {
          if (!normalizedUrl) return;
          const generation = ++migrationCopyGeneration.current;
          void copyPrompt(buildMigrationPrompt(normalizedUrl), "Migrationsauftrag kopiert.", (feedback) => {
            if (generation === migrationCopyGeneration.current) setMigrationCopyFeedback(feedback);
          });
        }}
      /> : <WordPressPluginDetails
        skills={skills}
        onOpenSkill={onOpenSkill}
        purpose={pluginPurpose}
        siteUrl={pluginSiteUrl}
        requirements={pluginRequirements}
        feedback={pluginCopyFeedback}
        onPurposeChange={(value) => { setPluginPurpose(value); setPluginCopyFeedback(null); }}
        onSiteUrlChange={(value) => { setPluginSiteUrl(value); setPluginCopyFeedback(null); }}
        onRequirementsChange={(value) => { setPluginRequirements(value); setPluginCopyFeedback(null); }}
        onCopy={() => {
          if (!pluginPurpose.trim()) return;
          const site = pluginSiteUrl.trim() ? normalizeMigrationUrl(pluginSiteUrl) : null;
          if (pluginSiteUrl.trim() && !site) return;
          void copyPrompt(buildWordPressPluginPrompt(pluginPurpose.trim(), site, pluginRequirements), "Plugin-Auftrag kopiert.", setPluginCopyFeedback);
        }}
      />}
    </section> : null}
  </section>;
}

function WorkflowDiagram({ workflow }: { workflow: (typeof APP_BUILDER_WORKFLOWS)[number] }) {
  const steps = workflow.id === "app-dashboard"
    ? ["Neubau oder Migration wählen", "Daten- und Funktionsvertrag festlegen", "In vollständigen Slices bauen", "End-to-End prüfen"]
    : workflow.steps;
  return <div className="app-builder-diagram" aria-label={`Ablauf für ${workflow.title}`}>
    <ol>
      {steps.map((step, index) => <li key={step}>
        <span className="app-builder-diagram-node"><small>0{index + 1}</small><strong>{step}</strong></span>
        {index < steps.length - 1 ? <ArrowRight aria-hidden="true" /> : null}
      </li>)}
    </ol>
  </div>;
}

function WorkflowSteps({ steps }: { steps: readonly string[] }) {
  return <ol className="app-builder-detail-steps">
    {steps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}
  </ol>;
}

function AppDashboardDetails({
  skills,
  onOpenSkill,
  migrationUrl,
  invalidUrl,
  normalizedUrl,
  newAppCopyFeedback,
  migrationCopyFeedback,
  onMigrationUrlChange,
  onCopyNewApp,
  onCopyMigration,
}: {
  skills: ReadonlyMap<GuideSkillKey, CatalogItem>;
  onOpenSkill: AppBuilderGuideProps["onOpenSkill"];
  migrationUrl: string;
  invalidUrl: boolean;
  normalizedUrl: string | null;
  newAppCopyFeedback: CopyFeedback | null;
  migrationCopyFeedback: CopyFeedback | null;
  onMigrationUrlChange: (value: string) => void;
  onCopyNewApp: () => void;
  onCopyMigration: () => void;
}) {
  return <div className="app-builder-app-branches">
    <article className="app-builder-path">
      <header><span className="app-builder-path-icon"><Plus aria-hidden="true" /></span><div><small>NEUBAU</small><h3>Neue App von Grund auf</h3></div></header>
      <p>Für eine neue Arbeitsoberfläche mit klaren Nutzerflüssen, Datenverantwortung und typisierten Verträgen.</p>
      <WorkflowSteps steps={["Ziel, Nutzerfluss und Datenhoheit klären", "Architektur und Modulgrenzen festlegen", "In vollständigen, prüfbaren Teilabschnitten umsetzen", "End-to-End und visuell prüfen"]} />
      <div className="app-builder-start-skill"><span>Start-Fähigkeit</span><SkillButton skillKey="app-foundation" skills={skills} onOpenSkill={onOpenSkill} /></div>
      <button className="secondary-button app-builder-copy" type="button" aria-expanded={Boolean(newAppCopyFeedback)} aria-controls="new-app-prompt-preview" onClick={onCopyNewApp}>
        <Copy aria-hidden="true" /> Auftrag mit /app-foundation kopieren
      </button>
      <PromptCopyResult id="new-app-prompt-preview" feedback={newAppCopyFeedback} label="Neubau-Auftrag" />
    </article>

    <article className="app-builder-path app-builder-migration">
      <header><span className="app-builder-path-icon"><GitBranch aria-hidden="true" /></span><div><small>MIGRATION</small><h3>Bestehende App migrieren</h3></div></header>
      <p>Eine gewachsene HTML-Monolith-App in einen sauberen, typisierten Produktions-Stack überführen und dabei Verhalten, Daten und Nutzerabläufe erhalten.</p>
      <WorkflowSteps steps={["Ausgangsstand und Paritätsmatrix erfassen", "Zielmodule und Datenvertrag definieren", "Schrittweise mit nachgewiesener Verhaltensparität ablösen", "Umschaltung erst nach Staging- und Qualitätsprüfung"]} />
      <label className="app-builder-url" htmlFor="migration-app-url">
        <span>Link zur bestehenden App</span>
        <span className={invalidUrl ? "app-builder-url-field invalid" : "app-builder-url-field"}>
          <Link2 aria-hidden="true" />
          <input id="migration-app-url" type="url" inputMode="url" placeholder="https://app.example.com/" value={migrationUrl} aria-invalid={invalidUrl} aria-describedby="migration-url-help" onChange={(event) => onMigrationUrlChange(event.target.value)} />
        </span>
      </label>
      <p className={invalidUrl ? "app-builder-field-help invalid" : "app-builder-field-help"} id="migration-url-help">
        {invalidUrl ? "Bitte eine vollständige http(s)-URL eingeben." : "Die URL wird nicht automatisch geöffnet oder gescannt."}
      </p>
      <div className="app-builder-start-skill"><span>Start-Fähigkeit</span><SkillButton skillKey="app-migrate" skills={skills} onOpenSkill={onOpenSkill} /></div>
      <button className="secondary-button app-builder-copy" type="button" disabled={!normalizedUrl} aria-expanded={Boolean(migrationCopyFeedback)} aria-controls="migration-prompt-preview" onClick={onCopyMigration}>
        <Copy aria-hidden="true" /> Auftrag mit /app-migrate kopieren
      </button>
      <PromptCopyResult id="migration-prompt-preview" feedback={migrationCopyFeedback} label="Migrationsauftrag" />
    </article>
  </div>;
}

function WebsiteCloneDetails({
  skills,
  onOpenSkill,
  referenceUrl,
  targetUrl,
  feedback,
  onReferenceUrlChange,
  onTargetUrlChange,
  onCopy,
}: {
  skills: ReadonlyMap<GuideSkillKey, CatalogItem>;
  onOpenSkill: AppBuilderGuideProps["onOpenSkill"];
  referenceUrl: string;
  targetUrl: string;
  feedback: CopyFeedback | null;
  onReferenceUrlChange: (value: string) => void;
  onTargetUrlChange: (value: string) => void;
  onCopy: () => void;
}) {
  const invalidReference = referenceUrl.trim().length > 0 && normalizeMigrationUrl(referenceUrl) === null;
  const invalidTarget = targetUrl.trim().length > 0 && normalizeMigrationUrl(targetUrl) === null;
  const canCopy = Boolean(normalizeMigrationUrl(referenceUrl)) && Boolean(normalizeMigrationUrl(targetUrl));
  return <div className="app-builder-path">
    <p>Eine Referenzseite strukturiert nachbauen. QuickGraph erzeugt daraus einen prüfbaren Klon-Auftrag; die URLs werden nicht automatisch geöffnet oder gescannt.</p>
    <GuideUrlField id="clone-reference-url" label="Referenz-URL" placeholder="https://referenz.example" value={referenceUrl} invalid={invalidReference} help={invalidReference ? "Bitte eine vollständige http(s)-URL eingeben." : "Struktur und Erscheinungsbild dienen nur als Vorlage."} onChange={onReferenceUrlChange} />
    <GuideUrlField id="clone-target-url" label="Ziel-URL" placeholder="https://ziel.example" value={targetUrl} invalid={invalidTarget} help={invalidTarget ? "Bitte eine vollständige http(s)-URL eingeben." : "Die Zielseite wird sauber neu aufgebaut, kein Quellcode kopiert."} onChange={onTargetUrlChange} />
    <div className="app-builder-start-skill"><span>Start-Fähigkeit</span><SkillButton skillKey="app-foundation" skills={skills} onOpenSkill={onOpenSkill} /></div>
    <button className="secondary-button app-builder-copy" type="button" disabled={!canCopy} aria-expanded={Boolean(feedback)} aria-controls="clone-prompt-preview" onClick={onCopy}>
      <Copy aria-hidden="true" /> Auftrag mit /app-foundation kopieren
    </button>
    <PromptCopyResult id="clone-prompt-preview" feedback={feedback} label="Website-Auftrag" />
  </div>;
}

function ClassicWebsiteDetails({
  skills,
  onOpenSkill,
  goal,
  audience,
  targetUrl,
  feedback,
  onGoalChange,
  onAudienceChange,
  onTargetUrlChange,
  onCopy,
}: {
  skills: ReadonlyMap<GuideSkillKey, CatalogItem>;
  onOpenSkill: AppBuilderGuideProps["onOpenSkill"];
  goal: string;
  audience: string;
  targetUrl: string;
  feedback: CopyFeedback | null;
  onGoalChange: (value: string) => void;
  onAudienceChange: (value: string) => void;
  onTargetUrlChange: (value: string) => void;
  onCopy: () => void;
}) {
  const invalidTarget = targetUrl.trim().length > 0 && normalizeMigrationUrl(targetUrl) === null;
  const canCopy = goal.trim().length > 0 && audience.trim().length > 0 && !invalidTarget;
  return <div className="app-builder-path">
    <p>Eine klare Marketing- oder Inhaltsseite vom Angebot bis zur visuellen QA. Zuerst Ziel und Zielgruppe klären, danach entsteht ein umsetzbarer Website-Auftrag.</p>
    <GuideTextField id="classic-goal" label="Ziel der Website" placeholder="Zum Beispiel: qualifizierte Anfragen gewinnen" value={goal} onChange={onGoalChange} />
    <GuideTextField id="classic-audience" label="Zielgruppe" placeholder="Für wen ist die Website?" value={audience} onChange={onAudienceChange} />
    <GuideUrlField id="classic-target-url" label="Zieladresse" placeholder="https://ziel.example" value={targetUrl} invalid={invalidTarget} optional help={invalidTarget ? "Bitte eine vollständige http(s)-URL eingeben." : "Optional. Domain oder Projektname der geplanten Seite."} onChange={onTargetUrlChange} />
    <div className="app-builder-start-skill"><span>Start-Fähigkeit</span><SkillButton skillKey="app-foundation" skills={skills} onOpenSkill={onOpenSkill} /></div>
    <button className="secondary-button app-builder-copy" type="button" disabled={!canCopy} aria-expanded={Boolean(feedback)} aria-controls="classic-prompt-preview" onClick={onCopy}>
      <Copy aria-hidden="true" /> Auftrag mit /app-foundation kopieren
    </button>
    <PromptCopyResult id="classic-prompt-preview" feedback={feedback} label="Website-Auftrag" />
  </div>;
}

function WordPressPluginDetails({
  skills,
  onOpenSkill,
  purpose,
  siteUrl,
  requirements,
  feedback,
  onPurposeChange,
  onSiteUrlChange,
  onRequirementsChange,
  onCopy,
}: {
  skills: ReadonlyMap<GuideSkillKey, CatalogItem>;
  onOpenSkill: AppBuilderGuideProps["onOpenSkill"];
  purpose: string;
  siteUrl: string;
  requirements: string;
  feedback: CopyFeedback | null;
  onPurposeChange: (value: string) => void;
  onSiteUrlChange: (value: string) => void;
  onRequirementsChange: (value: string) => void;
  onCopy: () => void;
}) {
  const invalidSite = siteUrl.trim().length > 0 && normalizeMigrationUrl(siteUrl) === null;
  const canCopy = purpose.trim().length > 0 && !invalidSite;
  return <div className="app-builder-path">
    <p>Ein abgegrenztes PHP-Plugin für eine vorhandene WordPress-Installation. Zweck, Zielinstallation und Anforderungen festlegen, danach entsteht der technische Auftrag.</p>
    <GuideTextField id="plugin-purpose" label="Plugin-Zweck" placeholder="Welche konkrete Funktion soll das Plugin erfüllen?" value={purpose} onChange={onPurposeChange} multiline />
    <GuideUrlField id="plugin-site-url" label="Zielinstallation" placeholder="https://staging.example" value={siteUrl} invalid={invalidSite} optional help={invalidSite ? "Bitte eine vollständige http(s)-URL eingeben." : "Optional. Staging- oder Zielumgebung des Plugins."} onChange={onSiteUrlChange} />
    <GuideTextField id="plugin-requirements" label="Anforderungen" placeholder="Hooks, Admin-UI, REST, Sicherheit, Kompatibilität" value={requirements} onChange={onRequirementsChange} multiline optional />
    <div className="app-builder-start-skill"><span>Start-Fähigkeit</span><SkillButton skillKey="app-foundation" skills={skills} onOpenSkill={onOpenSkill} /></div>
    <button className="secondary-button app-builder-copy" type="button" disabled={!canCopy} aria-expanded={Boolean(feedback)} aria-controls="plugin-prompt-preview" onClick={onCopy}>
      <Copy aria-hidden="true" /> Auftrag mit /app-foundation kopieren
    </button>
    <PromptCopyResult id="plugin-prompt-preview" feedback={feedback} label="Plugin-Auftrag" />
  </div>;
}

function GuideTextField({ id, label, placeholder, value, onChange, multiline = false, optional = false }: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  optional?: boolean;
}) {
  return <label className="app-builder-field" htmlFor={id}>
    <span>{label}{optional ? <em> optional</em> : null}</span>
    {multiline
      ? <textarea id={id} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
      : <input id={id} type="text" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />}
  </label>;
}

function GuideUrlField({ id, label, placeholder, value, invalid, help, onChange, optional = false }: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  invalid: boolean;
  help: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return <>
    <label className="app-builder-url" htmlFor={id}>
      <span>{label}{optional ? <em> optional</em> : null}</span>
      <span className={invalid ? "app-builder-url-field invalid" : "app-builder-url-field"}>
        <Link2 aria-hidden="true" />
        <input id={id} type="url" inputMode="url" placeholder={placeholder} value={value} aria-invalid={invalid} aria-describedby={`${id}-help`} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
    <p className={invalid ? "app-builder-field-help invalid" : "app-builder-field-help"} id={`${id}-help`}>{help}</p>
  </>;
}

function PromptCopyResult({ id, feedback, label }: { id: string; feedback: CopyFeedback | null; label: string }) {
  if (!feedback) return null;
  return <section className="app-builder-copy-result" id={id} aria-label={`${label}: vollständiger Text`}>
    <p className={`app-builder-copy-status ${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>
      {feedback.tone === "error" ? <CircleAlert aria-hidden="true" /> : <Check aria-hidden="true" />}{feedback.message}
    </p>
    <div className="app-builder-prompt-preview"><strong>Vollständiger Auftrag</strong><pre>{feedback.prompt}</pre></div>
  </section>;
}

function SkillButton({ skillKey, skills, onOpenSkill }: {
  skillKey: GuideSkillKey;
  skills: ReadonlyMap<GuideSkillKey, CatalogItem>;
  onOpenSkill: AppBuilderGuideProps["onOpenSkill"];
}) {
  const skill = skills.get(skillKey);
  return <button
    className="app-builder-skill-button"
    type="button"
    data-skill-key={skillKey}
    disabled={!skill}
    title={skill ? `/${skillKey} in der rechten Detailansicht öffnen` : `/${skillKey} ist im aktiven Katalogprofil nicht verfügbar`}
    aria-label={skill ? `Fähigkeit /${skillKey} in der rechten Detailansicht öffnen` : `Fähigkeit /${skillKey} ist im aktiven Katalogprofil nicht verfügbar`}
    onClick={() => skill && void onOpenSkill(skill)}
  >
    <code>/{skillKey}</code><PanelRightOpen aria-hidden="true" />
  </button>;
}
