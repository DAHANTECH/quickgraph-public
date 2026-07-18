import { BookOpen, BrainCircuit, Check, Copy, ExternalLink, FileText, Network, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CatalogItem, ContextOverview } from "../../domain";

export type MemoryFocus = "overview" | "gbrain" | "obsidian" | "graphify";

interface MemoryHubProps {
  items: readonly CatalogItem[];
  contextOverview: ContextOverview | null;
  focus: MemoryFocus;
  onFocusChange: (focus: MemoryFocus) => void;
  onOpenContext: () => void;
  onOpenItem: (item: CatalogItem) => void;
}

const TOOL_NAMES: Record<Exclude<MemoryFocus, "overview">, readonly string[]> = {
  gbrain: ["setup-gbrain", "sync-gbrain"],
  obsidian: ["obsidian-lessons"],
  graphify: ["graphify"],
};

export function MemoryHub({ items, contextOverview, focus, onFocusChange, onOpenContext, onOpenItem }: MemoryHubProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const tools = useMemo(() => ({
    gbrain: findItems(items, TOOL_NAMES.gbrain),
    obsidian: findItems(items, TOOL_NAMES.obsidian),
    graphify: findItems(items, TOOL_NAMES.graphify),
  }), [items]);
  const memoryFile = contextOverview?.files.find((file) => file.target === "memory");

  useEffect(() => {
    if (focus === "overview") return;
    const target = document.getElementById(`memory-${focus}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);

  const copyCommand = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(command);
      window.setTimeout(() => setCopied((current) => current === command ? null : current), 1600);
    } catch {
      setCopied(null);
    }
  };

  const openFirst = (tool: keyof typeof tools) => {
    const item = tools[tool][0];
    if (item) onOpenItem(item);
  };

  return <section className="memory-hub" aria-labelledby="memory-hub-title">
    <header className="memory-hub-heading">
      <div>
        <p>Wissen speichern, finden und verstehen</p>
        <h1 id="memory-hub-title">Memory</h1>
        <span>Obsidian bewahrt die kuratierte Wahrheit. GBrain macht Arbeitsquellen durchsuchbar. Graphify zeigt Beziehungen. QuickGraph verbindet Status und Aktionen.</span>
      </div>
      <button className="secondary-button" type="button" onClick={onOpenContext}>
        <FileText aria-hidden="true" /> Kontextampeln öffnen
      </button>
    </header>

    <div className="memory-status-strip" aria-label="Memory-Systemstatus">
      <StatusItem label="MEMORY.md" value={memoryFile ? `${formatNumber(memoryFile.tokens)} Tokens` : "Nicht geladen"} ready={Boolean(memoryFile)} />
      <StatusItem label="GBrain" value={`${tools.gbrain.length}/2 Skills`} ready={tools.gbrain.length > 0} />
      <StatusItem label="Obsidian" value={tools.obsidian.length ? "Workflow bereit" : "Skill fehlt"} ready={tools.obsidian.length > 0} />
      <StatusItem label="Graphify" value={tools.graphify.length ? "Analyse bereit" : "Skill fehlt"} ready={tools.graphify.length > 0} />
    </div>

    <nav className="memory-local-nav" aria-label="Memory-Funktionen">
      {(["overview", "gbrain", "obsidian", "graphify"] as const).map((id) => <button
        className={focus === id ? "active" : ""}
        key={id}
        type="button"
        onClick={() => onFocusChange(id)}
      >{id === "overview" ? "Zusammenspiel" : toolLabel(id)}</button>)}
    </nav>

    <section className="memory-workflow" aria-labelledby="memory-workflow-title">
      <div className="memory-section-heading">
        <div><span>Workflow</span><h2 id="memory-workflow-title">So arbeitet das System zusammen</h2></div>
        <p>Die Werkzeuge ergänzen sich. Keines ersetzt die anderen.</p>
      </div>
      <div className="memory-flow" role="img" aria-label="Arbeitsquellen fließen zu Obsidian, GBrain und Graphify; QuickGraph macht Status und Aktionen sichtbar">
        <FlowNode icon={<FileText />} eyebrow="Quellen" title="Repos, Sessions, Notizen" detail="Code, Dokumentation und gelernte Lektionen" />
        <span className="memory-flow-arrow" aria-hidden="true">→</span>
        <div className="memory-flow-stack">
          <FlowNode icon={<BookOpen />} eyebrow="Wahrheit" title="Obsidian Vault" detail="Dauerhaftes, kuratiertes Wissen" />
          <FlowNode icon={<Search />} eyebrow="Abruf" title="GBrain Index" detail="Semantische Suche im Arbeitskontext" />
          <FlowNode icon={<Network />} eyebrow="Struktur" title="Graphify Graph" detail="Abhängigkeiten und Communities" />
        </div>
        <span className="memory-flow-arrow" aria-hidden="true">→</span>
        <FlowNode icon={<BrainCircuit />} eyebrow="Kontrolle" title="QuickGraph" detail="Status, Einstieg und sichere Aktionen" />
      </div>
      <ol className="memory-workflow-steps">
        <li><strong>Erfassen</strong><span>Relevante Lektionen in Obsidian kuratieren, Quellen nicht blind duplizieren.</span></li>
        <li><strong>Synchronisieren</strong><span>GBrain nach relevanten Repo-Änderungen neu indexieren.</span></li>
        <li><strong>Analysieren</strong><span>Graphify bei Architektur-, Abhängigkeits- oder Navigationsfragen aktualisieren.</span></li>
        <li><strong>Nutzen</strong><span>QuickGraph zeigt den passenden Einstieg, Kontextstatus und die erzeugten Artefakte.</span></li>
      </ol>
    </section>

    <div className="memory-tool-grid">
      <ToolCard
        id="memory-gbrain"
        icon={<Search />}
        title="GBrain"
        role="Index und semantische Suche"
        detail="Indexiert ausgewählte Repositories und hält den Suchkontext für Agenten aktuell. Es ist ein Abrufsystem, nicht die redaktionelle Quelle der Wahrheit."
        dependencies={["Konfigurierte Repositories", "Lokaler oder entfernter Index", "Sync nach relevanten Änderungen"]}
        available={tools.gbrain.length > 0}
        actions={<>
          <button className="secondary-button" type="button" disabled={!tools.gbrain.length} onClick={() => openFirst("gbrain")}>Skill öffnen</button>
          <button className="secondary-button" type="button" onClick={() => void copyCommand("/sync-gbrain")}>
            {copied === "/sync-gbrain" ? <Check /> : <Copy />} {copied === "/sync-gbrain" ? "Kopiert" : "/sync-gbrain"}
          </button>
        </>}
      />
      <ToolCard
        id="memory-obsidian"
        icon={<BookOpen />}
        title="Obsidian"
        role="Kuratierte, menschenlesbare Wissensbasis"
        detail="Speichert belastbare Lektionen im lokalen Vault. Kontext-Hubs verweisen auf Details, damit globale Regeln und Memory-Dateien kompakt bleiben."
        dependencies={["Lokaler Knowledge-System-Vault", "Bewusste redaktionelle Auswahl", "Validierte Ursache, Lösung und Prävention"]}
        available={tools.obsidian.length > 0}
        actions={<>
          <button className="secondary-button" type="button" disabled={!tools.obsidian.length} onClick={() => openFirst("obsidian")}>Skill öffnen</button>
          <button className="secondary-button" type="button" onClick={() => void copyCommand("/obsidian-lessons")}>
            {copied === "/obsidian-lessons" ? <Check /> : <Copy />} {copied === "/obsidian-lessons" ? "Kopiert" : "/obsidian-lessons"}
          </button>
        </>}
      />
      <ToolCard
        id="memory-graphify"
        icon={<Network />}
        title="Graphify"
        role="Beziehungs- und Abhängigkeitsanalyse"
        detail="Leitet aus Code und Dokumenten einen navigierbaren Graphen, Communities und einen Bericht ab. Ergebnisse sind Analyseartefakte, keine neue Wissensquelle."
        dependencies={["Aktueller Quellkorpus", "Extraktion und optionales Modell-Backend", "Neuaufbau nach strukturellen Änderungen"]}
        available={tools.graphify.length > 0}
        actions={<>
          <button className="secondary-button" type="button" disabled={!tools.graphify.length} onClick={() => openFirst("graphify")}>Skill öffnen</button>
          <a className="secondary-button" href="/graphify-out/graph.html" target="_blank" rel="noreferrer">Graph <ExternalLink /></a>
          <a className="secondary-button" href="/graphify-out/GRAPH_REPORT.md" target="_blank" rel="noreferrer">Bericht <ExternalLink /></a>
        </>}
      />
    </div>

    <section className="memory-dependencies" aria-labelledby="memory-dependencies-title">
      <div className="memory-section-heading"><div><span>Abhängigkeiten</span><h2 id="memory-dependencies-title">Was wovon abhängt</h2></div></div>
      <div className="memory-dependency-list">
        <p><strong>Obsidian → GBrain</strong><span>Kuratierte Vault-Inhalte können indexiert und dadurch agentisch auffindbar werden.</span></p>
        <p><strong>Quellen → Graphify</strong><span>Nur aktuelle, lesbare Quellen ergeben einen belastbaren Beziehungsgraphen.</span></p>
        <p><strong>GBrain + Graphify → Agenten</strong><span>GBrain liefert Treffer; Graphify liefert Struktur und Nachbarschaften für die Einordnung.</span></p>
        <p><strong>Alle Systeme → QuickGraph</strong><span>QuickGraph zeigt Status und Aktionen, speichert aber nicht automatisch die Wahrheit dieser Systeme.</span></p>
      </div>
    </section>
  </section>;
}

function findItems(items: readonly CatalogItem[], names: readonly string[]): CatalogItem[] {
  const candidates = new Set(names.map(normalize));
  return items.filter((item) => candidates.has(normalize(item.key)) || candidates.has(normalize(item.name)));
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("de").replace(/^\//, "").replace(/\s+/g, "-");
}

function toolLabel(tool: Exclude<MemoryFocus, "overview">): string {
  return tool === "gbrain" ? "GBrain" : tool === "obsidian" ? "Obsidian" : "Graphify";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE").format(value);
}

function StatusItem({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return <div><span className={ready ? "memory-status-dot ready" : "memory-status-dot"} aria-hidden="true" /><strong>{label}</strong><small>{value}</small></div>;
}

function FlowNode({ icon, eyebrow, title, detail }: { icon: ReactNode; eyebrow: string; title: string; detail: string }) {
  return <div className="memory-flow-node"><span className="memory-flow-icon">{icon}</span><div><small>{eyebrow}</small><strong>{title}</strong><span>{detail}</span></div></div>;
}

interface ToolCardProps {
  id: string;
  icon: ReactNode;
  title: string;
  role: string;
  detail: string;
  dependencies: readonly string[];
  available: boolean;
  actions: ReactNode;
}

function ToolCard({ id, icon, title, role, detail, dependencies, available, actions }: ToolCardProps) {
  return <article className="memory-tool-card" id={id}>
    <header><span className="memory-tool-icon">{icon}</span><div><h2>{title}</h2><p>{role}</p></div><span className={available ? "memory-availability ready" : "memory-availability"}>{available ? "Bereit" : "Nicht gefunden"}</span></header>
    <p>{detail}</p>
    <div className="memory-tool-dependencies"><strong>Benötigt</strong>{dependencies.map((dependency) => <span key={dependency}>{dependency}</span>)}</div>
    <footer>{actions}</footer>
  </article>;
}
