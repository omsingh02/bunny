import { spawn } from 'child_process';

export class CdpClient {
    constructor(options = {}) {
        this.port = options.port || 9333;
        this.process = null;
        this.ws = null;
        this.id = 1;
        this.pendingCallbacks = new Map();
    }

    async launch(targetUrl, viewport = { width: 1920, height: 1080, isMobile: false }) {
        this.process = spawn('chromium', [
            '--headless=new',
            `--remote-debugging-port=${this.port}`,
            '--no-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            `--window-size=${viewport.width},${viewport.height}`,
            targetUrl
        ], { stdio: 'ignore' });

        // Poll for devtools availability
        let tab = null;
        for (let i = 0; i < 50; i++) {
            await new Promise(r => setTimeout(r, 100));
            try {
                const res = await fetch(`http://127.0.0.1:${this.port}/json/list`);
                const tabs = await res.json();
                tab = tabs.find(t => t.type === 'page') || tabs[0];
                if (tab && tab.webSocketDebuggerUrl) break;
            } catch {
                // Keep waiting for chromium to start
            }
        }

        if (!tab || !tab.webSocketDebuggerUrl) {
            this.kill();
            throw new Error(`Failed to connect to Chromium CDP on port ${this.port}`);
        }

        this.ws = new WebSocket(tab.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            this.ws.onopen = resolve;
            this.ws.onerror = reject;
        });

        this.ws.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                if (data.id && this.pendingCallbacks.has(data.id)) {
                    const { resolve, reject } = this.pendingCallbacks.get(data.id);
                    this.pendingCallbacks.delete(data.id);
                    if (data.error) {
                        reject(new Error(data.error.message || JSON.stringify(data.error)));
                    } else {
                        resolve(data.result);
                    }
                }
            } catch (err) {
                console.error('CDP message parse error:', err);
            }
        };

        await this.send('Runtime.enable');
        await this.send('Page.enable');
        await this.send('DOM.enable');
        await this.send('CSS.enable');

        await this.setDeviceMetrics(viewport.width, viewport.height, viewport.isMobile);
    }

    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const curId = this.id++;
            this.pendingCallbacks.set(curId, { resolve, reject });
            this.ws.send(JSON.stringify({ id: curId, method, params }));
        });
    }

    async evaluate(expression) {
        const result = await this.send('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true
        });
        if (result.exceptionDetails) {
            throw new Error(`Evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
        }
        return result.result?.value;
    }

    async setDeviceMetrics(width, height, isMobile = false) {
        await this.send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: isMobile
        });
    }

    async emulateColorScheme(scheme) {
        // scheme: 'dark' | 'light' | 'none'
        await this.send('Emulation.setEmulatedMedia', {
            media: 'screen',
            features: scheme && scheme !== 'none' ? [{ name: 'prefers-color-scheme', value: scheme }] : []
        });
    }

    async waitFor(fnOrMs, timeoutMs = 8000) {
        if (typeof fnOrMs === 'number') {
            await new Promise(r => setTimeout(r, fnOrMs));
            return;
        }

        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const ready = await this.evaluate(fnOrMs);
            if (ready) return ready;
            await new Promise(r => setTimeout(r, 100));
        }
        throw new Error(`Timeout after ${timeoutMs}ms waiting for: ${fnOrMs}`);
    }

    async close() {
        if (this.ws) {
            try { this.ws.close(); } catch {}
            this.ws = null;
        }
        this.kill();
    }

    kill() {
        if (this.process) {
            try { this.process.kill('SIGKILL'); } catch {}
            this.process = null;
        }
    }
}
