const config = require('../config');
const getIfNew = require('./get-if-new');
const pageCache = require('./page-cache');

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

async function fetchPath(domain, path, preferCache) {
  let cache = false;
  let schemes = [preferredScheme[domain] || 'http'];
  schemes[1] = 'http' === schemes[0] ? 'https': 'http';

  for (let scheme of schemes) {
    try {
      cache = await getIfNew.json(scheme, domain, path, preferCache);
      if (false !== cache) {
        preferredScheme[domain] = scheme;
        return cache;
      }
    } catch (err) {
      console.error(err);
    }
  }

  return cache;
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
  let cache = false, row, domain, homepage, feed;

  let allfeeds = await fetchAllFeeds();

  try {
    cache = await getIfNew.text('http', 'search.fed.wiki.org:3030', 'logs/online');

    if (false === cache) {
      return [];
    }

    for (row of cache.data.split("\n")) {
      if (0 === row.length || '#' === row[0] || -1 === row.indexOf("\t")) {
        continue;
      }

      domain = row.split("\t", 2)[1].trim();

      if (undefined === allfeeds.data[domain]) {
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

        allfeeds.data[domain] = feed;
        allfeeds.data[domain].active = true;
      }
    }
  } catch (err) {
    console.error(err);
  }

  await saveAllFeeds(allfeeds.data);

  return allfeeds.data;
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

  try {
    allFeedsCache = await pageCache.read('_internal', 'allfeeds.json');
    if (false !== allFeedsCache) {
      return allFeedsCache;
    }
  } catch (err) {
    console.error(err);
  }

  if (false === allFeedsCache) {
    allFeedsCache = await pageCache.write('_internal', 'allfeeds.json', {});
  }

  return allFeedsCache;
}

async function saveAllFeeds(data) {
  return await pageCache.write('_internal', 'allfeeds.json', _filterBlackList(data));
}

async function fetchPeers(domain, preferCache) {
  let cache = false;

  try {
    cache = await fetchPath(domain, 'plugin/present/roll', preferCache);
  } catch (err) {
    console.error(err);
  }

  if (false === cache) {
    // Handle sites that don't have /plugin/present/roll endpoint
    cache = pageCache.format(
      domain,
      `plugin/present/roll`,
      { roll: [ { site: domain } ] }
    );
    cache.cached = true;
  }

  cache.data = cache.data.roll.map(site => site.site);

  return cache;
}

async function fetchSitemap(domain, preferCache) {
  let cache = false;

  const filterDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // One Week

  try {
    cache = await fetchPath(domain, 'system/sitemap.json', preferCache)
  } catch (err) {
    console.error(err);
  }

  if (false === cache || false === Array.isArray(cache.data)) {
    return false;
  }

  cache.data = cache.data.filter((page) => {
    return new Date(page.date) > filterDate;
  });

  return cache;
}

async function fetchSiteFeed(domain, preferCache) {
  let cache = await pageCache.read(domain, 'feed.json');

  if (true === preferCache && false !== cache) {
    return cache;
  }

  const sitemap = await fetchSitemap(domain, preferCache);
  const homepage = await homepageUrl(domain);

  let allfeeds = await fetchAllFeeds(), feed, page;

  if (false !== sitemap && (false === sitemap.cached || false === cache)) {
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

    cache = await pageCache.write(domain, 'feed.json', feed);
  }

  allfeeds.data[domain] = {
    type: 'rss',
    text: domain,
    xmlUrl: `${config.docroot}/${domain}/rss.xml`,
    description: `Updates from ${domain} fedwiki`,
    htmlUrl: `${homepage}/`,
    version: 'RSS2',
    active: isActive(sitemap)
  };

  await saveAllFeeds(allfeeds.data);

  return cache;
}

async function homepageUrl(domain) {
  if (null == preferredScheme[domain]) {
    await fetchSitemap(domain, true);
  }

  return `${preferredScheme[domain]}://${domain}`;
}

function isActive(sitemap) {
  if (false === sitemap) {
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
