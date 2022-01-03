const config = require('../config');
const getIfNew = require('./get-if-new');
const pageCache = require('./page-cache');

let preferredScheme = {};
let allFeedsCache = null;

async function fetchPath(domain, path, preferCache) {
  let cache = false;
  let schemes = [preferredScheme[domain] || 'http'];
  schemes[1] = 'http' === schemes[0] ? 'https': 'http';

  for (let scheme of schemes) {
    try {
      cache = await getIfNew.json(`${scheme}://${domain}`, path, preferCache);
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
    cache = await getIfNew.text('http://search.fed.wiki.org:3030', 'logs/online');

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

async function fetchAllFeeds() {
  if (null != allFeedsCache) {
    return allFeedsCache;
  }

  try {
    allFeedsCache = await pageCache.read(config.docroot, 'allfeeds.json');
    if (false !== allFeedsCache) {
      return allFeedsCache;
    }
  } catch (err) {
    console.error(err);
  }

  if (false === allFeedsCache) {
    allFeedsCache = await pageCache.write(config.docroot, 'allfeeds.json', {});
  }

  return allFeedsCache;
}

async function saveAllFeeds(data) {
  allFeedsCache = await pageCache.write(config.docroot, 'allfeeds.json', data);
  return allFeedsCache;
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
    cache = {
      cachename: `http://${domain}/plugin/present/roll`,
      cached: true,
      data: { roll: [ { site: domain } ] },
      created: (new Date()).toISOString()
    };
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
  homepageUrl,
  isActive,
  mergeSearchRoster,
  saveAllFeeds
};
