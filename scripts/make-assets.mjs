// make-assets.mjs - regenerates every image the site needs, from code:
//   assets/icons/favicon.svg, favicon.ico, apple-touch-icon.png, PWA icons (any + maskable),
//   preview.png (the link-preview / social card) and the install-dialog screenshots.
//
//   npm run assets               (everything)
//   npm run assets icons         (just the icons)
//   npm run assets screenshots   (just preview.png + the screenshots)
//
// Needs `chromium` on your PATH (it renders the icons and plays the real game for the screenshots).
// Three.js comes from the CDN; no internet? THREE_JS=/path/to/three.min.js npm run assets
// If `optipng` is installed the PNGs are squeezed a little.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from '../tests/helpers/static-server.mjs';
import { CdpClient } from '../tests/helpers/cdp-client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function save(file, data) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
    if (file.endsWith('.png')) spawnSync('optipng', ['-quiet', '-o3', target], { stdio: 'ignore' }); // fine if it's not installed
    console.log(`  ${file}  (${(fs.statSync(target).size / 1024).toFixed(1)} KB)`);
}

// ---- the bunny icon: one drawing, used for every icon -----------------------------------------

const BUNNY = `
  <ellipse cx="190" cy="152" rx="44" ry="112" fill="#fff" transform="rotate(-11 190 152)"/>
  <ellipse cx="190" cy="158" rx="22" ry="84" fill="#FFB3D1" transform="rotate(-11 190 152)"/>
  <ellipse cx="322" cy="152" rx="44" ry="112" fill="#fff" transform="rotate(11 322 152)"/>
  <ellipse cx="322" cy="158" rx="22" ry="84" fill="#FFB3D1" transform="rotate(11 322 152)"/>
  <ellipse cx="256" cy="322" rx="150" ry="134" fill="#fff"/>
  <circle cx="166" cy="352" r="27" fill="#FFB3D1" opacity=".85"/>
  <circle cx="346" cy="352" r="27" fill="#FFB3D1" opacity=".85"/>
  <circle cx="204" cy="306" r="20" fill="#3A2347"/>
  <circle cx="197" cy="298" r="7" fill="#fff"/>
  <circle cx="308" cy="306" r="20" fill="#3A2347"/>
  <circle cx="301" cy="298" r="7" fill="#fff"/>
  <path d="M238 338 q18-14 36 0 q-18 22-36 0z" fill="#FF4F9A"/>
  <path d="M256 354 v14 M256 368 q-14 14-30 4 M256 368 q14 14 30 4" stroke="#B5487F" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

// rounded: rounded-square icon (favicon, "any" icons). Not rounded = full-bleed square, which the
// OS crops itself (maskable + apple-touch-icon); `scale` keeps the bunny inside that safe zone.
function bunnySvg({ rounded = true, scale = 1 } = {}) {
    const shift = 256 * (1 - scale);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF7BB8"/><stop offset="1" stop-color="#B993FF"/></linearGradient></defs>
  <rect width="512" height="512"${rounded ? ' rx="112"' : ''} fill="url(#bg)"/>
  <g transform="translate(${shift} ${shift}) scale(${scale})">${BUNNY}
  </g>
</svg>
`;
}

// a .ico is a small header plus PNGs
function buildIco(pngs) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(1, 2);            // type: icon
    header.writeUInt16LE(pngs.length, 4);
    let offset = 6 + 16 * pngs.length;
    const entries = pngs.map(({ size, data }) => {
        const entry = Buffer.alloc(16);
        entry.writeUInt8(size, 0);         // width
        entry.writeUInt8(size, 1);         // height
        entry.writeUInt16LE(1, 4);         // colour planes
        entry.writeUInt16LE(32, 6);        // bits per pixel
        entry.writeUInt32LE(data.length, 8);
        entry.writeUInt32LE(offset, 12);
        offset += data.length;
        return entry;
    });
    return Buffer.concat([header, ...entries, ...pngs.map(p => p.data)]);
}

