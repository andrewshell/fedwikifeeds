const cacheStoreCommon = require('./cache-store-common');

function _sanitize(string) {
  return string.replaceAll(new RegExp('[^a-z0-9]+', 'ig'), '-');
}

function Cache(store) {
    this.store = store;
    this.status = cacheStoreCommon.Status;
}

Cache.prototype.decorate = async function (cacheDomain, cachePath, status, callback) {
    let response, name = this.cacheName(cacheDomain, cachePath);

    try {

        let existing = new cacheStoreCommon.Miss(name, new Error('Missing cache'));
        let hasCache = await this.store.isset(name);

        if (hasCache) {
            existing = await this.store.get(name);
        }

        if (status >= this.status.preferCache && hasCache) {
            response = existing;
        } else if (status === this.status.onlyCache) {
            throw new Error('Missing cache');
        } else {
            response = await callback(existing);
            if (!(response instanceof cacheStoreCommon.Hit)) {
                response = new cacheStoreCommon.Hit(name, response);
            }
            await this.store.set(response);
        }

    } catch (err) {

        if (status >= this.status.cacheOnFail && await this.store.isset(name)) {
            response = await this.store.get(name);
            response.error = err;
        } else {
            response = new cacheStoreCommon.Miss(name, err);
        }

    }

    Object.freeze(response);
    return response;
}

Cache.prototype.cacheName = function (cacheDomain, cachePath) {
    return `${_sanitize(cacheDomain)}/${_sanitize(cachePath)}`;
}

Cache.prototype.setStore = function (store) {
    this.store = store;
}

Cache.prototype.hit = function (name, data, etag) {
    return new cacheStoreCommon.Hit(name, data, etag);
}

Cache.prototype.miss = function (name, error) {
    return new cacheStoreCommon.Miss(name, error);
}

Object.freeze(Cache.status);

module.exports = Cache;
