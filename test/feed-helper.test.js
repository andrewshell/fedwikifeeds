const { Cacheism } = require('@andrewshell/cacheism');

// fedwiki-helper is the data layer; mock it so feed-helper is tested in isolation.
jest.mock('../lib/fedwiki-helper');

// daverss.cloudPing makes a real network call; stub only that, keep buildRssFeed real.
jest.mock('daverss', () => {
  const actual = jest.requireActual('daverss');
  return { ...actual, cloudPing: jest.fn() };
});

// Quiet logging (resetModules re-requires lib/log, so test/setup.js is not enough).
jest.mock('../lib/log', () => ({
  info: jest.fn(),
  notice: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

let feedHelper;
let fedwikiHelper;
let rss;

function reload() {
  jest.resetModules();
  const c = require('@andrewshell/cacheism');
  c.Cacheism.store.filesystem = c.Cacheism.store.memory;
  fedwikiHelper = require('../lib/fedwiki-helper');
  rss = require('daverss');
  feedHelper = require('../lib/feed-helper');
}

// A feed-list entry as stored in allfeeds.data.
function feedEntry(domain, active = true) {
  return {
    type: 'rss',
    text: domain,
    xmlUrl: `http://localhost:3000/${domain}/rss.xml`,
    description: `Updates from ${domain} fedwiki`,
    htmlUrl: `http://${domain}/`,
    version: 'RSS2',
    active,
  };
}

beforeEach(() => {
  reload();
  fedwikiHelper.fetchAllFeeds.mockResolvedValue({ data: {}, etag: 'etag', cached: false });
  fedwikiHelper.saveAllFeeds.mockResolvedValue();
  fedwikiHelper.homepageUrl.mockImplementation(async (domain) => `http://${domain}`);
});

describe('feed-helper', () => {
  describe('fetchAllFeeds', () => {
    it('renders every feed as an OPML subscription list', async () => {
      fedwikiHelper.fetchAllFeeds.mockResolvedValue({
        data: { 'a.com': feedEntry('a.com'), 'b.com': feedEntry('b.com') },
        etag: 'etag',
        cached: false,
      });

      const list = await feedHelper.fetchAllFeeds();

      expect(typeof list.data).toBe('string');
      expect(list.data).toContain('All Federated Wiki Feeds');
      expect(list.data).toContain('a.com');
      expect(list.data).toContain('b.com');
      expect(list.cached).toBe(false);
    });
  });

  describe('fetchActiveFeeds', () => {
    it('includes only feeds flagged active', async () => {
      fedwikiHelper.fetchAllFeeds.mockResolvedValue({
        data: { 'active.com': feedEntry('active.com', true), 'idle.com': feedEntry('idle.com', false) },
        etag: 'etag',
        cached: false,
      });

      const list = await feedHelper.fetchActiveFeeds();

      expect(list.data).toContain('Active Federated Wiki Feeds');
      expect(list.data).toContain('active.com');
      expect(list.data).not.toContain('idle.com');
    });
  });

  describe('fetchPeersOpml', () => {
    it('builds an OPML list of a domain\'s peers', async () => {
      fedwikiHelper.fetchPeers.mockResolvedValue({
        isHit: true,
        isMiss: false,
        cached: false,
        data: ['peer1.com', 'peer2.com'],
      });

      const result = await feedHelper.fetchPeersOpml('example.com', Cacheism.Status.onlyFresh);

      expect(result.data).toContain('Peers of example.com');
      expect(result.data).toContain('peer1.com');
      expect(result.data).toContain('peer2.com');
      expect(fedwikiHelper.saveAllFeeds).toHaveBeenCalled();
    });
  });

  describe('fetchRosterOpml', () => {
    it('builds an OPML list from a roster, escaping the description', async () => {
      fedwikiHelper.fetchRoster.mockResolvedValue({
        isHit: true,
        isMiss: false,
        cached: false,
        data: { title: 'Team Roster', description: 'Us & Them', domains: ['member.com'] },
      });

      const result = await feedHelper.fetchRosterOpml('example.com', 'team', Cacheism.Status.onlyFresh);

      expect(result.data).toContain('Team Roster');
      expect(result.data).toContain('member.com');
      // util.escapeXml turns & into &amp;
      expect(result.data).toContain('Us &amp; Them');
    });
  });

  describe('fetchRiver', () => {
    function siteFeedWithItem(domain, title, text, pubDate, guid) {
      return {
        isHit: true,
        isMiss: false,
        data: {
          items: {
            [guid]: {
              title,
              text,
              type: 'markdown',
              link: `http://${domain}/view/welcome-visitors/view/${guid}`,
              pubDate,
              guid,
            },
          },
        },
      };
    }

    it('builds a River of News with rendered item bodies', async () => {
      fedwikiHelper.fetchAllFeeds.mockResolvedValue({
        data: { 'a.com': feedEntry('a.com', true), 'b.com': feedEntry('b.com', true) },
        etag: 'etag',
        cached: false,
      });
      fedwikiHelper.fetchSiteFeed.mockImplementation(async (domain) =>
        domain === 'a.com'
          ? siteFeedWithItem('a.com', 'Hello World', 'See [[Some Page]] and [http://x.com a link]', '2022-01-02T00:00:00.000Z', 'guid-a')
          : siteFeedWithItem('b.com', 'Second', 'plain', '2022-01-01T00:00:00.000Z', 'guid-b')
      );

      const river = await feedHelper.fetchRiver('Test River', ['a.com', 'b.com']);

      expect(river.data.metadata.name).toBe('Test River');
      const feeds = river.data.updatedFeeds.updatedFeed;
      // Both feeds are present, newest first; the trailing block is no longer dropped.
      expect(feeds).toHaveLength(2);
      expect(feeds.map((f) => f.feedTitle)).toEqual(['a.com', 'b.com']);
      expect(feeds[0].item).toHaveLength(1);
      const item = feeds[0].item[0];
      expect(item.title).toBe('Hello World');
      expect(item.id).toBe('guid-a');
      // resolveLinks turns [[Some Page]] into an internal anchor (appended to the
      // item link) and [http://... a link] into an external nofollow anchor.
      expect(item.body).toContain('<a href="http://a.com/view/welcome-visitors/view/guid-a/view/some-page">Some Page</a>');
      expect(item.body).toContain('<a href="http://x.com" rel="nofollow">a link</a>');
    });

    it('includes the only feed group for a single-domain river', async () => {
      fedwikiHelper.fetchAllFeeds.mockResolvedValue({
        data: { 'a.com': feedEntry('a.com', true) },
        etag: 'etag',
        cached: false,
      });
      fedwikiHelper.fetchSiteFeed.mockResolvedValue(
        siteFeedWithItem('a.com', 'Solo', 'just one', '2022-01-02T00:00:00.000Z', 'guid-a')
      );

      const river = await feedHelper.fetchRiver('Solo River', ['a.com']);

      const feeds = river.data.updatedFeeds.updatedFeed;
      expect(feeds).toHaveLength(1);
      expect(feeds[0].feedTitle).toBe('a.com');
      expect(feeds[0].item).toHaveLength(1);
      expect(feeds[0].item[0].title).toBe('Solo');
    });

    it('renders markdown, html and plain-text item bodies', async () => {
      fedwikiHelper.fetchAllFeeds.mockResolvedValue({
        data: { 'a.com': feedEntry('a.com', true), 'z.com': feedEntry('z.com', true) },
        etag: 'etag',
        cached: false,
      });
      fedwikiHelper.fetchSiteFeed.mockImplementation(async (domain) => {
        if (domain === 'a.com') {
          return {
            isHit: true,
            isMiss: false,
            data: {
              items: {
                md: { title: 'md', text: '# Heading', type: 'markdown', link: 'http://a.com/view/md', pubDate: '2022-03-03T00:00:00.000Z', guid: 'md' },
                html: { title: 'html', text: '<b>bold</b><script>alert(1)</script>', type: 'html', link: 'http://a.com/view/html', pubDate: '2022-03-02T00:00:00.000Z', guid: 'html' },
                plain: { title: 'plain', text: 'line1\nline2', type: 'plaintext', link: 'http://a.com/view/plain', pubDate: '2022-03-01T00:00:00.000Z', guid: 'plain' },
              },
            },
          };
        }
        // A second feed; a.com sorts first since its items are newer.
        return {
          isHit: true,
          isMiss: false,
          data: { items: { z: { title: 'z', text: 'z', type: 'markdown', link: 'http://z.com/view/z', pubDate: '2022-01-01T00:00:00.000Z', guid: 'z' } } },
        };
      });

      const river = await feedHelper.fetchRiver('Mixed River', ['a.com', 'z.com']);
      const items = river.data.updatedFeeds.updatedFeed[0].item;
      const byTitle = Object.fromEntries(items.map((i) => [i.title, i.body]));

      // markdown: heading renderer is overridden to <h3>
      expect(byTitle.md).toContain('<h3>Heading</h3>');
      // html: sanitize-html keeps <b> and strips <script>
      expect(byTitle.html).toContain('<b>bold</b>');
      expect(byTitle.html).not.toContain('<script>');
      // default/plain: newlines become <br />
      expect(byTitle.plain).toContain('line1<br />line2');
    });

    it('skips domains that are inactive or unknown', async () => {
      fedwikiHelper.fetchAllFeeds.mockResolvedValue({
        data: { 'idle.com': feedEntry('idle.com', false) },
        etag: 'etag',
        cached: false,
      });

      const river = await feedHelper.fetchRiver('Empty River', ['idle.com', 'missing.com']);

      expect(river.data.updatedFeeds.updatedFeed).toEqual([]);
      expect(fedwikiHelper.fetchSiteFeed).not.toHaveBeenCalled();
    });
  });

  describe('fetchSiteRss', () => {
    function siteFeed(overrides = {}) {
      return {
        isHit: true,
        isMiss: false,
        cached: true,
        etag: 'etag',
        cacheName: 'a.com/feed.json',
        data: {
          title: 'a.com',
          link: 'http://a.com/',
          description: 'Updates from a.com fedwiki',
          generator: 'fedwikifeeds',
          maxFeedItems: 100,
          image: { url: 'http://a.com/favicon.png', title: 'a.com', link: 'http://a.com/', width: 32, height: 32 },
          rssCloud: {
            domain: 'rpc.rsscloud.io',
            port: 5337,
            path: '/pleaseNotify',
            registerProcedure: '',
            protocol: 'http-post',
          },
          items: {
            'guid-1': {
              title: 'First Post',
              text: 'Body text',
              link: 'http://a.com/view/welcome-visitors/view/first-post',
              pubDate: '2022-01-01T00:00:00.000Z',
              guid: 'guid-1',
            },
          },
        },
        ...overrides,
      };
    }

    it('renders the site feed as RSS XML', async () => {
      fedwikiHelper.fetchSiteFeed.mockResolvedValue(siteFeed());

      const result = await feedHelper.fetchSiteRss('a.com', Cacheism.Status.preferCache);

      expect(typeof result.data).toBe('string');
      expect(result.data).toContain('<rss');
      expect(result.data).toContain('First Post');
      expect(result.cached).toBe(true);
    });

    it('passes through a missed site feed', async () => {
      fedwikiHelper.fetchSiteFeed.mockResolvedValue({ isHit: false, isMiss: true, cacheName: 'a.com/feed.json' });

      const result = await feedHelper.fetchSiteRss('a.com', Cacheism.Status.preferCache);

      expect(result.isMiss).toBe(true);
    });

    it('returns a Miss when the feed has no rssCloud block', async () => {
      const feed = siteFeed();
      delete feed.data.rssCloud;
      fedwikiHelper.fetchSiteFeed.mockResolvedValue(feed);

      const result = await feedHelper.fetchSiteRss('a.com', Cacheism.Status.preferCache);

      expect(result.isMiss).toBe(true);
    });

    it('pings rsscloud when the feed is freshly built', async () => {
      fedwikiHelper.fetchSiteFeed.mockResolvedValue(siteFeed({ cached: false }));

      await feedHelper.fetchSiteRss('a.com', Cacheism.Status.preferCache);

      expect(rss.cloudPing).toHaveBeenCalled();
    });
  });
});
