import type { ContextFileOverview, ContextOverview, ContextStatus } from "./types";

export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

export function contextStatusForTokens(tokens: number): ContextStatus {
  if (tokens < 1_500) return "green";
  if (tokens <= 3_000) return "yellow";
  return "red";
}

export function contextMetrics(content: string) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\n$/, "");
  const tokens = estimateTokens(content);
  return {
    lines: normalized ? normalized.split("\n").length : 0,
    chars: content.length,
    tokens,
    status: contextStatusForTokens(tokens),
  };
}

export function normalizeContextFile(file: ContextFileOverview): ContextFileOverview {
  const metrics = contextMetrics(file.content);
  return {
    ...file,
    lines: Number.isFinite(file.lines) ? file.lines : metrics.lines,
    chars: file.chars ?? metrics.chars,
    tokens: Number.isFinite(file.tokens) ? file.tokens : metrics.tokens,
    status: file.status ?? metrics.status,
  };
}

export function summarizeContext(files: readonly ContextFileOverview[]): ContextOverview["summary"] {
  const order: Record<ContextStatus, number> = { green: 0, yellow: 1, red: 2 };
  return {
    available: files.length,
    status: files.reduce<ContextStatus>(
      (worst, file) => order[file.status] > order[worst] ? file.status : worst,
      "green",
    ),
    totalTokens: files.reduce((total, file) => total + file.tokens, 0),
  };
}
