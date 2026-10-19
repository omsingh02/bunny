// wiring.mjs - instant checks, no browser needed:
//  - every element id the JS looks up exists in index.html (and ids are unique)
//  - every file that index.html, game.css and the JS point at exists
//  - leaderboard and settings logic, and that junk in localStorage can't get through
//  - the README's size and budget numbers match tests/budget.mjs and the real files
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StorageManager, cleanSettings, cleanScore, cleanLeaderboard } from '../assets/scripts/modules/StorageManager.js';
import { SETTING_TOGGLES } from '../assets/scripts/modules/UIController.js';
import { BUDGET } from './budget.mjs';
import { ownGzipBytes } from './helpers/size.mjs';
import { isCompleteThree } from './helpers/three.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const isRemote = (ref) => /^(https?:)?\/\//.test(ref) || ref.startsWith('data:');

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const scriptFiles = fs.readdirSync(path.join(root, 'assets/scripts'), { recursive: true })
    .filter(f => f.endsWith('.js'))
    .map(f => path.join('assets/scripts', f));

// ---- element ids ---------------------------------------------------------------------------
const html = read('index.html');
const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
check(new Set(htmlIds).size === htmlIds.length, `duplicate ids in index.html: ${htmlIds.filter((id, i) => htmlIds.indexOf(id) !== i)}`);

// ---- accessibility basics that need no browser (tests/a11y.mjs does the rest) -------------------
const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)?.[1] ?? '';
check(viewport.length > 0, 'index.html needs a viewport meta tag');
check(!/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(viewport), `the viewport tag must not lock zoom (people who need big text rely on it): "${viewport}"`);
check(/<html lang="[a-z-]+"/i.test(html), 'the <html> tag needs a lang attribute');
// headings go down one level at a time (h1, h2, h3), never h1 -> h3: screen readers use them as an outline
const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map(m => Number(m[1]));
check(levels[0] === 1 && levels.filter(l => l === 1).length === 1, 'index.html needs exactly one <h1>, and it comes first');
levels.forEach((level, i) => check(i === 0 || level <= levels[i - 1] + 1, `heading #${i + 1} (h${level}) skips a level after h${levels[i - 1]}`));
check(JSON.parse(read('package.json')).scripts.test.includes('tests/a11y.mjs'), '"npm test" should run tests/a11y.mjs');