async function makeIcons() {
    console.log('Icons');
    const browser = new CdpClient({ port: 9361 });
    await browser.launch('about:blank');
    try {
        await browser.transparentBackground();
        const render = async (svg, size) => {
            await browser.setViewport(size, size);
            const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;
            await browser.goto('data:text/html;charset=utf-8,' + encodeURIComponent(html));
            await browser.waitFor(`document.readyState === 'complete'`);
            return browser.screenshot();
        };

        save('assets/icons/favicon.svg', bunnySvg());
        const icon192 = await render(bunnySvg(), 192);
        const icon512 = await render(bunnySvg(), 512);
        save('assets/icons/icon-192.png', icon192);
        save('assets/icons/icon-512.png', icon512);
        save('assets/icons/icon-maskable-512.png', await render(bunnySvg({ rounded: false, scale: 0.68 }), 512));
        save('assets/icons/apple-touch-icon.png', await render(bunnySvg({ rounded: false, scale: 0.86 }), 180));
        const frames = [];
        for (const size of [16, 32, 48]) frames.push({ size, data: await render(bunnySvg(), size) }); // one at a time: they share the page
        save('favicon.ico', buildIco(frames));
    } finally {
        await browser.close();
    }
}

// ---- screenshots of the real game -------------------------------------------------------------

// Stages one good-looking frame: the bunny mid-hop, treats zig-zagging up the track, obstacles
// further back, a believable score, a 3x combo and no achievement toast. The game loop is frozen
// at the end, so the picture is exactly what's set up here.
const STAGE = `(() => {
    for (const achievement of Object.values(game.achievements)) achievement.unlocked = true; // no toast in the picture
    const world = game.worldManager;
    const put = (thing, lane, z) => { thing.position.x = game.lanes[lane]; thing.position.z = z; };
    for (const [lane, z] of [[0, -2.5], [2, -4.5], [0, -7], [2, -9.5], [1, -12], [0, -14.5]]) {
        world.createCollectible(z);
        put(world.collectibles.at(-1), lane, z);
    }
    for (const [lane, z] of [[0, -11], [2, -15]]) {
        world.createObstacle(z);
        put(world.obstacles.at(-1), lane, z);
    }
    game.bestScore = 2450;
    game.score = 340;
    game.lastMilestone = 250;
    game.checkMilestone();
    game.comboCount = 3;
    game.comboExpires = 999;
    game.updateScore();
    game.bunny.position.set(0, 1.0, 0);
    game.bunny.rotation.set(-0.3, 0, 0.08);
    game.gameState = 'frozen';       // the loop stops updating...
    game.renderPending = true;       // ...after drawing this one frame
    return 1;
})()`;

async function makeScreenshots() {
    console.log('Screenshots');
    const server = await startStaticServer(root);
    try {
        const shoot = async (file, viewport, { touch = false } = {}) => {
            const browser = new CdpClient({ port: 9362 });
            await browser.launch('about:blank', viewport);
            try {
                await browser.blockUrls(['https://a.omsingh.me/*']); // a screenshot run shouldn't count as a visitor
                if (process.env.THREE_JS) await browser.serveFile('https://cdnjs.cloudflare.com/ajax/libs/three.js/*', process.env.THREE_JS);
                if (touch) await browser.setTouch(true);
                await browser.goto(server.url + '/');
                await browser.waitFor(`window.game?.gameState === 'menu'`, 30000);

                await browser.evaluate(`document.getElementById('start-btn').click(); 1`);
                await browser.waitFor(`game.gameState === 'playing'`, 15000);
                await browser.evaluate(STAGE);

                await sleep(700);                                    // let the frame and the HUD glow settle
                save(file, await browser.screenshot());
            } finally {
                await browser.close();
            }
        };

        await shoot('preview.png', { width: 1200, height: 630, isMobile: false });
        await shoot('assets/screenshots/wide.png', { width: 1280, height: 720, isMobile: false });
        await shoot('assets/screenshots/narrow.png', { width: 390, height: 844, isMobile: true }, { touch: true });
    } finally {
        await server.stop();
    }
}

const only = process.argv[2]; // "icons" or "screenshots" to redo just one half
if (!only || only === 'icons') await makeIcons();
if (!only || only === 'screenshots') await makeScreenshots();
console.log('done');
