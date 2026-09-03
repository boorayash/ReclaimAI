import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render?: (row: T) => ReactNode;
}

// Thin table shell: hairline row dividers, right-aligned numerics via column
// config. Every table in the app renders identically.
export function Table<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'No rows.',
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2 font-medium text-slate ${c.align === 'right' ? 'text-right' : ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-hairline ${onRowClick ? 'cursor-pointer hover:bg-hairline' : ''}`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}
                >
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
