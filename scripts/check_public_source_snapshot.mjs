#!/usr/bin/env node
/** Validate the deny-by-default QuickGraph source snapshot or its Vite release. */

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const target = resolve(process.argv[2] ?? ".");
const releaseMode = process.argv.includes("--release");
const expectedStarterHash = "68415b88cc1a0ecede5123b4ef27bd954babecbff2cb696742090fecfb506688";
const expectedKeys = [
  "brainstorming-helper",
  "code-debugging",
  "code-review",
  "context-audit",
  "project-planning",
  "research-organizer",
  "workflow-retrospective",
  "writing-assistant",
];
const forbiddenLiteralHashesByWordCount = new Map([
  [1, new Set([
    "138e85cb9ca4e245d84b07b8799a2f9c9735f33bba814d8f2b7a54080c648b75",
    "1e78714c6ac76881d2cb05f834037c7044dd180498048d432f68ab17300d7fb6",
    "4c8a5eb4beb2a825a6388f1de322bbea30918f79246db591a126147527f29776",
    "547fad7aa47a65e3d2d55739540e962d2d5e7c44be296fabe7fcad10e67ceed4",
    "7bb0d320da665a2fb450e0e8422edfa362b72d262a67ef7e517e95824533830b",
    "8b3d44197f0ac92cbcea004660e4085404360df9ce3d15e245ddaf02d5b2852f",
    "9f15eede4474e4ad690e582cdcc86045cf4be9f1a06ab7c0c2df440c14d5a561",
    "b06118efcf29d36b5ab269448936d9a8dd7d0c42fa873a452c3a968727b12be0",
    "b42bb8543311b2c003067e568e9c0d983f09a986102903d9b3512ac1b607c9b0",
    "c6c1a2d1c8766d1ad14627e8cabcfe8362c6aee6475d7c2659885af6d9a05dcf",
    "c8ba71bc3aff1d9eb68ce46d6ef0b7fbf5cff17644c499039313314b75c84327",
    "d53cd2cae33d58c3e11990de51c36acf6ccf752ec6a6bbd14ef1cb0ecdbda299",
  ])],
  [2, new Set([
    "190303cba838ebf324bde6bf297d26d94e97282aab2418a8ccc0435d72058644",
    "3bd8727e213f9a94ec08c7117229388e12444e06a62a0f8639d763f56b111e5e",
    "60eccda5896c81ad7c67b6fce509a059bda94cf49cd060d465466e0ee6fef31a",
    "8677538f487067c2e6345164e80590c07403651870dcebac22cb2af0989e4bf6",
    "a7cba5cce900f7486fe17bb167bc55394d83b76604c46204fb63a6b63e1f3c73",
    "acf89ab297be5a6becb25b606eafb69feb48f9ea06afaec28d6e0aebf62a3196",
    "c3628d157cf7f7aeccc1f8e81053efdacbc9a09d712b78d30fc41bb559fbf246",
    "d9f2d77d6d9215f8a8d6c3a14ec9273ee758a1d1566ce686c49f2d712addd446",
    "e84cbce426eedd797cc1a20298f777da5ab63a78f67f684dc6dafffa43b91efc",
    "ff91b25a78f7b01134e0aa0bf6a6187d0d0ef4b8c578d6d454ebc91bbe803c92",
  ])],
  [3, new Set([
    "6e6e0e61d1c67ea239f1ecee8c2b73e61644feab5ea16dee98cd96b402dee2c3",
    "a612aab1dbf7bbe6998f05f14403a35ae7db9cb02a767621593464123e21d3d2",
    "f18a967d86bf079ced80ac2a5f112bb2990faa9ba63769ae030ce3be55fd4b98",
  ])],
]);

if (!(await isDirectory(target))) throw new Error(`Snapshot-Verzeichnis fehlt: ${target}`);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (releaseMode) {
    await validateRelease();
  } else {
    await validateSource();
  }
}

