// size.mjs - how many bytes a visitor downloads for the game's own files: index.html, the stylesheet and
// every script, each gzipped on its own at the highest level (like a static host sends them).
// Three.js comes from a CDN and the font is its own file, so neither counts.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export function ownGzipBytes(root) {
    const scripts = fs.readdirSync(path.join(root, 'assets/scripts'), { recursive: true })
        .filter(file => file.endsWith('.js'))
        .map(file => path.join('assets/scripts', file));

    const files = ['index.html', 'assets/styles/game.css', ...scripts].map(file => ({
        file,
        bytes: zlib.gzipSync(fs.readFileSync(path.join(root, file)), { level: 9 }).length
    }));
    return { total: files.reduce((sum, f) => sum + f.bytes, 0), files };
}
