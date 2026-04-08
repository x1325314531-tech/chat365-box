'use strict';

/**
 * NetGetIpGeo.js — 多路随机竞速，单次请求同时获取出口 IP 与地理信息（无需第二轮 GEO）。
 * 代理用法参考 NetGetIpGeoSplit.js。
 *
 * 对外入口：fetchIpGeo(opts) 或 new NetGetIpGeo(defaults).run(override)
 */

const net = require('net');
const axios = require('axios');
const Log = require('ee-core/log');
const {
    buildProxyAuthUrl,
    buildSocksAuthUrl,
    fetchTextViaProxyUrl,
    fetchTextViaSocksProxy,
} = require('./proxyFetch');
const {
    getSystemProxyForUrl,
    buildProxyNodeUrl,
    ensureGostProxyChain,
    stopGostProxyChain,
    fetchTextViaProxyNode,
} = require('./TwoLevelProxyChain');
// ---------------------------------------------------------------------------
// 可配置：同时返回 IP + 地理的探测地址（顺序与随机池无关；竞速前会再随机抽子集）
// ---------------------------------------------------------------------------

/** 探测池配置：id 供界面/日志；label 人类可读；url 请求地址；kind 决定 normalizeGeoRow 的解析分支 */
const IPGEO_ENDPOINTS = [
    { id: 'ipapi_co', label: 'ipapi.co/json', url: 'https://ipapi.co/json/', kind: 'json_ipapi' },
    { id: 'ip_sb', label: 'api.ip.sb/geoip', url: 'https://api.ip.sb/geoip/', kind: 'json_ip_sb' },
    { id: 'ipbase_com', label: 'api.ipbase.com/v1/json', url: 'https://api.ipbase.com/v1/json/', kind: 'json_ipbase' },
    { id: 'cloudflare', label: 'Cloudflare cdn-cgi/trace', url: 'https://www.cloudflare.com/cdn-cgi/trace', kind: 'cloudflare_trace' },
];

/** 默认每次从池中随机抽取参与竞速的条数 N（可被 fetchIpGeo({ raceCount }) 覆盖） */
const DEFAULT_RACE_COUNT = 2;

/** 单次请求超时时间（毫秒），传给 axios / 代理底层 */
const DEFAULT_TIMEOUT_MS = 20000;

/** HTTPS 代理 CONNECT 场景下 TLS 校验选项（与项目其它代理工具一致） */
const TLS_INSECURE = { rejectUnauthorized: false };

/**
 * 将毫秒耗时格式化为「一位小数」的秒数字符串，用于返回 elapsedSec
 */
function formatElapsedSec(ms) {
    const s = Number(ms) / 1000;
    if (Number.isNaN(s) || s < 0) {
        return '0.0';
    }
    return s.toFixed(1);
}

/**
 * 校验字符串是否为合法 IPv4/IPv6，合法则返回规范化字符串，否则 null
 */
function normalizeIp(s) {
    const t = String(s || '').trim();
    return net.isIP(t) !== 0 ? t : null;
}

/**
 * 判断给定 IP 是否为 IPv6（用于 IPv6 时仅保留国家、清空省市策略）
 */
function isIpv6(ip) {
    return normalizeIp(ip) != null && net.isIP(ip) === 6;
}

/**
 * 从探测池 all 中随机打乱后截取前 n 条（至少 1 条，且不超过池长度），供本轮 Promise.any 竞速使用
 */
function pickRandomEndpoints(all, n) {
    const pool = [...all];
    for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const take = Math.max(1, Math.min(Number(n) || DEFAULT_RACE_COUNT, pool.length));
    return pool.slice(0, take);
}

/**
 * 安全 JSON.parse，失败返回 null，避免解析异常中断竞速
 */
function parseJsonSafe(text) {
    try {
        return JSON.parse(String(text || ''));
    } catch (_) {
        return null;
    }
}

/**
 * 按各服务商响应格式统一解析为 { ip, country, region, city, ipv6Only }。
 * kind 对应 IPGEO_ENDPOINTS[].kind；IPv6 时 ipv6Only=true，仅国家有效。
 */