async function validateSource() {
  const starterPath = join(target, "src/data/public-starter-pack.json");
  const starterBytes = await readFile(starterPath);
  validateStarter(starterBytes);

  const forbiddenPaths = [
    "src/data/public-catalog.json",
    "src/data/public-apps.json",
    "src/data/demo.json",
    "src/distribution/private.ts",
    "public/app-screenshots",
    "public/skill-screenshots",
    "public/skill-illustrations",
    "public/graphify-out",
  ];
  for (const path of forbiddenPaths) {
    if (await exists(join(target, path))) throw new Error(`Private Snapshot-Datei ist verboten: ${path}`);
  }

  const publicFiles = (await listFiles(join(target, "public")))
    .map((file) => relative(join(target, "public"), file).split("\\").join("/"));
  if (JSON.stringify(publicFiles.sort()) !== JSON.stringify(["openrouter-models.json"])) {
    throw new Error(`Unerwartete Public-Assets: ${publicFiles.join(", ") || "keine"}`);
  }

  const testFiles = (await listFiles(join(target, "src")))
    .map((file) => relative(target, file).split("\\").join("/"))
    .filter((file) => /\.(?:test|spec)\.[^.]+$/u.test(file));
  if (JSON.stringify(testFiles.sort()) !== JSON.stringify([
    "src/adapters/browser/public-distribution.test.ts",
    "src/components/DataCenterDialog.public.test.tsx",
    "src/components/OnboardingTour.test.tsx",
  ])) {
    throw new Error(`Unerwartete Snapshot-Tests: ${testFiles.join(", ") || "keine"}`);
  }

  const bridge = await readFile(join(target, "src/data/public-catalog.ts"), "utf8");
  if (!bridge.includes('from "../distribution/public"') || bridge.includes("@quickgraph/distribution")) {
    throw new Error("Der Public-Katalog ist nicht hart an die neutrale Distribution gebunden.");
  }

  const vite = await readFile(join(target, "vite.config.ts"), "utf8");
  if (
    !vite.includes("VITE_QUICKGRAPH_ADAPTER': JSON.stringify('browser')")
    || vite.includes("BACKEND_PORT")
    || vite.includes("@quickgraph/distribution")
  ) {
    throw new Error("Die öffentliche Vite-Konfiguration ist nicht browser-only.");
  }

  const packageJson = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(join(target, "package-lock.json"), "utf8"));
  if (
    packageJson.name !== "quickgraph-public"
    || !packageJson.scripts?.test?.includes("public-distribution.test.ts")
    || !packageJson.scripts?.test?.includes("DataCenterDialog.public.test.tsx")
    || !packageJson.scripts?.test?.includes("OnboardingTour.test.tsx")
    || packageJson.scripts?.scan !== "node scripts/check_public_source_snapshot.mjs ."
    || !packageJson.scripts?.build?.includes("npm run scan:dist")
  ) {
    throw new Error("Die öffentlichen npm-Gates entsprechen nicht dem Snapshot-Vertrag.");
  }
  if (
    packageLock.name !== packageJson.name
    || packageLock.packages?.[""]?.name !== packageJson.name
    || JSON.stringify(packageLock.packages?.[""]?.dependencies) !== JSON.stringify(packageJson.dependencies)
    || JSON.stringify(packageLock.packages?.[""]?.devDependencies) !== JSON.stringify(packageJson.devDependencies)
  ) {
    throw new Error("package.json und package-lock.json sind im Public-Snapshot nicht synchron.");
  }

  const readme = await readFile(join(target, "README.md"), "utf8");
  if (readme.includes("aktive Website liegt vollständig in `public/`")) {
    throw new Error("README beschreibt noch das veraltete Release-only-Layout.");
  }

  await scanFiles(await listFiles(target), target);
  console.log(`Public-Source-Snapshot geprüft: exakt ${expectedKeys.length} neutrale Katalogeinträge.`);
}