// ids looked up through $('id'), on('id', ...) or getElementById('id'), plus the ones the code
// reaches through tables (settings toggles, touch buttons)
const usedIds = new Set([...Object.keys(SETTING_TOGGLES), 'touch-left', 'touch-right', 'touch-jump']);
for (const file of scriptFiles) {
    for (const m of read(file).matchAll(/(?:\$|\bon|getElementById)\(\s*['"]([^'"]+)['"]/g)) usedIds.add(m[1]);
}
for (const id of usedIds) {
    check(htmlIds.includes(id), `the JS looks up #${id}, but index.html has no element with that id`);
}

// ---- files that must exist -----------------------------------------------------------------
// (404.html is served at any depth, so its links are absolute: path.join handles both kinds)
for (const page of ['index.html', '404.html']) {
    for (const m of read(page).matchAll(/(?:src|href)="([^"#?]+)"/g)) {
        if (!isRemote(m[1]) && m[1] !== '/') check(fs.existsSync(path.join(root, m[1])), `${page} points at ${m[1]}, which doesn't exist`);
    }
}
for (const m of read('assets/styles/game.css').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (!isRemote(m[1])) check(fs.existsSync(path.join(root, 'assets/styles', m[1])), `game.css points at ${m[1]}, which doesn't exist`);
}
for (const file of scriptFiles) {
    for (const m of read(file).matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
        check(fs.existsSync(path.join(root, path.dirname(file), m[1])), `${file} imports ${m[1]}, which doesn't exist`);
    }
}
let manifest = null;
try {
    manifest = JSON.parse(read('assets/manifest.json'));
} catch (e) {
    check(false, `assets/manifest.json is not valid JSON: ${e.message}`);
}

// ---- icons, manifest, link preview and SEO files -------------------------------------------
const site = `https://${read('CNAME').trim()}/`;
const pngSize = (file) => {
    const bytes = fs.readFileSync(path.join(root, file));
    return bytes.readUInt32BE(0) === 0x89504e47 ? `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}` : 'not a PNG';
};

// every icon and screenshot in the manifest exists and really has the size it claims
for (const item of [...(manifest?.icons ?? []), ...(manifest?.screenshots ?? [])]) {
    const file = path.join('assets', item.src);
    if (!fs.existsSync(path.join(root, file))) {
        check(false, `the manifest points at ${item.src}, which doesn't exist`);
    } else if (item.type === 'image/png') {
        check(pngSize(file) === item.sizes, `the manifest says ${item.src} is ${item.sizes}, but it is ${pngSize(file)}`);
    }
}
for (const size of ['192x192', '512x512']) {
    check(manifest?.icons.some(i => i.sizes === size && i.purpose === 'any'), `the manifest needs a ${size} icon`);
}
check(manifest?.icons.some(i => i.purpose === 'maskable'), 'the manifest needs a maskable icon');

// favicon.ico: every frame holds an image of the size it declares
const ico = fs.readFileSync(path.join(root, 'favicon.ico'));
for (let i = 0; i < ico.readUInt16LE(4); i++) {
    const entry = 6 + i * 16;
    const declared = ico.readUInt8(entry) || 256;
    const actual = ico.readUInt32BE(ico.readUInt32LE(entry + 12) + 16); // width of the PNG inside
    check(actual === declared, `favicon.ico frame ${i + 1} says ${declared}px but holds a ${actual}px image`);
}

// the link-preview image is the right size, and the page's urls all agree with CNAME
const meta = (attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1];
const ogImage = meta('property', 'og:image');
check(ogImage === meta('name', 'twitter:image'), 'og:image and twitter:image should be the same picture');
if (ogImage?.startsWith(site) && fs.existsSync(path.join(root, ogImage.slice(site.length)))) {
    const claimed = `${meta('property', 'og:image:width')}x${meta('property', 'og:image:height')}`;
    check(pngSize(ogImage.slice(site.length)) === claimed, `og:image is ${pngSize(ogImage.slice(site.length))} but the page says ${claimed}`);
} else {
    check(false, `og:image (${ogImage}) should be a file of this repo, served from ${site}`);
}
for (const [what, value] of [['the canonical link', html.match(/rel="canonical" href="([^"]*)"/)?.[1]], ['og:url', meta('property', 'og:url')]]) {
    check(value === site, `${what} should be ${site} (it is ${value})`);
}
check(read('sitemap.xml').includes(`<loc>${site}</loc>`), `sitemap.xml should list ${site}`);
check(read('robots.txt').includes(`Sitemap: ${site}sitemap.xml`), `robots.txt should point at ${site}sitemap.xml`);

// ---- LICENSE, and a README that matches the game --------------------------------------------
check(/^MIT License/.test(read('LICENSE')), 'LICENSE should be the MIT license');
check(JSON.parse(read('package.json')).license === 'MIT', 'package.json should say "license": "MIT"');

const readme = read('README.md');
const gameSource = read('assets/scripts/game.js');

// relative links and images point at real files, and #anchors point at real headings
// (GitHub lower-cases the heading, drops emoji and punctuation, and turns spaces into hyphens. Invisible
// "marks" survive, which is why an emoji like 🛠️ leaves a hidden character in the anchor: this check then
// fails, so use emoji without one in headings that you link to. Same rule as the github-slugger package.)
const slug = (heading) => heading.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\s-]/gu, '').replace(/ /g, '-');
const anchors = [...readme.matchAll(/^#{1,6} (.+)$/gm)].map(m => slug(m[1]));
for (const m of readme.matchAll(/(?:\]\(|(?:src|href)=")([^)"\s]+)/g)) {
    const [target, anchor] = m[1].split('#');
    if (/^(https?:|mailto:)/.test(target)) continue;
    if (target) check(fs.existsSync(path.join(root, target)), `README.md links to ${target}, which doesn't exist`);
    else if (anchor) check(anchors.includes(anchor), `README.md links to #${anchor}, but no heading makes that anchor`);
}

// the project layout in the README only names things that exist
const layout = readme.match(/\*\*Project layout\*\*\s+```\n([\s\S]*?)```/)?.[1] ?? '';
check(layout.length > 0, 'README.md should have a **Project layout** code block');
for (const line of layout.split('\n').filter(Boolean)) {
    for (const entry of line.split(/ {2,}/)[0].split(', ')) {
        check(fs.existsSync(path.join(root, entry)), `the README project layout lists ${entry}, which doesn't exist`);
    }
}

// the difficulty table, the milestones and the achievements are copied from game.js: keep them in sync
const seconds = ([from, to]) => `${(from / 1000).toFixed(1)}–${(to / 1000).toFixed(1)} s`;
for (const key of ['easy', 'medium', 'hard']) {
    const block = gameSource.match(new RegExp(`\\b${key}: \\{([^}]*)\\}`))?.[1] ?? '';
    const number = (name) => Number(block.match(new RegExp(`${name}: ([\\d.]+)`))?.[1]);
    const range = (name) => block.match(new RegExp(`${name}: \\[(\\d+), (\\d+)\\]`))?.slice(1).map(Number);
    const name = block.match(/name: "([^"]+)"/)?.[1];
    const [base, top, step] = [number('baseSpeed'), number('maxSpeed'), number('speedIncrement')];
    const expected = [
        name,
        `${base} → ${top}`,
        seconds(range('obstacleIntervalRange')),
        seconds(range('collectibleIntervalRange')),
        `${Math.round((top - base) / (step * 0.1))} points`
    ];
    for (const text of expected) check(readme.includes(text), `the ${key} row of README.md should say "${text}" (it comes from game.js)`);
}
const milestones = gameSource.match(/this\.milestones = \[([^\]]+)\]/)?.[1].split(',').map(n => n.trim()).join(', ');
check(readme.includes(milestones), `README.md should list the milestones as "${milestones}"`);
for (const [, title] of gameSource.matchAll(/title: "([^"]+)"/g)) {
    check(readme.includes(title), `README.md should list the achievement "${title}"`);
}

