/** The mark: a square vault door with two keyholes stacked, one filled, one ringed. Two locks. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo">
      <rect x="1.5" y="1.5" width="29" height="29" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <rect x="6" y="6" width="20" height="20" fill="var(--violet)" />
      <circle cx="16" cy="12.6" r="2.6" fill="var(--paper)" />
      <path d="M14.7 14.2h2.6l.9 6h-4.4z" fill="var(--paper)" />
      <rect x="22.5" y="22.5" width="3.5" height="3.5" fill="var(--mint)" />
    </svg>
  );
}
