const fetch = require('node-fetch');
const pageCache = require('./page-cache');
const wait = require('./wait');

let lastFetch = 0;

async function getResponse(domain, path, etag) {
    const controller = new AbortController();
    const headers = {};
    const rate = 1000; // 1 seconds
    const timeout = 5000; // 2.5 seconds

    if (null != etag) {
        headers['If-None-Match'] = etag;
    }

    const elapsed = Date.now() - lastFetch;
    if (elapsed < rate) {
        await wait(rate - elapsed);
    }
    lastFetch = Date.now();

    setTimeout(() => {
        controller.abort();
    }, timeout);

    const url = `${domain}/${path}`
    const response = await fetch(url, {
        headers,
        signal: controller.signal
    });

    return response;
}

async function getJsonIfNew(domain, path, preferCache) {
    let cache = await pageCache.read(domain, path);

    if (false !== cache && true === preferCache) {
        return cache;
    }

    let etag = false === cache ? null : cache.etag;
    let response;

    try {
        response = await getResponse(domain, path, etag);
    } catch (err) {
        console.error(`${err.name}: ${domain}/${path}`);
        return cache;
    }

    if (200 === response.status) {
        etag = response.headers.get('ETag');
        cache = await pageCache.write(domain, path, await response.json(), etag);
    } else if (-1 === [304, 404].indexOf(response.status)) {
        console.error(`${response.status}: ${domain}/${path}`);
    }

    return cache;
}

async function getTextIfNew(domain, path, preferCache) {
    let cache = await pageCache.read(domain, path);

    if (false !== cache && true === preferCache) {
        return cache;
    }

    let etag = false === cache ? null : cache.etag;

    const response = await getResponse(domain, path, etag);

    if (200 === response.status) {
        etag = response.headers.get('ETag');
        cache = await pageCache.write(domain, path, await response.text(), etag);
    }

    return cache;
}

module.exports = {
    json: getJsonIfNew,
    text: getTextIfNew
};
