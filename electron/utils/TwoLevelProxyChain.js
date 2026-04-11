'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, execFile } = require('child_process');
const {
    buildProxyAuthUrl,
    buildSocksAuthUrl,
    fetchTextViaProxyUrl,
    fetchTextViaSocksProxy,
} = require('./proxyFetch');

const TLS_INSECURE = { rejectUnauthorized: false };

function execFileText(file, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        execFile(file, args, { windowsHide: true, timeout: timeoutMs }, (err, stdout, stderr) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(`${stdout || ''}${stderr || ''}`);
        });
    });
}

function normalizeProxyNodeUrl(kind, raw) {
    const s = String(raw || '').trim();
    if (!s) {
        return '';
    }
    if (s.includes('://')) {
        return s;
    }
    if (String(kind || '').toLowerCase().startsWith('socks')) {
        return `socks5://${s}`;
    }
    return `http://${s}`;
}

function parseWindowsProxyServerString(raw) {
    const t = String(raw || '').trim();
    if (!t) {
        return {};
    }
    if (!t.includes('=')) {
        const one = normalizeProxyNodeUrl('http', t);
        return { http: one, https: one };
    }
    const map = {};
    for (const part of t.split(';')) {
        if (!part.includes('=')) {
            continue;
        }
        const [k0, v0] = part.split('=', 2);
        const k = String(k0 || '').trim().toLowerCase();
        const v = String(v0 || '').trim();
        if (!v) {
            continue;
        }
        if (k === 'http' || k === 'https') {
            map[k] = normalizeProxyNodeUrl(k, v);
        } else if (k === 'socks' || k === 'socks5' || k === 'socks5h') {
            const socks = normalizeProxyNodeUrl('socks5', v);
            map.http = socks;
            map.https = socks;
            map.socks5 = socks;
        }
    }
    return map;
}

async function getWindowsSystemProxyMap() {
    if (process.platform !== 'win32') {
        return {};
    }
    const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
    const outEnable = await execFileText('reg', ['query', key, '/v', 'ProxyEnable'], 2000).catch(() => '');
    const mEnable = /^\s*ProxyEnable\s+REG_DWORD\s+(\S+)/im.exec(outEnable);
    const enabled = mEnable ? String(mEnable[1] || '').toLowerCase() : '';
    if (!(enabled === '0x1' || enabled === '1' || enabled === '0x00000001')) {
        return {};
    }
    const outServer = await execFileText('reg', ['query', key, '/v', 'ProxyServer'], 2000).catch(() => '');
    const mServer = /^\s*ProxyServer\s+REG_SZ\s+(.+)$/im.exec(outServer);
    const raw = mServer ? String(mServer[1] || '').trim() : '';
    if (!raw) {
        return {};
    }
    return parseWindowsProxyServerString(raw);
}

function pickSystemProxyForUrl(targetUrl, proxyMap) {
    const u = String(targetUrl || '').trim().toLowerCase();
    const isHttps = u.startsWith('https:');
    if (isHttps) {
        return proxyMap.https || proxyMap.http || proxyMap.socks5 || '';
    }
    return proxyMap.http || proxyMap.https || proxyMap.socks5 || '';
}

async function getSystemProxyForUrl(targetUrl) {
    const proxyMap = await getWindowsSystemProxyMap().catch(() => ({}));
    const picked = pickSystemProxyForUrl(targetUrl, proxyMap || {});
    return String(picked || '').trim() || null;
}

function buildProxyNodeUrl(opts) {
    const pType = String(opts && opts.proxyType ? opts.proxyType : 'http').toLowerCase();
    const h = String(opts && opts.host ? opts.host : '').trim();
    const pt = parseInt(String(opts && opts.port != null ? opts.port : '').trim(), 10);
    const u = String(opts && opts.username ? opts.username : '').trim();
    const p = String(opts && opts.password ? opts.password : '').trim();
    if (!h || Number.isNaN(pt)) {
        return '';
    }
    if (pType === 'socks5') {
        return buildSocksAuthUrl(h, pt, u, p);
    }
    const scheme = pType === 'https' ? 'https' : 'http';
    return buildProxyAuthUrl(scheme, h, pt, u, p);
}

async function pickFreeLocalPort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => {
            const a = srv.address();
            const port = a && typeof a === 'object' ? a.port : 0;
            srv.close(() => resolve(port));
        });
    });
}

async function waitForTcpOpen(host, port, timeoutMs) {
    const deadline = Date.now() + Math.max(300, Number(timeoutMs) || 20000);
    while (Date.now() <= deadline) {
        const ok = await new Promise((resolve) => {
            const s = net.connect({ host, port });
            const done = (v) => {
                try {
                    s.destroy();
                } catch (_) {}
                resolve(v);
            };
            s.once('connect', () => done(true));
            s.once('error', () => done(false));
            s.setTimeout(300, () => done(false));
        });
        if (ok) {
            return;
        }
        await new Promise((r) => setTimeout(r, 120));
    }
    throw new Error('gost 启动超时');
}

function resolveGostExePath() {
    const candidates = [];
    if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, 'tunnel', 'tunnel.exe'));
        candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'resources', 'tunnel', 'tunnel.exe'));
        candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'tunnel', 'tunnel.exe'));
    }
    candidates.push(path.join(__dirname, '..', 'resources', 'tunnel', 'tunnel.exe'));
    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) {
                return p;
            }
        } catch (_) {}
    }
    return candidates[candidates.length - 1];
}

