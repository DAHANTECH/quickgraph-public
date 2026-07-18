export const PLATFORM_FEE = 0.055;

export const DEFAULT_COMPARISON_IDS = [
  "openai/gpt-5.1-codex-mini",
  "openai/gpt-5.1-codex",
  "openai/gpt-5.3-codex",
  "~anthropic/claude-sonnet-latest",
  "~google/gemini-flash-latest",
  "deepseek/deepseek-v4-flash",
] as const;

export const MODEL_SORTS = ["name", "description", "score", "cost", "context", "provider"] as const;
export type ModelSort = (typeof MODEL_SORTS)[number];

export interface ModelUseCase {
  label: string;
  input: number;
  output: number;
  must: readonly string[];
  weights: Readonly<Record<string, number>>;
  note: string;
}

export const MODEL_USE_CASES = {
  "codex-daily": {
    label: "Codex Alltag",
    input: 180_000,
    output: 35_000,
    must: ["coding", "tools"],
    weights: { coding: 34, tools: 18, context: 16, cost: 22, reasoning: 10 },
    note: "Normale Repo-Arbeit, kleine bis mittlere Edits, Iteration mit Tool-Nutzung.",
  },
  "codex-hard": {
    label: "Schwere Codex-Aufgabe",
    input: 420_000,
    output: 70_000,
    must: ["coding", "reasoning"],
    weights: { coding: 34, reasoning: 24, context: 22, tools: 10, cost: 10 },
    note: "Architektur, schweres Debugging, riskante Migrationen und lange Tool-Spuren.",
  },
  "deep-research": {
    label: "Deep Research",
    input: 260_000,
    output: 45_000,
    must: ["long-context"],
    weights: { context: 30, reasoning: 18, structured: 14, cost: 18, tools: 10, vision: 10 },
    note: "Viele Quellen, Vergleich, Synthese und zitierfähige Struktur.",
  },
  "cheap-batch": {
    label: "Günstige Batch-Jobs",
    input: 600_000,
    output: 35_000,
    must: ["cheap"],
    weights: { cost: 54, context: 18, structured: 14, fast: 14 },
    note: "Klassifizieren, Umformatieren, Extraktion, erste Graphify-/Repo-Pässe.",
  },
  "long-context": {
    label: "Long Context",
    input: 900_000,
    output: 30_000,
    must: ["long-context"],
    weights: { context: 48, cost: 18, reasoning: 14, structured: 10, files: 10 },
    note: "Sehr große Dokumente, Reports, Transkripte und breite Repository-Orientierung.",
  },
  "design-vision": {
    label: "Design & Vision",
    input: 120_000,
    output: 30_000,
    must: ["vision"],
    weights: { vision: 34, reasoning: 14, structured: 14, cost: 18, context: 10, fast: 10 },
    note: "Screenshots, UI-Audit, visuelle Review-Pässe und Mockup-Vergleiche.",
  },
} as const satisfies Record<string, ModelUseCase>;

export type ModelUseCaseId = keyof typeof MODEL_USE_CASES;

export interface ModelSetup {
  title: string;
  useCaseId: ModelUseCaseId;
  modelIds: readonly string[];
  flow: string;
}

export const MODEL_SETUPS: readonly ModelSetup[] = [
  {
    title: "Codex Kostenleiter",
    useCaseId: "codex-daily",
    modelIds: ["openai/gpt-5.1-codex-mini", "openai/gpt-5.1-codex", "openai/gpt-5.3-codex"],
    flow: "Mini für Orientierung, Standard für Umsetzung, Premium nur bei harten Architektur- oder Debugging-Punkten.",
  },
  {
    title: "Research Stack",
    useCaseId: "deep-research",
    modelIds: ["~google/gemini-flash-latest", "~anthropic/claude-sonnet-latest", "~openai/gpt-latest"],
    flow: "Flash für breite Sichtung, Sonnet für Synthese, ein zweites Frontier-Modell für die Gegenprüfung.",
  },
  {
    title: "Budget Batch Stack",
    useCaseId: "cheap-batch",
    modelIds: ["deepseek/deepseek-v4-flash", "qwen/qwen3.6-flash", "openai/gpt-5.4-nano"],
    flow: "Preiswerte Modelle für Extraktion, Klassifikation und erste Strukturierung, nicht für finale riskante Entscheidungen.",
  },
  {
    title: "Design Review Stack",
    useCaseId: "design-vision",
    modelIds: ["~anthropic/claude-sonnet-latest", "~google/gemini-pro-latest", "openai/gpt-5.5"],
    flow: "Vision-Modell für das Screenshot-Audit, zweites Modell für die Gegenmeinung, Premium nur für die finale Designentscheidung.",
  },
];

