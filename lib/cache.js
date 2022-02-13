const generateEtag = require('etag');

function cache(name, status, callback) {
    try {
        const data = callback();

        return new Hit(
            name,
            false,
            data
        );
    } catch (err) {
        return new Miss(
            name,
            err
        );
    }
}

class Hit {
    constructor(name, cached, data, error, etag) {
        this.version = 2;
        this.cacheName = name;
        this.cached = cached;
        this.created = new Date();
        this.data = data;
        this.error = error ?? null;
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
