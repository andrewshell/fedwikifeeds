const cacheStoreCommon = require('./cache-store-common');
const cacheStoreFilesystem = { };
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');

module.exports = function (config) {
    function _mkdir(dirpath) {
      if (false === fs.existsSync(dirpath)) {
        fs.mkdirSync(dirpath, { recursive: true });
      }
    }

    _mkdir(config.datadir);

    cacheStoreFilesystem.get = async (cacheName) => {
        const filename = path.resolve(config.datadir, `${cacheName}.json`);
        const data = await fsPromises.readFile(filename, 'utf8');
        return cacheStoreCommon.Data.parse(data).hit();
    }

    cacheStoreFilesystem.set = async (hit) => {
        const filename = path.resolve(config.datadir, `${hit.cacheName}.json`);
        _mkdir(path.dirname(filename));
        await fsPromises.writeFile(filename, cacheStoreCommon.Data.fromHit(hit).stringify(), 'utf8');
    }

    cacheStoreFilesystem.isset = async (cacheName) => {
        const filename = path.resolve(config.datadir, `${cacheName}.json`);
        return fs.existsSync(filename);
    }

    cacheStoreFilesystem.unset = async (cacheName) => {
        const filename = path.resolve(config.datadir, `${cacheName}.json`);
        await fsPromises.rm(filename, { force: true });
    }

    return cacheStoreFilesystem;
}