export interface ModelPricing {
  inputPerMillion: number | null;
  outputPerMillion: number | null;
}

export interface Model {
  id: string;
  canonicalSlug: string | null;
  name: string;
  provider: string;
  description: string;
  contextLength: number;
  maxCompletionTokens: number | null;
  pricing: ModelPricing;
  tags: readonly string[];
}

export interface ModelCatalog {
  source: string | null;
  fetchedAt: string | null;
  modelCount: number;
  models: readonly Model[];
}

export interface ModelFilters {
  query?: string;
  provider?: string | "all";
  tag?: string | "all";
}

const DEFAULT_USE_CASE: ModelUseCaseId = "codex-daily";
const UNKNOWN_PROVIDER = "unknown";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function wholeNumber(value: unknown, fallback = 0): number {
  return Math.floor(nonNegativeNumber(value) ?? fallback);
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => text(item)?.toLowerCase() ?? []))];
}

function providerFromId(id: string): string {
  return id.includes("/") ? id.split("/", 1)[0] : UNKNOWN_PROVIDER;
}

function useCaseFor(id: ModelUseCaseId | undefined): ModelUseCase {
  return MODEL_USE_CASES[id ?? DEFAULT_USE_CASE];
}

export function normalizeModel(value: unknown): Model | null {
  const input = record(value);
  const id = text(input?.id);
  if (!input || !id) return null;

  const pricing = record(input.pricing);
  return {
    id,
    canonicalSlug: text(input.canonical_slug),
    name: text(input.name) ?? id,
    provider: text(input.provider) ?? providerFromId(id),
    description: text(input.description) ?? "",
    contextLength: wholeNumber(input.context_length),
    maxCompletionTokens: nonNegativeNumber(input.max_completion_tokens),
    pricing: {
      inputPerMillion: nonNegativeNumber(pricing?.input_per_m),
      outputPerMillion: nonNegativeNumber(pricing?.output_per_m),
    },
    tags: strings(input.tags),
  };
}

export function normalizeModelCatalog(value: unknown): ModelCatalog {
  const input = record(value);
  const models = Array.isArray(input?.models)
    ? input.models.flatMap((item) => {
        const model = normalizeModel(item);
        return model ? [model] : [];
      })
    : [];

  return {
    source: text(input?.source),
    fetchedAt: text(input?.fetched_at) ?? text(input?.fetchedAt),
    modelCount: wholeNumber(input?.model_count ?? input?.modelCount, models.length),
    models,
  };
}

export function calculateUseCaseCost(
  model: Model,
  useCaseId: ModelUseCaseId = DEFAULT_USE_CASE,
  includePlatformFee = true,
): number | null {
  const { inputPerMillion, outputPerMillion } = model.pricing;
  if (inputPerMillion === null || outputPerMillion === null) return null;

  const useCase = useCaseFor(useCaseId);
  const tokenCost = (useCase.input / 1_000_000) * inputPerMillion
    + (useCase.output / 1_000_000) * outputPerMillion;
  return includePlatformFee ? tokenCost * (1 + PLATFORM_FEE) : tokenCost;
}

