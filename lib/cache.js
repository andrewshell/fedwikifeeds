const cacheStoreCommon = require('./cache-store-common');

function _sanitize(string) {
  return string.replaceAll(new RegExp('[^a-z0-9]+', 'ig'), '-');
}

async function cache(cacheDomain, cachePath, status, callback) {
    let response, name = `${_sanitize(cacheDomain)}/${_sanitize(cachePath)}`;

    try {

        if (status >= cache.status.preferCache && await cache.store.isset(name)) {
            response = await cache.store.get(name);
        } else if (status === cache.status.onlyCache) {
            throw new Error('Missing cache');
        } else {
            response = new cacheStoreCommon.Hit(name, await callback());
            await cache.store.set(response);
        }
    } catch (err) {
        if (status >= cache.status.cacheOnFail && await cache.store.isset(name)) {
            response = await cache.store.get(name);
            response.error = err;
        } else {
            response = new cacheStoreCommon.Miss(name, err);
        }
    }

    Object.freeze(response);
    return response;
}

cache.setStore = function (store) {
    cache.store = store;
}

cache.status = { onlyFresh: 0, cacheOnFail: 1, preferCache: 2, onlyCache: 3 };

Object.freeze(cache.status);

module.exports = cache;
