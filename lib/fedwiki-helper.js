const Cacheism = require('@andrewshell/cacheism');

const config = require('../config');
const dayjs = require('./day');
const log = require('./log');

const cache = new Cacheism(Cacheism.store.filesystem(config));
const getIfNew = require('./get-if-new')(cache);
const logPrefix = 'fedwiki-helper';

let preferredScheme = {};
let allFeedsCache = null;
let allRostersCache = null;

function _synopsis(text) {
  if ('string' === typeof text) {
    return text;
  } else if ('string' === typeof text?.text) {
    return text.text;
  }
  return '';
}

async function fetchPath(domain, path, cachePref, defaultValue) {
  if (domain !== domain.toLowerCase()) {
    domain = domain.toLowerCase();
  }

  log.info(logPrefix, 'fetchPath: %s/%s', domain, path);

  let c = false;
  let schemes = [preferredScheme[domain] || 'http'];
  schemes[1] = 'http' === schemes[0] ? 'https': 'http';

  for (let scheme of schemes) {
    try {
      c = await getIfNew.json(scheme, domain, path, cachePref || Cacheism.Status.cacheOnFail);
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
  log.info(logPrefix, 'fetchAllPeerDomains');

  const allFeeds = await fetchAllFeeds(), peerDomains = {};
  let parts, sub, domain;

  for (const feed of Object.values(allFeeds.data)) {
    parts = feed.text.split('.');
    while (2 < parts.length) {
      sub = parts.shift();
      domain = parts.join('.').toLowerCase();
      if (undefined === peerDomains[domain]) {
        peerDomains[domain] = `${sub}.${domain}`;
      }
    }
  }

  return Object.values(peerDomains);
}

async function mergeSearchRoster() {
  log.info(logPrefix, 'mergeSearchRoster');

  let c, row, domain, homepage, feed;

  let allfeeds = (await fetchAllFeeds()).data;

  const oneDayAgo = dayjs().subtract(1, 'day');

  try {
    c = await getIfNew.text('http', 'search.fed.wiki.org:3030', 'logs/online', Cacheism.Status.onlyCache);

    if (c.isHit && dayjs(c.created).isAfter(oneDayAgo, 'minute')) {
      return [];
    }

    if (c.isMiss) {
      return [];
    }

    for (row of c.data.split("\n")) {
      if (0 === row.length || '#' === row[0] || -1 === row.indexOf("\t")) {
        continue;
      }

      domain = row.split("\t", 2)[1].trim().toLowerCase();

      if (undefined === allfeeds[domain]) {
        log.info(logPrefix, 'adding %s to allfeeds.opml', domain);
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

        await saveAllFeeds(allfeeds);
      }
    }
  } catch (err) {
    log.error(logPrefix, '%j', err);
  }

  return await saveAllFeeds(allfeeds);
}

function _filterBlackList(data) {
  for (let domain of config.blacklist) {
    if (domain in data) {
      delete data[domain];
    }
  }
  return data;
}

async function fetchAllFeeds() {
  if (null != allFeedsCache) {
    return allFeedsCache;
  }

  allFeedsCache = await cache.go('-internal', 'allfeeds.json', Cacheism.Status.preferCache, () => {
    return {};
  });

  if (0 === Object.keys(allFeedsCache.data).length) {
    log.error(logPrefix, 'All Feeds Cache is empty!');
    throw new Error('All Feeds Cache is empty');
  }

  for (const domain of Object.keys(allFeedsCache.data)) {
    if (domain !== domain.toLowerCase()) {
      delete allFeedsCache.data[domain];
    }
  }

  return allFeedsCache;
}

async function saveAllFeeds(data) {
  log.info(logPrefix, 'saveAllFeeds');

  if (0 === Object.keys(data).length) {
    log.error(logPrefix, 'Refusing to save empty feeds cache!');
    throw new Error('Refusing to save empty feeds cache');
  }

  await cache.go('-internal', 'allfeeds.json', Cacheism.Status.onlyFresh, _filterBlackList.bind(null, data));

  return;
}

async function fetchAllRosters() {
  log.info(logPrefix, 'fetchAllRosters()');

  if (null != allRostersCache) {
    return allRostersCache;
  }

  allRostersCache = await cache.go('-internal', 'allrosters.json', Cacheism.Status.preferCache, () => {
    return {};
  });

  return allRostersCache;
}

async function saveAllRosters(data) {
  return await cache.go('-internal', 'allrosters.json', Cacheism.Status.onlyFresh, () => { return data; });
}

async function fetchPeers(domain, cachePref) {
  log.info(logPrefix, 'fetchPeers(%s)', domain);

  if (domain !== domain.toLowerCase()) {
    domain = domain.toLowerCase();
  }

  let c = await fetchPath(domain, 'plugin/present/roll', cachePref, { roll: [ { site: domain } ] });

  if (c.isMiss) {
    return c;
  }

  return cache.hit(c.cacheName, c.data.roll.map(site => site.site), c.etag);
}

async function fetchReferences(domain, page, cachePref) {
  if (domain !== domain.toLowerCase()) {
    domain = domain.toLowerCase();
  }

  log.info(logPrefix, 'fetchReferences %s/%s', domain, page);

  let c = await fetchPath(domain, `${page}.json`, cachePref, { title: page, story: [], journal: [] });

  if (c.isMiss) {
    return c;
  }

  const domains = new Set();

  for (const story of c.data.story) {
    if (story.type === 'reference') {
      domains.add(story.site);
    }
  }

  return cache.hit(c.cacheName, [...domains], c.etag);
}

async function fetchRoster(domain, page, cachePref, skip) {
  if (domain !== domain.toLowerCase()) {
    domain = domain.toLowerCase();
  }

  log.info(logPrefix, 'fetchRoster %s/%s', domain, page);

  let c = await fetchPath(domain, `${page}.json`, cachePref, { title: page, story: [], journal: [] });

  if (c.isMiss) {
    return c;
  }

  if (null == skip) {
    skip = {};
  }

  skip[`${domain}/${page}`] = true;

  const roster = {
    title: c.data.title,
    description: c.data.story[0].text
  };

  const domains = new Set();

  for (const story of c.data.story) {
    if (story.type === 'roster') {

      let lines = story.text.split(/\r?\n/), rosterParts, subRoster;
      for (let line of lines) {
        let match = line.match(/^([a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+)(:\d+)?$/);
        if (null == match) {
          match = line.match(/^localhost(:\d+)?$/);
        }
        if (null != match) {
          domains.add(match[0]);
          continue;
        }
        if (null == match) {
          match = line.match(/^ROSTER ([A-Za-z0-9.-:]+\/[a-z0-9-]+)$/);
        }
        if (null != match) {
          if (skip[match[1]]) {
            continue;
          }
          skip[match[1]] = true;
          rosterParts = match[1].split('/', 2);
          if (2 === rosterParts.length) {
            subRoster = await fetchRoster(rosterParts[0], rosterParts[1], cachePref, skip)
            if (subRoster.isHit && Array.isArray(subRoster.data?.domains)) {
              subRoster.data.domains.forEach((d) => {
                domains.add(d);
              });
            }
          }
          continue;
        }
        if (null == match) {
          match = line.match(/^REFERENCES ([A-Za-z0-9.-:]+\/[a-z0-9-]+)$/);
        }
        if (null != match) {
          const refParts = match[1].split('/', 2);
          if (2 === refParts.length) {
            const references = await fetchReferences(refParts[0], refParts[1], cachePref)
            if (references.isHit && Array.isArray(references.data)) {
              references.data.forEach((d) => {
                domains.add(d);
              });
            }
          }
          continue;
        }
      } // for lines

    }
  }

  roster.domains = [...domains];

  return cache.hit(c.cacheName, roster, c.etag);
}

async function fetchSitemap(domain, cachePref) {
  if (domain !== domain.toLowerCase()) {
    domain = domain.toLowerCase();
  }

  log.info(logPrefix, 'fetchSitemap: %s', domain);

  const filterDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // One Week

  let c = await fetchPath(domain, 'system/sitemap.json', cachePref, []);

  if (c.isMiss) {
    return c;
  }

  if (!Array.isArray(c.data)) {
    return cache.miss(c.cacheName, new Error('Invalid data'));
  }

  const data = await Promise.all(c.data.filter((page) => {
    return new Date(page.date) > filterDate;
  }).map(async (page) => {
    let d = await fetchPath(domain, `${page.slug}.json`, cachePref, []);
    page.story = d?.data?.story || [];
    return page;
  }));

  return cache.hit(c.cacheName, data, c.etag);
}

async function fetchSiteFeed(domain, cachePref) {
  if (domain !== domain.toLowerCase()) {
    domain = domain.toLowerCase();
  }

  return cache.go(domain, 'feed.json', cachePref, async (existing) => {
    const sitemap = await fetchSitemap(domain, cachePref);
    const homepage = await homepageUrl(domain);

    let feed = null, guid;

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
            text: _synopsis(page?.story[0]?.text || page?.synopsis || ''),
            type: page?.story[0]?.type || 'markdown',
            link: `${homepage}/view/welcome-visitors/view/${page.slug}`,
            target: domain,
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
  if (domain !== domain.toLowerCase()) {
    domain = domain.toLowerCase();
  }

  if (null == preferredScheme[domain]) {
    await fetchSitemap(domain, true);
  }

  return `${preferredScheme[domain] || 'http'}://${domain}`;
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
  fetchAllRosters,
  fetchPeers,
  fetchReferences,
  fetchRoster,
  fetchSitemap,
  fetchSiteFeed,
  homepageUrl,
  isActive,
  mergeSearchRoster,
  saveAllFeeds,
  saveAllRosters
};
