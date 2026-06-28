const { Cacheism } = require('@andrewshell/cacheism');

// get-if-new is a `factory(cache)` that fedwiki-helper invokes at require time.
// Replace it with a controllable stub so no real network/caching happens.
const mockGetIfNew = {
  json: jest.fn(),
  text: jest.fn(),
  name: jest.fn((scheme, domain, path) => `${domain}/${scheme}-${path}`),
};
jest.mock('../lib/get-if-new', () => jest.fn(() => mockGetIfNew));

// Silence the npmlog wrapper. resetModules re-requires lib/log (which re-asserts
// its log level), so silencing via test/setup.js alone is not enough here.
jest.mock('../lib/log', () => ({
  info: jest.fn(),
  notice: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

let fedwikiHelper;
let config;

// Re-require the module with a clean registry so its module-level caches
// (preferredScheme, allFeedsCache, allRostersCache) reset between tests. The
// filesystem->memory store swap from test/setup.js must be re-applied because
// resetModules hands back a fresh Cacheism.
function reload() {
  jest.resetModules();
  const { Cacheism } = require('@andrewshell/cacheism');
  Cacheism.store.filesystem = Cacheism.store.memory;
  config = require('../config');
  config.blacklist = [];
  fedwikiHelper = require('../lib/fedwiki-helper');
}

// Lightweight stand-ins for Cacheism responses returned by the get-if-new stub.
function hit(data, etag = 'etag') {
  return { isHit: true, isMiss: false, data, etag, cacheName: 'stub/name', cached: false };
}
function miss() {
  return { isHit: false, isMiss: true, data: null, etag: null, cacheName: 'stub/name', error: 'err' };
}

beforeEach(() => {
  mockGetIfNew.json.mockReset();
  mockGetIfNew.text.mockReset();
  mockGetIfNew.name.mockImplementation((scheme, domain, path) => `${domain}/${scheme}-${path}`);
  reload();
});

describe('fedwiki-helper', () => {
  describe('isActive', () => {
    it('is false for a missed sitemap', () => {
      expect(fedwikiHelper.isActive({ isMiss: true })).toBe(false);
    });

    it('is false for an empty sitemap', () => {
      expect(fedwikiHelper.isActive({ isMiss: false, data: [] })).toBe(false);
    });

    it('is true for a non-empty sitemap', () => {
      expect(fedwikiHelper.isActive({ isMiss: false, data: [{ slug: 'x' }] })).toBe(true);
    });
  });

  describe('saveAllFeeds / fetchAllFeeds', () => {
    it('throws when saving an empty feed set', async () => {
      await expect(fedwikiHelper.saveAllFeeds({})).rejects.toThrow('Refusing to save empty feeds cache');
    });

    it('throws when the feed cache is empty', async () => {
      await expect(fedwikiHelper.fetchAllFeeds()).rejects.toThrow('All Feeds Cache is empty');
    });

    it('round-trips saved feeds', async () => {
      await fedwikiHelper.saveAllFeeds({ 'a.com': { text: 'a.com' } });
      const all = await fedwikiHelper.fetchAllFeeds();
      expect(all.data).toEqual({ 'a.com': { text: 'a.com' } });
    });

    it('drops feed keys that are not lower-cased', async () => {
      await fedwikiHelper.saveAllFeeds({ 'a.com': { text: 'a.com' }, 'Mixed.Com': { text: 'Mixed.Com' } });
      const all = await fedwikiHelper.fetchAllFeeds();
      expect(Object.keys(all.data)).toEqual(['a.com']);
    });

    it('filters blacklisted domains on save', async () => {
      config.blacklist = ['bad.com'];
      await fedwikiHelper.saveAllFeeds({ 'a.com': { text: 'a.com' }, 'bad.com': { text: 'bad.com' } });
      const all = await fedwikiHelper.fetchAllFeeds();
      expect(Object.keys(all.data)).toEqual(['a.com']);
    });

    it('memoizes the feed cache across calls', async () => {
      await fedwikiHelper.saveAllFeeds({ 'a.com': { text: 'a.com' } });
      const first = await fedwikiHelper.fetchAllFeeds();
      const second = await fedwikiHelper.fetchAllFeeds();
      expect(second).toBe(first);
    });
  });

  describe('saveAllRosters / fetchAllRosters', () => {
    it('defaults to an empty object', async () => {
      const rosters = await fedwikiHelper.fetchAllRosters();
      expect(rosters.data).toEqual({});
    });

    it('round-trips saved rosters', async () => {
      await fedwikiHelper.saveAllRosters({ 'a.com/welcome': { domains: ['a.com'] } });
      const rosters = await fedwikiHelper.fetchAllRosters();
      expect(rosters.data).toEqual({ 'a.com/welcome': { domains: ['a.com'] } });
    });
  });

  describe('fetchAllPeerDomains', () => {
    it('derives parent domains from feed text', async () => {
      await fedwikiHelper.saveAllFeeds({
        'a.example.com': { text: 'a.example.com' },
        'x.y.example.com': { text: 'x.y.example.com' },
      });
      const peers = await fedwikiHelper.fetchAllPeerDomains();
      expect(new Set(peers)).toEqual(new Set(['a.example.com', 'x.y.example.com']));
    });
  });

  describe('fetchPeers', () => {
    it('maps the roll plugin sites to a domain list', async () => {
      mockGetIfNew.json.mockResolvedValue(hit({ roll: [{ site: 'p1.com' }, { site: 'p2.com' }] }));
      const peers = await fedwikiHelper.fetchPeers('example.com');
      expect(peers.isHit).toBe(true);
      expect(peers.data).toEqual(['p1.com', 'p2.com']);
    });

    it('lower-cases the requested domain before fetching', async () => {
      mockGetIfNew.json.mockResolvedValue(hit({ roll: [{ site: 'p1.com' }] }));
      await fedwikiHelper.fetchPeers('Example.COM');
      expect(mockGetIfNew.json).toHaveBeenCalledWith('http', 'example.com', 'plugin/present/roll', expect.anything());
    });

    it('falls back to a self-roll default when both schemes miss', async () => {
      mockGetIfNew.json.mockResolvedValue(miss());
      const peers = await fedwikiHelper.fetchPeers('example.com');
      expect(peers.isHit).toBe(true);
      expect(peers.data).toEqual(['example.com']);
    });
  });

  describe('fetchReferences', () => {
    it('collects the sites of reference stories', async () => {
      mockGetIfNew.json.mockResolvedValue(
        hit({
          title: 'Page',
          story: [
            { type: 'reference', site: 'r1.com' },
            { type: 'markdown', text: 'ignored' },
            { type: 'reference', site: 'r2.com' },
            { type: 'reference', site: 'r1.com' },
          ],
        })
      );
      const refs = await fedwikiHelper.fetchReferences('example.com', 'welcome-visitors');
      expect(refs.isHit).toBe(true);
      expect(refs.data).toEqual(['r1.com', 'r2.com']);
    });
  });

  describe('fetchRoster', () => {
    it('extracts domains, title and description from a roster page', async () => {
      mockGetIfNew.json.mockResolvedValue(
        hit({
          title: 'My Roster',
          story: [{ type: 'roster', text: 'a.com\nb.com\nlocalhost:3000' }],
        })
      );
      const roster = await fedwikiHelper.fetchRoster('example.com', 'my-roster');
      expect(roster.isHit).toBe(true);
      expect(roster.data.title).toBe('My Roster');
      expect(roster.data.description).toBe('a.com\nb.com\nlocalhost:3000');
      expect(roster.data.domains).toEqual(['a.com', 'b.com', 'localhost:3000']);
    });

    it('inlines a nested ROSTER reference', async () => {
      mockGetIfNew.json.mockImplementation(async (scheme, domain, path) => {
        if (domain === 'example.com') {
          return hit({ title: 'Top', story: [{ type: 'roster', text: 'a.com\nROSTER other.com/list' }] });
        }
        if (domain === 'other.com') {
          return hit({ title: 'Sub', story: [{ type: 'roster', text: 'c.com\nd.com' }] });
        }
        return miss();
      });
      const roster = await fedwikiHelper.fetchRoster('example.com', 'my-roster');
      expect(new Set(roster.data.domains)).toEqual(new Set(['a.com', 'c.com', 'd.com']));
    });
  });

  describe('fetchSitemap', () => {
    const NOW = new Date('2022-06-15T00:00:00.000Z').getTime();
    const DAY = 24 * 60 * 60 * 1000;

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('keeps only recent, non-default, non-future pages and attaches their story', async () => {
      const pages = [
        { slug: 'recent-page', title: 'Recent', date: NOW - DAY },
        { slug: 'welcome-visitors', title: 'Welcome', date: NOW - DAY },
        { slug: 'too-old', title: 'Old', date: NOW - 10 * DAY },
        { slug: 'from-the-future', title: 'Future', date: NOW + DAY },
      ];
      mockGetIfNew.json.mockImplementation(async (scheme, domain, path) => {
        if (path === 'system/sitemap.json') return hit(pages);
        if (path === 'recent-page.json') return hit({ story: [{ text: 'hello', type: 'markdown' }] });
        return miss();
      });

      const sitemap = await fedwikiHelper.fetchSitemap('example.com');
      expect(sitemap.isHit).toBe(true);
      expect(sitemap.data).toHaveLength(1);
      expect(sitemap.data[0].slug).toBe('recent-page');
      expect(sitemap.data[0].story).toEqual([{ text: 'hello', type: 'markdown' }]);
    });

    it('returns a Miss when the sitemap is not an array', async () => {
      mockGetIfNew.json.mockImplementation(async (scheme, domain, path) => {
        if (path === 'system/sitemap.json') return hit({ not: 'an array' });
        return miss();
      });
      const sitemap = await fedwikiHelper.fetchSitemap('example.com');
      expect(sitemap.isMiss).toBe(true);
    });
  });

  describe('homepageUrl', () => {
    it('uses the scheme that successfully served the sitemap', async () => {
      mockGetIfNew.json.mockImplementation(async (scheme) => (scheme === 'http' ? hit([]) : miss()));
      expect(await fedwikiHelper.homepageUrl('example.com')).toBe('http://example.com');
    });

    it('falls through to https when http misses', async () => {
      mockGetIfNew.json.mockImplementation(async (scheme) => (scheme === 'https' ? hit([]) : miss()));
      expect(await fedwikiHelper.homepageUrl('example.com')).toBe('https://example.com');
    });
  });

  describe('fetchSiteFeed', () => {
    const NOW = new Date('2022-06-15T00:00:00.000Z').getTime();
    const DAY = 24 * 60 * 60 * 1000;

    beforeEach(async () => {
      jest.useFakeTimers();
      jest.setSystemTime(NOW);
      // fetchSiteFeed reads & writes the all-feeds cache, which must be non-empty.
      await fedwikiHelper.saveAllFeeds({ 'seed.com': { text: 'seed.com' } });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('builds a site feed from the sitemap and records the feed as active', async () => {
      mockGetIfNew.json.mockImplementation(async (scheme, domain, path) => {
        if (path === 'system/sitemap.json') {
          return hit([{ slug: 'recent-page', title: 'Recent', date: NOW - DAY }]);
        }
        if (path === 'recent-page.json') {
          return hit({ story: [{ text: 'a synopsis', type: 'markdown' }] });
        }
        return miss();
      });

      const feed = await fedwikiHelper.fetchSiteFeed('example.com', Cacheism.Status.onlyFresh);

      expect(feed.isHit).toBe(true);
      expect(feed.data.title).toBe('example.com');
      expect(feed.data.link).toBe('http://example.com/');
      const items = Object.values(feed.data.items);
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Recent');
      expect(items[0].text).toBe('a synopsis');
      expect(items[0].link).toBe('http://example.com/view/welcome-visitors/view/recent-page');
      expect(items[0].guid).toBe(`http://example.com/recent-page.html#${NOW - DAY}`);

      // The feed is registered as active in the all-feeds list.
      const all = await fedwikiHelper.fetchAllFeeds();
      expect(all.data['example.com'].active).toBe(true);
    });

    it('returns a Miss and marks the feed inactive when the sitemap is invalid', async () => {
      mockGetIfNew.json.mockImplementation(async (scheme, domain, path) => {
        if (path === 'system/sitemap.json') return hit({ not: 'an array' });
        return miss();
      });

      const feed = await fedwikiHelper.fetchSiteFeed('example.com', Cacheism.Status.onlyFresh);

      // The callback returns `existing` (a Miss for the empty cache); cacheism 3.0.1
      // honors a returned Miss, so the result is a real Miss.
      expect(feed.isMiss).toBe(true);
      // The feed is recorded as inactive in the all-feeds list.
      const all = await fedwikiHelper.fetchAllFeeds();
      expect(all.data['example.com'].active).toBe(false);
    });
  });

  describe('mergeSearchRoster', () => {
    const NOW = new Date('2022-06-15T00:00:00.000Z').getTime();
    const DAY = 24 * 60 * 60 * 1000;

    beforeEach(async () => {
      jest.useFakeTimers();
      jest.setSystemTime(NOW);
      await fedwikiHelper.saveAllFeeds({ 'existing.com': { text: 'existing.com' } });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    function onlineLog(data, createdMsAgo) {
      return { isHit: true, isMiss: false, data, created: new Date(NOW - createdMsAgo) };
    }

    it('does nothing when the online log was refreshed within the last day', async () => {
      mockGetIfNew.text.mockResolvedValue(onlineLog('foo\tnew.com', DAY / 2));

      const result = await fedwikiHelper.mergeSearchRoster();

      expect(result).toEqual([]);
      const all = await fedwikiHelper.fetchAllFeeds();
      expect(all.data['new.com']).toBeUndefined();
    });

    it('does nothing when the online log is a miss', async () => {
      mockGetIfNew.text.mockResolvedValue(miss());

      const result = await fedwikiHelper.mergeSearchRoster();

      expect(result).toEqual([]);
    });

    it('adds new domains from the log, skipping comments and known domains', async () => {
      // Stale log (2 days old) so the merge actually runs.
      mockGetIfNew.text.mockResolvedValue(
        onlineLog('#comment\n\nfoo\tnew.com\nbar\texisting.com', 2 * DAY)
      );
      // homepageUrl -> fetchSitemap needs a sitemap response.
      mockGetIfNew.json.mockResolvedValue(hit([]));

      await fedwikiHelper.mergeSearchRoster();

      const all = await fedwikiHelper.fetchAllFeeds();
      expect(all.data['new.com']).toBeDefined();
      expect(all.data['new.com'].active).toBe(true);
      expect(all.data['new.com'].xmlUrl).toContain('new.com');
    });
  });
});