function normalizeGeoRow(kind, rawText, rawObj) {
    const o = rawObj && typeof rawObj === 'object' ? rawObj : parseJsonSafe(rawText);
    if (kind === 'json_ipapi') {
        if (!o || o.error) {
            throw new Error(o && o.reason ? String(o.reason) : 'ipapi.co 无效响应');
        }
        const ip = normalizeIp(o.ip);
        if (!ip) {
            throw new Error('ipapi.co 无 ip');
        }
        const v6 = isIpv6(ip) || String(o.version || '').toLowerCase() === 'ipv6';
        const country = o.country_name != null ? String(o.country_name) : (o.country != null ? String(o.country) : '');
        if (v6) {
            return { ip, country: country || '未知', region: '', city: '', ipv6Only: true };
        }
        return {
            ip,
            country: country || '未知',
            region: o.region != null ? String(o.region) : '',
            city: o.city != null ? String(o.city) : '',
            ipv6Only: false,
        };
    }
    if (kind === 'json_ip_sb') {
        const ip = normalizeIp(o && o.ip);
        if (!ip) {
            throw new Error('ip.sb 无有效 ip');
        }
        const v6 = isIpv6(ip);
        const country = o.country != null ? String(o.country) : '';
        if (v6) {
            return { ip, country: country || '未知', region: '', city: '', ipv6Only: true };
        }
        return {
            ip,
            country: country || '未知',
            region: o.region != null ? String(o.region) : '',
            city: o.city != null ? String(o.city) : '',
            ipv6Only: false,
        };
    }
    if (kind === 'json_ipbase') {
        const ip = normalizeIp(o && o.ip);
        if (!ip) {
            throw new Error('ipbase 无有效 ip');
        }
        const v6 = isIpv6(ip);
        const country = o.country_name != null ? String(o.country_name) : '';
        if (v6) {
            return { ip, country: country || '未知', region: '', city: '', ipv6Only: true };
        }
        return {
            ip,
            country: country || '未知',
            region: o.region_name != null ? String(o.region_name) : '',
            city: o.city != null ? String(o.city) : '',
            ipv6Only: false,
        };
    }
    if (kind === 'cloudflare_trace') {
        const text = String(rawText || '');
        const lines = text.split(/\r?\n/);
        let ipRaw = '';
        let loc = '';
        for (const line of lines) {
            const t = line.trim();
            const mi = /^ip=(.+)$/i.exec(t);
            if (mi) {
                ipRaw = mi[1].trim();
            }
            const ml = /^loc=(.+)$/i.exec(t);
            if (ml) {
                loc = ml[1].trim();
            }
        }
        const ip = normalizeIp(ipRaw);
        if (!ip) {
            throw new Error('Cloudflare trace 无有效 ip');
        }
        const v6 = isIpv6(ip);
        const country = loc || '未知';
        if (v6) {
            return { ip, country, region: '', city: '', ipv6Only: true };
        }
        return { ip, country, region: '', city: '', ipv6Only: false };
    }
    throw new Error('未知 kind');
}

/**
 * 实际发起网络请求：直连用 axios GET；走代理则按 proxyType 选用 SOCKS5 / HTTP / HTTPS 代理（proxyFetch）。
 * ctx：useProxy、proxyType、host、port、username、password、timeoutMs
 */
