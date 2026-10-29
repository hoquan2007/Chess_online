/** Original rook + R monogram, designed to stay legible at favicon size. */
export function RooklineMark({ size = 38 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label="Rookline logo">
    <rect x="1" y="1" width="46" height="46" rx="12" fill="#193C33" stroke="#B5A477" strokeWidth="1.5" />
    <path d="M13 12h5v5h5v-5h5v5h5v-5h3v11l-4 4v9H16v-9l-3-4V12Z" fill="#F4E8C8" />
    <path d="M20 21h7.5c3.5 0 5.5 2 5.5 5 0 2.6-1.8 4-4.4 4.4L33 36h-5.5l-4.2-6H24v6h-4V21Zm4 4v2h3.5c1.2 0 1.7-.4 1.7-1s-.5-1-1.7-1H24Z" fill="#193C33" />
    <path d="M15 39h19" stroke="#C7AE73" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}
