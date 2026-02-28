import { readFileSync, writeFileSync } from 'fs';

const POI_FILE = './data/poi/swiss-poi-seed.csv';
const OUTPUT_FILE = './scripts/stamp-prompts.txt';

const TIERS = {
    TIER1: ['Zermatt', 'Lucerne', 'Interlaken', 'Grindelwald', 'Montreux', 'Lugano', 'Davos', 'Verbier', 'Engelberg', 'Wengen', 'Mürren', 'Lauterbrunnen', 'Kandersteg', 'Zug', 'Rapperswil', 'Thun', 'Brienz', 'Ascona', 'Locarno', 'Chur'],
};

function getSceneType(poi) {
    const types = poi.types ? poi.types.toLowerCase() : '';
    const alt = parseInt(poi.altitude) || 0;

    if (types.includes('mountain') || alt > 1500) return 'mountain/nature';
    if (types.includes('lake')) return 'lake';
    if (types.includes('town') || types.includes('city')) return 'town';
    if (types.includes('thermal') || types.includes('spa')) return 'thermal';
    if (types.includes('viewpoint')) return 'viewpoint';
    return 'family';
}

function generatePrompt(poi) {
    const name = poi.name;
    const region = poi.region || 'Switzerland';
    const sceneType = getSceneType(poi);

    let sceneDesc = '';
    switch (sceneType) {
        case 'mountain/nature': sceneDesc = 'Layered alpine ridges, snow-capped peaks, meadow foreground, sky gradient with sun disk'; break;
        case 'lake': sceneDesc = 'Mountain backdrop with lake shoreline band, water reflections, small sailboat or pier'; break;
        case 'town': sceneDesc = 'Clustered rooflines with church spire, historic architecture silhouette, rolling hills behind'; break;
        case 'thermal': sceneDesc = 'Rising steam wisps, alpine backdrop, warm earthy tones'; break;
        case 'viewpoint': sceneDesc = 'Panoramic mountain vista, observation point foreground, dramatic depth layers'; break;
        default: sceneDesc = 'Gentle landscape, walking path, friendly alpine scene';
    }

    return `Vintage Swiss tourism poster stamp for ${name}, ${region}.
Style: 1930s Swiss lithograph travel poster. Warm aged paper background with subtle print grain texture.

Scene composition: ${sceneDesc}

Color palette: Limited to 3-4 colors. Deep blue or slate for mountains, golden amber for sun/warmth, cream white for sky/paper, forest green for meadows, charcoal for silhouettes. Red accent sparingly (Swiss cross, rooftops).

Typography: NONE. (Just the scenic poster art + frame).

Frame: Subtle dashed perforated stamp border. Slight aged/worn edges.

Dimensions: Square, 400x400px. No watermarks. No modern elements. Must read clearly at 80x80px thumbnail size.`;
}

async function main() {
    const content = readFileSync(POI_FILE, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const header = lines[0].split(',');
    const records = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        header.forEach((key, i) => {
            obj[key.trim()] = values[i] ? values[i].trim() : '';
        });
        return obj;
    });

    let output = '';

    // Tier 1
    output += '=== TIER 1 - HERO DESTINATIONS ===\n\n';
    TIERS.TIER1.forEach(heroName => {
        const poi = records.find(r => r.name && r.name.toLowerCase() === heroName.toLowerCase());
        if (poi) {
            output += `--- ${poi.name} ---\n${generatePrompt(poi)}\n\n`;
        }
    });

    // Tiers 2 & 3
    output += '=== TIER 2 & 3 - OTHER DESTINATIONS ===\n\n';
    records.forEach(poi => {
        if (!TIERS.TIER1.some(h => h.toLowerCase() === (poi.name || '').toLowerCase())) {
            output += `--- ${poi.name} ---\n${generatePrompt(poi)}\n\n`;
        }
    });

    writeFileSync(OUTPUT_FILE, output);
    console.log(`Prompts generated in ${OUTPUT_FILE}`);
}

main().catch(console.error);