export function scoreModelFit(
  model: Model,
  useCaseId: ModelUseCaseId = DEFAULT_USE_CASE,
): number {
  const useCase = useCaseFor(useCaseId);
  const tags = new Set(model.tags);
  const { weights } = useCase;
  const cost = calculateUseCaseCost(model, useCaseId);
  let score = 0;

  for (const tag of ["coding", "tools", "reasoning", "structured", "vision", "files", "fast"]) {
    if (tags.has(tag)) score += weights[tag] ?? 0;
  }
  if (model.contextLength >= useCase.input) score += weights.context ?? 0;
  else if (model.contextLength >= useCase.input * 0.65) score += (weights.context ?? 0) * 0.6;

  if (cost !== null) {
    const costScore = cost <= 0.25 ? 1 : cost <= 1 ? 0.8 : cost <= 3 ? 0.55 : cost <= 8 ? 0.3 : 0.1;
    score += (weights.cost ?? 0) * costScore;
  }
  for (const tag of useCase.must) {
    if (!tags.has(tag) && !(tag === "long-context" && model.contextLength >= 200_000)) score -= 16;
  }
  if (model.id.includes(":free")) score -= 4;

  return Math.max(0, Math.round(score));
}

export function searchModels(models: readonly Model[], query: string): Model[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...models];

  return models.filter((model) => {
    const haystack = `${model.id} ${model.name} ${model.description} ${model.tags.join(" ")}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function filterModels(models: readonly Model[], filters: ModelFilters = {}): Model[] {
  const provider = filters.provider ?? "all";
  const tag = filters.tag ?? "all";
  return searchModels(models, filters.query ?? "")
    .filter((model) => provider === "all" || model.provider === provider)
    .filter((model) => tag === "all" || model.tags.includes(tag));
}

export function modelProviders(models: readonly Model[]): string[] {
  return [...new Set(models.map((model) => model.provider).filter(Boolean))].sort();
}

export function sortModels(
  models: readonly Model[],
  sort: ModelSort = "score",
  useCaseId: ModelUseCaseId = DEFAULT_USE_CASE,
): Model[] {
  return [...models].sort((left, right) => {
    if (sort === "name") return left.name.localeCompare(right.name, "de");
    if (sort === "description") return left.description.localeCompare(right.description, "de");
    if (sort === "cost") {
      return (calculateUseCaseCost(left, useCaseId) ?? 9999) - (calculateUseCaseCost(right, useCaseId) ?? 9999);
    }
    if (sort === "context") return right.contextLength - left.contextLength;
    if (sort === "provider") return `${left.provider}${left.name}`.localeCompare(`${right.provider}${right.name}`);
    return scoreModelFit(right, useCaseId) - scoreModelFit(left, useCaseId);
  });
}

export function findModels(
  models: readonly Model[],
  filters: ModelFilters = {},
  sort: ModelSort = "score",
  useCaseId: ModelUseCaseId = DEFAULT_USE_CASE,
): Model[] {
  return sortModels(filterModels(models, filters), sort, useCaseId);
}

export function preferredModels(
  models: readonly Model[],
  filters: ModelFilters = {},
  useCaseId: ModelUseCaseId = DEFAULT_USE_CASE,
): Model[] {
  return findModels(models, filters, "score", useCaseId)
    .filter((model) => scoreModelFit(model, useCaseId) >= 52)
    .slice(0, 8);
}

export function toggleComparisonSelection(selectedIds: ReadonlySet<string>, modelId: string): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(modelId)) next.delete(modelId);
  else next.add(modelId);
  return next;
}

export function defaultComparisonSelection(models: readonly Model[]): Set<string> {
  const known = new Set(models.map((model) => model.id));
  const selected = DEFAULT_COMPARISON_IDS.filter((modelId) => known.has(modelId));
  if (selected.length >= 2) return new Set(selected);

  return new Set(findModels(models, {}, "score", "codex-daily").slice(0, 3).map((model) => model.id));
}

export function comparisonModels(
  models: readonly Model[],
  selectedIds: ReadonlySet<string>,
  useCaseId: ModelUseCaseId = DEFAULT_USE_CASE,
): Model[] {
  return sortModels(models.filter((model) => selectedIds.has(model.id)), "score", useCaseId);
}