// ---- leaderboard: top 10 per difficulty, best first ----------------------------------------
let board = [];
for (let i = 0; i < 12; i++) board = StorageManager.addToLeaderboard(board, 1000 + i * 10, 'hard');
board = StorageManager.addToLeaderboard(board, 400, 'easy');
check(board.some(e => e.difficulty === 'easy'), 'an Easy run disappeared after many Hard runs (the board must keep the top 10 of each difficulty)');
check(board.filter(e => e.difficulty === 'hard').length === 10, 'the Hard board should keep exactly its top 10');
check(board.every((e, i) => i === 0 || board[i - 1].score >= e.score), 'the leaderboard should be sorted best-first');

// ---- settings: defaults fill in anything missing -------------------------------------------
const settings = StorageManager.loadSettings();
check(Object.values(settings).every(v => v === true), 'settings should default to everything on');

// ---- storage: whatever is saved, the game gets sane values --------------------------------------
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const defaults = cleanSettings(undefined);
for (const junk of [null, 'abc', 42, [], [true], { musicEnabled: 'no', sfxEnabled: 0, haptic: true }]) {
    check(same(cleanSettings(junk), defaults), `cleanSettings(${JSON.stringify(junk)}) should give the defaults`);
}
check(same(cleanSettings({ musicEnabled: false, bogus: 1 }), { ...defaults, musicEnabled: false }), 'cleanSettings should keep real booleans for known settings and drop everything else');

for (const [junk, expected] of [['abc', 0], [-5, 0], [Infinity, 0], [NaN, 0], [null, 0], [undefined, 0], [{}, 0], [12.9, 12], ['42', 42], [0, 0]]) {
    check(cleanScore(junk) === expected, `cleanScore(${String(junk)}) should be ${expected} (it is ${cleanScore(junk)})`);
}

