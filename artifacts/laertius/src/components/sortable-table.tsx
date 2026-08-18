import { useState } from "react";

export type SortDir = "asc" | "desc";
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

/**
 * Column sort state for an accessible table: one active column at a time,
 * clicking the active column flips the direction, clicking a new column
 * starts ascending. `sort === null` keeps the table's natural order.
 */
export function useTableSort<K extends string>() {
  const [sort, setSort] = useState<SortState<K> | null>(null);
  const toggle = (key: K) =>
    setSort((s) =>
      s && s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  return { sort, toggle };
}

export type SortValue = string | number | undefined;

/**
 * Stable sort of rows by the accessor for the active column. Numbers sort
 * numerically, strings with localeCompare; rows whose value is undefined
 * (e.g. "not dated") always sink to the bottom in either direction.
 */
export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K> | null,
  accessors: Record<K, (row: T) => SortValue>,
): T[] {
  if (!sort) return rows;
  const acc = accessors[sort.key];
  const mul = sort.dir === "asc" ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i, v: acc(row) }))
    .sort((a, b) => {
      if (a.v === undefined && b.v === undefined) return a.i - b.i;
      if (a.v === undefined) return 1;
      if (b.v === undefined) return -1;
      let cmp: number;
      if (typeof a.v === "number" && typeof b.v === "number") {
        cmp = a.v - b.v;
      } else {
        cmp = String(a.v).localeCompare(String(b.v));
      }
      return cmp !== 0 ? mul * cmp : a.i - b.i;
    })
    .map((x) => x.row);
}

interface SortableThProps<K extends string> {
  label: string;
  sortKey: K;
  sort: SortState<K> | null;
  onToggle: (key: K) => void;
  className?: string;
  /** Right-align numeric columns. */
  numeric?: boolean;
  testId?: string;
}

/**
 * A <th scope="col"> whose content is a button toggling the column sort,
 * exposing aria-sort on the header cell for screen readers.
 */
export function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  onToggle,
  className,
  numeric,
  testId,
}: SortableThProps<K>) {
  const active = sort?.key === sortKey;
  const ariaSort = active
    ? sort!.dir === "asc"
      ? ("ascending" as const)
      : ("descending" as const)
    : ("none" as const);
  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      <button
        type="button"
        data-testid={testId ?? `sort-${sortKey}`}
        onClick={() => onToggle(sortKey)}
        className={`inline-flex items-center gap-1 font-medium uppercase tracking-wide hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm ${
          numeric ? "justify-end w-full text-right" : "text-left"
        } ${active ? "text-foreground" : ""}`}
      >
        {label}
        <span aria-hidden="true" className="text-[10px] leading-none">
          {active ? (sort!.dir === "asc" ? "\u25B2" : "\u25BC") : "\u25B4\u25BE"}
        </span>
        <span className="sr-only">
          {active
            ? sort!.dir === "asc"
              ? ", sorted ascending, activate to sort descending"
              : ", sorted descending, activate to sort ascending"
            : ", not sorted, activate to sort ascending"}
        </span>
      </button>
    </th>
  );
}
