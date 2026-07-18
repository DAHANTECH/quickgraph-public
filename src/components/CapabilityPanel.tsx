import { Check, LockKeyhole } from "lucide-react";
import { CAPABILITY_KEYS, type Capability, type CapabilityFlags } from "../domain";

const LABELS: Record<Capability, string> = {
  catalogRead: "Katalog lesen",
  catalogManage: "Eigene Skills verwalten",
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

interface CapabilityPanelProps {
  capabilities: CapabilityFlags;
}

export function CapabilityPanel({ capabilities }: CapabilityPanelProps) {
  return (
    <section className="capability-panel" aria-labelledby="capability-title">
      <h2 id="capability-title">Adapterumfang</h2>
      <ul>
        {CAPABILITY_KEYS.map((capability) => {
          const enabled = capabilities[capability];
          const Icon = enabled ? Check : LockKeyhole;
          return (
            <li key={capability} data-supported={enabled}>
              <Icon aria-hidden="true" />
              <span>{LABELS[capability]}</span>
              <small>{enabled ? "Verfügbar" : "Nicht verfügbar"}</small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
