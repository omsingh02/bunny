// Minimal Chrome DevTools Protocol client: starts headless Chromium and lets tests drive the page.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export class CdpClient {
    constructor({ port = 9333 } = {}) {
        this.port = port;
        this.process = null;
        this.profileDir = null;
        this.ws = null;
        this.nextId = 1;
        this.pending = new Map();
        this.events = []; // every { method, params } event the page sent (console, exceptions...)
    }

    async launch(targetUrl = 'about:blank', viewport = { width: 1280, height: 720, isMobile: false }) {
        // a throwaway profile, so this never clashes with a Chromium you already have open
        this.profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunny-chromium-'));
        this.process = spawn('chromium', [
            '--headless=new',
            `--remote-debugging-port=${this.port}`,
            `--user-data-dir=${this.profileDir}`,
            '--no-sandbox',
            '--disable-gpu',
            '--enable-unsafe-swiftshader', // software WebGL, so this works without a GPU
            '--disable-dev-shm-usage',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            `--window-size=${viewport.width},${viewport.height}`,
            targetUrl
        ], { stdio: 'ignore', detached: true });
        // however node ends (even a crash or a test timeout), take the browser down with it
        this.killBrowser = () => { try { process.kill(-this.process.pid, 'SIGKILL'); } catch {} };
        process.once('exit', this.killBrowser);

        let tab = null;
        for (let i = 0; i < 100 && !tab?.webSocketDebuggerUrl; i++) {
            await new Promise(r => setTimeout(r, 100));
            try {
                const tabs = await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json();
                tab = tabs.find(t => t.type === 'page') || tabs[0];
            } catch {
                // chromium is still starting
            }
        }
        if (!tab?.webSocketDebuggerUrl) {
            await this.close();
            throw new Error(`Could not connect to Chromium on port ${this.port} (is \`chromium\` installed?)`);
        }

        this.ws = new WebSocket(tab.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            this.ws.onopen = resolve;
            this.ws.onerror = reject;
        });
        this.ws.onmessage = (evt) => {
            const data = JSON.parse(evt.data);
            if (data.method) {
                this.events.push(data);
                if (data.method === 'Fetch.requestPaused') this.answerPausedRequest(data.params);
            } else if (this.pending.has(data.id)) {
                const { resolve, reject } = this.pending.get(data.id);
                this.pending.delete(data.id);
                data.error ? reject(new Error(data.error.message)) : resolve(data.result);
            }
        };

        await this.send('Runtime.enable');
        await this.send('Page.enable');
        await this.setViewport(viewport.width, viewport.height, viewport.isMobile);
    }

    async setViewport(width, height, mobile = false) {
        await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    }

    // PNG of the current viewport (as a Buffer)
    async screenshot() {
        const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
        return Buffer.from(data, 'base64');
    }

    // Makes the page background transparent, so screenshots of icons keep their alpha
    async transparentBackground() {
        await this.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    }

    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = this.nextId++;
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async goto(url) {
        await this.send('Page.navigate', { url });
    }

    reload() {
        return this.send('Page.reload', { ignoreCache: true });
    }

    async evaluate(expression) {
        const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) {
            throw new Error(`Evaluation failed: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`);
        }
        return result.result?.value;
    }

    // Polls `expression` until it's truthy; throws on timeout
    async waitFor(expression, timeoutMs = 8000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const value = await this.evaluate(expression);
                if (value) return value;
            } catch {
                // the page may be mid-load; keep polling
            }
            await new Promise(r => setTimeout(r, 100));
        }
        throw new Error(`Timed out after ${timeoutMs}ms waiting for: ${expression}`);
    }

    // Never load these URLs (wildcards allowed), e.g. analytics scripts
    async blockUrls(patterns) {
        await this.send('Network.enable');
        await this.send('Network.setBlockedURLs', { urls: patterns });
    }

    // Answer requests for `urlPattern` (e.g. the Three.js CDN URL) from a local file instead
    async serveFile(urlPattern, filePath, contentType = 'application/javascript') {
        this.served = [...(this.served || []), { urlPattern, body: fs.readFileSync(filePath).toString('base64'), contentType }];
        await this.send('Fetch.enable', { patterns: this.served.map(({ urlPattern }) => ({ urlPattern })) });
    }

    answerPausedRequest({ requestId, request }) {
        const match = (this.served || []).find(({ urlPattern }) => new RegExp('^' + urlPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(request.url));
        const answer = match
            ? this.send('Fetch.fulfillRequest', {
                requestId,
                responseCode: 200,
                responseHeaders: [{ name: 'Content-Type', value: match.contentType }, { name: 'Access-Control-Allow-Origin', value: '*' }],
                body: match.body
            })
            : this.send('Fetch.continueRequest', { requestId });
        answer.catch(() => {}); // the page may already be gone
    }

    // Runs `source` in every new document, before the page's own scripts
    async evalOnNewDocument(source) {
        await this.send('Page.addScriptToEvaluateOnNewDocument', { source });
    }

    async setTouch(enabled) {
        await this.send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: enabled ? 5 : 0 });
    }

    // type: 'touchStart' | 'touchMove' | 'touchEnd'
    touch(type, x, y) {
        return this.send('Input.dispatchTouchEvent', {
            type,
            touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }]
        });
    }

    // Presses and releases a key, e.g. press('ArrowLeft', 37) or press('Space', 32, ' ')
    async press(code, keyCode, key = code) {
        const event = { code, key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
        await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...event });
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...event });
    }

    // Uncaught exceptions and console.error() calls made by the page
    pageErrors() {
        return this.events.flatMap(({ method, params }) => {
            if (method === 'Runtime.exceptionThrown') {
                return [params.exceptionDetails.exception?.description || params.exceptionDetails.text];
            }
            if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
                return [params.args.map(a => a.value ?? a.description).join(' ')];
            }
            return [];
        });
    }

    async close() {
        try { this.ws?.close(); } catch {}
        this.ws = null;
        if (this.process) {
            const exited = new Promise(resolve => this.process.once('exit', resolve));
            this.killBrowser();
            process.off('exit', this.killBrowser);
            await Promise.race([exited, new Promise(r => setTimeout(r, 2000))]);
            this.process = null;
        }
        if (this.profileDir) {
            try {
                fs.rmSync(this.profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
            } catch {
                // best effort: it's a temp dir, the OS will clear it eventually
            }
            this.profileDir = null;
        }
    }
}
