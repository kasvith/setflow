import sharp from 'sharp';
import { mkdir } from 'fs/promises';

const sizes = [16, 48, 128];

// Create a gradient icon
async function generateIcon(size) {
  // Create SVG with gradient
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#E91E63"/>
          <stop offset="100%" style="stop-color:#9C27B0"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size * 0.28}" fill="white" opacity="0.95"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size * 0.15}" fill="url(#grad)"/>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(`public/icon${size}.png`);

  console.log(`Created icon${size}.png`);
}

await mkdir('public', { recursive: true });

for (const size of sizes) {
  await generateIcon(size);
}

console.log('All icons generated!');
