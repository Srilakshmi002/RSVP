import { useId } from 'react';

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

const SWAG_START = { x: 78, y: 52 };
const SWAG_CONTROL = { x: 400, y: 188 };
const SWAG_END = { x: 722, y: 52 };

function curvePoint(t) {
  const u = 1 - t;
  return {
    x: u * u * SWAG_START.x + 2 * u * t * SWAG_CONTROL.x + t * t * SWAG_END.x,
    y: u * u * SWAG_START.y + 2 * u * t * SWAG_CONTROL.y + t * t * SWAG_END.y,
  };
}

function curveAngle(t) {
  const dx = 2 * (1 - t) * (SWAG_CONTROL.x - SWAG_START.x) + 2 * t * (SWAG_END.x - SWAG_CONTROL.x);
  const dy = 2 * (1 - t) * (SWAG_CONTROL.y - SWAG_START.y) + 2 * t * (SWAG_END.y - SWAG_CONTROL.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function JasmineBud({ x, y, rotate = 0, scale = 1 }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotate.toFixed(1)}) scale(${scale.toFixed(2)})`}>
      <path d="M0 18 C-9 10 -10.4 -2 -5.2 -11.5 C-2.4 -16.2 2.4 -16.2 5.2 -11.5 C10.4 -2 9 10 0 18 Z" fill="#fff6ea" />
      <path d="M0 13 C-5.2 7 -5.8 0.4 -3 -7.2 C-1.3 -10.4 1.3 -10.4 3 -7.2 C5.8 0.4 5.2 7 0 13 Z" fill="#ffffff" />
      <path d="M-1.6 3.2 C-0.4 -5.2 0.4 -5.2 1.6 3.2" fill="none" stroke="#eadcc4" strokeWidth="0.8" />
      <path d="M0 -14.2 C1.8 -10.6 1.2 -8 0 -5.2 C-1.2 -8 -1.8 -10.6 0 -14.2 Z" fill="#f3e7d2" />
      <path d="M-2.4 -12.6 C-5.4 -15 -3.6 -18 -1.2 -16.2 C0.6 -19.2 3.4 -16.6 2.2 -14 C4.8 -15.2 5.2 -12.2 2.6 -11.2 C1.2 -9.6 -1.4 -9.8 -2.4 -12.6 Z" fill="#2a6240" />
    </g>
  );
}

function OpenJasmine({ x, y, rotate = 0, scale = 1 }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotate.toFixed(1)}) scale(${scale.toFixed(2)})`}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <path
          key={deg}
          d="M0 1 C4.2 -2.4 5.4 -8.2 0 -14.6 C-5.4 -8.2 -4.2 -2.4 0 1 Z"
          fill={deg % 90 === 0 ? '#fffdf8' : '#f7efe2'}
          stroke="#eadcc6"
          strokeWidth="0.4"
          transform={`rotate(${deg})`}
        />
      ))}
      <circle r="3.1" fill="#f2d48a" />
      <circle r="1.35" fill="#c8962e" />
    </g>
  );
}

function Rose({ x, y, scale = 1, deep = false }) {
  const outer = deep ? '#7a2433' : '#9a3b4c';
  const inner = deep ? '#541722' : '#6e1e2c';
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})`}>
      <ellipse cx="-10" cy="7" rx="9" ry="3.6" fill="#24573a" transform="rotate(-28)" />
      <ellipse cx="11" cy="6" rx="8.5" ry="3.4" fill="#1e4a30" transform="rotate(26)" />
      {[0, 55, 110, 165, 220, 275].map((deg) => (
        <ellipse key={`outer-${deg}`} cx="0" cy="-11" rx="6.2" ry="10" fill={outer} transform={`rotate(${deg})`} />
      ))}
      {[28, 88, 148, 208, 268, 328].map((deg) => (
        <ellipse key={`inner-${deg}`} cx="0" cy="-6.5" rx="4.1" ry="6.6" fill={inner} transform={`rotate(${deg})`} />
      ))}
      <circle r="3.5" fill="#4a1420" />
      <circle r="1.45" fill="#e2b657" />
    </g>
  );
}

function Leaf({ x, y, rotate = 0, scale = 1 }) {
  return (
    <path
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotate.toFixed(1)}) scale(${scale.toFixed(2)})`}
      d="M0 0 C8 -4 20 -2 26 1 C16 6 7 5.2 0 0 Z"
      fill="#2f6b45"
    />
  );
}

