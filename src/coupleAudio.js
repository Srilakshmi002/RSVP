import { wedding as w } from './config';

const claims = new Set();
let audio;
let pauseTimer = 0;

function track() {
  if (!audio) {
    audio = new Audio(w.coupleAudio);
    audio.loop = true;
    audio.preload = 'auto';
    audio.controls = false;
    audio.muted = false;
    audio.volume = 1;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('aria-hidden', 'true');
    audio.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none';
    audio.addEventListener('ended', () => {
      if (claims.size === 0) return;
      audio.currentTime = 0;
      const attempt = audio.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
    });
  }
  if (!audio.isConnected && document.body) document.body.appendChild(audio);
  return audio;
}

function start() {
  const element = track();
  if (!element.paused) return;
  const attempt = element.play();
  if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
}

export function setCoupleAudioClaim(id, on) {
  if (on) claims.add(id);
  else claims.delete(id);
  if (claims.size > 0) {
    window.clearTimeout(pauseTimer);
    pauseTimer = 0;
    start();
    return;
  }
  if (pauseTimer) return;
  pauseTimer = window.setTimeout(() => {
    pauseTimer = 0;
    if (claims.size === 0 && audio && !audio.paused) audio.pause();
  }, 300);
}

function resumeFromGesture() {
  if (claims.size === 0) return;
  start();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', resumeFromGesture, true);
  window.addEventListener('keydown', resumeFromGesture, true);
}
