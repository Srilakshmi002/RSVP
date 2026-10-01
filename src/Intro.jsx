import { useCallback, useEffect, useRef, useState } from 'react';
import { coupleNames, wedding as w } from './config';
import { BrassLamp, JasmineGarland, Kolam } from './decor';

export default function Intro({ onClose }) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const onCloseRef = useRef(onClose);
  const skipRef = useRef(null);
  const closed = useRef(false);
  onCloseRef.current = onClose;

  const requestClose = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    setLeaving(true);
    window.setTimeout(() => onCloseRef.current(), 480);
  }, []);

  useEffect(() => {
    skipRef.current?.focus();
    const delays = [800, 1700, 2900, 4100, 5600];
    const ids = delays.map((delay, index) => window.setTimeout(() => {
      if (closed.current) return;
      if (index === delays.length - 1) requestClose();
      else setStep(index + 1);
    }, delay));
    const onKey = (event) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      ids.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
    };
  }, [requestClose]);

  const className = [
    'opening',
    leaving ? 'is-leaving' : '',
    step >= 1 ? 'show-groom' : '',
    step >= 2 ? 'show-bride' : '',
    step >= 3 ? 'show-names' : '',
    step >= 4 ? 'show-date' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={className} role="dialog" aria-modal="true" aria-label={`Welcome to the wedding of ${coupleNames()}`}>
      <button ref={skipRef} type="button" className="skip-intro" onClick={requestClose}>Skip intro</button>
      <BrassLamp className="opening-lamp left" />
      <BrassLamp className="opening-lamp right" />
      <div className="opening-card">
        <Kolam className="opening-kolam" />
        <JasmineGarland className="opening-garland" />
        <div className="opening-portraits">
          <figure className="portrait-frame groom-portrait">
            <img src={w.groomImage} width="600" height="800" alt={`${w.groomFirst} ${w.groomLast}, groom`} />
          </figure>
          <figure className="portrait-frame bride-portrait">
            <img src={w.brideImage} width="600" height="800" alt={`${w.brideFirst} ${w.brideLast}, bride`} />
          </figure>
        </div>
        <p className="opening-kicker">Together with our families</p>
        <p className="opening-names"><span>{w.groomFirst}</span> <em>&</em> <span>{w.brideFirst}</span></p>
        <p className="opening-date">{w.date}<br />{w.venue}</p>
      </div>
    </div>
  );
}
