const config = require('../config');
const cacheStoreCommon = require('./cache-store-common');
const cacheStoreFilesystem = { data: {} };
const path = require('path');
const { readFile, writeFile, rm } = require('fs/promises');

cacheStoreFilesystem.get = async (cacheName) => {
    const filename = path.resolve(config.datadir, `${cacheName}.json`);
    const data = await readFile(filename, 'utf8');
    return cacheStoreCommon.Data.parse(data).hit();
}

cacheStoreFilesystem.set = async (hit) => {
    const filename = path.resolve(config.datadir, `${cacheName}.json`);
    await writeFile(filename, 'utf8', cacheStoreCommon.Data.fromHit(hit).stringify());
}

cacheStoreFilesystem.isset = async (cacheName) => {
    const filename = path.resolve(config.datadir, `${cacheName}.json`);
    try {
        await fsPromise.stat(filename);
        return true;
    } catch (err) {
        return false;
    }
}

cacheStoreFilesystem.unset = async (cacheName) => {
    const filename = path.resolve(config.datadir, `${cacheName}.json`);
    await rm(filename, { force: true });
}

module.exports = cacheStoreFilesystem;
