import type { ReactNode } from "react";
import { Bookmark, ChevronDown, ChevronRight } from "lucide-react";

/** Ein ein-/ausklappbarer Sidebar-Abschnitt. Expand-Zustand und Toggle werden von der App-Shell bestimmt. */
export function SidebarSection({
  id,
  label,
  count,
  icon,
  children,
  hasActiveChild = false,
  onActivate,
  expanded,
  onToggle,
}: {
  id: string;
  label: string;
  count: number;
  icon: ReactNode | null;
  children: ReactNode;
  hasActiveChild?: boolean;
  onActivate?: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasChildren = children !== null;
  const nested = id.startsWith("area:") || id.startsWith("view:") || id.startsWith("branch:");
  const className = ["sidebar-section", nested ? "sidebar-section-nested" : "", hasActiveChild ? "has-active-child" : ""]
    .filter(Boolean)
    .join(" ");
  const labelContent = <span className="nav-label">{icon}<span className="nav-text">{label}</span></span>;
  const metaContent = <span className="sidebar-section-meta"><small>{count}</small>{expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</span>;
  return <section className={className}>
    {onActivate && !hasChildren ? <button className="sidebar-section-head sidebar-section-direct" type="button" onClick={onActivate} title={label} aria-current={hasActiveChild ? "page" : undefined}>
      {labelContent}<span className="sidebar-section-meta"><small>{count}</small></span>
    </button> : onActivate ? <div className="sidebar-section-head">
      <button className="sidebar-section-activate" type="button" onClick={onActivate} title={label}>
        {labelContent}
      </button>
      <button
        className="sidebar-section-toggle"
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${label} ${expanded ? "schließen" : "öffnen"}`}
        title={`${label} ${expanded ? "schließen" : "öffnen"}`}
      >
        {metaContent}
      </button>
    </div> : <button
      className="sidebar-section-head"
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      title={`${label} ${expanded ? "schließen" : "öffnen"}`}
    >
      {labelContent}
      {metaContent}
    </button>}
    {hasChildren && expanded ? <div className="sidebar-section-children">{children}</div> : null}
  </section>;
}

/** Ein einzelner, mit Lesezeichen versehbarer Navigationseintrag in der Sidebar. */
export function NavigationOption({
  quickAccessId,
  label,
  active,
  onClick,
  count,
  icon,
  quickAccessIds,
  onToggle,
}: {
  quickAccessId: string;
  label: string;
  active: boolean;
  onClick: () => void;
  count?: ReactNode;
  icon?: ReactNode;
  quickAccessIds: ReadonlySet<string>;
  onToggle: (quickAccessId: string) => void;
}) {
  return <BookmarkableSidebarRow
    label={label}
    quickAccessId={quickAccessId}
    quickAccessIds={quickAccessIds}
    onToggle={onToggle}
  >
    <button className={active ? "sidebar-area-child active" : "sidebar-area-child"} type="button" onClick={onClick} title={label}>
      <span className="sidebar-child-label">{icon}{label}</span>{count !== undefined ? <small>{count}</small> : null}
    </button>
  </BookmarkableSidebarRow>;
}

/** Ein Icon-Button der kompakten Sidebar-Rail. */
export function CollapsedNavButton({
  id,
  label,
  icon,
  active,
  onSelect,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  onSelect: () => void;
}) {
  return <button
    aria-label={label}
    className={active ? "sidebar-rail-button active" : "sidebar-rail-button"}
    data-nav-id={id}
    onClick={onSelect}
    title={label}
    type="button"
  >
    {icon}
  </button>;
}

interface BookmarkableSidebarRowProps {
  children: ReactNode;
  label: string;
  quickAccessId: string;
  quickAccessIds: ReadonlySet<string>;
  onToggle: (quickAccessId: string) => void;
}

function BookmarkableSidebarRow({ children, label, quickAccessId, quickAccessIds, onToggle }: BookmarkableSidebarRowProps) {
  return <div className="sidebar-bookmarkable-row">
    {children}
    <SidebarBookmarkButton
      label={label}
      quickAccessId={quickAccessId}
      quickAccessIds={quickAccessIds}
      onToggle={onToggle}
    />
  </div>;
}

function SidebarBookmarkButton({ label, quickAccessId, quickAccessIds, onToggle }: Omit<BookmarkableSidebarRowProps, "children">) {
  const bookmarked = quickAccessIds.has(quickAccessId);
  return <button
    className={bookmarked ? "sidebar-nav-bookmark active" : "sidebar-nav-bookmark"}
    type="button"
    aria-label={bookmarked ? `Aus Lesezeichen entfernen: ${label}` : `Zu Lesezeichen hinzufügen: ${label}`}
    aria-pressed={bookmarked}
    title={bookmarked ? "Aus Lesezeichen entfernen" : "Zu Lesezeichen hinzufügen"}
    onClick={() => onToggle(quickAccessId)}
  >
    <Bookmark aria-hidden="true" />
  </button>;
}
