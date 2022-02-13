const expect = require('expect.js');

const cacheStoreCommon = require('../lib/cache-store-common');
const cache = require('../lib/cache');
cache.setStore(require('../lib/cache-store-memory'));

describe('cache', function() {

  beforeEach(function() {
    // runs before each test in this block
    cache.store.data = {};
  });

  it('should export as a function', function() {
    expect(cache).to.be.a('function');
  });

  describe('when status=onlyFresh', async function () {

    it('should return a Hit with the live value', async function () {
      const c = await cache('_internal', 'nocache', cache.status.onlyFresh, async () => {
        return 'live';
      });

      expect(c).to.be.a(cacheStoreCommon.Hit);
      expect(c).to.have.property('version', 2);
      expect(c).to.have.property('cacheName', '-internal/nocache');
      expect(c).to.have.property('cached', false);
      expect(c).to.have.property('created');
      expect(c.created).to.be.a(Date);
      expect(c).to.have.property('data', 'live');
      expect(c).to.have.property('error', null);
      expect(c).to.have.property('etag');
    });

    it('should return a Miss on error', async function () {
      const c = await cache('_internal', 'nocache', cache.status.onlyFresh, async () => {
        throw Error('cache error');
      });

      expect(c).to.be.a(cacheStoreCommon.Miss);
      expect(c).to.have.property('version', 2);
      expect(c).to.have.property('cacheName', '-internal/nocache');
      expect(c).to.have.property('error');
      expect(c.error).to.be.an(Error);
      expect(c.error).to.have.property('message', 'cache error');
    });

    it('should update cache with successful live value', async function () {
      const c = await cache('_internal', 'true', cache.status.onlyFresh, async () => {
        return 'live';
      });

      expect(c).to.be.a(cacheStoreCommon.Hit);
      expect(c).to.have.property('version', 2);
      expect(c).to.have.property('cacheName', '-internal/true');
      expect(c).to.have.property('cached', false);
      expect(c).to.have.property('created');
      expect(c.created).to.be.a(Date);
      expect(c).to.have.property('data', 'live');
      expect(c).to.have.property('error', null);
      expect(c).to.have.property('etag');

      expect(cache.store.data).to.have.property('-internal/true');

      const d = cacheStoreCommon.Data.parse(cache.store.data['-internal/true']);
      expect(d).to.be.a(cacheStoreCommon.Data);
      expect(d).to.have.property('data', 'live');
      expect(d).to.have.property('etag', c.etag);
    });

  });

  describe('when status=cacheOnFail', function () {

    it('should return a Miss on error with no cache', async function () {
      const c = await cache('_internal', 'nocache', cache.status.cacheOnFail, async () => {
        throw Error('cache error');
      });

      expect(c).to.be.a(cacheStoreCommon.Miss);
      expect(c).to.have.property('version', 2);
      expect(c).to.have.property('cacheName', '-internal/nocache');
      expect(c).to.have.property('error');
      expect(c.error).to.be.an(Error);
      expect(c.error).to.have.property('message', 'cache error');
    });

    it('should return a Hit on error with cache', async function () {
      cache.store.data['-internal/true'] = cacheStoreCommon.Data.fromHit(
        new cacheStoreCommon.Hit('-internal/true', 'cached')
      ).stringify();

      const c = await cache('_internal', 'true', cache.status.cacheOnFail, async () => {
        throw Error('cache error');
      });

      expect(c).to.be.a(cacheStoreCommon.Hit);
      expect(c).to.have.property('version', 2);
      expect(c).to.have.property('cacheName', '-internal/true');
      expect(c).to.have.property('cached', true);
      expect(c).to.have.property('created');
      expect(c.created).to.be.a(Date);
      expect(c).to.have.property('data', 'cached');
      expect(c).to.have.property('error');
      expect(c.error).to.be.an(Error);
      expect(c.error).to.have.property('message', 'cache error');
      expect(c).to.have.property('etag');
    });

    it('should return a Hit with the live value with cache', async function () {
      cache.store.data['-internal/true'] = cacheStoreCommon.Data.fromHit(
        new cacheStoreCommon.Hit('-internal/true', 'cached')
      ).stringify();

      const c = await cache('_internal', 'true', cache.status.cacheOnFail, async () => {
        return 'live';
      });

      expect(c).to.be.a(cacheStoreCommon.Hit);
      expect(c).to.have.property('version', 2);
      expect(c).to.have.property('cacheName', '-internal/true');
      expect(c).to.have.property('cached', false);
      expect(c).to.have.property('created');
      expect(c.created).to.be.a(Date);
      expect(c).to.have.property('data', 'live');
      expect(c).to.have.property('error', null);
      expect(c).to.have.property('etag');
    });

    it('should update cache with successful live value', async function () {
      cache.store.data['-internal/true'] = cacheStoreCommon.Data.fromHit(
        new cacheStoreCommon.Hit('-internal/true', 'cached')
      ).stringify();

      const c = await cache('_internal', 'true', cache.status.cacheOnFail, async () => {
        return 'live';
      });

      expect(c).to.be.a(cacheStoreCommon.Hit);
      expect(c).to.have.property('version', 2);
      expect(c).to.have.property('cacheName', '-internal/true');
      expect(c).to.have.property('cached', false);
      expect(c).to.have.property('created');
      expect(c.created).to.be.a(Date);
      expect(c).to.have.property('data', 'live');
      expect(c).to.have.property('error', null);
      expect(c).to.have.property('etag');

      expect(cache.store.data).to.have.property('-internal/true');

      const d = cacheStoreCommon.Data.parse(cache.store.data['-internal/true']);
      expect(d).to.be.a(cacheStoreCommon.Data);
      expect(d).to.have.property('data', 'live');
      expect(d).to.have.property('etag', c.etag);
    });

  });

  describe('when status=preferCache', function () {

    it('should return a Miss on error with no cache', async function () {
      const c = await cache('_internal', 'nocache', cache.status.preferCache, async () => {
        throw Error('cache error');
      });

      expect(c).to.be.a(cacheStoreCommon.Miss);
      expect(c).to.have.property('version', 2);
      expect(c).to.have.property('cacheName', '-internal/nocache');
      expect(c).to.have.property('error');
      expect(c.error).to.be.an(Error);
      expect(c.error).to.have.property('message', 'cache error');
    });

    it('should return a Hit with the cached value with cache', async function () {
      cache.store.data['-internal/true'] = cacheStoreCommon.Data.fromHit(
        new cacheStoreCommon.Hit('-internal/true', 'cached')
      ).stringify();

      const c = await cache('_internal', 'true', cache.status.preferCache, async () => {
        return 'live';
      });

      expect(c).to.be.a(cacheStoreCommon.Hit);
      expect(c).to.have.property('version', 2);
      expect(c).to.have.property('cacheName', '-internal/true');
      expect(c).to.have.property('cached', true);
      expect(c).to.have.property('created');
      expect(c.created).to.be.a(Date);
      expect(c).to.have.property('data', 'cached');
      expect(c).to.have.property('error', null);
      expect(c).to.have.property('etag');
    });

    it('should return a Hit with the live value with no cache', async function () {
      const c = await cache('_internal', 'true', cache.status.preferCache, async () => {
        return 'live';
      });

      expect(c).to.be.a(cacheStoreCommon.Hit);
      expect(c).to.have.property('version', 2);
      expect(c).to.have.property('cacheName', '-internal/true');
      expect(c).to.have.property('cached', false);
      expect(c).to.have.property('created');
      expect(c.created).to.be.a(Date);
      expect(c).to.have.property('data', 'live');
      expect(c).to.have.property('error', null);
      expect(c).to.have.property('etag');
    });

  });

  describe('when status=onlyCache', function () {
    it('should return a Miss on error with no cache', async function () {
      const c = await cache('_internal', 'nocache', cache.status.onlyCache, async () => {
        throw Error('cache error');
      });

      expect(c).to.be.a(cacheStoreCommon.Miss);
      expect(c).to.have.property('version', 2);
      expect(c).to.have.property('cacheName', '-internal/nocache');
      expect(c).to.have.property('error');
      expect(c.error).to.be.an(Error);
      expect(c.error).to.have.property('message', 'Missing cache');
    });

    it('should return a Hit with the cached value with cache', async function () {
      cache.store.data['-internal/true'] = cacheStoreCommon.Data.fromHit(
        new cacheStoreCommon.Hit('-internal/true', 'cached')
      ).stringify();

      const c = await cache('_internal', 'true', cache.status.onlyCache, async () => {
        return 'live';
      });

      expect(c).to.be.a(cacheStoreCommon.Hit);
      expect(c).to.have.property('version', 2);
      expect(c).to.have.property('cacheName', '-internal/true');
      expect(c).to.have.property('cached', true);
      expect(c).to.have.property('created');
      expect(c.created).to.be.a(Date);
      expect(c).to.have.property('data', 'cached');
      expect(c).to.have.property('error', null);
      expect(c).to.have.property('etag');
    });

    it('should return a Miss with no cache', async function () {
      const c = await cache('_internal', 'nocache', cache.status.onlyCache, async () => {
        return 'live';
      });

      expect(c).to.be.a(cacheStoreCommon.Miss);
      expect(c).to.have.property('version', 2);
      expect(c).to.have.property('cacheName', '-internal/nocache');
      expect(c).to.have.property('error');
      expect(c.error).to.be.an(Error);
      expect(c.error).to.have.property('message', 'Missing cache');
    });

  });
});
