export function SilkBorder({ className }) {
  return <div className={['silk-border', className].filter(Boolean).join(' ')} aria-hidden="true" />;
}

export function Kolam({ className }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="60" cy="60" r="8" />
        <circle cx="60" cy="60" r="22" />
        <circle cx="60" cy="60" r="36" />
        <path d="M60 16c16 8 26 22 26 44s-10 36-26 44c-16-8-26-22-26-44S44 24 60 16z" />
      </g>
      <g fill="currentColor">
        {[
          [60, 28], [60, 92], [28, 60], [92, 60],
          [39, 39], [81, 39], [39, 81], [81, 81],
        ].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.1" />)}
      </g>
    </svg>
  );
}

export function BrassLamp({ className }) {
  return (
    <svg className={className} viewBox="0 0 80 150" aria-hidden="true">
      <ellipse className="flame" cx="40" cy="18" rx="7" ry="12" fill="#F2C14E" />
      <path d="M30 34h20l5 8H25z" fill="#C8962E" />
      <path d="M20 44h40l5 8H15z" fill="#E2B657" />
      <path d="M18 54h44l-4 8H22z" fill="#C8962E" />
      <rect x="36" y="62" width="8" height="34" rx="2" fill="#B8892E" />
      <path d="M16 100h48l8 14H8z" fill="#C8962E" />
      <rect x="14" y="116" width="52" height="8" rx="2" fill="#E2B657" />
      <rect x="22" y="126" width="36" height="8" rx="2" fill="#A97828" />
    </svg>
  );
}
