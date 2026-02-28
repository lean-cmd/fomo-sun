// This script takes raw scenic stamp artwork and overlays consistent typography
// Run: node scripts/stamp-typography.mjs

import sharp from 'sharp';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, basename, extname } from 'path';

const STAMPS_DIR = './public/stamps';
const RAW_DIR = './public/stamps/raw';

if (!existsSync(RAW_DIR)) {
    mkdirSync(RAW_DIR, { recursive: true });
    console.log(`Created ${RAW_DIR}. Drop raw Nano Banana images here.`);
}

// For each raw image, composite the text overlay
async function addTypography(inputPath, outputPath, { name, region }) {
    const textSvg = `
    <svg width="400" height="400">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&amp;family=Jost:wght@300&amp;display=swap');
        </style>
      </defs>
      <!-- Destination name -->
      <text x="200" y="325" text-anchor="middle" 
            font-family="Bebas Neue, sans-serif" font-size="42" 
            fill="rgba(31, 41, 55, 0.9)" 
            letter-spacing="3">${name.toUpperCase()}</text>
      <!-- Region subtitle -->
      <text x="200" y="355" text-anchor="middle"
            font-family="Jost, sans-serif" font-size="14" font-weight="300"
            fill="rgba(71, 85, 105, 0.85)" letter-spacing="2">· ${region.toUpperCase()} ·</text>
    </svg>`;

    await sharp(inputPath)
        .resize(400, 400)
        .composite([{ input: Buffer.from(textSvg), top: 0, left: 0 }])
        .jpeg({ quality: 82 })
        .toFile(outputPath);

    console.log(`Processed: ${outputPath}`);
}

async function main() {
    const files = readdirSync(RAW_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f));

    if (files.length === 0) {
        console.log('No raw images found in public/stamps/raw/');
        return;
    }

    // Note: For a real batch, we'd need a mapping of filename -> {name, region}
    // For now, we assume filename is slug-vintage.extension and we'll need manual mapping 
    // or a more sophisticated script if running in huge batches.
    console.log(`Found ${files.length} files. Please ensure you have a mapping logic.`);
}

// export for use in other scripts
export { addTypography };

if (process.argv[1].endsWith('stamp-typography.mjs')) {
    main().catch(console.error);
}
