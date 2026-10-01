/**
 * Personalize the invitation here. The site shows names as "Groom & Bride".
 * Replace the portrait files in public/images, or change the image paths below.
 * Muhurtham is the ceremony time, shown in the venue's local time (Aubrey, Texas).
 */
const muhurtham = '7:57 AM';
export const wedding = {
  groomFirst: 'Pradeep',
  groomLast: 'Ajjampudi',
  brideFirst: 'Anusha',
  brideLast: 'Mandava',

  // Couple photographs. Replace these files, or point these at your own images in public/.
  groomImage: '/images/groom.jpg',
  brideImage: '/images/bride.jpg',
  introPoster: '/images/couple-poster.jpg',
  introVideo: '/video/intro.mp4',
  coupleAudio: '/audio/kudmayi.m4a',

  date: 'Wednesday, October 14, 2026',
  shortDate: '10.14.2026',
  deadline: 'October 7, 2026',
  venue: 'The Milestone Mansion Aubrey',
  address: '1301 W Sherman Dr, Aubrey, TX 76227',
  location: 'Aubrey, TX',
  contactEmail: 'hello@example.com',

  // Ceremony time, and the time zone used on notification emails. Both are Central Time for Aubrey, Texas.
  muhurtham,
  timezone: 'America/Chicago',

  attire: 'Festive and traditional attire is welcome. Silks, jewel tones, and comfortable shoes are a lovely choice.',

  schedule: [
    {
      time: muhurtham,
      title: 'Muhurtham',
      detail: 'Please join us as we begin the day together.',
    },
  ],
};

export function venueMapsUrl() {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${wedding.venue}, ${wedding.address}`)}`;
}

export function coupleNames(style = 'short') {
  if (style === 'full') {
    return `${wedding.groomFirst} ${wedding.groomLast} & ${wedding.brideFirst} ${wedding.brideLast}`;
  }
  return `${wedding.groomFirst} & ${wedding.brideFirst}`;
}
