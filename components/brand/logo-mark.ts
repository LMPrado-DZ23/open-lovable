/**
 * Open Lovable mark: a faceted (low-poly) heart in an orange → red → purple
 * gradient with an interlaced monogram in the centre. Shared by the React
 * logo and the favicon (app/icon.svg) so both stay identical.
 */
const facets: Array<[string, number]> = [
  // [points, shade] — positive shade lightens the facet, negative darkens it.
  ['8,31 19,13 30,30', 0.22], ['19,13 35,8 30,30', 0.14], ['35,8 50,22 30,30', 0.04],
  ['50,22 65,8 70,30', 0.04], ['65,8 81,13 70,30', 0.14], ['81,13 92,31 70,30', 0.22],
  ['8,31 30,30 11,49', 0.06], ['92,31 70,30 89,49', 0.06],
  ['30,30 50,22 50,42', -0.04], ['50,22 70,30 50,42', -0.08],
  ['11,49 30,30 31,66', -0.06], ['89,49 70,30 69,66', -0.1],
  ['11,49 31,66 50,94', -0.12], ['89,49 69,66 50,94', -0.18],
  ['31,66 50,42 50,94', 0.02], ['69,66 50,42 50,94', -0.06],
];

export function logoMarkSVG(id = 'ol'): string {
  const shades = facets.map(([points, shade]) => `<polygon points="${points}" fill="${shade >= 0 ? '#fff' : '#2a0a3a'}" fill-opacity="${Math.abs(shade)}" stroke="#b8401b" stroke-opacity=".45" stroke-width="1.1" stroke-linejoin="round"/>`).join('');
  return `<defs><linearGradient id="${id}-g" x1="50" y1="6" x2="50" y2="94" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffb23e"/><stop offset=".45" stop-color="#f4583a"/><stop offset=".75" stop-color="#d63d6a"/><stop offset="1" stop-color="#7a3cf0"/></linearGradient></defs>`
    + `<path d="M8 31 19 13 35 8 50 22 65 8 81 13 92 31 89 49 50 94 11 49Z" fill="url(#${id}-g)"/>`
    + shades
    // Interlaced monogram: an "M" woven with two crossing strokes.
    + `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M36 68V38l14 15 14-15v30M40 74l20-24M60 74 40 50" stroke="#7c1f12" stroke-opacity=".55" stroke-width="7"/><path d="M36 68V38l14 15 14-15v30M40 74l20-24M60 74 40 50" stroke="#ff7a3d" stroke-width="3.6"/></g>`;
}

export function logoMarkDocument(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${logoMarkSVG('icon')}</svg>`;
}
