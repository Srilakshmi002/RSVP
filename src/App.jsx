import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Heart, MapPin, Menu, X } from 'lucide-react';
import { RECEPTION_MEAL_OPTIONS } from '../shared/meals.js';
import { coupleNames, venueMapsUrl, wedding as w } from './config';
import CoupleFilm from './CoupleFilm';
import { BrassLamp, Kolam, SilkBorder } from './decor';
import Intro from './Intro';

function MapsLink() {
  return (
    <a className="maps-link" href={venueMapsUrl()} target="_blank" rel="noopener noreferrer">
      View on Google Maps <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  );
}

function MealPicker({ name, legend, value, onChange, options }) {
  return (
    <fieldset className="meal-picker">
      <legend>{legend} <b>*</b></legend>
      <div className="meal-options">
        {options.map((meal) => (
          <label key={meal} className={value === meal ? 'selected' : ''}>
            <input type="radio" name={name} value={meal} checked={value === meal} onChange={() => onChange(meal)} required />
            {meal}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RsvpForm({ event }) {
  const reception = event === 'reception';
  const title = reception ? 'Reception RSVP' : 'Wedding RSVP';
  const [attendance, setAttendance] = useState('yes');
  const [additionalGuests, setAdditionalGuests] = useState(0);
  const [primaryMeal, setPrimaryMeal] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const sending = useRef(false);
  const successRef = useRef(null);
  const errorRef = useRef(null);

  useEffect(() => {
    if (status === 'done') successRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(formEvent) {
    formEvent.preventDefault();
    if (sending.current) return;
    const attending = attendance === 'yes';
    if (reception && attending && !RECEPTION_MEAL_OPTIONS.includes(primaryMeal)) {
      setError('Please choose your meal preference.');
      setStatus('idle');
      return;
    }
    sending.current = true;
    setStatus('sending');
    setError('');
    const payload = {
      name: fullName.trim(),
      email: email.trim(),
      event,
      attendance,
      meal: reception && attending ? primaryMeal : '',
      additionalGuests: attending ? additionalGuests : 0,
      dietary: '',
      message: note.trim(),
    };
    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let body = null;
      try { body = await response.json(); } catch { body = null; }
      if (body?.preview || (!body && import.meta.env.DEV)) {
        setResult({ preview: true, saved: false, notified: false, attendance });
        setStatus('done');
        return;
      }
      if (!response.ok || body?.saved !== true) {
        throw new Error(body?.error || 'Your response could not be saved. Please try again.');
      }
      setResult({ preview: false, saved: true, notified: body.notified === true, attendance });
      setStatus('done');
    } catch (err) {
      if (import.meta.env.DEV && err instanceof TypeError) {
        setResult({ preview: true, saved: false, notified: false, attendance });
        setStatus('done');
        return;
      }
      setError(err.message || 'Please check your connection and try again.');
      setStatus('idle');
    } finally {
      sending.current = false;
    }
  }

  const totalAttending = 1 + additionalGuests;
  const eventName = reception ? 'reception' : 'wedding';
  const confirmation = result?.attendance === 'yes'
    ? `We’ll see you at the ${eventName}.`
    : 'You’ll be there in spirit.';

  return (
    <div className="form-card">
      <Kolam className="card-kolam" />
      {status === 'done' ? (
        <div className="success" role="status">
          <span className="success-icon"><Check aria-hidden="true" /></span>
          <p className="eyebrow">{result.preview ? 'Preview only' : title}</p>
          <h3 ref={successRef} tabIndex={-1}>
            {result.preview ? 'This response was not saved.' : confirmation}
          </h3>
          <p>
            {result.preview
              ? 'This is a preview. Your response has not been saved, and no email was sent.'
              : result.attendance === 'yes'
                ? `Thank you for celebrating with us. We’ve saved your ${eventName} response and can’t wait to see you.`
                : `Thank you for letting us know. We’ve saved your ${eventName} response.`}
          </p>
          {result.saved && result.notified && <p>The couple has been notified.</p>}
          <button className="button" type="button" onClick={() => { setStatus('idle'); setResult(null); }}>Back to the form <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      ) : (
        <form onSubmit={submit} aria-busy={status === 'sending'}>
          <div className="form-heading"><h3>{title}</h3><span>{coupleNames()}</span></div>
          <label>Your full name <b>*</b>
            <input name="name" autoComplete="name" placeholder="First and last name" maxLength={120} required value={fullName} onChange={(formEvent) => setFullName(formEvent.target.value)} />
          </label>
          <label>Email address <b>*</b>
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required value={email} onChange={(formEvent) => setEmail(formEvent.target.value)} />
          </label>
          <fieldset>
            <legend>Will you be attending? <b>*</b></legend>
            <div className="attendance">
              {[['yes', 'Joyfully accept'], ['no', 'Regretfully decline']].map(([value, text]) => (
                <label className={attendance === value ? 'selected' : ''} key={value}>
                  <input type="radio" name={`attendance-${event}`} value={value} checked={attendance === value} onChange={() => setAttendance(value)} />
                  {text}
                </label>
              ))}
            </div>
          </fieldset>
          {attendance === 'yes' && (
            <>
              <div className="stepper" role="group" aria-labelledby={`${event}-guest-count-label`}>
                <p id={`${event}-guest-count-label`}>Additional guests coming with you</p>
                <div className="stepper-controls">
                  <button type="button" aria-label="Decrease additional guests" disabled={additionalGuests <= 0} onClick={() => setAdditionalGuests((value) => Math.max(0, value - 1))}>−</button>
                  <span className="stepper-value">{additionalGuests}<span className="visually-hidden"> additional guests</span></span>
                  <button type="button" aria-label="Increase additional guests" onClick={() => setAdditionalGuests((value) => value + 1)}>+</button>
                </div>
              </div>
              <p className="stepper-total" aria-live="polite">Total attending: {totalAttending}</p>
              {reception ? (
                <MealPicker name={`meal-${event}`} legend="Your meal preference" value={primaryMeal} onChange={setPrimaryMeal} options={RECEPTION_MEAL_OPTIONS} />
              ) : (
                <p className="meal-note">A vegetarian meal will be served at the wedding.</p>
              )}
            </>
          )}
          <label>A note for the couple <span className="optional">(optional)</span>
            <textarea name="message" rows="3" maxLength={2000} placeholder="Share a wish, a memory, or a song request" value={note} onChange={(formEvent) => setNote(formEvent.target.value)} />
          </label>
          {error && <p className="error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
          <p className="visually-hidden" aria-live="polite">{status === 'sending' ? 'Sending your response' : ''}</p>
          <button className="button submit" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending your response…' : 'Send my RSVP'}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
          <p className="form-foot"><Heart size={12} aria-hidden="true" /> With happy hearts, we look forward to celebrating.</p>
        </form>
      )}
    </div>
  );
}

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [menu, setMenu] = useState(false);
  const headingRef = useRef(null);
  const introWasOpen = useRef(true);

  useEffect(() => {
    document.title = `${coupleNames('full')} — Our Wedding`;
  }, []);

  useEffect(() => {
    if (!showIntro) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [showIntro]);

  useEffect(() => {
    if (introWasOpen.current && !showIntro) headingRef.current?.focus({ preventScroll: true });
  }, [showIntro]);

  useEffect(() => {
    if (showIntro || window.location.hash !== '#celebration') return undefined;
    const section = document.getElementById('celebration');
    if (!section) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    return undefined;
  }, [showIntro]);

  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  function goToEvents(event) {
    setMenu(false);
    const section = document.getElementById('celebration');
    if (!section) return;
    event.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (window.location.hash !== '#celebration') history.pushState(null, '', '#celebration');
    section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <>
      {showIntro && <Intro onClose={() => setShowIntro(false)} />}
      <div className="site" inert={showIntro ? true : undefined}>
        <a className="skip-link" href="#rsvp">Skip to RSVP</a>
        <header>
          <SilkBorder />
          <div className="header-bar">
          <a className="monogram" href="#home" aria-label={`${coupleNames('full')}, back to top`}>
            {w.groomFirst[0]}<span>&</span>{w.brideFirst[0]}
          </a>
          <button className="menu-toggle" type="button" onClick={() => setMenu((open) => !open)} aria-label="Toggle navigation" aria-expanded={menu} aria-controls="site-nav">
            {menu ? <X /> : <Menu />}
          </button>
          <nav id="site-nav" className={menu ? 'open' : ''}>
            {[['The celebration', '#celebration'], ['The details', '#details']].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a>
            ))}
            <a className="nav-rsvp" href="/#celebration" onClick={goToEvents}>Kindly RSVP <ArrowUpRight size={15} aria-hidden="true" /></a>
          </nav>
          </div>
        </header>
        <main>
          <section className="hero" id="home">
            <div className="hero-copy">
              <p className="eyebrow"><span />Together with our families</p>
              <h1 ref={headingRef} tabIndex={-1}>
                <span className="person">{w.groomFirst} <span className="surname">{w.groomLast}</span></span>
                <em>&</em>
                <span className="person">{w.brideFirst} <span className="surname">{w.brideLast}</span></span>
              </h1>
              <p className="hero-sub">We would be honoured to celebrate our wedding with you.</p>
              <a className="button" href="/#celebration" onClick={goToEvents}>Join our celebration <ArrowUpRight size={17} aria-hidden="true" /></a>
              <div className="hero-date"><span>{w.shortDate}</span><i />{w.venue}</div>
            </div>
            <div className="hero-art">
              <div className="couple-film hero-film">
                <CoupleFilm active={!showIntro} />
              </div>
            </div>
          </section>

          <section className="intro" id="celebration">
            <Kolam className="section-kolam" />
            <p className="eyebrow">We’re getting married</p>
            <h2>It wouldn’t be the same <em>without you.</em></h2>
            <p>From the first hello to this next chapter, our story has been filled with love. We can’t wait to celebrate it with you.</p>
            <div className="event-actions">
              <a className="button" href="#rsvp">Wedding</a>
              <a className="button" href="#reception">Reception</a>
            </div>
            <div className="event-facts">
              <div><span>Attire</span><h3>Festive & traditional</h3><p>{w.attire}</p></div>
            </div>
          </section>

          <section className="rsvp-section" id="rsvp">
            <div className="rsvp-garland-row">
              <img className="garland-tree left" src="/images/banana-tree-left.png" width="785" height="1007" alt="" aria-hidden="true" />
              <img className="rsvp-garland" src="/images/floral-garland.png" width="1195" height="505" alt="" aria-hidden="true" />
              <img className="garland-tree right" src="/images/banana-tree-right.png" width="805" height="1075" alt="" aria-hidden="true" />
              <p className="sumuhurtham">Sumuhurtham October 14, 2026, 7:57AM</p>
            </div>
            <div className="rsvp-copy">
              <p className="eyebrow">A seat saved for you</p>
              <h2>Will you <em>be joining us?</em></h2>
              <p>Kindly reply by <strong>{w.deadline}</strong>. We would love to know you are coming.</p>
              <div className="note">
                <BrassLamp className="note-lamp" />
                <p>Whether near or far, you are part of our story. Thank you for being part of our lives.</p>
              </div>
              <div className="signature">With love,<br />{coupleNames('full')}</div>
            </div>
            <div className="form-wrap">
              <RsvpForm event="wedding" />
            </div>
          </section>

          <section className="rsvp-section reception-section" id="reception">
            <div className="form-wrap">
              <RsvpForm event="reception" />
            </div>
          </section>

          <section className="details" id="details">
            <p className="eyebrow">The day itself</p>
            <h2>A little look at <em>the celebration.</em></h2>
            <div className="timeline">
              {w.schedule.map((item) => (
                <article key={`${item.time}-${item.title}`}>
                  <BrassLamp className="timeline-lamp" />
                  <p className="eyebrow">{item.time}</p>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
            <div className="venue-block">
              <p className="venue-line"><MapPin size={16} aria-hidden="true" /> <span><strong>{w.venue}</strong> · {w.address}</span></p>
              <MapsLink />
            </div>
          </section>
        </main>
        <footer>
          <span className="footer-names">{coupleNames('full')}</span>
          <p>{w.shortDate} <span>·</span> {w.venue}<span className="footer-address">{w.address}</span></p>
          <span className="footer-love">Made with love <Heart size={13} aria-hidden="true" /></span>
        </footer>
      </div>
    </>
  );
}
