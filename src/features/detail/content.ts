import { parse } from "yaml";

const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Returns the executable body while leaving the original source untouched.
 * The raw source remains the value used by the editor, exports and persistence.
 */
export function executableContent(source: string): string {
  const frontmatter = source.match(FRONTMATTER_PATTERN);
  if (!frontmatter) return source;

  try {
    const metadata = parse(frontmatter[1]);
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return source;
  } catch {
    return source;
  }

  const body = source.slice(frontmatter[0].length);
  return body.replace(/^\r?\n/, "");
}
