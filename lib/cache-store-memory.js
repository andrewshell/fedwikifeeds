const cacheStoreCommon = require('./cache-store-common');

module.exports = function (config) {
    const cacheStoreMemory = { data: {} };

    cacheStoreMemory.get = async (cacheName) => {
        return cacheStoreCommon.Data.parse(cacheStoreMemory.data[cacheName]).hit();
    }

    cacheStoreMemory.set = async (hit) => {
        cacheStoreMemory.data[hit.cacheName] = cacheStoreCommon.Data.fromHit(hit).stringify();
    }

    cacheStoreMemory.isset = async (cacheName) => {
        return null != cacheStoreMemory.data[cacheName];
    }

    cacheStoreMemory.unset = async (cacheName) => {
        delete cacheStoreMemory.data[cacheName];
    }

    return cacheStoreMemory;
}