function place(x, y, angle, distance) {
  const rad = ((angle + 90) * Math.PI) / 180;
  return { x: x + Math.cos(rad) * distance, y: y + Math.sin(rad) * distance };
}

function strand(x, lean, buds, roses, leaves) {
  for (let n = 0; n < 5; n += 1) {
    const y = 78 + n * 28;
    buds.push({ x: x + lean * n * 1.4, y, rotate: 96 + lean * 10, scale: 0.78 + (n % 2) * 0.08 });
    buds.push({ x: x + lean * 9, y: y + 8, rotate: 78, scale: 0.7 });
  }
  leaves.push({ x: x + lean * 16, y: 196, rotate: lean * 50, scale: 0.85 });
  roses.push({ x: x + lean * 4, y: 228, scale: 0.95, deep: lean < 0 });
}

export function JasmineGarland({ className }) {
  const shadowId = `garland-shadow-${useId().replace(/:/g, '')}`;
  const steps = 26;
  const buds = [];
  const blossoms = [];
  const roses = [];
  const leaves = [];

  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const point = curvePoint(t);
    const angle = curveAngle(t);
    const wobble = ((i * 13) % 11) - 5;
    [-13, -4, 5, 14].forEach((distance, layer) => {
      const spot = place(point.x, point.y, angle, distance + wobble * 0.25);
      buds.push({
        x: spot.x,
        y: spot.y,
        rotate: angle + 88 + (layer - 1.5) * 18 + wobble,
        scale: 0.82 + (layer % 2) * 0.14 + (i % 3) * 0.04,
      });
    });
    if (i % 6 === 3) {
      blossoms.push({ x: point.x, y: point.y, rotate: wobble, scale: 1.02 });
    }
    if (i % 6 === 0) {
      const roseSpot = place(point.x, point.y, angle, i % 12 === 0 ? -18 : 16);
      roses.push({ x: roseSpot.x, y: roseSpot.y, scale: i % 12 === 0 ? 1.02 : 0.88, deep: i % 12 !== 0 });
      leaves.push({ x: roseSpot.x + 14, y: roseSpot.y + 8, rotate: angle + 24, scale: 0.75 });
    }
  }

  strand(48, -1, buds, roses, leaves);
  strand(752, 1, buds, roses, leaves);

  const bottom = curvePoint(0.5);
  for (let n = 0; n < 4; n += 1) {
    buds.push({ x: bottom.x - 7, y: bottom.y + 22 + n * 26, rotate: -10, scale: 0.82 });
    buds.push({ x: bottom.x + 8, y: bottom.y + 30 + n * 26, rotate: 14, scale: 0.76 });
  }
  roses.push({ x: bottom.x, y: bottom.y + 132, scale: 1.12, deep: true });
  leaves.push({ x: bottom.x - 16, y: bottom.y + 128, rotate: -40, scale: 0.8 });

  return (
    <svg className={className} viewBox="0 0 800 340" aria-hidden="true">
      <defs>
        <filter id={shadowId} x="-12%" y="-12%" width="124%" height="124%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.3" floodColor="#4a1420" floodOpacity="0.28" />
        </filter>
      </defs>
      <g filter={`url(#${shadowId})`}>
        <path d="M78 52 Q400 188 722 52" fill="none" stroke="#1e4a30" strokeWidth="3" strokeLinecap="round" />
        {leaves.map((leaf, index) => <Leaf key={`leaf-${index}`} {...leaf} />)}
        {buds.map((bud, index) => <JasmineBud key={`bud-${index}`} {...bud} />)}
        {blossoms.map((flower, index) => <OpenJasmine key={`bloom-${index}`} {...flower} />)}
        {roses.map((rose, index) => <Rose key={`rose-${index}`} {...rose} />)}
      </g>
    </svg>
  );
}

export function BananaLeaf({ className, flip = false }) {
  return (
    <svg className={className} viewBox="0 0 220 90" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M8 58 C70 8 150 6 212 30 C148 34 86 42 8 58 Z" fill="#2F6B45" />
      <path d="M20 54 C78 28 150 24 198 36" fill="none" stroke="#1E4A30" strokeWidth="1.6" />
      <path d="M28 50 C40 38 36 28 24 24" fill="none" stroke="#1E4A30" strokeWidth="1" />
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
