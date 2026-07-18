export type ContextDiffKind = "unchanged" | "removed" | "added" | "changed";

export interface ContextDiffRow {
  kind: ContextDiffKind;
  before?: string;
  after?: string;
  beforeLine?: number;
  afterLine?: number;
}

export interface ContextMetrics {
  chars: number;
  lines: number;
  tokens: number;
}

export function buildContextDiff(before: string, after: string): ContextDiffRow[] {
  const beforeLines = linesOf(before);
  const afterLines = linesOf(after);
  let prefix = 0;
  while (
    prefix < beforeLines.length
    && prefix < afterLines.length
    && beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix
    && suffix < afterLines.length - prefix
    && beforeLines[beforeLines.length - suffix - 1] === afterLines[afterLines.length - suffix - 1]
  ) {
    suffix += 1;
  }

  const rows: ContextDiffRow[] = [];
  for (let index = 0; index < prefix; index += 1) {
    rows.push({
      kind: "unchanged",
      before: beforeLines[index],
      after: afterLines[index],
      beforeLine: index + 1,
      afterLine: index + 1,
    });
  }

  const beforeMiddle = beforeLines.slice(prefix, beforeLines.length - suffix);
  const afterMiddle = afterLines.slice(prefix, afterLines.length - suffix);
  const sharedMiddleLength = Math.min(beforeMiddle.length, afterMiddle.length);
  for (let index = 0; index < sharedMiddleLength; index += 1) {
    rows.push({
      kind: "changed",
      before: beforeMiddle[index],
      after: afterMiddle[index],
      beforeLine: prefix + index + 1,
      afterLine: prefix + index + 1,
    });
  }
  for (let index = sharedMiddleLength; index < beforeMiddle.length; index += 1) {
    rows.push({
      kind: "removed",
      before: beforeMiddle[index],
      beforeLine: prefix + index + 1,
    });
  }
  for (let index = sharedMiddleLength; index < afterMiddle.length; index += 1) {
    rows.push({
      kind: "added",
      after: afterMiddle[index],
      afterLine: prefix + index + 1,
    });
  }

  for (let index = suffix; index > 0; index -= 1) {
    const beforeIndex = beforeLines.length - index;
    const afterIndex = afterLines.length - index;
    rows.push({
      kind: "unchanged",
      before: beforeLines[beforeIndex],
      after: afterLines[afterIndex],
      beforeLine: beforeIndex + 1,
      afterLine: afterIndex + 1,
    });
  }
  return rows;
}

export function contextMetrics(content: string): ContextMetrics {
  return {
    chars: content.length,
    lines: linesOf(content).length,
    tokens: content.length === 0 ? 0 : Math.ceil(content.length / 4),
  };
}

function linesOf(content: string): string[] {
  if (!content) return [];
  const normalized = content.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (normalized.endsWith("\n")) lines.pop();
  return lines;
}
