import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";

export interface CompactListColumn<SortKey extends string> {
  key: SortKey;
  label: string;
  sortable?: boolean;
}

interface CompactListHeaderProps<SortKey extends string> {
  activeSort: SortKey;
  className?: string;
  columns: readonly CompactListColumn<SortKey>[];
  direction: SortDirection;
  leadingSpacer?: boolean;
  onSort: (key: SortKey) => void;
}

export function CompactListHeader<SortKey extends string>({
  activeSort,
  className = "",
  columns,
  direction,
  leadingSpacer = false,
  onSort,
}: CompactListHeaderProps<SortKey>) {
  return <div className={`compact-list-header ${className}`.trim()} role="row">
    {leadingSpacer ? <span className="compact-list-header-spacer" aria-hidden="true" /> : null}
    {columns.map((column) => {
      const active = column.key === activeSort;
      const sortable = column.sortable !== false;
      return <span
        aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
        className="compact-list-column"
        data-column={column.key}
        key={column.key}
        role="columnheader"
      >
        {sortable ? <button type="button" onClick={() => onSort(column.key)}>
          <span>{column.label}</span>
          {active
            ? direction === "asc" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />
            : <ChevronsUpDown aria-hidden="true" />}
        </button> : <span>{column.label}</span>}
      </span>;
    })}
  </div>;
}
