const fetch = require('node-fetch');
const pageCache = require('./page-cache');
const wait = require('./wait');

let lastFetch = 0;

async function getResponse(scheme, domain, path, etag) {
    const controller = new AbortController();
    const headers = {};
    const rate = 1000; // 1 seconds
    const timeout = 10000; // 10 seconds

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

    const url = `${scheme}://${domain}/${path}`
    const response = await fetch(url, {
        headers,
        signal: controller.signal
    });

    return response;
}

async function getJsonIfNew(scheme, domain, path, preferCache) {
    let cache = await pageCache.read(domain, `${scheme}-${path}`);

    if (false !== cache && true === preferCache) {
        return cache;
    }

    let etag = false === cache ? null : cache.etag;
    let response;

    try {
        response = await getResponse(scheme, domain, path, etag);
    } catch (err) {
        console.error(`${err.name}: ${scheme}://${domain}/${path}`);
        return cache;
    }

    if (200 === response.status) {
        etag = response.headers.get('ETag');
        cache = await pageCache.write(domain, `${scheme}-${path}`, await response.json(), etag);
    } else if (-1 === [304, 404].indexOf(response.status)) {
        console.error(`${response.status}: ${scheme}://${domain}/${path}`);
    }

    return cache;
}

async function getTextIfNew(scheme, domain, path, preferCache) {
    let cache = await pageCache.read(domain, `${scheme}-${path}`);

    if (false !== cache && true === preferCache) {
        return cache;
    }

    let etag = false === cache ? null : cache.etag;
    let response;

    try {
        response = await getResponse(scheme, domain, path, etag);
    } catch (err) {
        console.error(`${err.name}: ${scheme}://${domain}/${path}`);
        return cache;
    }

    if (200 === response.status) {
        etag = response.headers.get('ETag');
        cache = await pageCache.write(domain, `${scheme}-${path}`, await response.text(), etag);
    } else if (-1 === [304, 404].indexOf(response.status)) {
        console.error(`${response.status}: ${scheme}://${domain}/${path}`);
    }

    return cache;
}

module.exports = {
    json: getJsonIfNew,
    text: getTextIfNew
};
