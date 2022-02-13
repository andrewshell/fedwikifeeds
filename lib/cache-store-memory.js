const cacheStoreCommon = require('./cache-store-common');
const cacheStoreMemory = { data: {} };

cacheStoreMemory.get = (cacheName) => {
    return cacheStoreCommon.Data.parse(cacheStoreMemory.data[cacheName]).hit();
}

cacheStoreMemory.set = (hit) => {
    cacheStoreMemory.data[hit.cacheName] = cacheStoreCommon.Data.fromHit(hit);
}

cacheStoreMemory.isset = (cacheName) => {
    return null != cacheStoreMemory.data[cacheName];
}

cacheStoreMemory.unset = (cacheName) => {
    delete cacheStoreMemory.data[cacheName];
}

module.exports = cacheStoreMemory;