function stopGostProxyChain(ctx) {
    const proc = ctx && ctx._gostProc;
    if (proc && !proc.killed) {
        try {
            proc.kill();
        } catch (_) {}
    }
    if (ctx) {
        ctx._gostProc = null;
        ctx._gostProxyUrl = null;
        ctx._gostPromise = null;
    }
}

async function ensureGostProxyChain(ctx, systemProxyNodeUrl, customProxyNodeUrl, timeoutMs) {
    if (!ctx) {
        throw new Error('ctx 是必须的');
    }
    if (ctx._gostProxyUrl && ctx._gostProc && !ctx._gostProc.killed) {
        return ctx._gostProxyUrl;
    }
    if (ctx._gostProxyUrl && (!ctx._gostProc || ctx._gostProc.killed)) {
        ctx._gostProxyUrl = null;
        ctx._gostPromise = null;
        ctx._gostProc = null;
    }
    if (ctx._gostPromise) {
        return ctx._gostPromise;
    }
    ctx._gostPromise = (async () => {
        const port = await pickFreeLocalPort();
        const listenUrl = `http://127.0.0.1:${port}`;
        const exe = resolveGostExePath();
        const args = ['-L', listenUrl, '-F', systemProxyNodeUrl, '-F', customProxyNodeUrl];
        const proc = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] });
        ctx._gostProc = proc;
        ctx._gostProxyUrl = listenUrl;
        proc.once('exit', () => {
            if (ctx._gostProc === proc) {
                ctx._gostProc = null;
                ctx._gostProxyUrl = null;
                ctx._gostPromise = null;
            }
        });
        const ready = waitForTcpOpen('127.0.0.1', port, Math.min(3000, Number(timeoutMs) || 20000));
        const failed = new Promise((_, reject) => {
            proc.once('error', reject);
            proc.once('exit', (code) => {
                if (code && Number(code) !== 0) {
                    reject(new Error(`gost 退出 code=${code}`));
                }
            });
        });
        await Promise.race([ready, failed]);
        return listenUrl;
    })();
    return ctx._gostPromise;
}

async function fetchTextViaProxyNode(targetUrl, proxyNodeUrl) {
    const u = String(proxyNodeUrl || '').trim().toLowerCase();
    if (!u) {
        throw new Error('系统代理无效');
    }
    if (u.startsWith('socks5://') || u.startsWith('socks://') || u.startsWith('socks5h://')) {
        return fetchTextViaSocksProxy(targetUrl, proxyNodeUrl, TLS_INSECURE);
    }
    if (u.startsWith('https://')) {
        return fetchTextViaProxyUrl(targetUrl, proxyNodeUrl, TLS_INSECURE);
    }
    return fetchTextViaProxyUrl(targetUrl, proxyNodeUrl);
}

function toElectronProxyRulesFromUrl(proxyUrl) {
    const u = new URL(String(proxyUrl));
    const host = u.hostname;
    const port = u.port ? parseInt(String(u.port), 10) : 0;
    if (!host || !port) {
        return '';
    }
    return `http=${host}:${port};https=${host}:${port}`;
}

class GostProxyChain {
    constructor(opts = {}) {
        this.timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : 20000;
        this.exePath = opts.exePath || null;
        this.proc = null;
        this.localProxyUrl = null;
        this._startPromise = null;
    }

    async start(systemProxyNodeUrl, customProxyNodeUrl) {
        if (this.localProxyUrl && this.proc && !this.proc.killed) {
            return this.localProxyUrl;
        }
        if (this.localProxyUrl && (!this.proc || this.proc.killed)) {
            this.localProxyUrl = null;
            this._startPromise = null;
            this.proc = null;
        }
        if (this._startPromise) {
            return this._startPromise;
        }
        this._startPromise = (async () => {
            const port = await pickFreeLocalPort();
            const listenUrl = `http://127.0.0.1:${port}`;
            const exe = this.exePath || resolveGostExePath();
            const args = ['-L', listenUrl, '-F', systemProxyNodeUrl, '-F', customProxyNodeUrl];
            const proc = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] });
            this.proc = proc;
            this.localProxyUrl = listenUrl;
            proc.once('exit', () => {
                if (this.proc === proc) {
                    this.proc = null;
                    this.localProxyUrl = null;
                    this._startPromise = null;
                }
            });
            const ready = waitForTcpOpen('127.0.0.1', port, Math.min(3000, Number(this.timeoutMs) || 20000));
            const failed = new Promise((_, reject) => {
                proc.once('error', reject);
                proc.once('exit', (code) => {
                    if (code && Number(code) !== 0) {
                        reject(new Error(`gost 退出 code=${code}`));
                    }
                });
            });
            await Promise.race([ready, failed]);
            return listenUrl;
        })();
        return this._startPromise;
    }

    stop() {
        if (this.proc && !this.proc.killed) {
            try {
                this.proc.kill();
            } catch (_) {}
        }
        this.proc = null;
        this.localProxyUrl = null;
        this._startPromise = null;
    }

    getElectronProxyRules() {
        if (!this.localProxyUrl) {
            return '';
        }
        try {
            return toElectronProxyRulesFromUrl(this.localProxyUrl);
        } catch (_) {
            return '';
        }
    }
}

function createGostProxyChain(opts) {
    return new GostProxyChain(opts);
}

module.exports = {
    TLS_INSECURE,
    getSystemProxyForUrl,
    buildProxyNodeUrl,
    ensureGostProxyChain,
    stopGostProxyChain,
    fetchTextViaProxyNode,
    toElectronProxyRulesFromUrl,
    GostProxyChain,
    createGostProxyChain,
};
