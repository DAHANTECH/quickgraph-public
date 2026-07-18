import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { BrowserQuickGraphAdapter } from "../adapters/browser";
import { DISTRIBUTION_SUPPORTS_DEMO } from "../data/public-catalog";
import { DataCenterDialog } from "./DataCenterDialog";

describe("Data Center distribution modes", () => {
  it("shows demo controls only when the active distribution ships demo data", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;

    await act(async () => root.render(
      <DataCenterDialog
        adapter={new BrowserQuickGraphAdapter("data-center-distribution-test")}
        activeProfile="browser"
        items={[]}
        mode="quickgraph"
        open
        onClose={vi.fn()}
        onDataChanged={vi.fn()}
        onModeChange={vi.fn()}
      />,
    ));

    const radioLabels = [...container.querySelectorAll('[role="radio"]')]
      .map((element) => element.textContent ?? "");
    const buttonLabels = [...container.querySelectorAll("button")]
      .map((element) => element.textContent ?? "");

    if (DISTRIBUTION_SUPPORTS_DEMO) {
      expect(radioLabels.some((label) => /Demo/iu.test(label))).toBe(true);
      expect(buttonLabels.some((label) => /Demo zurücksetzen/iu.test(label))).toBe(true);
    } else {
      expect(radioLabels.some((label) => /Demo/iu.test(label))).toBe(false);
      expect(buttonLabels.some((label) => /Demo zurücksetzen/iu.test(label))).toBe(false);
      expect(container).toHaveTextContent("neutraler Starter-Katalog");
    }

    await act(async () => root.unmount());
    container.remove();
  });
});
