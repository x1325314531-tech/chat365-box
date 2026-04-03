'use strict';

const https = require('https');
const http = require('http');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

/**
 * 构造与 Python requests 相同的代理 URL：http(s)://user:pwd@host:port
 */
function buildProxyAuthUrl(scheme, host, port, username, password) {
    const u = String(username || '').trim();
    const pw = String(password || '').trim();
    const auth = (u !== '' || pw !== '') ? `${encodeURIComponent(u)}:${encodeURIComponent(pw)}@` : '';
    return `${scheme}://${auth}${host}:${port}`;
}

/**
 * SOCKS5 代理 URL：socks5://user:pwd@host:port（与常见客户端一致）
 */
function buildSocksAuthUrl(host, port, username, password) {
    const u = String(username || '').trim();
    const pw = String(password || '').trim();
    const auth = (u !== '' || pw !== '') ? `${encodeURIComponent(u)}:${encodeURIComponent(pw)}@` : '';
    return `socks5://${auth}${host}:${port}`;
}

/**
 * 经 SOCKS5 拉取 URL 文本（HTTPS 目标在 SOCKS 隧道上建立 TLS）
 */
function fetchTextViaSocksProxy(targetUrl, socksProxyUrl, agentOpts = {}) {
    const isTargetHttps = /^https:/i.test(targetUrl);
    const { rejectUnauthorized, ...socksAgentOpts } = agentOpts;
    const agent = new SocksProxyAgent(socksProxyUrl, socksAgentOpts);
    const lib = isTargetHttps ? https : http;
    const getOpts = { agent };
    if (isTargetHttps && rejectUnauthorized === false) {
        getOpts.rejectUnauthorized = false;
    }
    return new Promise((resolve, reject) => {
        const req = lib.get(targetUrl, getOpts, (res) => {
            let body = '';
            res.on('data', (ch) => { body += ch; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(20000, () => {
            req.destroy();
            reject(new Error('timeout'));
        });
    });
}

/**
 * 用代理拉取 URL 文本。HTTPS 目标走 CONNECT（HttpsProxyAgent），HTTP 目标走转发（HttpProxyAgent），
 * 避免 Axios 在 Node 下对「HTTPS 目标 + HTTP 代理」发错误的 GET https://绝对路径。
 */
function fetchTextViaProxyUrl(targetUrl, proxyUrl, agentOpts = {}) {
    const isTargetHttps = /^https:/i.test(targetUrl);
    const AgentCtor = isTargetHttps ? HttpsProxyAgent : HttpProxyAgent;
    const agent = new AgentCtor(proxyUrl, agentOpts);
    const lib = isTargetHttps ? https : http;
    return new Promise((resolve, reject) => {
        const req = lib.get(targetUrl, { agent }, (res) => {
            let body = '';
            res.on('data', (ch) => { body += ch; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(20000, () => {
            req.destroy();
            reject(new Error('timeout'));
        });
    });
}

module.exports = {
    buildProxyAuthUrl,
    buildSocksAuthUrl,
    fetchTextViaProxyUrl,
    fetchTextViaSocksProxy,
};
