import type { QuickGraphAdapter } from "../domain";
import { BrowserQuickGraphAdapter } from "./browser";
import { LocalApiQuickGraphAdapter } from "./local-api";

export class AdapterConfigurationError extends Error {
  constructor(readonly configuredValue: unknown) {
    super(
      "VITE_QUICKGRAPH_ADAPTER muss explizit auf \"browser\" oder \"local-api\" gesetzt sein.",
    );
    this.name = "AdapterConfigurationError";
  }
}

export interface AdapterFactories {
  browser: () => QuickGraphAdapter;
  localApi: () => QuickGraphAdapter;
}

const defaultFactories: AdapterFactories = {
  browser: () => new BrowserQuickGraphAdapter(),
  localApi: () => new LocalApiQuickGraphAdapter(
    import.meta.env.VITE_QUICKGRAPH_API_URL || "",
  ),
};

export function selectQuickGraphAdapter(
  configuredValue: unknown,
  factories: AdapterFactories = defaultFactories,
): QuickGraphAdapter {
  switch (configuredValue) {
    case "browser":
      return factories.browser();
    case "local-api":
      return factories.localApi();
    default:
      throw new AdapterConfigurationError(configuredValue);
  }
}
