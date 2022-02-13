const expect = require('expect.js');
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

  it('should return a cache.Hit with the live value if status=onlyFresh', function () {
    const c = cache('_internal/nocache', cache.status.onlyFresh, () => {
      return 'live';
    });

    expect(c).to.be.a(cache.Hit);
    expect(c).to.have.property('version', 2);
    expect(c).to.have.property('cacheName', '_internal/nocache');
    expect(c).to.have.property('cached', false);
    expect(c).to.have.property('created');
    expect(c.created).to.be.a(Date);
    expect(c).to.have.property('data', 'live');
    expect(c).to.have.property('error', null);
    expect(c).to.have.property('etag');
  });

  it('should return a cache.Miss on error if status=onlyFresh', function () {
    const c = cache('_internal/nocache', cache.status.onlyFresh, () => {
      throw Error('cache error');
    });

    expect(c).to.be.a(cache.Miss);
    expect(c).to.have.property('version', 2);
    expect(c).to.have.property('cacheName', '_internal/nocache');
    expect(c).to.have.property('error');
    expect(c.error).to.be.an(Error);
    expect(c.error).to.have.property('message', 'cache error');
  });

  it('should return a cache.Miss on error if status=cacheOnFail and no cache', function () {
    const c = cache('_internal/nocache', cache.status.cacheOnFail, () => {
      throw Error('cache error');
    });

    expect(c).to.be.a(cache.Miss);
    expect(c).to.have.property('version', 2);
    expect(c).to.have.property('cacheName', '_internal/nocache');
    expect(c).to.have.property('error');
    expect(c.error).to.be.an(Error);
    expect(c.error).to.have.property('message', 'cache error');
  });

  it('should return a cache.Hit on error if status=cacheOnFail with cache', function () {
    /**
     * @todo #1 If status=cacheOnFail and existing cache, if the callback
     *  throws an error it should return a cache.Hit object.
     */
    cache.store.data['_internal/true'] = new cache.Hit('_internal/true', true, 'cached');
    const c = cache('_internal/true', cache.status.cacheOnFail, () => {
      throw Error('cache error');
    });

    expect(c).to.be.a(cache.Hit);
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

  it.skip('should return a cache.Hit on error if status=cacheOnFail with cache', function () {
    /**
     * @todo #1 If status=cacheOnFail and existing cache, if the callback
     *  succeeds it should return a cache.Hit object with the live value and save to
     *  the cache.
     */
    cache.status['_internal/true'] = 'cached';
    const c = cache('_internal/true', cache.status.cacheOnFail, () => {
      return 'live';
    });

    expect(c).to.be.a(cache.Hit);
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
