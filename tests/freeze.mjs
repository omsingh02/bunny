// freeze.mjs - Bunny Runner is finished, and this is the lock on the door.
//
// FROZEN.sha256 lists every file in the repository with its SHA-256 (the layout `sha256sum` prints). This
// test fails when a file has changed, been added or been removed, so a "quick last tweak" can't slip in,
// and CI goes red on any pull request that tries. Line endings don't count for text files, so a Windows
// checkout agrees with a Linux one.
//
// To reopen the project on purpose: delete this file and FROZEN.sha256, take the freeze test out of the
// "test" script in package.json, and say why in the commit.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = 'FROZEN.sha256';

const digest = (file) => {
    let bytes = fs.readFileSync(path.join(root, file));
    if (!bytes.includes(0)) bytes = Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
    return createHash('sha256').update(bytes).digest('hex');
};

// every file git knows about, except the list itself (a file can't contain its own hash)
const trackedFiles = () => execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(file => file && file !== MANIFEST && fs.existsSync(path.join(root, file)))
    .sort();

// the text FROZEN.sha256 should contain right now
export const snapshot = () => trackedFiles().map(file => `${digest(file)}  ${file}\n`).join('');

const check = () => {
    const expected = new Map(fs.readFileSync(path.join(root, MANIFEST), 'utf8').split('\n')
        .map(line => line.match(/^([0-9a-f]{64})  (.+)$/)).filter(Boolean).map(m => [m[2], m[1]]));

    let files;
    try { files = trackedFiles(); } catch { files = [...expected.keys()].filter(f => fs.existsSync(path.join(root, f))); } // no git (a zip download): only the listed files can be checked

    const changed = files.filter(f => expected.has(f) && digest(f) !== expected.get(f));
    const added = files.filter(f => !expected.has(f));
    const removed = [...expected.keys()].filter(f => !fs.existsSync(path.join(root, f)));

    if (changed.length + added.length + removed.length) {
        console.error('freeze: Bunny Runner is complete, and every file is locked.\n' +
            [...changed.map(f => `  ✖ changed: ${f}`), ...added.map(f => `  ✖ added:   ${f}`), ...removed.map(f => `  ✖ removed: ${f}`)].join('\n') +
            '\n  To reopen the project on purpose, see the top of tests/freeze.mjs.');
        process.exit(1);
    }
    console.log(`freeze: ok (${expected.size} files, all exactly as released)`);
};

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) check();
