/** Open Lovable mark: a heart built from a speech bubble — "describe it and it gets built". */
export default function OpenLovableLogo({size = 28, withWordmark = true}: {size?: number; withWordmark?: boolean}) {
  return <span className="inline-flex items-center gap-[10px]">
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ol-mark" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff7a45"/>
          <stop offset="0.55" stopColor="#f0457d"/>
          <stop offset="1" stopColor="#7b5cff"/>
        </linearGradient>
      </defs>
      <path d="M16 28.5 5.2 18.4A7.1 7.1 0 0 1 16 8.6a7.1 7.1 0 0 1 10.8 9.8Z" fill="url(#ol-mark)"/>
      <circle cx="11.5" cy="15.2" r="1.5" fill="#fff"/>
      <circle cx="16" cy="15.2" r="1.5" fill="#fff"/>
      <circle cx="20.5" cy="15.2" r="1.5" fill="#fff"/>
    </svg>
    {withWordmark && <span className="text-[17px] font-semibold tracking-tight text-[#1c1b22]">Open Lovable</span>}
  </span>;
}
