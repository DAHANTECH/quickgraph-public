import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Network } from "lucide-react";
import { selectQuickGraphAdapter } from "./adapters";
import { App } from "./app";
import { writeDataMode, type RuntimeProfile } from "./lib/preferences";
import "./styles/tokens.css";
import "./styles/app.css";

const root = createRoot(document.getElementById("root")!);

try {
  const configuredProfile = import.meta.env.VITE_QUICKGRAPH_ADAPTER;
  const requestedProfile = new URLSearchParams(window.location.search).get("profile");
  const activeProfile = configuredProfile === "local-api" && requestedProfile === "browser"
    ? "browser"
    : configuredProfile;
  const adapter = selectQuickGraphAdapter(activeProfile);
  const switchProfile = configuredProfile === "local-api"
    ? (profile: RuntimeProfile, mode?: Parameters<typeof writeDataMode>[0]) => {
        if (mode) writeDataMode(mode);
        const url = new URL(window.location.href);
        if (profile === "browser") url.searchParams.set("profile", "browser");
        else url.searchParams.delete("profile");
        window.location.assign(url);
      }
    : undefined;
  root.render(
    <StrictMode>
      <App adapter={adapter} onSwitchProfile={switchProfile} />
    </StrictMode>,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "Ungültige Adapterkonfiguration.";
  root.render(
    <StrictMode>
      <main className="configuration-error" role="alert">
        <Network aria-hidden="true" />
        <p>QuickGraph konnte nicht gestartet werden</p>
        <h1>Adapter explizit konfigurieren</h1>
        <code>{message}</code>
      </main>
    </StrictMode>,
  );
}
