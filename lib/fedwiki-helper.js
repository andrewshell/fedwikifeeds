const getIfNew = require('./get-if-new');
const pageCache = require('./page-cache');

let preferredScheme = {};
let allFeedsCache = null;

async function fetchPath(domain, path, preferCache) {
  let cache = false, url;
  let schemes = [preferredScheme[domain] || 'http'];
  schemes[1] = 'http' === schemes[0] ? 'https': 'http';

  for (let scheme of schemes) {
    try {
      url = `${scheme}://${domain}${path}`;
      cache = await getIfNew.json(url, preferCache);
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

async function fetchSearchRoster() {
  let cache = false;

  try {
    cache = await getIfNew.text('http://search.fed.wiki.org:3030/logs/online');
    if (false === cache) {
      return [];
    }
    cache.data = cache.data.split("\n").filter(row => {
      if (0 === row.length || '#' === row[0] || -1 === row.indexOf("\t")) {
        return false;
      }
      return true;
    }).map(row => {
      return row.split("\t", 2)[1].trim();
    });
  } catch (err) {
    console.error(err);
  }

  return cache;
}

async function fetchAllFeeds() {
  if (null != allFeedsCache) {
    return allFeedsCache;
  }

  try {
    allFeedsCache = await pageCache.read('allfeeds.json');
    if (false !== allFeedsCache) {
      return allFeedsCache;
    }
  } catch (err) {
    console.error(err);
  }

  if (false === allFeedsCache) {
    allFeedsCache = await pageCache.write('allfeeds.json', {});
  }

  return allFeedsCache;
}

async function saveAllFeeds(data) {
  allFeedsCache = await pageCache.write('allfeeds.json', data);
  return allFeedsCache;
}

async function fetchPeers(domain, preferCache) {
  let cache = false;

  try {
    cache = await fetchPath(domain, '/plugin/present/roll', preferCache);
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
    cache = await fetchPath(domain, '/system/sitemap.json', preferCache)
  } catch (err) {
    console.error(err);
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
  fetchPeers,
  fetchSearchRoster,
  fetchSitemap,
  homepageUrl,
  isActive,
  saveAllFeeds
};
