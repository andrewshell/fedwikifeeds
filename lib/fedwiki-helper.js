const cache = require('./cache');
const config = require('../config');
const getIfNew = require('./get-if-new');

let preferredScheme = {};
let allFeedsCache = null;

function _synopsis(text) {
  if ('string' === typeof text) {
    return text;
  } else if ('string' === typeof text.text) {
    return text.text;
  }
  return '';
}

async function fetchPath(domain, path, cachePref, defaultValue) {
  let c = false;
  let schemes = [preferredScheme[domain] || 'http'];
  schemes[1] = 'http' === schemes[0] ? 'https': 'http';

  for (let scheme of schemes) {
    try {
      c = await getIfNew.json(scheme, domain, path, cachePref || cache.status.cacheOnFail);
      console.dir(c);
      process.exit(1);
      if (c.isHit) {
        preferredScheme[domain] = scheme;
        return c;
      }
    } catch (err) {
      c = cache.miss(getIfNew.name(scheme, domain, path), err);
    }
  }

  if (c.isMiss && null != defaultValue) {
    c = cache.hit(getIfNew.name(schemes[0], domain, path), defaultValue);
  }

  return c;
}

async function fetchAllPeerDomains() {
  const allFeeds = await fetchAllFeeds(), peerDomains = {};
  let parts, sub, domain;

  for (const feed of Object.values(allFeeds.data)) {
    parts = feed.text.split('.');
    while (2 < parts.length) {
      sub = parts.shift();
      domain = parts.join('.');
      if (undefined === peerDomains[domain]) {
        peerDomains[domain] = `${sub}.${domain}`;
      }
    }
  }

  return Object.values(peerDomains);
}

async function mergeSearchRoster() {
  let c, row, domain, homepage, feed;

  let allfeeds = (await fetchAllFeeds()).data;

  try {
    c = await getIfNew.text('http', 'search.fed.wiki.org:3030', 'logs/online', cache.status.cacheOnFail);

    if (c.isMiss) {
      return [];
    }

    for (row of c.data.split("\n")) {
      if (0 === row.length || '#' === row[0] || -1 === row.indexOf("\t")) {
        continue;
      }

      domain = row.split("\t", 2)[1].trim();

      if (undefined === allfeeds[domain]) {
        console.log(`adding ${domain} to allfeeds.opml`);
        homepage = await homepageUrl(domain);

        feed = {
          type: 'rss',
          text: domain,
          xmlUrl: `${config.docroot}/${domain}/rss.xml`,
          description: `Updates from ${domain} fedwiki`,
          htmlUrl: `${homepage}/`,
          version: 'RSS2'
        };

        allfeeds[domain] = feed;
        allfeeds[domain].active = true;
      }
    }
  } catch (err) {
    console.error(err);
  }

  return await saveAllFeeds(allfeeds);
}

function _filterBlackList(data) {
  for (let domain of config.blacklist) {
    if (null !== data[domain]) {
      delete data[domain];
    }
  }
  return data;
}

async function fetchAllFeeds() {
  if (null != allFeedsCache) {
    return allFeedsCache;
  }

  allFeedsCache = await cache('-internal', 'allfeeds.json', cache.status.preferCache, () => {
    return {};
  });

  return allFeedsCache;
}

async function saveAllFeeds(data) {
  return await cache('-internal', 'allfeeds.json', cache.status.onlyFresh, _filterBlackList.bind(null, data));
}

async function fetchPeers(domain, cachePref) {
  let c = await fetchPath(domain, 'plugin/present/roll', cachePref, { roll: [ { site: domain } ] });

  return cache.hit(c.cacheName, c.data.roll.map(site => site.site), c.etag);
}

async function fetchSitemap(domain, cachePref) {
  const filterDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // One Week

  let c = await fetchPath(domain, 'system/sitemap.json', cachePref, []);

  if (c.isMiss) {
    return c;
  }

  return cache.hit(c.cacheName, c.data.filter((page) => {
    return new Date(page.date) > filterDate;
  }), c.etag);
}

async function fetchSiteFeed(domain, cachePref) {

  return cache(domain, 'feed.json', cachePref, async (existing) => {
    const sitemap = await fetchSitemap(domain, cachePref);
    const homepage = await homepageUrl(domain);

    let feed = null;

    if (sitemap.isHit && (!sitemap.cached || existing.isMiss)) {
      feed = {
        title: domain,
        link: `${homepage}/`,
        description: `Updates from ${domain} fedwiki`,
        generator: config.generator,
        maxFeedItems: 100,
        image: {
          url: `${homepage}/favicon.png`,
          title: domain,
          link: `${homepage}/`,
          width: 32,
          height: 32
        },
        rssCloud: {
          domain: "rpc.rsscloud.io",
          port: 5337,
          path: "/pleaseNotify",
          registerProcedure: "",
          protocol: "http-post"
        },
        items: {}
      };

      for (let page of sitemap.data) {
        guid = `${homepage}/${page.slug}.html#${page.date}`;
        if (null == feed.items[guid]) {
          feed.items[guid] = {
            title: page.title,
            text: _synopsis(page.synopsis || ''),
            link: `${homepage}/${page.slug}.html`,
            pubDate: (new Date(page.date)).toISOString(),
            seen: Date.now(),
            guid
          };
        }
      }
    }

    let allfeeds = (await fetchAllFeeds()).data;

    allfeeds[domain] = {
      type: 'rss',
      text: domain,
      xmlUrl: `${config.docroot}/${domain}/rss.xml`,
      description: `Updates from ${domain} fedwiki`,
      htmlUrl: `${homepage}/`,
      version: 'RSS2',
      active: isActive(sitemap)
    };

    await saveAllFeeds(allfeeds);

    if (null === feed) {
      return existing;
    }

    return feed;
  });

}

async function homepageUrl(domain) {
  if (null == preferredScheme[domain]) {
    await fetchSitemap(domain, true);
  }

  return `${preferredScheme[domain]}://${domain}`;
}

function isActive(sitemap) {
  if (sitemap.isMiss) {
    return false;
  }

  return 0 < sitemap.data.length;
}

module.exports = {
  fetchAllFeeds,
  fetchAllPeerDomains,
  fetchPeers,
  fetchSitemap,
  fetchSiteFeed,
  homepageUrl,
  isActive,
  mergeSearchRoster,
  saveAllFeeds
};
