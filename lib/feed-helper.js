const config = require('../config');
const fedwikiHelper = require('./fedwiki-helper');
const rss = require('daverss');
const opml = require('opml');
const dayjs = require('dayjs');
dayjs.extend(require('dayjs/plugin/utc'))

const Cacheism = require('@andrewshell/cacheism');
const cache = new Cacheism(Cacheism.store.filesystem(config));

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

  const list = cache.hit(cache.cacheName('-internal', `allfeeds.opml`), opml.stringify(opmlstruct), allfeeds.etag);
  list.cached = allfeeds.cached;
  Object.freeze(list);

  return list;
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
      feed = await fedwikiHelper.fetchSiteFeed(domain, Cacheism.Status.onlyCache);
      if (feed.isHit && null != feed.data.items) {
        items.push(...Object.values(feed.data.items).map(item => Object.assign(item, { domain })));
      }
    }
  }

  items = items.sort((a, b) => dayjs(b.pubDate).diff(a.pubDate)).slice(0, config.riverLimit);
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

  const riverjs = cache.hit(cache.cacheName('-internal', `river.json`), river);
  riverjs.cached = true;
  Object.freeze(riverjs);

  return riverjs;
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

  const list = cache.hit(cache.cacheName('-internal', `activefeeds.opml`), opml.stringify(opmlstruct), allfeeds.etag);
  list.cached = true;
  Object.freeze(list);

  return list;
}

async function fetchPeersOpml(domain, cachePref) {
  console.log(`fetchPeersOpml: ${domain}`);

  return cache.go(domain, `peers.opml`, cachePref, async (existing) => {
    const peers = await fedwikiHelper.fetchPeers(domain, cachePref);

    let allfeeds = (await fedwikiHelper.fetchAllFeeds()).data;

    if (peers.isHit && (false === peers.cached || existing.isMiss)) {
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
              if (undefined === allfeeds[peer]) {
                allfeeds[peer] = feed;
                allfeeds[peer].active = true;
              }
              return feed;
            }))
          }
        }
      };

      await fedwikiHelper.saveAllFeeds(allfeeds);

      return opml.stringify(opmlstruct);
    }

    return existing;
  });
}

async function fetchRosterOpml(domain, page, cachePref) {
  console.log(`fetchRosterOpml: ${domain}/${page}`);

  return cache.go(domain, `${page}/roster.opml`, cachePref, async (existing) => {
    const roster = await fedwikiHelper.fetchRoster(domain, page, cachePref);

    let allfeeds = (await fedwikiHelper.fetchAllFeeds()).data;

    if (roster.isHit && (false === roster.cached || existing.isMiss)) {
      const opmlstruct = {
        opml: {
          head: {
            title: roster.data.title,
            description: roster.data.description
          },
          body: {
            subs: await Promise.all(roster.data.domains.map(async (peer) => {
              const homepage = await fedwikiHelper.homepageUrl(peer);
              const feed = {
                type: 'rss',
                text: peer,
                xmlUrl: `${config.docroot}/${peer}/rss.xml`,
                description: `Updates from ${peer} fedwiki`,
                htmlUrl: `${homepage}/`,
                version: 'RSS2'
              };
              if (undefined === allfeeds[peer]) {
                allfeeds[peer] = feed;
                allfeeds[peer].active = true;
              }
              return feed;
            }))
          }
        }
      };

      await fedwikiHelper.saveAllFeeds(allfeeds);

      return opml.stringify(opmlstruct);
    }

    return existing;
  });
}

async function fetchSiteRss(domain, cachePref) {
  console.log(`fetchSiteRss: ${domain}`);

  let feed = await fedwikiHelper.fetchSiteFeed(domain, cachePref);

  if (feed.isMiss) {
    return feed;
  }

  if (null == feed.data.rssCloud) {
    return cache.miss(feed.cacheName, new Error('Invalid feed'));
  }

  const headElements = {
    title: feed.data.title,
    link: feed.data.link,
    description: feed.data.description,
    generator: feed.data.generator,
    maxFeedItems: feed.data.maxFeedItems,
    image: feed.data.image,
    flRssCloudEnabled: true,
    rssCloudDomain: feed.data.rssCloud.domain,
    rssCloudPort: feed.data.rssCloud.port,
    rssCloudPath: feed.data.rssCloud.path,
    rssCloudRegisterProcedure: feed.data.rssCloud.registerProcedure,
    rssCloudProtocol: feed.data.rssCloud.protocol
  };

  const historyArray = Object.values(feed.data.items).map((item) => {
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

  if (false === feed.cached) {
    console.log(`ping: ${config.docroot}/${domain}/rss.xml`);
    rss.cloudPing(`http://rpc.rsscloud.io:5337/ping`, `${config.docroot}/${domain}/rss.xml`);
  }

  let rssxml = cache.hit(cache.cacheName(domain, `rss.xml`), rss.buildRssFeed(headElements, historyArray), feed.etag);
  rssxml.cached = feed.cached;
  Object.freeze(rssxml);

  return rssxml;
}

module.exports = {
  fetchAllFeeds,
  fetchActiveFeeds,
  fetchPeersOpml,
  fetchRosterOpml,
  fetchRiver,
  fetchSiteRss
};
