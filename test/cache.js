const expect = require('expect.js');
const cache = require('../lib/cache');

describe('cache', function() {

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

  it.skip('should return a cache.Miss on error if status=onlyFresh', function () {
    /**
     * @todo #1 Since onlyFresh never touches the file cache, if the callback
     *  throws an error it should return a cache.Miss object.
     */
  });

  it.skip('should return a cache.Miss on error if status=cacheOnFail and no cache', function () {
    /**
     * @todo #1 If status=cacheOnFail and no cache, if the callback
     *  throws an error it should return a cache.Miss object.
     */
  });

  it.skip('should return a cache.Hit on error if status=cacheOnFail with cache', function () {
    /**
     * @todo #1 If status=cacheOnFail and existing cache, if the callback
     *  throws an error it should return a cache.Hit object.
     */
  });

  it.skip('should return a cache.Hit on error if status=cacheOnFail with cache', function () {
    /**
     * @todo #1 If status=cacheOnFail and existing cache, if the callback
     *  succeeds it should return a cache.Hit object with the live value and save to
     *  the cache.
     */
  });
});
