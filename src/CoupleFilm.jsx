import { wedding as w } from './config';

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function CoupleFilm() {
  return (
    <img
      src={w.coupleImage}
      width="1374"
      height="1145"
      alt={`${w.groomFirst} and ${w.brideFirst} in traditional wedding attire`}
    />
  );
}
