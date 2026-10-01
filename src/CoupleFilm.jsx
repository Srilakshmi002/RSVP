import { useEffect, useId, useRef, useState } from 'react';
import { wedding as w } from './config';
import { setCoupleAudioClaim } from './coupleAudio';

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function CoupleFilm({ active = true }) {
  const reduceMotion = useState(prefersReducedMotion)[0];
  const videoRef = useRef(null);
  const [useStill, setUseStill] = useState(reduceMotion);
  const claimId = useId();

  useEffect(() => {
    const video = videoRef.current;
    if (!video || useStill) return undefined;
    if (!active) {
      video.pause();
      return undefined;
    }
    let cancelled = false;
    video.muted = true;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        if (!cancelled) setUseStill(true);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [useStill, active]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || useStill || !active) {
      setCoupleAudioClaim(claimId, false);
      return undefined;
    }
    const rect = video.getBoundingClientRect();
    let inView = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    const sync = () => {
      const running = !video.paused && !video.ended;
      setCoupleAudioClaim(claimId, inView && running);
    };
    const observer = new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      sync();
    });
    observer.observe(video);
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    video.addEventListener('ended', sync);
    sync();
    return () => {
      observer.disconnect();
      video.removeEventListener('play', sync);
      video.removeEventListener('pause', sync);
      video.removeEventListener('ended', sync);
      setCoupleAudioClaim(claimId, false);
    };
  }, [useStill, active, claimId]);

  if (useStill) {
    return (
      <img
        src={w.introPoster}
        width="1280"
        height="720"
        alt={`${w.groomFirst} and ${w.brideFirst} in traditional wedding attire`}
      />
    );
  }

  return (
    <video
      ref={(node) => {
        videoRef.current = node;
        if (node) node.muted = true;
      }}
      className="couple-video"
      autoPlay
      muted
      loop
      playsInline
      controls={false}
      poster={w.introPoster}
      preload="auto"
      width="1280"
      height="720"
      disablePictureInPicture
      aria-hidden="true"
      onError={() => setUseStill(true)}
    >
      <source src={w.introVideo} type="video/mp4" />
    </video>
  );
}
