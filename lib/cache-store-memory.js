const cacheStoreMemory = { data: {} };

cacheStoreMemory.get = (name) => {
    return cacheStoreMemory.data[name];
}

cacheStoreMemory.set = (name, value) => {
    cacheStoreMemory.data[name] = value;
}

cacheStoreMemory.isset = (name) => {
    return null != cacheStoreMemory.data[name];
}

cacheStoreMemory.unset = (name) => {
    delete cacheStoreMemory.data[name];
}

module.exports = cacheStoreMemory;
