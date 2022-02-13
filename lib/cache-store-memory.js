const cacheStoreCommon = require('./cache-store-common');
const cacheStoreMemory = { data: {} };

cacheStoreMemory.get = async (cacheName) => {
    return cacheStoreCommon.Data.parse(cacheStoreMemory.data[cacheName]).hit();
}

cacheStoreMemory.set = async (hit) => {
    cacheStoreMemory.data[hit.cacheName] = cacheStoreCommon.Data.fromHit(hit);
}

cacheStoreMemory.isset = async (cacheName) => {
    return null != cacheStoreMemory.data[cacheName];
}

cacheStoreMemory.unset = async (cacheName) => {
    delete cacheStoreMemory.data[cacheName];
}

module.exports = cacheStoreMemory;
