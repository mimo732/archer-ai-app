// Generates ARCHER AI PWA icons (192 / 512 / 512-maskable / apple-touch 180)
// from an inline SVG (JARVIS-style: dark HUD, cyan orbital rings, gold core, "A").
const sharp = require("sharp");
const path = require("path");

const W = 1024; // render big, downscale for crispness

function svg({ inset = 0 }) {
  const cx = W / 2;
  const cy = W / 2;
  const r1 = 330 - inset; // main ring
  const r2 = 386 - inset; // outer faint ring
  const r3 = 268 - inset; // gold inner ring
  const core = 200 - inset; // core circle
  const apex = cy - 210 + inset * 0.6;
  const base = cy + 210 - inset * 0.6;
  const leg = 175 - inset * 0.5;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${W}" viewBox="0 0 ${W} ${W}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="78%">
      <stop offset="0%" stop-color="#0b2416"/>
      <stop offset="55%" stop-color="#051008"/>
      <stop offset="100%" stop-color="#030603"/>
    </radialGradient>
    <linearGradient id="core" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#fbbf24"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${W}" rx="${inset > 0 ? 0 : 0}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${r2}" fill="none" stroke="#22d3ee" stroke-opacity="0.25" stroke-width="7"/>
  <circle cx="${cx}" cy="${cy}" r="${r1}" fill="none" stroke="#22d3ee" stroke-opacity="0.9" stroke-width="18"/>
  <circle cx="${cx}" cy="${cy}" r="${r3}" fill="none" stroke="#fbbf24" stroke-opacity="0.4" stroke-width="6"/>
  <circle cx="${cx}" cy="${cy}" r="${core}" fill="url(#core)" fill-opacity="0.18"/>
  <circle cx="${cx}" cy="${cy}" r="${core}" fill="none" stroke="url(#core)" stroke-width="10" stroke-opacity="0.85"/>
  <g stroke="#ecfeff" stroke-opacity="0.96" stroke-width="${Math.round(W * 0.052)}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M ${cx} ${apex} L ${cx - leg} ${base}"/>
    <path d="M ${cx} ${apex} L ${cx + leg} ${base}"/>
    <path d="M ${cx - Math.round(leg * 0.62)} ${cy + 60} L ${cx + Math.round(leg * 0.62)} ${cy + 60}"/>
  </g>
  <g fill="#67e8f9">
    <circle cx="${cx + r1 * 0.71}" cy="${cy - r1 * 0.71}" r="14" fill-opacity="0.9"/>
    <circle cx="${cx - r1 * 0.94}" cy="${cy - r1 * 0.34}" r="10" fill-opacity="0.7"/>
    <circle cx="${cx + r1 * 0.2}" cy="${cy + r1 * 0.99}" r="12" fill-opacity="0.8"/>
    <circle cx="${cx - r1 * 0.5}" cy="${cy + r1 * 0.87}" r="8" fill-opacity="0.6"/>
  </g>
</svg>`;
}

(async () => {
  const out = "/home/z/my-project/public";
  const base = svg({ inset: 0 });
  const mask = svg({ inset: 110 }); // keep content inside the safe zone for circular masks

  await sharp(Buffer.from(base)).resize(512, 512).png().toFile(path.join(out, "icon-512.png"));
  await sharp(Buffer.from(base)).resize(192, 192).png().toFile(path.join(out, "icon-192.png"));
  await sharp(Buffer.from(base)).resize(180, 180).png().toFile(path.join(out, "apple-touch-icon.png"));
  await sharp(Buffer.from(mask)).resize(512, 512).png().toFile(path.join(out, "icon-512-maskable.png"));
  console.log("icons written:", ["icon-192.png", "icon-512.png", "apple-touch-icon.png", "icon-512-maskable.png"].join(", "));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
