const config = require('../config');
const crypto = require('crypto');
const path = require('path');
const generateEtag = require('etag');
const { readFile, writeFile } = require('fs/promises');

function sha1hash(value) {
    const sha1 = crypto.createHash('sha1');
    const data = sha1.update(value, 'utf-8');
    return data.digest('hex');
}

async function readCache(cachename) {
    const hash = sha1hash(cachename);
    const filename = path.resolve(config.datadir, `./${hash}.json`);

    try {
        const contents = await readFile(filename, 'utf-8');

        const cache = JSON.parse(contents);

        cache.created = new Date(cache.created);
        cache.cached = true;
        if (undefined === cache.version) {
            cache.data = JSON.parse(cache.data);
        }

        return cache;
    } catch (err) {
        return false;
    }
}

async function writeCache(cachename, data, etag) {
    const hash = sha1hash(cachename);
    const filename = path.resolve(config.datadir, `./${hash}.json`);

    try {
        const cache = {
            version: 2,
            cachename,
            created: (new Date()).toISOString(),
            data
        };

        cache.etag = null == etag ? generateEtag(JSON.stringify(data)) : etag;

        const contents = JSON.stringify(cache, null, 2);

        await writeFile(filename, contents, 'utf-8');

        cache.data = data;
        cache.cached = false;

        return cache;
    } catch (err) {
        console.error(err);
        return false;
    }
}

module.exports = {
    read: readCache,
    write: writeCache
};
