const generateEtag = require('etag');

class Status {}

Status.onlyFresh = 0;
Status.cacheOnFail = 1;
Status.preferCache = 2;
Status.onlyCache = 3;

Object.freeze(Status);

class Hit {
    constructor(name, data, etag) {
        this.version = 2;
        this.cacheName = name;
        this.cached = false;
        this.created = new Date();
        this.data = data;
        this.error = null;
        this.etag = null == etag ? generateEtag(JSON.stringify(data)) : etag;
        this.isHit = true;
        this.isMiss = false;
    }
}

class Miss {
    constructor(name, error) {
        this.version = 2;
        this.cacheName = name;
        this.cached = false;
        this.created = new Date();
        this.data = null;
        this.error = error;
        this.etag = null;
        this.isHit = false;
        this.isMiss = true;
    }
}

class Data {
    constructor(version, name, created, data, etag) {
        this.version = version;
        this.cacheName = name;
        this.created = created;
        this.data = data;
        this.etag = etag;
    }

    hit() {
        if (2 !== this.version) {
            throw new Error(`Unknown cache version number: ${this.version}`);
        }

        const hit = new Hit(this.cacheName, this.data, this.etag);
        hit.cached = true;
        hit.created = this.created;

        return hit;
    }

    stringify() {
        return JSON.stringify({
            version: this.version,
            cacheName: this.cacheName,
            created: this.created,
            data: this.data,
            etag: this.etag,
        }, null, 2);
    }

    static fromHit(hit) {
        return new Data(hit.version, hit.cacheName, hit.created, hit.data, hit.etag);
    }

    static parse(value) {
        const parsed = JSON.parse(value);
        return new Data(parsed.version, parsed.cacheName, new Date(parsed.created), parsed.data, parsed.etag);
    }
}

module.exports = { Hit, Miss, Data, Status };
