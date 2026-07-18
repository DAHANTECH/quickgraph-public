import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Check,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FilePenLine,
  FileText,
  FileType2,
  LockKeyhole,
  Pencil,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { downloadDetail, executableContent, printDetailAsPdf } from "../features/detail";
import { CatalogContentConflictError } from "../domain";
import type {
  AppCatalogMetadata,
  AppHealth,
  CatalogItem,
  QuickGraphAdapter,
} from "../domain";

interface ItemDrawerProps {
  adapter: QuickGraphAdapter;
  item: CatalogItem | null;
  app?: AppCatalogMetadata | null;
  onClose: () => void;
  onCatalogChanged?: (updatedItem?: CatalogItem) => Promise<void>;
  inQuickAccess?: boolean;
  onToggleQuickAccess?: (item: CatalogItem) => void;
  onCatalogItemRenamed?: (previousItemId: string, nextItemId: string) => void;
}

const MAX_APP_HEALTH_CHECKS = 6;
const APP_HEALTH_CHECK_INTERVAL_MS = 800;
const DEFAULT_DRAWER_WIDTH = 560;
const MIN_DRAWER_WIDTH = 420;
const DRAWER_VIEWPORT_GAP = 24;
const DRAWER_WIDTH_STORAGE_KEY = "quickgraph.drawer.width.v2";
const COPY_FEEDBACK_MS = 1_400;

const ITEM_KIND_LABELS: Record<CatalogItem["kind"], string> = {
  skill: "Fähigkeit",
  prompt: "Arbeitsauftrag",
  mcp: "MCP",
  app: "App",
  workflow: "Arbeitsablauf",
  command: "Befehl",
  rule: "Regel",
};

type CopyStatus = "success" | "error" | null;
type CopyTarget = "header-content" | "invoke" | "body-content";
type DrawerStyle = CSSProperties & { "--drawer-width": string };

interface CopyIconButtonProps {
  onClick: () => void;
  status: CopyStatus;
  title: string;
  successTitle: string;
  errorTitle: string;
}

const PROVENANCE_LABELS: Record<NonNullable<CatalogItem["provenance"]>["classification"], string> = {
  first_party: "Eigener Skill",
  third_party: "Drittanbieter",
  derived: "Abgeleitete Version",
  conflict: "Herkunft muss geprüft werden",
  unknown: "Herkunft noch nicht verifiziert",
};

const PROVENANCE_DETAILS: Record<NonNullable<CatalogItem["provenance"]>["classification"], string> = {
  first_party: "Dieser Eintrag ist als eigener Skill gekennzeichnet.",
  third_party: "Die Herkunft verweist auf einen verifizierten Drittanbieter.",
  derived: "Dieser Eintrag ist aus einem verifizierten Drittanbieterprojekt abgeleitet.",
  conflict: "Die vorliegenden Herkunftshinweise widersprechen sich und werden nicht automatisch aufgelöst.",
  unknown: "Für diesen Eintrag liegt noch keine ausreichende Herkunftsevidenz vor.",
};

