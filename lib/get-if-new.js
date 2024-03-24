const Cacheism = require('@andrewshell/cacheism');
const fetch = require('node-fetch');

const log = require('./log');
const logPrefix = 'get-if-new    ';

function sleep(milisec) {
    return new Promise(resolve => {
        setTimeout(() => { resolve('') }, milisec);
    })
}

function factory(cache) {

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
      await sleep(rate - elapsed);
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

  function getCacheName(scheme, domain, path) {
    return cache.cacheName(domain, `${scheme}-${path}`);
  }

  async function getJsonIfNew(scheme, domain, path, cachePref) {
    return cache.go(domain, `${scheme}-${path}`, cachePref || Cacheism.Status.cacheOnFail, async (existing) => {
      try {
        response = await getResponse(scheme, domain, path, existing.etag);
      } catch (err) {
        log.error(logPrefix, '%s: %s://%s/%s', err.name, scheme, domain, path);
        if (cachePref === Cacheism.Status.onlyFresh) {
          return new Cacheism.Miss(existing.cacheName, err);
        } else {
          return existing;
        }
      }

      if (200 === response.status) {
        etag = response.headers.get('ETag');
        return new Cacheism.Hit(existing.cacheName, await response.json(), etag);
      } else if (-1 === [304, 404].indexOf(response.status)) {
        log.error(logPrefix, '%s: %s://%s/%s', response.status, scheme, domain, path);
        return existing;
      }
    });
  }

  async function getTextIfNew(scheme, domain, path, cachePref) {
    return cache.go(domain, `${scheme}-${path}`, cachePref || Cacheism.Status.cacheOnFail, async (existing) => {
      try {
        response = await getResponse(scheme, domain, path, existing.etag);
      } catch (err) {
        log.error(logPrefix, '%s: %s://%s/%s', err.name, scheme, domain, path);
        if (cachePref === Cacheism.Status.onlyFresh) {
          return new Cacheism.Miss(existing.cacheName, err);
        } else {
          throw new Error('test');
          return existing;
        }
      }

      if (200 === response.status) {
        etag = response.headers.get('ETag');
        return new Cacheism.Hit(existing.cacheName, await response.text(), etag);
      } else if (-1 === [304, 404].indexOf(response.status)) {
        log.error(logPrefix, '%s: %s://%s/%s', response.status, scheme, domain, path);
        return existing;
      }
    });
  }

  return {
    json: getJsonIfNew,
    text: getTextIfNew,
    name: getCacheName
  }
}

module.exports = factory;