async function validateRelease() {
  const files = await listFiles(target);
  const relativeFiles = files.map((file) => relative(target, file).split("\\").join("/")).sort();
  const allowed = [
    /^index\.html$/u,
    /^openrouter-models\.json$/u,
    /^assets\/[^/]+\.js$/u,
    /^assets\/[^/]+\.css$/u,
  ];
  const unexpected = relativeFiles.filter((file) => !allowed.some((pattern) => pattern.test(file)));
  if (unexpected.length > 0) {
    throw new Error(`Nicht freigegebene Build-Dateien:\n${unexpected.map((file) => `- ${file}`).join("\n")}`);
  }

  const javascriptFiles = relativeFiles.filter((file) => extname(file) === ".js");
  const stylesheetFiles = relativeFiles.filter((file) => extname(file) === ".css");
  if (javascriptFiles.length !== 1 || stylesheetFiles.length < 1) {
    throw new Error(`Unerwartete Build-Struktur: ${javascriptFiles.length} JS, ${stylesheetFiles.length} CSS.`);
  }
  const javascript = await readFile(join(target, javascriptFiles[0]), "utf8");
  for (const key of expectedKeys) {
    if (!javascript.includes(key)) throw new Error(`Starter-Eintrag fehlt im Build: ${key}`);
  }

  await scanFiles(files, target, true);
  console.log(`Public-Vite-Build geprüft: ${relativeFiles.length} Dateien, exakt ${expectedKeys.length} Katalogeinträge.`);
}

function validateStarter(bytes) {
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== expectedStarterHash) throw new Error(`Nicht freigegebener Starter-Hash: ${hash}`);
  const starter = JSON.parse(bytes.toString("utf8"));
  const keys = starter.items?.map((item) => item.key).sort();
  if (
    starter.mode !== "starter"
    || starter.policy !== "public-demo-only"
    || JSON.stringify(keys) !== JSON.stringify([...expectedKeys].sort())
    || starter.profiles?.length !== 0
    || Object.keys(starter.usage ?? {}).length !== 0
  ) {
    throw new Error("Der Public-Starter entspricht nicht dem freigegebenen Datenvertrag.");
  }
}

async function scanFiles(files, base, strictRelease = false) {
  const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".svg", ".ts", ".tsx", ".txt", ".yaml", ".yml"]);
  const checks = [
    ["macOS-Benutzerpfad", /\/Users\/[A-Za-z0-9._-]+/iu],
    ["persönliche E-Mail-Adresse", /[A-Z0-9._%+-]+@(?!example\.com\b|dahantech\.dev\b)[A-Z0-9.-]+\.[A-Z]{2,}/iu],
    ["OpenAI-Schlüssel", /\bsk-(?![A-Za-z0-9_-]*\{)[A-Za-z0-9_-]{20,}\b/u],
    ["Anthropic-Schlüssel", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/u],
    ["GitHub-Token", /\bgh[opsu]_[A-Za-z0-9]{20,}\b/u],
    ["privater Schlüssel", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
    ["private Toolwurzel", /(?:~|\/|\\)\.(?:claude|codex|agents|ssh|aws)(?:\/|\\)/iu],
    ...(strictRelease ? [
      ["lokale URL", /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?/iu],
      ["Datei-URI", /file:\/\//iu],
    ] : []),
  ];

  const findings = [];
  for (const file of files) {
    const relativePath = relative(base, file).split("\\").join("/");
    if (containsForbiddenLiteral(relativePath)) {
      findings.push(`${relativePath}: gesperrte private Kennung im Dateinamen`);
    }
    if (!textExtensions.has(extname(file).toLowerCase())) continue;
    const content = await readFile(file, "utf8");
    if (containsForbiddenLiteral(content)) {
      findings.push(`${relativePath}: gesperrte private Kennung`);
    }
    for (const [label, pattern] of checks) {
      if (pattern.test(content)) findings.push(`${relativePath}: ${label}`);
    }
  }
  if (findings.length > 0) {
    throw new Error(`Public-Snapshot enthält gesperrte Daten:\n${findings.map((item) => `- ${item}`).join("\n")}`);
  }
}

export function containsForbiddenLiteral(value) {
  const normalized = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  if (!normalized) return false;
  const words = normalized.split(/\s+/u);
  for (const [wordCount, forbiddenHashes] of forbiddenLiteralHashesByWordCount) {
    for (let index = 0; index <= words.length - wordCount; index += 1) {
      const hash = createHash("sha256")
        .update(words.slice(index, index + wordCount).join(" "))
        .digest("hex");
      if (forbiddenHashes.has(hash)) return true;
    }
  }
  return false;
}

async function listFiles(directory) {
  if (!(await isDirectory(directory))) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if ([".git", "dist", "node_modules"].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nested.flat();
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
