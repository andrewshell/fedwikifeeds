const config = require('../config');
const crypto = require('crypto');
const path = require('path');
const generateEtag = require('etag');
const fs = require('fs');
const { readFile, writeFile, rm } = require('fs/promises');

function sha1hash(value) {
  const sha1 = crypto.createHash('sha1');
  const data = sha1.update(value, 'utf-8');
  return data.digest('hex');
}

async function _mkdir(cacheDomain) {
  const dirpath = path.resolve(config.datadir, cacheDomain);
  if (false === fs.existsSync(config.datadir)) {
    fs.mkdirSync(config.datadir, { recursive: true });
  }
  if (false === fs.existsSync(dirpath)) {
    fs.mkdirSync(dirpath);
  }
}

async function _deleteCache(cacheName) {
  const filename = path.resolve(config.datadir, cacheName);
  try {
    await rm(filename);
    return true;
  } catch (err) {
    return false;
  }
}

async function _readCache(cacheName) {
  const filename = path.resolve(config.datadir, cacheName);
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

function _sanitize(string) {
  return string.replaceAll(new RegExp('[^a-z0-9]+', 'ig'), '-');
}

function formatCache(cacheDomain, cachePath, data, etag) {
  const cacheName = `${_sanitize(cacheDomain)}/${_sanitize(cachePath)}.json`;

  try {
    const cache = {
      version: 2,
      cacheName,
      created: (new Date()).toISOString(),
      data
    };

    cache.etag = null == etag ? generateEtag(JSON.stringify(data)) : etag;

    return cache;
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function readCache(cacheDomain, cachePath) {
  let cacheName, cacheNames = [], hash, cache;
  cacheNames.push(`${_sanitize(cacheDomain)}/${_sanitize(cachePath)}.json`);

  hash = sha1hash(`${_sanitize(cacheDomain)}/${_sanitize(cachePath)}.json`);
  cacheNames.push(`${hash}.json`);

  hash = sha1hash(`/${_sanitize(cachePath)}.json`);
  cacheNames.push(`${hash}.json`);

  hash = sha1hash(`${_sanitize(cachePath)}.json`);
  cacheNames.push(`${hash}.json`);

  for (cacheName of cacheNames) {
    cache = await _readCache(cacheName);
    if (false !== cache) {
      if (cacheName !== cacheNames[0]) {
        cache = await writeCache(cacheDomain, cachePath, cache.data, cache.etag);
        await _deleteCache(cacheName);
      }
      return cache;
    }
  }

  return cache;
}

async function writeCache(cacheDomain, cachePath, data, etag) {
  try {
    const cache = formatCache(cacheDomain, cachePath, data, etag);

    const filename = path.resolve(config.datadir, cache.cacheName);

    const contents = JSON.stringify(cache, null, 2);

    _mkdir(_sanitize(cacheDomain));
    await writeFile(filename, contents, 'utf-8');

    cache.cached = false;

    return cache;
  } catch (err) {
    console.error(err);
    return false;
  }
}

module.exports = {
  format: formatCache,
  read: readCache,
  write: writeCache
};
