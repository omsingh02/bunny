import http from 'http';
import fs from 'fs';
import path from 'path';

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg'
};

export function startStaticServer(rootDir, port = 0) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            let reqPath = decodeURIComponent(req.url.split('?')[0]);
            if (reqPath === '/' || reqPath === '') {
                reqPath = '/index.html';
            }

            const resolvedRoot = path.resolve(rootDir);
            const filePath = path.resolve(resolvedRoot, '.' + reqPath);

            // Prevent path traversal outside root
            if (!filePath.startsWith(resolvedRoot)) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end('Forbidden');
                return;
            }

            fs.stat(filePath, (err, stats) => {
                if (err || !stats.isFile()) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found: ' + reqPath);
                    return;
                }

                const ext = path.extname(filePath).toLowerCase();
                const contentType = MIME_TYPES[ext] || 'application/octet-stream';

                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': stats.size,
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                });

                fs.createReadStream(filePath).pipe(res);
            });
        });

        server.on('error', reject);

        server.listen(port, '127.0.0.1', () => {
            const actualPort = server.address().port;
            resolve({
                port: actualPort,
                url: `http://127.0.0.1:${actualPort}`,
                stop: () => new Promise((res) => server.close(res))
            });
        });
    });
}
