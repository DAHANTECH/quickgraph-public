export function isSafeSkillIllustrationPath(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("/skill-illustrations/")) return false;
  if (value.startsWith("//") || /[\x00-\x1F\x7F\\%?#]/u.test(value)) return false;
  const segments = value.slice("/skill-illustrations/".length).split("/");
  return segments.length > 0 && segments.every((segment) => segment && segment !== "." && segment !== "..");
}
