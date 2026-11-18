/** The mark: a block (hexagon) inside a second ring, a keyhole at the centre. Two rings, two locks. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--safe)" />
        </linearGradient>
      </defs>
      <path d="M16 1.8 28.3 8.9v14.2L16 30.2 3.7 23.1V8.9z" fill="none" stroke="url(#logo-g)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 7.6 23.3 11.8v8.4L16 24.4 8.7 20.2v-8.4z" fill="rgba(76,125,255,0.14)" stroke="var(--safe)" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="16" cy="14.6" r="2.3" fill="var(--text)" />
      <path d="M14.9 15.8h2.2l.7 4.2h-3.6z" fill="var(--text)" />
    </svg>
  );
}
