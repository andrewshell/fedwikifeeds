const generateEtag = require('etag');

function cache(name, status, callback) {
    let response;

    try {
        const data = callback();

        response = new Hit(
            name,
            false,
            data
        );
    } catch (err) {
        if (status > cache.status.onlyFresh && cache.store.isset(name)) {
            response = cache.store.get(name);
            response.error = err;
        } else {
            response = new Miss(
                name,
                err
            );
        }
    }

    Object.freeze(response);
    return response;
}

cache.setStore = function (store) {
    cache.store = store;
}

class Hit {
    constructor(name, cached, data, etag) {
        this.version = 2;
        this.cacheName = name;
        this.cached = cached;
        this.created = new Date();
        this.data = data;
        this.error = null;
        this.etag = null == etag ? generateEtag(JSON.stringify(data)) : etag;
    }
}

class Miss {
    constructor(name, error) {
        this.version = 2;
        this.cacheName = name;
        this.error = error;
    }
}

cache.Hit = Hit;
cache.Miss = Miss;
cache.status = { onlyFresh: 0, cacheOnFail: 1, preferCache: 2, onlyCache: 3 };
Object.freeze(cache.status);

module.exports = cache;
