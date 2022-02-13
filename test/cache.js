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

  it('should return a cacheStoreCommon.Hit with the live value if status=onlyFresh', function () {
    const c = cache('_internal/nocache', cache.status.onlyFresh, () => {
      return 'live';
    });

    expect(c).to.be.a(cacheStoreCommon.Hit);
    expect(c).to.have.property('version', 2);
    expect(c).to.have.property('cacheName', '_internal/nocache');
    expect(c).to.have.property('cached', false);
    expect(c).to.have.property('created');
    expect(c.created).to.be.a(Date);
    expect(c).to.have.property('data', 'live');
    expect(c).to.have.property('error', null);
    expect(c).to.have.property('etag');
  });

  it('should return a cacheStoreCommon.Miss on error if status=onlyFresh', function () {
    const c = cache('_internal/nocache', cache.status.onlyFresh, () => {
      throw Error('cache error');
    });

    expect(c).to.be.a(cacheStoreCommon.Miss);
    expect(c).to.have.property('version', 2);
    expect(c).to.have.property('cacheName', '_internal/nocache');
    expect(c).to.have.property('error');
    expect(c.error).to.be.an(Error);
    expect(c.error).to.have.property('message', 'cache error');
  });

  it('should update cache with successful live value if status=onlyFresh', function () {
    const c = cache('_internal/true', cache.status.onlyFresh, () => {
      return 'live';
    });

    expect(c).to.be.a(cacheStoreCommon.Hit);
    expect(c).to.have.property('version', 2);
    expect(c).to.have.property('cacheName', '_internal/true');
    expect(c).to.have.property('cached', false);
    expect(c).to.have.property('created');
    expect(c.created).to.be.a(Date);
    expect(c).to.have.property('data', 'live');
    expect(c).to.have.property('error', null);
    expect(c).to.have.property('etag');

    expect(cache.store.data).to.have.property('_internal/true');
    expect(cache.store.data['_internal/true']).to.be.a(cacheStoreCommon.Data);
    expect(cache.store.data['_internal/true']).to.have.property('etag', c.etag);
  });

  it('should return a cacheStoreCommon.Miss on error if status=cacheOnFail and no cache', function () {
    const c = cache('_internal/nocache', cache.status.cacheOnFail, () => {
      throw Error('cache error');
    });

    expect(c).to.be.a(cacheStoreCommon.Miss);
    expect(c).to.have.property('version', 2);
    expect(c).to.have.property('cacheName', '_internal/nocache');
    expect(c).to.have.property('error');
    expect(c.error).to.be.an(Error);
    expect(c.error).to.have.property('message', 'cache error');
  });

  it('should return a cacheStoreCommon.Hit on error if status=cacheOnFail with cache', function () {
    cache.store.data['_internal/true'] = cacheStoreCommon.Data.fromHit(
      new cacheStoreCommon.Hit('_internal/true', 'cached')
    ).stringify();

    const c = cache('_internal/true', cache.status.cacheOnFail, () => {
      throw Error('cache error');
    });

    expect(c).to.be.a(cacheStoreCommon.Hit);
    expect(c).to.have.property('version', 2);
    expect(c).to.have.property('cacheName', '_internal/true');
    expect(c).to.have.property('cached', true);
    expect(c).to.have.property('created');
    expect(c.created).to.be.a(Date);
    expect(c).to.have.property('data', 'cached');
    expect(c).to.have.property('error');
    expect(c.error).to.be.an(Error);
    expect(c.error).to.have.property('message', 'cache error');
    expect(c).to.have.property('etag');
  });

  it('should return a cacheStoreCommon.Hit with the live value if status=cacheOnFail with cache', function () {
    cache.store.data['_internal/true'] = cacheStoreCommon.Data.fromHit(
      new cacheStoreCommon.Hit('_internal/true', 'cached')
    ).stringify();

    const c = cache('_internal/true', cache.status.cacheOnFail, () => {
      return 'live';
    });

    expect(c).to.be.a(cacheStoreCommon.Hit);
    expect(c).to.have.property('version', 2);
    expect(c).to.have.property('cacheName', '_internal/true');
    expect(c).to.have.property('cached', false);
    expect(c).to.have.property('created');
    expect(c.created).to.be.a(Date);
    expect(c).to.have.property('data', 'live');
    expect(c).to.have.property('error', null);
    expect(c).to.have.property('etag');
  });
});
