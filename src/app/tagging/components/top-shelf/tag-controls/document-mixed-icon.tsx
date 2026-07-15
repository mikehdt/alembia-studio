// Custom icon for mixed delete state — Lucide file page with stacked +/- symbols.
// Page art matches lucide-react's FilePlusIcon / FileMinusIcon (folded corner);
// the + (top) and - (bottom) sit inside the page so the mixed state stays readable.
interface DocumentMixedIconProps {
  className?: string;
}

export const DocumentMixedIcon = ({ className }: DocumentMixedIconProps) => (
  <svg
    className={`${className} lucide`}
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* Page outline + folded corner (Lucide file art) */}
    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
    <path d="M14 2v5a1 1 0 0 0 1 1h5" />
    {/* Plus (top half) */}
    <path d="M9 14h6" />
    <path d="M12 11.5v5" />
    {/* Minus (bottom half) */}
    <path d="M9 18.5h6" />
  </svg>
);
