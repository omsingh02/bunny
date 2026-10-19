// three.mjs - where the browser tests get Three.js from, so a slow or stalled CDN can't turn a test run red.
// The game loads Three.js r128 from cdnjs, and the tests answer that request from a local copy instead:
//   - $THREE_JS, if set, is that copy (use it offline);
//   - otherwise r128 is downloaded once (jsDelivr, then cdnjs, a few tries each) into the temp folder and reused.
// A download only counts if it is complete: a stalled CDN hands over half a file, which must never be cached.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CDN_PATTERN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/*';
const MIRRORS = [
    'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];
const TRIES_PER_MIRROR = 2;
const TIMEOUT_MS = 25000;

// the real file has the license header, says it is r128, and ends with the closing of its UMD wrapper
export const isCompleteThree = (text) => text.length > 500_000 && text.includes('SPDX-License-Identifier: MIT') && text.includes('="128"') && /\}\)\);?\s*$/.test(text);

async function download() {
    for (const url of MIRRORS) {
        for (let attempt = 1; attempt <= TRIES_PER_MIRROR; attempt++) {
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
                const text = response.ok ? await response.text() : '';
                if (isCompleteThree(text)) return text;
            } catch {
                // stalled, refused or offline: try again, then the next mirror
            }
        }
    }
    return null;
}

// Path of a complete local copy of three.min.js, or null if none could be had (the page then asks the CDN itself)
export async function threeFile() {
    if (process.env.THREE_JS) return process.env.THREE_JS;

    const dir = path.join(os.tmpdir(), `bunny-tests-${process.getuid?.() ?? 'user'}`);
    const file = path.join(dir, 'three.r128.min.js');
    try {
        if (isCompleteThree(fs.readFileSync(file, 'utf8'))) return file;
    } catch {
        // not downloaded yet
    }

    const text = await download();
    if (!text) {
        console.warn('(could not download Three.js r128 for the tests: the pages will ask the CDN themselves)');
        return null;
    }
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const partial = `${file}.${process.pid}.tmp`; // written whole, then renamed: a parallel run never reads half a file
    fs.writeFileSync(partial, text);
    fs.renameSync(partial, file);
    return file;
}

// Makes the page's request for Three.js be answered from the local copy
export async function serveThree(client) {
    const file = await threeFile();
    if (file) await client.serveFile(CDN_PATTERN, file);
}
