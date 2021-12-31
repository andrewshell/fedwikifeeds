const config = require('../config');
const fedwikiHelper = require('./fedwiki-helper');
const pageCache = require('./page-cache');
const rss = require ("daverss");
const opml = require ("opml");

async function fetchAllFeeds() {
  const allfeeds = await fedwikiHelper.fetchAllFeeds();

  const opmlstruct = {
    opml: {
      head: {
        title: `All Federated Wiki Feeds`,
        length: Object.values(allfeeds.data).length
      },
      body: {
        subs: Object.values(allfeeds.data)
      }
    }
  };

  return pageCache.write(`/allfeeds.opml`, opml.stringify(opmlstruct));
}

async function fetchPeersOpml(domain, preferCache) {
  console.log(`fetchPeersOpml: ${domain}`);

  let cache = await pageCache.read(`/${domain}/peers.opml`);
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

    cache = pageCache.write(`/${domain}/peers.opml`, opml.stringify(opmlstruct));
    await fedwikiHelper.saveAllFeeds(allfeeds.data);
  }

  return cache;
}

function synopsis(text) {
  if ('string' === typeof text) {
    return text;
  } else if ('string' === typeof text.text) {
    return text.text;
  }
  return '';
}

async function fetchSiteRss(domain, preferCache) {
  console.log(`fetchSiteRss: ${domain}`);

  let cache = await pageCache.read(`/${domain}/rss.xml`);

  if (true === preferCache && false !== cache) {
    return cache;
  }

  const sitemap = await fedwikiHelper.fetchSitemap(domain, preferCache);
  const homepage = await fedwikiHelper.homepageUrl(domain);

  let allfeeds = await fedwikiHelper.fetchAllFeeds();

  if (false !== sitemap && (false === sitemap.cached || false === cache)) {
    const headElements = {
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
      flRssCloudEnabled: true,
      rssCloudDomain: "rpc.rsscloud.io",
      rssCloudPort: 5337,
      rssCloudPath: "/pleaseNotify",
      rssCloudRegisterProcedure: "",
      rssCloudProtocol: "http-post"
    };

    const historyArray = sitemap.data.map((page) => {
      return {
        title: page.title,
        text: synopsis(page.synopsis),
        link: `${homepage}/${page.slug}.html`,
        when: (new Date(page.date)),
        guid: {
          flPermalink: false,
          value: `${homepage}/${page.slug}.html#${page.date}`
        }
      };
    }).sort((a, b) => b.when - a.when);

    cache = await pageCache.write(`/${domain}/rss.xml`, rss.buildRssFeed(headElements, historyArray));

    console.log(`ping: ${config.docroot}/${domain}/rss.xml`);
    rss.cloudPing(`http://rpc.rsscloud.io:5337/ping`, `${config.docroot}/${domain}/rss.xml`);
  }

  allfeeds.data[domain] = {
    type: 'rss',
    text: domain,
    xmlUrl: `${config.docroot}/${domain}/rss.xml`,
    description: `Updates from ${domain} fedwiki`,
    htmlUrl: `${homepage}/`,
    version: 'RSS2',
    active: fedwikiHelper.isActive(sitemap)
  };

  await fedwikiHelper.saveAllFeeds(allfeeds.data);

  return cache;
}

module.exports = {
  fetchAllFeeds,
  fetchPeersOpml,
  fetchSiteRss
};
