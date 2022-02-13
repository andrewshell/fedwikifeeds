const cacheStoreCommon = require('./cache-store-common');

function cache(name, status, callback) {
    let response;

    try {
        const data = callback();

        response = new cacheStoreCommon.Hit(
            name,
            data
        );

        cache.store.set(response);
    } catch (err) {
        if (status > cache.status.onlyFresh && cache.store.isset(name)) {
            response = cache.store.get(name);
            response.error = err;
        } else {
            response = new cacheStoreCommon.Miss(
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

cache.status = { onlyFresh: 0, cacheOnFail: 1, preferCache: 2, onlyCache: 3 };

Object.freeze(cache.status);

module.exports = cache;
