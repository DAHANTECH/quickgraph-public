import { Grid2X2, List } from "lucide-react";
import type { CatalogViewPreference } from "../lib/preferences";

interface EntryViewToggleProps {
  view: CatalogViewPreference;
  onChange: (view: CatalogViewPreference) => void;
  label?: string;
}

export function EntryViewToggle({ view, onChange, label = "Eintragsdarstellung" }: EntryViewToggleProps) {
  return (
    <div className="view-toggle" role="group" aria-label={label} data-tour="view-mode">
      <button
        className={view === "grid" ? "active" : ""}
        type="button"
        onClick={() => onChange("grid")}
        title="Kachelansicht"
        aria-pressed={view === "grid"}
      >
        <Grid2X2 aria-hidden="true" />
        <span className="sr-only">Kachelansicht</span>
      </button>
      <button
        className={view === "list" ? "active" : ""}
        type="button"
        onClick={() => onChange("list")}
        title="Listenansicht"
        aria-pressed={view === "list"}
      >
        <List aria-hidden="true" />
        <span className="sr-only">Listenansicht</span>
      </button>
    </div>
  );
}
