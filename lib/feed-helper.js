const config = require('../config');
const fedwikiHelper = require('./fedwiki-helper');
const pageCache = require('./page-cache');
const rss = require('daverss');
const opml = require('opml');
const dayjs = require('dayjs');
dayjs.extend(require('dayjs/plugin/utc'))

async function fetchAllFeeds() {
  const allfeeds = await fedwikiHelper.fetchAllFeeds();

  const feeds = Object.values(allfeeds.data);

  const opmlstruct = {
    opml: {
      head: {
        title: `All Federated Wiki Feeds`,
        length: feeds.length
      },
      body: {
        subs: feeds
      }
    }
  };

  const cache = pageCache.format(
    '_internal',
    `allfeeds.opml`,
    opml.stringify(opmlstruct),
    allfeeds.etag
  );

  cache.cached = true;

  return cache;
}

async function fetchRiver(name, domains) {
  const riverDateFormat = 'ddd, DD MMM YYYY HH:mm:ss [GMT]';
  const localDateFormat = 'M/D/YYYY, h:mm:ss A';

  const allfeeds = await fedwikiHelper.fetchAllFeeds();
  const river = {
    updatedFeeds: {
      updatedFeed: []
    },
    metadata: {
      name,
      docs: "http://scripting.com/stories/2010/12/06/innovationRiverOfNewsInJso.html",
      secs: 0,
      ctBuilds: 0,
      ctDuplicatesSkipped: 0,
      whenGMT: dayjs().utc().format(riverDateFormat),
      whenLocal: dayjs().local().format(localDateFormat),
      aggregator: config.generator
    }
  };

  let feed, items = [];

  for (let domain of domains) {
    if (null != allfeeds.data[domain] && allfeeds.data[domain].active) {
      feed = await fedwikiHelper.fetchSiteFeed(domain, true);
      if (false != feed) {
        items.push(...Object.values(feed.data.items).map(item => Object.assign(item, { domain })));
      }
    }
  }

  items = items.sort((a, b) => b.seen - a.seen).slice(0, config.riverLimit);
  feed = null;

  for (let item of items) {
    if (null != feed && feed.feedTitle !== item.domain) {
      river.updatedFeeds.updatedFeed.push(feed);
      feed = null;
    }
    if (null == feed) {
      feed = {
        feedTitle: allfeeds.data[item.domain].text,
        feedUrl: allfeeds.data[item.domain].xmlUrl,
        websiteUrl: allfeeds.data[item.domain].htmlUrl,
        feedDescription: allfeeds.data[item.domain].description,
        whenLastUpdate: dayjs(item.pubDate).utc().format(riverDateFormat),
        item: []
      };
    }
    feed.item.push({
      "title": item.title,
      "link": item.link,
      "body": item.text,
      "pubDate": dayjs(item.pubDate).utc().format(riverDateFormat),
      "permaLink": "",
      "id": item.guid,
    });
  }

  const cache = pageCache.format(
    '_internal',
    `river.json`,
    river
  );

  cache.cached = true;

  return cache;
}

async function fetchActiveFeeds() {
  const allfeeds = await fedwikiHelper.fetchAllFeeds();

  const feeds = Object.values(allfeeds.data)
      .filter(filter => true === filter.active )

  const opmlstruct = {
    opml: {
      head: {
        title: `Active Federated Wiki Feeds`,
        length: feeds.length
      },
      body: {
        subs: feeds
      }
    }
  };

  const cache = pageCache.format(
    '_internal',
    `activefeeds.opml`,
    opml.stringify(opmlstruct),
    allfeeds.etag
  );

  cache.cached = true;

  return cache;
}

async function fetchPeersOpml(domain, preferCache) {
  console.log(`fetchPeersOpml: ${domain}`);

  let cache = await pageCache.read(domain, `peers.opml`);
  if (true === preferCache && false !== cache) {
    return cache;
  }

  const peers = await fedwikiHelper.fetchPeers(domain, preferCache);

  let allfeeds = await fedwikiHelper.fetchAllFeeds();

  if (false !== peers && (false === peers.cached || false === cache)) {
    const opmlstruct = {
      opml: {
        head: {
          title: `Peers of ${domain}`
        },
        body: {
          subs: await Promise.all(peers.data.map(async (peer) => {
            const homepage = await fedwikiHelper.homepageUrl(peer);
            const feed = {
              type: 'rss',
              text: peer,
              xmlUrl: `${config.docroot}/${peer}/rss.xml`,
              description: `Updates from ${peer} fedwiki`,
              htmlUrl: `${homepage}/`,
              version: 'RSS2'
            };
            if (undefined === allfeeds.data[peer]) {
              allfeeds.data[peer] = feed;
              allfeeds.data[peer].active = true;
            }
            return feed;
          }))
        }
      }
    };

    cache = pageCache.write(domain, `peers.opml`, opml.stringify(opmlstruct));
    await fedwikiHelper.saveAllFeeds(allfeeds.data);
  }

  return cache;
}

async function fetchSiteRss(domain, preferCache) {
  console.log(`fetchSiteRss: ${domain}`);

  let cache = await fedwikiHelper.fetchSiteFeed(domain, preferCache);

  if (false === cache) {
    return cache;
  }

  const headElements = {
    title: cache.data.title,
    link: cache.data.link,
    description: cache.data.description,
    generator: cache.data.generator,
    maxFeedItems: cache.data.maxFeedItems,
    image: cache.data.image,
    flRssCloudEnabled: true,
    rssCloudDomain: cache.data.rssCloud.domain,
    rssCloudPort: cache.data.rssCloud.port,
    rssCloudPath: cache.data.rssCloud.path,
    rssCloudRegisterProcedure: cache.data.rssCloud.registerProcedure,
    rssCloudProtocol: cache.data.rssCloud.protocol
  };

  const historyArray = Object.values(cache.data.items).map((item) => {
    return {
      title: item.title,
      text: item.text,
      link: item.link,
      when: (new Date(item.pubDate)),
      guid: {
        flPermalink: false,
        value: item.guid
      }
    };
  }).sort((a, b) => b.when - a.when);

  if (false === cache.cached) {
    console.log(`ping: ${config.docroot}/${domain}/rss.xml`);
    rss.cloudPing(`http://rpc.rsscloud.io:5337/ping`, `${config.docroot}/${domain}/rss.xml`);
  }

  let xmlCache = pageCache.format(
    domain,
    `rss.xml`,
    rss.buildRssFeed(headElements, historyArray),
    cache.etag
  );

  xmlCache.cached = cache.cached;

  return xmlCache;
}

module.exports = {
  fetchAllFeeds,
  fetchActiveFeeds,
  fetchPeersOpml,
  fetchRiver,
  fetchSiteRss
};
