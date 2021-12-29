const express = require('express');
const router = express.Router();
const config = require('../config');
const getIfNew = require('../lib/get-if-new');
const pageCache = require('../lib/page-cache');
const fedHelper = require('../lib/fed-helper');
const rss = require ("daverss");
const opml = require ("opml");

router.get('/', function(req, res, next) {
  res.render('index', {
    title: 'Federated Wiki Feeds',
    docroot: config.docroot
  });
});

router.get('/allfeeds.opml', async function (req, res, next) {
  const domain = req.params.domain;

  let allfeeds = await fedHelper.fetchAllFeeds();

  const opmlstruct = {
    opml: {
      head: {
        title: `Peers of ${domain}`
      },
      body: {
        subs: allfeeds.data
      }
    }
  };

  cache = await pageCache.write(`/${domain}/peers.opml`, opml.stringify(opmlstruct));

  const ifNoneMatch = req.get('if-none-match');
  const ifModifiedSince = req.get('if-modified-since');

  if (ifNoneMatch && cache.etag === ifNoneMatch) {
    res.status(304).send();
  } else if (ifModifiedSince && cache.created <= (new Date(ifModifiedSince))) {
    res.status(304).send();
  } else {
    res.header("Content-Type", "text/xml");
    res.header("ETag", cache.etag);
    res.status(200).send(cache.data);
  }
});

router.get('/:domain/peers.opml', async function (req, res, next) {
  const domain = req.params.domain;
  const peers = await fedHelper.fetchPeers(domain);

  let cache = await pageCache.read(`/${domain}/peers.opml`);
  let allfeeds = await fedHelper.fetchAllFeeds();

  if (false !== peers && (false === peers.cached || false === cache)) {
    const opmlstruct = {
      opml: {
        head: {
          title: `Peers of ${domain}`
        },
        body: {
          subs: await Promise.all(peers.data.map(async (peer) => {
            const homepage = await fedHelper.homepageUrl(peer);
            const feed = {
              type: 'rss',
              text: peer,
              xmlUrl: `${config.docroot}/${peer}/rss.xml`,
              description: `Updates from ${peer} fedwiki`,
              htmlUrl: `${homepage}/`,
              version: 'RSS2'
            };
            allfeeds.data.push(feed);
            return feed;
          }))
        }
      }
    };

    cache = await pageCache.write(`/${domain}/peers.opml`, opml.stringify(opmlstruct));
    await fedHelper.saveAllFeeds(allfeeds.data);
  }

  const ifNoneMatch = req.get('if-none-match');
  const ifModifiedSince = req.get('if-modified-since');

  if (ifNoneMatch && cache.etag === ifNoneMatch) {
    res.status(304).send();
  } else if (ifModifiedSince && cache.created <= (new Date(ifModifiedSince))) {
    res.status(304).send();
  } else {
    res.header("Content-Type", "text/xml");
    res.header("ETag", cache.etag);
    res.status(200).send(cache.data);
  }
});

router.get('/:domain/rss.xml', async function(req, res, next) {
  const domain = req.params.domain;
  const sitemap = await fedHelper.fetchSitemap(domain);
  const homepage = await fedHelper.homepageUrl(domain);
  const filterDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // One Week

  let cache = await pageCache.read(`/${domain}/rss.xml`);
  let allfeeds = await fedHelper.fetchAllFeeds();

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
      }
    };

    const historyArray = sitemap.data.map((page) => {
      return {
        title: page.title,
        text: page.synopsis,
        link: `${homepage}/${page.slug}.html`,
        when: (new Date(page.date)),
        guid: {
          flPermalink: false,
          value: `${homepage}/${page.slug}.html#${page.date}`
        }
      };
    }).filter((item) => {
      return item.when > filterDate;
    }).sort((a, b) => b.when - a.when);

    cache = await pageCache.write(`/${domain}/rss.xml`, rss.buildRssFeed(headElements, historyArray));
    allfeeds.data.push({
      type: 'rss',
      text: domain,
      xmlUrl: `${config.docroot}/${domain}/rss.xml`,
      description: `Updates from ${domain} fedwiki`,
      htmlUrl: `${homepage}/`,
      version: 'RSS2'
    });
    await fedHelper.saveAllFeeds(allfeeds.data);
  }

  const ifNoneMatch = req.get('if-none-match');
  const ifModifiedSince = req.get('if-modified-since');

  if (ifNoneMatch && cache.etag === ifNoneMatch) {
    res.status(304).send();
  } else if (ifModifiedSince && cache.created <= (new Date(ifModifiedSince))) {
    res.status(304).send();
  } else {
    res.header("Content-Type", "application/rss+xml");
    res.header("ETag", cache.etag);
    res.status(200).send(cache.data);
  }
});

module.exports = router;
