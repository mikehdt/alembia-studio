import {
  type SampleColumn,
  type SampleRow,
  type SamplesGridModel,
  sampleUrl,
} from '../training-detail-tabs/samples-model';

type SamplesGridProps = {
  grid: SamplesGridModel;
  onOpen: (rowKey: string, colIndex: number, trigger: HTMLElement) => void;
};

/**
 * The samples grid: prompt columns across the top, sampling events down the
 * side (newest first). Scrolls horizontally on narrow viewports rather than
 * crushing the columns. Thumbnails are the served images scaled by CSS — no
 * thumbnail generation.
 */
export function SamplesGrid({ grid, onOpen }: SamplesGridProps) {
  const { columns, rows } = grid;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-2">
        <thead>
          <tr>
            {/* Corner cell above the row-stamp column. */}
            <th className="w-20" />
            {columns.map((column) => (
              <ColumnHeader key={column.index} column={column} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <GridRow
              key={row.key}
              row={row}
              columns={columns}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ColumnHeader({ column }: { column: SampleColumn }) {
  return (
    <th className="min-w-40 max-w-56 text-left align-bottom">
      <span
        title={column.label}
        className="block truncate text-sm font-medium text-slate-600 dark:text-slate-300"
      >
        {column.label}
      </span>
    </th>
  );
}

function GridRow({
  row,
  columns,
  onOpen,
}: {
  row: SampleRow;
  columns: SampleColumn[];
  onOpen: (rowKey: string, colIndex: number, trigger: HTMLElement) => void;
}) {
  return (
    <tr>
      <th className="align-middle text-right text-sm font-medium whitespace-nowrap text-slate-500">
        {row.label}
      </th>
      {columns.map((column) => {
        const sample = row.cells[column.index];
        return (
          <td key={column.index} className="align-middle">
            {sample ? (
              <button
                type="button"
                onClick={(e) => onOpen(row.key, column.index, e.currentTarget)}
                title={`${row.label} · ${column.label}`}
                aria-label={`Open sample for ${column.label} at ${row.label}`}
                className="block w-full cursor-pointer overflow-hidden rounded border border-slate-300 bg-slate-100 transition-colors hover:border-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-600 dark:bg-slate-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local sample served straight off disk; the optimiser adds nothing and no thumbnail generation is wanted */}
                <img
                  src={sampleUrl(sample.path)}
                  alt={`${column.label} — ${row.label}`}
                  loading="lazy"
                  className="h-28 w-full object-contain"
                />
              </button>
            ) : (
              <div className="flex h-28 w-full items-center justify-center rounded border border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-700">
                —
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}
