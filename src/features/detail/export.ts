export const DETAIL_EXPORT_FORMATS = ["md", "doc", "pdf"] as const;

export type DetailExportFormat = (typeof DETAIL_EXPORT_FORMATS)[number];

export interface ExportableDetail {
  name: string;
  key?: string;
  category?: string;
  content: string;
  invoke?: string;
}

export function exportFilename(item: ExportableDetail, format: Exclude<DetailExportFormat, "pdf">): string {
  const extension = format === "md" ? "md" : "doc";
  const basename = (item.name || item.key || "quickgraph-item")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9äöüß_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "quickgraph-item";
  return `${basename}.${extension}`;
}

export function buildExportDocument(item: ExportableDetail): string {
  const title = escapeHtml(item.name);
  const category = escapeHtml(item.category ?? "QuickGraph");
  const invoke = item.invoke ? `<p><strong>Aufruf:</strong> ${escapeHtml(item.invoke)}</p>` : "";
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { color: #171717; font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; }
    main { max-width: 760px; margin: 0 auto; }
    h1 { font-size: 28px; line-height: 1.2; margin: 0 0 8px; }
    .meta { color: #5b5b63; font-size: 13px; }
    pre { overflow-wrap: anywhere; padding: 16px; border: 1px solid #d9d9df; background: #f7f7f8; font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <div class="meta"><p><strong>Kategorie:</strong> ${category}</p>${invoke}</div>
    <hr>
    <pre>${escapeHtml(item.content)}</pre>
  </main>
</body>
</html>`;
}

export function downloadDetail(item: ExportableDetail, format: Exclude<DetailExportFormat, "pdf">): void {
  const content = format === "md" ? item.content : buildExportDocument(item);
  const type = format === "md" ? "text/markdown;charset=utf-8" : "application/msword;charset=utf-8";
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = exportFilename(item, format);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function printDetailAsPdf(item: ExportableDetail): boolean {
  const printWindow = window.open("", "_blank", "popup");
  if (!printWindow) return false;
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(buildExportDocument(item));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 150);
  return true;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