async function fetchUrlBody(url, ctx) {
     const systemProxyNodeUrl = await getSystemProxyForUrl(url);
    if (!ctx.useProxy) {
        if (systemProxyNodeUrl) {
            ctx._usedSystemProxy = true;
            return fetchTextViaProxyNode(url, systemProxyNodeUrl);
        }
        const r = await axios.get(url, {
            timeout: ctx.timeoutMs,
            proxy: false,
            responseType: 'text',
            transformResponse: [(data) => data],
            validateStatus: (s) => s >= 200 && s < 300,
        });
        return String(r.data != null ? r.data : '');
    }
    const h = String(ctx.host || '').trim();
    const pt = parseInt(String(ctx.port || '').trim(), 10);
    const u = String(ctx.username || '').trim();
    const p = String(ctx.password || '').trim();
    const pType = String(ctx.proxyType || 'http').toLowerCase();
    if (!h || Number.isNaN(pt)) {
        throw new Error('代理已启用但未填写主机或端口');
    }
    Log.info('[NetGetIpGeo] 代理单次请求', {
        proxyProtocol: pType,
        proxyAddress: `${h}:${pt}`,
        username: u,
        password: p,
        targetUrl: url,
    });
     if (systemProxyNodeUrl) {
        ctx._usedSystemProxy = true;
        const customProxyNodeUrl = buildProxyNodeUrl({
            proxyType: pType,
            host: h,
            port: pt,
            username: u,
            password: p,
        });
        const gostLocalProxyUrl = await ensureGostProxyChain(ctx, systemProxyNodeUrl, customProxyNodeUrl, ctx.timeoutMs);
        try {
            return await fetchTextViaProxyUrl(url, gostLocalProxyUrl);
        } catch (e) {
            const code = e && e.code ? String(e.code) : '';
            const msg = e && e.message ? String(e.message) : String(e);
            if (code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(msg)) {
                stopGostProxyChain(ctx);
                const gostLocalProxyUrl2 = await ensureGostProxyChain(ctx, systemProxyNodeUrl, customProxyNodeUrl, ctx.timeoutMs);
                return fetchTextViaProxyUrl(url, gostLocalProxyUrl2);
            }
            throw e;
        }
    }
    if (pType === 'socks5') {
        const socksUrl = buildSocksAuthUrl(h, pt, u, p);
        return fetchTextViaSocksProxy(url, socksUrl, TLS_INSECURE);
    }
    if (pType === 'https') {
        const proxyUrl = buildProxyAuthUrl('https', h, pt, u, p);
        return fetchTextViaProxyUrl(url, proxyUrl, TLS_INSECURE);
    }

    const proxyUrl = buildProxyAuthUrl('http', h, pt, u, p);
    return fetchTextViaProxyUrl(url, proxyUrl);
}

/**
 * 请求单条探测 ep：拉取正文 → 解析 JSON/trace → normalizeGeoRow → 带上 source/sourceLabel 等业务字段
 */
async function runOneEndpoint(ep, ctx) {
    const body = await fetchUrlBody(ep.url, ctx);
    let obj = null;
    if (ep.kind !== 'cloudflare_trace') {
        obj = parseJsonSafe(body);
        if (!obj) {
            throw new Error('JSON 解析失败');
        }
    }
    const row = normalizeGeoRow(ep.kind, body, obj);
    return {
        source: ep.id,
        sourceLabel: ep.label,
        exitIp: row.ip,
        country: row.country || '未知',
        region: row.ipv6Only ? '' : (row.region || ''),
        city: row.ipv6Only ? '' : (row.city || ''),
        ipv6OnlyCountry: row.ipv6Only === true,
    };
}

/**
 * 对 picked 中每条线路并发 runOneEndpoint，Promise.any 取最先成功的一条；全部失败则聚合错误信息抛出
 */
async function raceEndpoints(picked, ctx) {
    const promises = picked.map((ep) => runOneEndpoint(ep, ctx).then((data) => ({ ep, data })));
    try {
        return await Promise.any(promises);
    } catch (e) {
        const agg = e && e.errors;
        if (Array.isArray(agg) && agg.length) {
            const parts = agg
                .map((x) => (x && x.message ? x.message : String(x)))
                .filter((m) => m && !/aborted|cancel|canceled/i.test(m));
            throw new Error(parts.length ? parts.join('；') : '全部线路失败');
        }
        throw new Error(e && e.message ? e.message : '全部线路失败');
    }
}