const goodEntry = { score: 120, difficulty: 'hard', date: '1/2/2026', timestamp: 5 };
check(same(cleanLeaderboard([goodEntry]), [goodEntry]), 'cleanLeaderboard should keep a well-formed entry as it is');
check(same(cleanLeaderboard([null, 5, 'x', [], {}, { score: 'abc', difficulty: 'easy' }, { score: -1, difficulty: 'easy' }, { score: 9, difficulty: 'nope' }, goodEntry]), [goodEntry]),
    'cleanLeaderboard should drop every malformed entry and keep the good one');
for (const junk of [null, 'abc', 7, {}, { 0: goodEntry }]) {
    check(same(cleanLeaderboard(junk), []), `cleanLeaderboard(${JSON.stringify(junk)}) should be an empty list`);
}
check(StorageManager.addToLeaderboard([null, 'x', { score: 'a' }], 50, 'easy').length === 1, 'adding a run to a leaderboard full of junk should not throw and should keep just the run');

// the same through localStorage itself (Node has none, so a stand-in that returns whatever the test says)
const savedValue = (raw) => { globalThis.localStorage = { getItem: () => raw, setItem() {}, removeItem() {} }; };
const definitions = () => ({ a: { title: 'A' }, b: { title: 'B' } });
for (const raw of ['null', '5', '"text"', '[]', '{oops', '{"a": null}', '{"a": {"unlocked": "yes"}}']) {
    savedValue(raw);
    let result = null;
    try { result = StorageManager.loadAchievements(definitions()); } catch (e) { result = e; }
    check(!(result instanceof Error) && result.a.unlocked === false && result.b.unlocked === false, `loading achievements from ${raw} should leave them all locked without throwing`);
}
savedValue('{"a": {"unlocked": true}}');
check(StorageManager.loadAchievements(definitions()).a.unlocked === true, 'a saved unlocked achievement should stay unlocked');
delete globalThis.localStorage;

// ---- size: the README's number is the real one, and its budget table matches budget.mjs -----------
const sizeKB = ownGzipBytes(root).total / 1000;
check(readme.includes(`under ${Math.ceil(sizeKB)} kB gzipped`), `README.md should say the game's own files come to "under ${Math.ceil(sizeKB)} kB gzipped" (they are ${sizeKB.toFixed(1)} kB)`);
for (const [label, value] of [
    ['The game\'s own files, gzipped', `${BUDGET.ownGzipKB} kB`],
    ['Draw calls in the busiest frame', String(BUDGET.peakDrawCalls)],
    ['Triangles in the busiest frame', BUDGET.peakTriangles.toLocaleString('en-US')],
    ['CPU time of one `update()`', `${BUDGET.updateMs} ms`],
    ['Memory growth, minute 2 to 10', `${BUDGET.heapGrowthMB} MB`],
    ['Geometries / objects in the scene', `${BUDGET.maxGeometries} / ${BUDGET.maxSceneObjects}`]
]) {
    check(readme.includes(`| ${label} | ${value} |`), `the README budget table should say "${label}: ${value}" (it comes from tests/budget.mjs)`);
}

// ---- the test helper that decides whether a downloaded Three.js is whole ---------------------
// (a stalled CDN hands over half a file; caching that would turn every later run red)
const wholeThree = `/* SPDX-License-Identifier: MIT */ !function(){var REVISION="128";${'x'.repeat(600_000)}}));\n`;
check(isCompleteThree(wholeThree), 'isCompleteThree should accept a whole three.min.js');
check(!isCompleteThree(wholeThree.slice(0, 550_000)), 'isCompleteThree should reject a download cut off partway');
check(!isCompleteThree(''), 'isCompleteThree should reject an empty download');
check(!isCompleteThree(wholeThree.replace('="128"', '="127"')), 'isCompleteThree should reject another Three.js revision');

// ---------------------------------------------------------------------------------------------
if (failures.length) {
    console.error(`wiring: ${failures.length} problem(s)\n` + failures.map(f => `  ✖ ${f}`).join('\n'));
    process.exit(1);
}
console.log(`wiring: ok (${usedIds.size} element ids, ${scriptFiles.length} scripts checked)`);
