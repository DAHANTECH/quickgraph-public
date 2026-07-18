import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DISTRIBUTION_SUPPORTS_DEMO } from "../data/public-catalog";
import { OnboardingTour } from "./OnboardingTour";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(async () => {
  for (const { container, root } of mounted.splice(0)) {
    await act(async () => root.unmount());
    container.remove();
  }
  document.querySelectorAll("[data-tour]").forEach((element) => element.remove());
  vi.unstubAllGlobals();
});

describe("OnboardingTour", () => {
  it("scrolls to each visible target, moves the spotlight, and positions the popover beside it", async () => {
    const { container, catalog, search } = await renderTour();

    expect(container).toHaveTextContent("Schritt 1 von 18");
    expect(catalog).toHaveAttribute("data-tour-active", "true");
    expect(catalog!.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center", inline: "nearest" });
    expect(popover(container)).toHaveAttribute("data-placement", "below");
    expect(popover(container).style.left).toBe("12px");
    expect(popover(container).style.top).toBe("156px");
    const spotlight = container.querySelector<HTMLElement>(".onboarding-tour__spotlight");
    expect(spotlight?.style.left).toBe("92px");
    expect(spotlight?.style.top).toBe("92px");
    expect(spotlight?.style.width).toBe("216px");
    expect(spotlight?.style.height).toBe("56px");

    await act(async () => findButton(container, "Weiter").click());

    expect(container).toHaveTextContent("Schritt 2 von 18");
    expect(catalog).not.toHaveAttribute("data-tour-active");
    expect(search).toHaveAttribute("data-tour-active", "true");
    expect(search!.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center", inline: "nearest" });
    expect(popover(container)).toHaveAttribute("data-placement", "above");
    expect(popover(container).style.left).toBe("490px");
    expect(popover(container).style.top).toBe("144px");
  });

  it("uses a centered fallback when every step target is missing or hidden", async () => {
    const hiddenCatalog = addTarget("catalog", { left: 100, top: 100, width: 200, height: 40 });
    hiddenCatalog.style.display = "none";
    const { container } = await renderTour({ targets: false });

    expect(hiddenCatalog.scrollIntoView).not.toHaveBeenCalled();
    expect(container.querySelector(".onboarding-tour__spotlight")).toBeNull();
    expect(popover(container)).toHaveAttribute("data-placement", "fallback");
    expect(popover(container).style.left).toBe("302px");
    expect(popover(container).style.top).toBe("214px");
    expect(container).toHaveTextContent("Dieses Element ist in der aktuellen Ansicht nicht sichtbar.");
  });

  it("supports back, Escape, and finishing the final step", async () => {
    const onClose = vi.fn();
    const { container } = await renderTour({ onClose });

    await act(async () => findButton(container, "Weiter").click());
    await act(async () => findButton(container, "Zurück").click());
    expect(container).toHaveTextContent("Schritt 1 von 18");

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(onClose).toHaveBeenCalledTimes(1);

    for (let index = 0; index < 17; index += 1) {
      await act(async () => findButton(container, "Weiter").click());
    }
    expect(findButton(container, "Fertig")).toBeDefined();
    await act(async () => findButton(container, "Fertig").click());
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("can be skipped explicitly", async () => {
    const onClose = vi.fn();
    const { container } = await renderTour({ onClose });

    await act(async () => findButton(container, "Überspringen").click());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses distinct browser data steps and reports their semantic ids", async () => {
    const onPrepareStep = vi.fn();
    const { container } = await renderTour({ onPrepareStep, profile: "browser" });

    for (let index = 0; index < 6; index += 1) {
      await act(async () => findButton(container, "Weiter").click());
    }
    expect(container).toHaveTextContent("Data Center");
    await act(async () => findButton(container, "Weiter").click());
    expect(container).toHaveTextContent("Datenmodi");
    await act(async () => findButton(container, "Weiter").click());
    expect(container).toHaveTextContent("Importe");
    expect(onPrepareStep.mock.calls.slice(-3).map(([step]) => step.id)).toEqual([
      "data-center",
      "data-modes",
      "imports",
    ]);
  });

  it("describes only the data modes shipped by the active distribution", async () => {
    const { container } = await renderTour({ profile: "browser" });

    for (let index = 0; index < 7; index += 1) {
      await act(async () => findButton(container, "Weiter").click());
    }

    expect(container).toHaveTextContent("Datenmodi");
    if (DISTRIBUTION_SUPPORTS_DEMO) {
      expect(container).toHaveTextContent("Demo");
    } else {
      expect(container).not.toHaveTextContent("Demo");
    }
  });

  it("explains profile switching before the LocalAPI export step", async () => {
    const onPrepareStep = vi.fn();
    const { container } = await renderTour({ onPrepareStep, profile: "local-api" });

    expect(container).toHaveTextContent("Schritt 1 von 18");
    for (let index = 0; index < 6; index += 1) {
      await act(async () => findButton(container, "Weiter").click());
    }
    expect(container).toHaveTextContent("Data Center");
    await act(async () => findButton(container, "Weiter").click());
    expect(container).toHaveTextContent("Datenquelle und Modus");
    await act(async () => findButton(container, "Weiter").click());
    expect(container).toHaveTextContent("Katalog exportieren");
    expect(container).not.toHaveTextContent("Data Center zeigen");
    expect(onPrepareStep.mock.calls.slice(-3).map(([step]) => step.id)).toEqual([
      "data-center",
      "data-modes",
      "local-catalog-export",
    ]);
  });
});

async function renderTour({
  onClose = vi.fn(),
  onPrepareStep,
  profile = "browser",
  targets = true,
}: {
  onClose?: ReturnType<typeof vi.fn>;
  onPrepareStep?: ReturnType<typeof vi.fn>;
  profile?: "browser" | "local-api";
  targets?: boolean;
} = {}) {
  const catalog = targets ? addTarget("catalog", { left: 100, top: 100, width: 200, height: 40 }) : null;
  const search = targets ? addTarget("search", { left: 600, top: 500, width: 200, height: 40 }) : null;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => root.render(
    <OnboardingTour open onClose={onClose} onPrepareStep={onPrepareStep} profile={profile} />,
  ));
  return { container, catalog, search };
}

function addTarget(name: string, rect: TargetRect): HTMLElement & { scrollIntoView: ReturnType<typeof vi.fn> } {
  const target = document.createElement("button") as unknown as HTMLElement & { scrollIntoView: ReturnType<typeof vi.fn> };
  target.dataset.tour = name;
  target.scrollIntoView = vi.fn();
  Object.defineProperty(target, "getBoundingClientRect", {
    value: () => new DOMRect(rect.left, rect.top, rect.width, rect.height),
  });
  document.body.append(target);
  return target;
}

interface TargetRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

function popover(container: HTMLElement): HTMLElement {
  const element = container.querySelector<HTMLElement>(".onboarding-tour__popover");
  if (!element) throw new Error("Tour-Popover fehlt.");
  return element;
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.replace(/\s+/g, " ").trim() === label,
  ) as HTMLButtonElement | undefined;
  if (!button) throw new Error(`Button „${label}“ fehlt.`);
  return button;
}
