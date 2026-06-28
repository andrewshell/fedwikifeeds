jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');
const { Cacheism } = require('@andrewshell/cacheism');
const factory = require('../lib/get-if-new');
const log = require('../lib/log');

const START = new Date('2022-01-01T00:00:00.000Z').getTime();

// NOTE ON CACHEISM SEMANTICS
// As of @andrewshell/cacheism 3.0.1, cache.go() honors a Miss *returned* by the
// callback (not just one thrown): `if (result instanceof Miss) response = result`.
// get-if-new returns `existing` / `new Cacheism.Miss(...)` to signal failures, so on
// failure with an EMPTY cache the caller now receives a real Miss. The populated-cache
// paths return the real cached Hit.

// Build a minimal node-fetch-style Response.
function response(status, body, etag) {
  return {
    status,
    headers: {
      get: (name) => (name.toLowerCase() === 'etag' ? (etag === undefined ? null : etag) : null),
    },
    json: jest.fn().mockResolvedValue(body),
    text: jest
      .fn()
      .mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('get-if-new', () => {
  let cache;
  let getIfNew;

  // Seed the cache so the "existing" value handed to the callback is a real Hit.
  async function seed(scheme, domain, path, data, etag) {
    const name = cache.cacheName(domain, `${scheme}-${path}`);
    await cache.go(domain, `${scheme}-${path}`, Cacheism.Status.onlyFresh, async () =>
      new Cacheism.Hit(name, data, etag)
    );
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(START);
    cache = new Cacheism(Cacheism.store.memory());
    getIfNew = factory(cache);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('name', () => {
    it('builds the cache name from domain, scheme and path (sanitized by Cacheism)', () => {
      // Cacheism v3 replaces runs of non-alphanumeric chars with a single dash.
      expect(getIfNew.name('http', 'Example.com', 'page.json')).toBe(
        'Example-com/http-page-json'
      );
    });
  });

  describe('json', () => {
    it('returns a Hit with the parsed body and ETag on a 200', async () => {
      fetch.mockResolvedValue(response(200, { foo: 'bar' }, 'etag-1'));

      const c = await getIfNew.json('http', 'example.com', 'p.json', Cacheism.Status.onlyFresh);

      expect(c.isHit).toBe(true);
      expect(c.data).toEqual({ foo: 'bar' });
      expect(c.etag).toBe('etag-1');
      expect(fetch).toHaveBeenCalledWith(
        'http://example.com/p.json',
        expect.objectContaining({ headers: {}, signal: expect.anything() })
      );
    });

    it('sends If-None-Match and keeps the cached value on a 304', async () => {
      await seed('http', 'example.com', 'p.json', { cached: true }, 'old-etag');
      fetch.mockResolvedValue(response(304));

      const c = await getIfNew.json('http', 'example.com', 'p.json', Cacheism.Status.onlyFresh);

      expect(fetch).toHaveBeenCalledWith(
        'http://example.com/p.json',
        expect.objectContaining({ headers: { 'If-None-Match': 'old-etag' } })
      );
      expect(c.isHit).toBe(true);
      expect(c.data).toEqual({ cached: true });
    });

    it('keeps the cached value on a 404', async () => {
      await seed('http', 'example.com', 'p.json', { cached: true }, 'e');
      fetch.mockResolvedValue(response(404));

      const c = await getIfNew.json('http', 'example.com', 'p.json', Cacheism.Status.onlyFresh);

      expect(c.isHit).toBe(true);
      expect(c.data).toEqual({ cached: true });
    });

    it('logs and keeps the cached value on an unexpected status', async () => {
      const errorSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
      await seed('http', 'example.com', 'p.json', { cached: true }, 'e');
      fetch.mockResolvedValue(response(500));

      const c = await getIfNew.json('http', 'example.com', 'p.json', Cacheism.Status.onlyFresh);

      expect(errorSpy).toHaveBeenCalled();
      expect(c.isHit).toBe(true);
      expect(c.data).toEqual({ cached: true });
    });

    it('falls back to the cached value when the fetch throws under cacheOnFail', async () => {
      jest.spyOn(log, 'error').mockImplementation(() => {});
      await seed('http', 'example.com', 'p.json', { old: 1 }, 'e1');
      fetch.mockRejectedValue(new Error('network fail'));

      const c = await getIfNew.json('http', 'example.com', 'p.json', Cacheism.Status.cacheOnFail);

      expect(c.isHit).toBe(true);
      expect(c.data).toEqual({ old: 1 });
    });

    it('defaults to cacheOnFail when no cache preference is given', async () => {
      fetch.mockResolvedValue(response(200, { n: 1 }, 'e'));

      const c = await getIfNew.json('http', 'example.com', 'p.json');

      expect(c.isHit).toBe(true);
      expect(c.data).toEqual({ n: 1 });
    });

    // Empty cache + failure. See "NOTE ON CACHEISM" above.
    it('returns a Miss on a 404 against an empty cache', async () => {
      fetch.mockResolvedValue(response(404));

      const c = await getIfNew.json('http', 'example.com', 'missing.json', Cacheism.Status.onlyFresh);

      expect(c.isMiss).toBe(true);
    });

    it('returns a Miss when the fetch throws under onlyFresh', async () => {
      jest.spyOn(log, 'error').mockImplementation(() => {});
      fetch.mockRejectedValue(new Error('network fail'));

      const c = await getIfNew.json('http', 'example.com', 'p.json', Cacheism.Status.onlyFresh);

      expect(c.isMiss).toBe(true);
    });
  });

  describe('text', () => {
    it('returns a Hit with the response text on a 200', async () => {
      fetch.mockResolvedValue(response(200, 'plain text body', 'etag-t'));

      const c = await getIfNew.text('http', 'example.com', 'log.txt', Cacheism.Status.onlyFresh);

      expect(c.isHit).toBe(true);
      expect(c.data).toBe('plain text body');
      expect(c.etag).toBe('etag-t');
    });

    it('falls back to the cached text when the fetch throws under cacheOnFail', async () => {
      jest.spyOn(log, 'error').mockImplementation(() => {});
      await seed('http', 'example.com', 'log.txt', 'cached log', 'e');
      fetch.mockRejectedValue(new Error('boom'));

      const c = await getIfNew.text('http', 'example.com', 'log.txt', Cacheism.Status.cacheOnFail);

      expect(c.isHit).toBe(true);
      expect(c.data).toBe('cached log');
    });
  });

  describe('rate limiting', () => {
    it('throttles requests to at most one per second', async () => {
      fetch.mockResolvedValue(response(200, { n: 1 }, 'e'));

      // First request goes out immediately and records the fetch time.
      await getIfNew.json('http', 'd', 'p1', Cacheism.Status.onlyFresh);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second request, issued at the same instant, must wait out the 1s rate.
      const second = getIfNew.json('http', 'd', 'p2', Cacheism.Status.onlyFresh);
      let settled = false;
      second.then(() => {
        settled = true;
      });

      await Promise.resolve();
      expect(settled).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1000);
      await second;
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