/**
 * 对外主函数：从探测池随机抽 raceCount 条 → raceEndpoints 竞速 → 成功返回 IP/地区/source/耗时；失败返回 status:false 与 message
 *
 * @param {object} opts
 * @param {number} [opts.raceCount] 每次随机抽取的条数 N，默认 2
 * @param {boolean} [opts.useProxy] 是否走代理，默认 false
 * @param {string} [opts.proxyType] http | https | socks5 | noProxy
 * @param {string} [opts.host] [opts.port] [opts.username] [opts.password]
 * @param {Array} [opts.endpoints] 覆盖默认 IPGEO_ENDPOINTS
 * @param {number} [opts.timeoutMs]
 */
async function fetchIpGeo(opts = {}) {
    const startedAt = Date.now();
    const raceCount = opts.raceCount != null ? opts.raceCount : DEFAULT_RACE_COUNT;
    const useProxy = opts.useProxy === true || opts.useProxy === 'true';
    const endpoints = Array.isArray(opts.endpoints) && opts.endpoints.length ? opts.endpoints : IPGEO_ENDPOINTS;
    const timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
    const proxyType = String(opts.proxyType || opts.proxy || 'http').toLowerCase();

    const ctx = {
        useProxy: useProxy && proxyType !== 'noproxy',
        proxyType,
        host: opts.host,
        port: opts.port,
        username: opts.username,
        password: opts.password,
        timeoutMs,
        _usedSystemProxy: false,
        _gostPromise: null,
        _gostProc: null,
        _gostProxyUrl: null,
    };

    const picked = pickRandomEndpoints(endpoints, raceCount);
     let result
    // if (ctx.useProxy) {
    //     const h = String(ctx.host || '').trim();
    //     const pt = String(ctx.port || '').trim();
    //     Log.info('[NetGetIpGeo] 走代理协议探测', {
    //         proxyProtocol: ctx.proxyType,
    //         proxyAddress: `${h}:${pt}`,
    //         username: String(ctx.username || '').trim(),
    //         password: String(ctx.password || '').trim(),
    //         endpoints: picked.map((ep) => ({ id: ep.id, label: ep.label, url: ep.url })),
    //     });
    // }

    try {
        const { ep, data } = await raceEndpoints(picked, ctx);
        const elapsedMs = Date.now() - startedAt;
        const elapsedSec = formatElapsedSec(elapsedMs);
        result= {
            status: true,
            message: 'OK',
            exitIp: data.exitIp,
            country: data.country,
            region: data.region,
            city: data.city,
            source: data.source,
            sourceLabel: data.sourceLabel,
            ipv6OnlyCountry: data.ipv6OnlyCountry === true,
            elapsedMs,
            elapsedSec,
           direct: !ctx.useProxy && ctx._usedSystemProxy !== true,
        };
    } catch (e) {
        const elapsedMs = Date.now() - startedAt;
         result= {
            status: false,
            message: e && e.message ? e.message : String(e),
            elapsedMs,
            elapsedSec: formatElapsedSec(elapsedMs),
             direct: !ctx.useProxy && ctx._usedSystemProxy !== true,
        };
    } finally{ 
        stopGostProxyChain(ctx);
    }
    return result
}

/**
 * 工具类：构造函数中保存默认选项（如 raceCount、代理配置），run(override) 与入参合并后调用 fetchIpGeo
 */
class NetGetIpGeo {
    /**
     * @param {object} defaults 默认传给 fetchIpGeo 的选项，可被 run() 入参覆盖
     */
    constructor(defaults = {}) {
        this.defaults = { ...defaults };
    }

    /**
     * 执行探测：等价于 fetchIpGeo({ ...this.defaults, ...override })
     */
    async run(override = {}) {
        return fetchIpGeo({ ...this.defaults, ...override });
    }
}

/** 导出：主函数、类、默认池与常量（供其它模块或单测使用 pickRandomEndpoints） */
module.exports = {
    fetchIpGeo,
    // NetGetIpGeo,
    // IPGEO_ENDPOINTS,
    // DEFAULT_RACE_COUNT,
    // pickRandomEndpoints,
};