function CopyIconButton({ onClick, status, title, successTitle, errorTitle }: CopyIconButtonProps) {
  const label = status === "success" ? successTitle : status === "error" ? errorTitle : title;

  return <button
    className={`icon-button drawer-invoke-button${status ? ` is-${status}` : ""}`}
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    aria-live="polite"
  >
    {status === "success" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    <span className="sr-only">{label}</span>
  </button>;
}

function isSafeExternalLink(value?: string): value is string {
  return Boolean(value?.startsWith("https://"));
}

function itemInitials(name: string): string {
  return name
    .split(/[\s-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ProvenanceIllustration({ item }: { item: CatalogItem }) {
  const [assetFailed, setAssetFailed] = useState(false);
  const illustration = item.illustration;
  const showAsset = Boolean(illustration?.src) && !assetFailed;

  return <figure className="drawer-provenance-illustration">
    {showAsset ? <img
      src={illustration?.src}
      alt={illustration?.alt || item.name}
      onError={() => setAssetFailed(true)}
    /> : <div className="drawer-provenance-fallback" aria-label={`${item.name} neutrale Illustration`}>
      {itemInitials(item.name)}
    </div>}
    {showAsset && illustration?.kind === "site-preview" ? <figcaption>Quellenvorschau</figcaption> : null}
  </figure>;
}

function ProvenanceBlock({ item }: { item: CatalogItem }) {
  const provenance = item.provenance;
  if (!provenance) return null;
  const { classification } = provenance;
  const linksAllowed = classification !== "unknown" && classification !== "conflict";
  const links = linksAllowed ? [
    isSafeExternalLink(provenance.homepage) ? { label: "Projektseite", href: provenance.homepage } : null,
    isSafeExternalLink(provenance.repository) ? { label: "Repository", href: provenance.repository } : null,
  ].filter((link): link is { label: string; href: string } => link !== null) : [];

  return <section className="drawer-provenance" aria-labelledby="drawer-provenance-title">
    <div className="drawer-provenance-header">
      <h3 id="drawer-provenance-title">Herkunft</h3>
      <span className="provenance-badge" data-classification={classification}>{PROVENANCE_LABELS[classification]}</span>
    </div>
    <div className="drawer-provenance-content">
      <ProvenanceIllustration item={item} />
      <dl className="drawer-provenance-meta">
        <div><dt>Anbieter</dt><dd>{provenance.providerLabel ?? (classification === "first_party" ? "QuickGraph" : "Nicht angegeben")}</dd></div>
        <div><dt>Herkunftsklasse</dt><dd>{PROVENANCE_LABELS[classification]}</dd></div>
        <div><dt>Lizenz</dt><dd>{provenance.license ?? "Nicht angegeben"}</dd></div>
      </dl>
    </div>
    <p className="drawer-provenance-detail" data-classification={classification}>{PROVENANCE_DETAILS[classification]}</p>
    {links.length ? <div className="drawer-provenance-links" aria-label="Offizielle Quellen">
      {links.map(({ label, href }) => <a key={href} href={href} target="_blank" rel="noopener noreferrer">
        <ExternalLink aria-hidden="true" />
        <span>{label}</span>
        <span className="sr-only"> (öffnet in neuem Tab)</span>
      </a>)}
    </div> : null}
  </section>;
}

interface DrawerScreenshot {
  src: string;
  label: string;
}

const BRAND_GUIDELINES_SCREENSHOTS: readonly DrawerScreenshot[] = [
  {
    src: "/skill-screenshots/brand-guidelines/prompt-hub-overview.png",
    label: "Prompt-Hub Brand Design: Hero, Tokens und erster Eindruck",
  },
  {
    src: "/skill-screenshots/brand-guidelines/prompt-hub-palette.png",
    label: "Farbpalette und semantische Design-Tokens",
  },
  {
    src: "/skill-screenshots/brand-guidelines/prompt-hub-prompt-card.png",
    label: "Prompt-Card-Komponenten aus dem Referenzdokument",
  },
  {
    src: "/skill-screenshots/brand-guidelines/prompt-hub-app-layout.png",
    label: "App-Layout-Vorschau mit Sidebar und Prompt-Kacheln",
  },
  {
    src: "/skill-screenshots/brand-guidelines/prompt-hub-advanced-navigation.png",
    label: "Header- und Menüsystem aus den erweiterten Sektionen",
  },
  {
    src: "/skill-screenshots/brand-guidelines/prompt-hub-media-gallery.png",
    label: "Media-Assets und Gallery Showcase",
  },
] as const;

const APP_GALLERY_FILES: Readonly<Record<string, readonly { file: string; label: string }[]>> = {
  "aura-network-app": [
    { file: "login", label: "Anmeldung" },
    { file: "dashboard", label: "Dashboard" },
    { file: "community", label: "Community" },
    { file: "academy", label: "Academy" },
    { file: "admin", label: "Administration" },
  ],
  "brunson-hso-app": standardAppGallery("Brunson HSO Copywriter"),
  "datev-arbeitsliste": standardAppGallery("DATEV-Arbeitsliste"),
  "fundament-builder": standardAppGallery("Fundament Builder"),
  "fundament-cockpit": standardAppGallery("Fundament Cockpit"),
  "funnel-generator": standardAppGallery("Funnel-Generator"),
  fynestra: standardAppGallery("FYNESTRA"),
  "kontakte-crm": standardAppGallery("Kontakte CRM"),
  "openmontage-panel": standardAppGallery("OpenMontage Panel"),
  "prompt-generator": standardAppGallery("Prompt-Generator"),
  "quickgraph-katalog": standardAppGallery("QuickGraph Katalog"),
  "video-dashboard": standardAppGallery("Video-Dashboard"),
};

function standardAppGallery(name: string): readonly { file: string; label: string }[] {
  return [
    { file: "overview", label: `${name}: Übersicht` },
    { file: "details", label: `${name}: Details` },
    { file: "workflow", label: `${name}: Workflow` },
  ];
}

function drawerWidthBounds(): { min: number; max: number } {
  const viewportWidth = typeof window === "undefined" ? 1_440 : window.innerWidth;
  const max = Math.max(280, viewportWidth - DRAWER_VIEWPORT_GAP);
  return { min: Math.min(MIN_DRAWER_WIDTH, max), max };
}

function clampDrawerWidth(width: number): number {
  const { min, max } = drawerWidthBounds();
  return Math.min(max, Math.max(min, Math.round(width)));
}

function readDrawerWidth(): number {
  if (typeof window === "undefined") return DEFAULT_DRAWER_WIDTH;
  try {
    const storedWidth = Number.parseInt(window.localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY) ?? "", 10);
    return clampDrawerWidth(Number.isFinite(storedWidth) ? storedWidth : DEFAULT_DRAWER_WIDTH);
  } catch {
    return clampDrawerWidth(DEFAULT_DRAWER_WIDTH);
  }
}

function persistDrawerWidth(width: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(clampDrawerWidth(width)));
  } catch {
    // Resizing remains available when browser storage is blocked.
  }
}

export function ItemDrawer({
  adapter,
  item,
  app,
  onClose,
  onCatalogChanged = async () => {},
  inQuickAccess = false,
  onToggleQuickAccess,
  onCatalogItemRenamed,
}: ItemDrawerProps) {
  const [copyStatuses, setCopyStatuses] = useState<Record<CopyTarget, CopyStatus>>({
    "header-content": null,
    invoke: null,
    "body-content": null,
  });
  const [drawerWidth, setDrawerWidth] = useState(readDrawerWidth);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [launchState, setLaunchState] = useState<string | null>(null);
  const [appHealth, setAppHealth] = useState<AppHealth | null>(null);
  const [isCheckingAppHealth, setIsCheckingAppHealth] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [screenshotIndex, setScreenshotIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [manageMode, setManageMode] = useState<"rename" | null>(null);
  const [newSlug, setNewSlug] = useState("");
  const [manageState, setManageState] = useState<string | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [contentState, setContentState] = useState<string | null>(null);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [conflictItem, setConflictItem] = useState<CatalogItem | null>(null);
  const appOperation = useRef(0);
  const openedItemId = useRef<string | null>(null);
  const lightboxRef = useRef<HTMLElement | null>(null);
  const lightboxCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const lightboxTriggerRef = useRef<HTMLButtonElement | null>(null);
  const copyTimers = useRef<Partial<Record<CopyTarget, number>>>({});
  const resizeSession = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  const checkAppHealth = useCallback(async (announce = false) => {
    if (!item || item.kind !== "app" || !app?.available || !adapter.capabilities.appHealth) return;

    const operation = appOperation.current;
    setIsCheckingAppHealth(true);
    if (announce) setLaunchState("App-Status wird geprüft.");
    try {
      const health = await adapter.getAppHealth(item.key);
      if (appOperation.current !== operation) return;
      setAppHealth(health);
      if (announce) setLaunchState(`App-Status: ${healthLabel(health.status)}.`);
    } catch {
      if (appOperation.current !== operation) return;
      setAppHealth({ id: item.key, status: "unavailable" });
      if (announce) setLaunchState("Die Verfügbarkeit der App konnte nicht geprüft werden.");
    } finally {
      if (appOperation.current === operation) setIsCheckingAppHealth(false);
    }
  }, [adapter, app?.available, item]);

  useEffect(() => {
    const nextItemId = item?.id ?? null;
    if (openedItemId.current === nextItemId) return;
    openedItemId.current = nextItemId;
    appOperation.current += 1;
    document.body.classList.remove("is-resizing-drawer");
    resizeSession.current = null;
    for (const timer of Object.values(copyTimers.current)) {
      if (timer !== undefined) window.clearTimeout(timer);
    }
    copyTimers.current = {};
    setCopyStatuses({ "header-content": null, invoke: null, "body-content": null });
    setExportStatus(null);
    setExportOpen(false);
    setLaunchState(null);
    setAppHealth(null);
    setIsCheckingAppHealth(false);
    setIsLaunching(false);
    setScreenshotIndex(0);
    setLightboxOpen(false);
    setManageMode(null);
    setNewSlug(item?.key ?? "");
    setManageState(null);
    setIsManaging(false);
    setEditMode(false);
    setDraftContent(item?.content ?? "");
    setContentState(null);
    setIsSavingContent(false);
    setConflictItem(null);
  }, [item]);

  useEffect(() => () => {
    appOperation.current += 1;
    document.body.classList.remove("is-resizing-drawer");
    for (const timer of Object.values(copyTimers.current)) {
      if (timer !== undefined) window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const clampToViewport = () => setDrawerWidth((current) => clampDrawerWidth(current));
    window.addEventListener("resize", clampToViewport);
    return () => window.removeEventListener("resize", clampToViewport);
  }, []);

  useEffect(() => {
    if (
      !editMode
      || !item
      || adapter.kind !== "local-api"
      || !item.revision
      || !adapter.capabilities.contentWrite
    ) return;

    const checkExternalRevision = async () => {
      try {
        const current = await adapter.getItem(item.id);
        if (current?.revision && current.revision !== item.revision) {
          setConflictItem(current);
          setContentState("Die Datei wurde außerhalb von QuickGraph geändert. Dein Entwurf bleibt erhalten.");
        }
      } catch {
        // Saving still performs the authoritative revision check.
      }
    };
    const interval = window.setInterval(() => void checkExternalRevision(), 4_000);
    return () => window.clearInterval(interval);
  }, [adapter, editMode, item]);

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (lightboxOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setLightboxOpen(false);
          lightboxTriggerRef.current?.focus();
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          setScreenshotIndex((current) => moveScreenshot(
            current,
            event.key === "ArrowLeft" ? -1 : 1,
            screenshotsFor(item, app).length,
          ));
          return;
        }
        if (event.key === "Tab") trapLightboxFocus(event, lightboxRef.current);
        return;
      }
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [app, item, lightboxOpen, onClose]);

  useEffect(() => {
    if (!item || item.kind !== "app" || !app?.available || !adapter.capabilities.appHealth) return;
    void checkAppHealth();
  }, [adapter.capabilities.appHealth, app?.available, checkAppHealth, item]);

  useEffect(() => {
    if (lightboxOpen) lightboxCloseButtonRef.current?.focus();
  }, [lightboxOpen]);

  if (!item) return null;

  const copyText = async (target: CopyTarget, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showCopyStatus(target, "success");
    } catch {
      showCopyStatus(target, "error");
    }
  };

  const copyContent = (target: Extract<CopyTarget, "header-content" | "body-content">) =>
    copyText(target, executableContent(editMode ? draftContent : item.content));

  const copyInvoke = async () => {
    if (!item.invoke) return;
    await copyText("invoke", item.invoke);
  };

  const showCopyStatus = (target: CopyTarget, status: Exclude<CopyStatus, null>) => {
    const timer = copyTimers.current[target];
    if (timer !== undefined) window.clearTimeout(timer);
    setCopyStatuses((current) => ({ ...current, [target]: status }));
    copyTimers.current[target] = window.setTimeout(() => {
      setCopyStatuses((current) => ({ ...current, [target]: null }));
      delete copyTimers.current[target];
    }, COPY_FEEDBACK_MS);
  };

  const resizeDrawer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = resizeSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    setDrawerWidth(clampDrawerWidth(session.startWidth + session.startX - event.clientX));
  };

  const finishDrawerResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = resizeSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const nextWidth = clampDrawerWidth(session.startWidth + session.startX - event.clientX);
    resizeSession.current = null;
    document.body.classList.remove("is-resizing-drawer");
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDrawerWidth(nextWidth);
    persistDrawerWidth(nextWidth);
  };

  const resizeDrawerWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const { min, max } = drawerWidthBounds();
    let nextWidth: number | null = null;
    if (event.key === "ArrowLeft") nextWidth = drawerWidth + 24;
    if (event.key === "ArrowRight") nextWidth = drawerWidth - 24;
    if (event.key === "Home") nextWidth = min;
    if (event.key === "End") nextWidth = max;
    if (nextWidth === null) return;

    event.preventDefault();
    const clampedWidth = clampDrawerWidth(nextWidth);
    setDrawerWidth(clampedWidth);
    persistDrawerWidth(clampedWidth);
  };

  const exportDetail = (format: "md" | "doc" | "pdf") => {
    const exportItem = editMode ? { ...item, content: draftContent } : item;
    if (format === "pdf") {
      setExportStatus(printDetailAsPdf(exportItem) ? "Druckdialog für PDF geöffnet." : "Popup wurde blockiert.");
    } else {
      downloadDetail(exportItem, format);
      setExportStatus("Datei exportiert.");
    }
    setExportOpen(false);
  };

  const openReadyApp = (health: AppHealth, pendingWindow?: Window | null): boolean => {
    if (health.status !== "ready" || !health.url) return false;
    if (pendingWindow && !pendingWindow.closed) {
      pendingWindow.location.replace(health.url);
      return true;
    }
    return Boolean(window.open(health.url, "_blank", "noopener,noreferrer"));
  };

  const launchApp = async () => {
    if (!app?.available || !app.launchConfigured || !adapter.capabilities.appLaunch || !adapter.capabilities.appHealth || isLaunching) return;

    const pendingWindow = window.open("about:blank", "_blank");
    if (pendingWindow) pendingWindow.opener = null;
    let appWasOpened = false;
    const operation = appOperation.current + 1;
    appOperation.current = operation;
    setIsLaunching(true);
    setAppHealth({ id: item.key, status: "starting" });
    setLaunchState(`App wird gestartet. Verfügbarkeit wird geprüft (1/${MAX_APP_HEALTH_CHECKS}).`);
    try {
      const launchResult = await adapter.launchApp(item.key);
      if (appOperation.current !== operation) return;

      setAppHealth(launchResult);
      if (launchResult.status === "ready" && launchResult.url) {
        setLaunchState("App ist bereit.");
        appWasOpened = openReadyApp(launchResult, pendingWindow);
        return;
      }

      for (let attempt = 1; attempt <= MAX_APP_HEALTH_CHECKS; attempt += 1) {
        if (appOperation.current !== operation) return;

        try {
          const health = await adapter.getAppHealth(item.key);
          if (appOperation.current !== operation) return;

          setAppHealth(health);
          if (health.status === "ready" && health.url) {
            setLaunchState("App ist bereit.");
            appWasOpened = openReadyApp(health, pendingWindow);
            return;
          }
        } catch {
          if (appOperation.current !== operation) return;
          setAppHealth({ id: item.key, status: "unavailable" });
          setLaunchState("Die Verfügbarkeit der App konnte nicht geprüft werden.");
          return;
        }

        if (attempt < MAX_APP_HEALTH_CHECKS) {
          setLaunchState(`App startet. Verfügbarkeit wird geprüft (${attempt + 1}/${MAX_APP_HEALTH_CHECKS}).`);
          await waitForAppHealthCheck();
        }
      }
      if (appOperation.current === operation) {
        setLaunchState("Die App antwortet noch nicht. Bitte später erneut versuchen.");
      }
    } catch (error) {
      if (appOperation.current === operation) {
        const reason = error instanceof Error ? error.message : "Unbekannter Fehler";
        setLaunchState(`Die App konnte nicht gestartet werden: ${reason}`);
      }
    } finally {
      if (!appWasOpened && pendingWindow && !pendingWindow.closed) pendingWindow.close();
      if (appOperation.current === operation) setIsLaunching(false);
    }
  };

  const openApp = () => {
    openReadyApp(appHealth ?? { id: item.key, status: "unavailable" });
  };

  const beginRename = () => {
    setManageMode("rename");
    setNewSlug(item.key);
    setManageState(null);
  };

  const renameSkill = async () => {
    const normalizedSlug = newSlug.trim();
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(normalizedSlug)) {
      setManageState("Der Kurzname muss mit einem Kleinbuchstaben beginnen und darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.");
      return;
    }
    if (normalizedSlug === item.key) {
      setManageMode(null);
      return;
    }
    setIsManaging(true);
    setManageState(null);
    try {
      const result = await adapter.renameCatalogItem(item.id, normalizedSlug);
      onCatalogItemRenamed?.(item.id, result.itemId);
      await onCatalogChanged();
      onClose();
    } catch {
      setManageState("Die Fähigkeit konnte nicht umbenannt werden. Prüfe, ob der Kurzname bereits existiert.");
    } finally {
      setIsManaging(false);
    }
  };

  const copyAppPath = async () => {
    if (!app) return;
    try {
      await navigator.clipboard.writeText(app.pathHint);
      setLaunchState("Pfadhinweis kopiert.");
    } catch {
      setLaunchState("Pfadhinweis konnte nicht kopiert werden.");
    }
  };

  const hasLocalAppMetadata = app?.available === true;
  const hasLaunchConfiguration = hasLocalAppMetadata && app?.launchConfigured === true;
  const canCheckAppHealth = hasLocalAppMetadata && adapter.capabilities.appHealth;
  const canLaunch = hasLaunchConfiguration && adapter.capabilities.appLaunch && adapter.capabilities.appHealth;
  const canOpen = appHealth?.status === "ready" && Boolean(appHealth.url);
  const appStatus = launchState
    ?? (adapter.kind === "browser"
      ? "Im Browser-Profil sind nur App-Metadaten und Referenzen verfügbar. Statusprüfung und lokaler Start benötigen das LocalAPI-Profil."
      : !hasLaunchConfiguration
      ? "Für diese App ist keine lokale Startkonfiguration verfügbar."
      : !adapter.capabilities.appHealth
        ? "Die Verfügbarkeitsprüfung für Apps ist nicht verfügbar."
        : !adapter.capabilities.appLaunch
          ? "Der App-Start ist nicht verfügbar."
          : null);
  const screenshots = screenshotsFor(item, app);
  const screenshot = screenshots[screenshotIndex];
  const canManage = item.kind === "skill" && item.owned === true && adapter.capabilities.catalogManage;
  const canEditContent = item.kind === "skill" || item.kind === "prompt";
  const canPersistContent = Boolean(item.revision)
    && adapter.capabilities.contentWrite
    && (adapter.kind === "local-api" || item.source === "browser-import");
  const contentChanged = draftContent !== item.content;

  const beginContentEdit = () => {
    setDraftContent(item.content);
    setContentState(null);
    setConflictItem(null);
    setEditMode(true);
  };

  const cancelContentEdit = () => {
    setDraftContent(item.content);
    setContentState(null);
    setConflictItem(null);
    setEditMode(false);
  };

  const saveContent = async () => {
    if (!canPersistContent || !item.revision || !contentChanged || isSavingContent) return;
    setIsSavingContent(true);
    setContentState(null);
    try {
      const result = await adapter.updateCatalogItemContent({
        itemId: item.id,
        content: draftContent,
        expectedRevision: item.revision,
      });
      setConflictItem(null);
      await onCatalogChanged(result.item);
      setEditMode(false);
      setContentState(result.backupCreated
        ? "Gespeichert. QuickGraph hat zuvor automatisch ein Backup angelegt."
        : "Im persönlichen Browser-Katalog gespeichert.");
    } catch (error) {
      if (error instanceof CatalogContentConflictError) {
        setConflictItem(error.currentItem);
        setContentState("Die Datei wurde außerhalb von QuickGraph geändert. Dein Entwurf wurde nicht überschrieben.");
      } else {
        setContentState(error instanceof Error ? error.message : "Der Inhalt konnte nicht gespeichert werden.");
      }
    } finally {
      setIsSavingContent(false);
    }
  };

  const loadLatestConflictVersion = async () => {
    if (!conflictItem) return;
    await onCatalogChanged(conflictItem);
    setDraftContent(conflictItem.content);
    setContentState("Der neueste lokale Stand wurde geladen. Du kannst ihn jetzt weiterbearbeiten.");
    setConflictItem(null);
  };

  const exportDraft = () => {
    downloadDetail({ ...item, content: draftContent }, "md");
    setContentState("Markdown exportiert. Ersetze damit die lokale Quelldatei bewusst manuell.");
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    lightboxTriggerRef.current?.focus();
  };

  const openLightbox = (index: number, trigger: HTMLButtonElement) => {
    lightboxTriggerRef.current = trigger;
    setScreenshotIndex(index);
    setLightboxOpen(true);
  };

  const selectPreviousScreenshot = () => setScreenshotIndex((current) => moveScreenshot(current, -1, screenshots.length));
  const selectNextScreenshot = () => setScreenshotIndex((current) => moveScreenshot(current, 1, screenshots.length));

  return (
    <div className="drawer-layer" role="presentation" onMouseDown={onClose}>
      <aside
        className="item-drawer"
        style={{ "--drawer-width": `${drawerWidth}px` } as DrawerStyle}
        data-tour="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className="drawer-resize-handle"
          role="separator"
          aria-label="Breite der Detailansicht ändern"
          aria-orientation="vertical"
          aria-valuemin={drawerWidthBounds().min}
          aria-valuemax={drawerWidthBounds().max}
          aria-valuenow={drawerWidth}
          tabIndex={0}
          title="Ziehen, um die Breite der Detailansicht zu ändern"
          onDoubleClick={() => {
            const defaultWidth = clampDrawerWidth(DEFAULT_DRAWER_WIDTH);
            setDrawerWidth(defaultWidth);
            persistDrawerWidth(defaultWidth);
          }}
          onKeyDown={resizeDrawerWithKeyboard}
          onPointerDown={(event) => {
            event.preventDefault();
            document.body.classList.add("is-resizing-drawer");
            resizeSession.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startWidth: drawerWidth,
            };
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={resizeDrawer}
          onPointerUp={finishDrawerResize}
          onPointerCancel={finishDrawerResize}
        />
        <header className="drawer-head">
          <div>
            <div className="drawer-kicker">{item.group}</div>
            <h2 id="drawer-title">{item.name}</h2>
            <p>{item.category} · {item.key}</p>
          </div>
          <div className="drawer-actions">
            {onToggleQuickAccess ? <button
              className="icon-button"
              type="button"
              aria-pressed={inQuickAccess}
              onClick={() => onToggleQuickAccess(item)}
              title={inQuickAccess ? "Aus Schnellzugriff entfernen" : "Zum Schnellzugriff hinzufügen"}
            >
              {inQuickAccess ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
              <span className="sr-only">
                {inQuickAccess ? `${item.name} aus dem Schnellzugriff entfernen` : `${item.name} zum Schnellzugriff hinzufügen`}
              </span>
            </button> : null}
            <CopyIconButton
              onClick={() => void copyContent("header-content")}
              status={copyStatuses["header-content"]}
              title="Inhalt kopieren"
              successTitle="Inhalt kopiert"
              errorTitle="Inhalt konnte nicht kopiert werden"
            />
            {item.invoke ? <CopyIconButton
              onClick={() => void copyInvoke()}
              status={copyStatuses.invoke}
              title={`Aufruf ${item.invoke} kopieren`}
              successTitle="Aufruf kopiert"
              errorTitle="Aufruf konnte nicht kopiert werden"
            /> : null}
            <div className="drawer-export">
              <button
                aria-expanded={exportOpen}
                aria-haspopup="menu"
                className="icon-button"
                type="button"
                onClick={() => setExportOpen((current) => !current)}
                title="Exportieren"
              >
                <Download aria-hidden="true" />
                <span className="sr-only">Exportieren</span>
              </button>
              {exportOpen ? <div className="drawer-export-menu" role="menu" aria-label="Exportformat wählen">
                <button type="button" role="menuitem" onClick={() => exportDetail("md")}><FileText aria-hidden="true" /> Markdown</button>
                <button type="button" role="menuitem" onClick={() => exportDetail("doc")}><FileType2 aria-hidden="true" /> Word</button>
                <button type="button" role="menuitem" onClick={() => exportDetail("pdf")}><Printer aria-hidden="true" /> PDF</button>
              </div> : null}
            </div>
            {canEditContent ? <button
              className="icon-button"
              type="button"
              onClick={editMode ? cancelContentEdit : beginContentEdit}
              title={editMode ? "Bearbeitung abbrechen" : "Inhalt bearbeiten"}
            >
              {editMode ? <RotateCcw aria-hidden="true" /> : <FilePenLine aria-hidden="true" />}
              <span className="sr-only">{editMode ? "Bearbeitung abbrechen" : "Inhalt bearbeiten"}</span>
            </button> : null}
            {canManage ? <button className="icon-button" type="button" onClick={beginRename} title="Eigene Fähigkeit umbenennen">
              <Pencil aria-hidden="true" />
              <span className="sr-only">Eigene Fähigkeit umbenennen</span>
            </button> : null}
            <button className="icon-button" type="button" onClick={onClose} title="Detailansicht schließen">
              <X aria-hidden="true" />
              <span className="sr-only">Detailansicht schließen</span>
            </button>
          </div>
        </header>

        <div className="drawer-body">
          <p className="drawer-description">{item.description}</p>
          {item.invoke ? <button
            className={`drawer-invoke${copyStatuses.invoke ? ` is-${copyStatuses.invoke}` : ""}`}
            type="button"
            onClick={() => void copyInvoke()}
            title={`${item.invoke} kopieren`}
            aria-label={`${item.invoke} kopieren`}
            aria-live="polite"
          >
            <code>{item.invoke}</code>
            {copyStatuses.invoke === "success" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            <span className="sr-only">{copyStatuses.invoke === "success" ? "Aufruf kopiert" : copyStatuses.invoke === "error" ? "Aufruf konnte nicht kopiert werden" : `${item.invoke} kopieren`}</span>
          </button> : null}
          {exportStatus ? <p className="sr-only" role="status">{exportStatus}</p> : null}
          <ProvenanceBlock item={item} />

          {manageMode === "rename" ? <section className="drawer-manage-panel" aria-labelledby="rename-skill-title">
            <h3 id="rename-skill-title">Fähigkeit umbenennen</h3>
            <p>Der Ordner und der aufrufbare Kurzname werden gemeinsam geändert.</p>
            <label>
              <span>Neuer Kurzname</span>
              <input value={newSlug} onChange={(event) => setNewSlug(event.target.value)} autoComplete="off" spellCheck={false} />
            </label>
            <div className="drawer-manage-actions">
              <button className="secondary-button" type="button" onClick={() => setManageMode(null)} disabled={isManaging}>Abbrechen</button>
              <button className="primary-button" type="button" onClick={() => void renameSkill()} disabled={isManaging}>{isManaging ? "Wird umbenannt" : "Umbenennen"}</button>
            </div>
          </section> : null}

          {manageState ? <p className="action-state" role="status">{manageState}</p> : null}

          {item.kind === "app" ? (
            <div className="drawer-app-action">
              {app ? <>
                <dl className="drawer-app-meta">
                  <div><dt>Typ</dt><dd>{app.type}</dd></div><div><dt>Status</dt><dd>{appHealth ? healthLabel(appHealth.status) : app.status}</dd></div>
                  <div><dt>Technikgrundlage</dt><dd>{app.stack}</dd></div><div><dt>Geändert</dt><dd>{new Date(app.updatedAt).toLocaleDateString("de-DE")}</dd></div>
                </dl>
                {hasLocalAppMetadata ? <div className="drawer-app-buttons">
                  {canCheckAppHealth ? <button className="secondary-button" type="button" disabled={isCheckingAppHealth || isLaunching} onClick={() => void checkAppHealth(true)}>
                    <RefreshCw aria-hidden="true" /> {isCheckingAppHealth ? "Status wird geprüft" : "Status prüfen"}
                  </button> : null}
                  <button className="secondary-button" type="button" disabled={!canOpen} onClick={openApp}><ExternalLink aria-hidden="true" /> Öffnen</button>
                  <button className="secondary-button" type="button" onClick={() => void copyAppPath()}><Copy aria-hidden="true" /> Pfad kopieren</button>
                </div> : <p className="drawer-app-browser-note">
                  Galerie und Metadaten sind öffentlich verfügbar. Statusprüfung und lokaler Start benötigen das LocalAPI-Profil.
                </p>}
              </> : <div className="drawer-app-import-note">
                <strong>App-Metadaten importiert</strong>
                <p>QuickGraph hat ausschließlich die ausgewählte package.json gelesen. Ein Startbefehl oder Ordnerzugriff wurde nicht übernommen.</p>
                <dl className="drawer-app-meta">
                  <div><dt>Kategorie</dt><dd>{item.category}</dd></div>
                  <div><dt>Technikgrundlage</dt><dd>{item.tags.join(", ") || "JavaScript"}</dd></div>
                </dl>
              </div>}
              <button
                className="primary-button"
                type="button"
                disabled={!canLaunch || isLaunching}
                onClick={launchApp}
              >
                {canLaunch ? (
                  <ExternalLink aria-hidden="true" />
                ) : (
                  <LockKeyhole aria-hidden="true" />
                )}
                {isLaunching ? "App wird gestartet" : canLaunch ? "App starten" : "App-Start nicht verfügbar"}
              </button>
              {appStatus ? <p className="action-state" role="status">{appStatus}</p> : null}
            </div>
          ) : null}

          {screenshot ? (
            <section className="skill-gallery" aria-labelledby="skill-gallery-title">
              <div className="skill-gallery-heading">
                <h3 id="skill-gallery-title">Referenzen</h3>
                <span aria-live="polite">{screenshotIndex + 1} von {screenshots.length}</span>
              </div>
              <div className="skill-gallery-preview">
                <button
                  className="skill-gallery-image-button"
                  type="button"
                  title="Screenshot vergrößern"
                  aria-label={`${screenshot.label} vergrößern`}
                  onClick={(event) => openLightbox(screenshotIndex, event.currentTarget)}
                >
                  <img className="skill-gallery-preview-image" src={screenshot.src} alt={screenshot.label} />
                </button>
                <div className="skill-gallery-controls" aria-label="Screenshot-Navigation">
                  <button className="icon-button" type="button" title="Vorheriger Screenshot" onClick={selectPreviousScreenshot}>
                    <ChevronLeft aria-hidden="true" />
                    <span className="sr-only">Vorheriger Screenshot</span>
                  </button>
                  <p>{screenshot.label}</p>
                  <button className="icon-button" type="button" title="Nächster Screenshot" onClick={selectNextScreenshot}>
                    <ChevronRight aria-hidden="true" />
                    <span className="sr-only">Nächster Screenshot</span>
                  </button>
                </div>
              </div>
              <div className="skill-gallery-thumbnails" aria-label="Screenshot auswählen">
                {screenshots.map((entry, index) => (
                  <button
                    className="skill-gallery-thumbnail"
                    type="button"
                    key={entry.src}
                    aria-current={index === screenshotIndex ? "true" : undefined}
                    aria-label={`Screenshot ${index + 1}: ${entry.label}`}
                    onClick={() => setScreenshotIndex(index)}
                  >
                    <img src={entry.src} alt="" />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="content-meta">
            <span>{ITEM_KIND_LABELS[item.kind]}</span>
            <span>{item.origin}</span>
            <span>{new Date(item.updatedAt).toLocaleDateString("de-DE")}</span>
          </div>
          {editMode ? <section className="drawer-content-editor" aria-labelledby="content-editor-title">
            <div className="drawer-content-editor-head">
              <div>
                <h3 id="content-editor-title">{item.kind === "prompt" ? "Arbeitsauftrag bearbeiten" : "Fähigkeit bearbeiten"}</h3>
                <p>{canPersistContent
                  ? adapter.kind === "local-api"
                    ? "Speichert revisionssicher in der lokalen Quelldatei und legt vorher ein Backup an."
                    : "Speichert in deinem persönlichen Browser-Katalog."
                  : "Der Browser darf öffentliche Quelldateien nicht direkt überschreiben. Exportiere deinen Entwurf als Markdown."}</p>
              </div>
              <span>{draftContent.length.toLocaleString("de-DE")} Zeichen</span>
            </div>
            {conflictItem ? <div className="drawer-content-conflict" role="alert">
              <strong>Neuere lokale Version erkannt</strong>
              <p>QuickGraph überschreibt sie nicht. Dein aktueller Entwurf bleibt im Editor erhalten.</p>
              <button className="secondary-button" type="button" onClick={() => void loadLatestConflictVersion()}>
                <RotateCcw aria-hidden="true" /> Neuesten Stand laden
              </button>
            </div> : null}
            <textarea
              className="drawer-content-input"
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              spellCheck={false}
              aria-label={`${item.name} Inhalt`}
            />
            <div className="drawer-content-editor-actions">
              <button className="secondary-button" type="button" onClick={cancelContentEdit} disabled={isSavingContent}>Abbrechen</button>
              {canPersistContent ? <button
                className="primary-button"
                type="button"
                onClick={() => void saveContent()}
                disabled={!contentChanged || !item.revision || isSavingContent || Boolean(conflictItem)}
              >
                <Save aria-hidden="true" /> {isSavingContent ? "Wird gespeichert" : "Speichern"}
              </button> : <button className="primary-button" type="button" onClick={exportDraft}>
                <Download aria-hidden="true" /> Markdown exportieren
              </button>}
            </div>
          </section> : <>
            {item.kind === "skill" ? <div className="drawer-content-editor-actions">
              <CopyIconButton
                onClick={() => void copyContent("body-content")}
                status={copyStatuses["body-content"]}
                title="Vollständigen Skilltext kopieren"
                successTitle="Vollständiger Skilltext kopiert"
                errorTitle="Vollständiger Skilltext konnte nicht kopiert werden"
              />
            </div> : null}
            <pre className="drawer-content">{executableContent(item.content)}</pre>
          </>}
          {contentState ? <p className="action-state drawer-content-state" role="status">{contentState}</p> : null}
        </div>
      </aside>
      {lightboxOpen && screenshot ? (
        <div
          className="screenshot-lightbox-layer"
          role="presentation"
          onMouseDown={(event) => {
            event.stopPropagation();
            if (event.target === event.currentTarget) closeLightbox();
          }}
        >
          <section
            className="screenshot-lightbox"
            ref={lightboxRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="screenshot-lightbox-title"
          >
            <header className="screenshot-lightbox-head">
              <div>
                <h3 id="screenshot-lightbox-title">{item.name}</h3>
                <p>{screenshotIndex + 1} von {screenshots.length}</p>
              </div>
              <button
                className="icon-button"
                type="button"
                ref={lightboxCloseButtonRef}
                title="Vorschau schließen"
                onClick={closeLightbox}
              >
                <X aria-hidden="true" />
                <span className="sr-only">Vorschau schließen</span>
              </button>
            </header>
            <div className="screenshot-lightbox-body">
              <div className="screenshot-lightbox-viewer">
                <button className="icon-button" type="button" title="Vorheriger Screenshot" onClick={selectPreviousScreenshot}>
                  <ChevronLeft aria-hidden="true" />
                  <span className="sr-only">Vorheriger Screenshot</span>
                </button>
                <figure>
                  <img src={screenshot.src} alt={screenshot.label} />
                  <figcaption>{screenshot.label}</figcaption>
                </figure>
                <button className="icon-button" type="button" title="Nächster Screenshot" onClick={selectNextScreenshot}>
                  <ChevronRight aria-hidden="true" />
                  <span className="sr-only">Nächster Screenshot</span>
                </button>
              </div>
              <div className="screenshot-lightbox-thumbnails" aria-label="Screenshot auswählen">
                {screenshots.map((entry, index) => (
                  <button
                    className="screenshot-lightbox-thumbnail"
                    type="button"
                    key={entry.src}
                    aria-current={index === screenshotIndex ? "true" : undefined}
                    aria-label={`Screenshot ${index + 1}: ${entry.label}`}
                    onClick={() => setScreenshotIndex(index)}
                  >
                    <img src={entry.src} alt="" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function appScreenshotUrl(reference: string): string {
  return reference.startsWith("/") ? reference : `/${reference.replace(/^assets\//, "")}`;
}

function healthLabel(status: AppHealth["status"]): string {
  if (status === "ready") return "Bereit";
  if (status === "starting") return "Wird gestartet";
  if (status === "stopped") return "Nicht gestartet";
  return "Nicht erreichbar";
}

function waitForAppHealthCheck(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, APP_HEALTH_CHECK_INTERVAL_MS));
}

function screenshotsFor(item: CatalogItem, app?: AppCatalogMetadata | null): readonly DrawerScreenshot[] {
  if (item.kind === "app" && app) {
    const gallery = APP_GALLERY_FILES[app.id];
    if (gallery) {
      return gallery.map(({ file, label }) => ({
        src: `/app-screenshots/${app.id}/${file}.png`,
        label,
      }));
    }
    return app.screenshot ? [{ src: appScreenshotUrl(app.screenshot), label: app.screenshotLabel }] : [];
  }

  return item.kind === "skill" && item.key === "brand-guidelines" ? BRAND_GUIDELINES_SCREENSHOTS : [];
}

function moveScreenshot(current: number, delta: -1 | 1, total: number): number {
  if (total <= 1) return 0;
  return (current + delta + total) % total;
}

function trapLightboxFocus(event: KeyboardEvent, lightbox: HTMLElement | null): void {
  const focusable = lightbox?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
  if (!focusable?.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
