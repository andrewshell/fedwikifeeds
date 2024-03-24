const config = require('../config');
const express = require('express');
const router = express.Router();
const fedwikiHelper = require('../lib/fedwiki-helper');
const feedHelper = require('../lib/feed-helper');
const csv = require('csv/sync');
const dayjs = require('../lib/day.js');

const Cacheism = require('@andrewshell/cacheism');
const cache = new Cacheism(Cacheism.store.filesystem(config));

function sendCachedOutput(req, res, cacheRes, contentType) {
  const ifNoneMatch = req.get('if-none-match');
  const ifModifiedSince = req.get('if-modified-since');

  if (cacheRes.isMiss) {
    res.status(404).send('404 Not Found');
  } else if (ifNoneMatch && cacheRes.etag === ifNoneMatch) {
    res.status(304).send();
  } else if (ifModifiedSince && cacheRes.created <= (new Date(ifModifiedSince))) {
    res.status(304).send();
  } else {
    console.log(`etag: ${cacheRes.etag}`);
    res.header("Content-Type", contentType);
    res.header("ETag", cacheRes.etag);
    res.status(200).send(cacheRes.data);
  }
}

/**
 * Home
 */

router.get('/', function(req, res, next) {
  res.render('index', {
    title: 'Federated Wiki Feeds',
    docroot: config.docroot
  });
});

/**
 * All Feeds
 */

router.get('/river.html', async function (req, res, next) {
  res.render('river', {
    layout: false,
    domain: req.headers.host || 'fedwikiriver.com',
    title: `Federated Wiki River`,
    description: `A river of updates from across the Federated Wiki network.`,
    opmlList: `/river.opml`,
    jsonFeed: `/river.js`
  });
});

router.get('/river.opml', async function (req, res, next) {
  const output = await feedHelper.fetchAllFeeds();
  sendCachedOutput(req, res, output, 'text/xml');
});

router.get('/river.csv', async function (req, res, next) {
  const allfeeds = await fedwikiHelper.fetchAllFeeds();
  const domains = Object.values(allfeeds.data)
      .filter(filter => true === filter.active )
      .map(feed => feed.text);
  const output = await feedHelper.fetchRiver('Federated Wiki River', domains);
  const flattened = output.data.updatedFeeds.updatedFeed.reduce((items, feed) => {
    for (let item of feed.item) {
      items.push([feed.feedTitle, feed.feedUrl, feed.websiteUrl, feed.feedDescription, feed.whenLastUpdate, item.title, item.link, item.body, item.pubDate, item.permaLink, item.id]);
    }
    return items;
  }, []);
  sendCachedOutput(req, res, cache.hit(output.cacheName, csv.stringify(flattened)), 'text/csv');
});

router.get('/river.js', async function (req, res, next) {
  const callback = req.query.callback || 'onGetRiverStream';
  const allfeeds = await fedwikiHelper.fetchAllFeeds();
  const domains = Object.values(allfeeds.data)
      .filter(filter => true === filter.active )
      .map(feed => feed.text);
  const output = await feedHelper.fetchRiver('Federated Wiki River', domains);
  const json = JSON.stringify(output.data, null, 2);
  sendCachedOutput(req, res, cache.hit(output.cacheName, `${callback}(${json});`), 'application/javascript');
});

router.get('/river.json', async function (req, res, next) {
  const allfeeds = await fedwikiHelper.fetchAllFeeds();
  const domains = Object.values(allfeeds.data)
      .filter(filter => true === filter.active )
      .map(feed => feed.text);
  const output = await feedHelper.fetchRiver('Federated Wiki River', domains);
  sendCachedOutput(req, res, output, 'application/json');
});

router.get('/activefeeds.opml', async function (req, res, next) {
  const output = await feedHelper.fetchActiveFeeds();
  sendCachedOutput(req, res, output, 'text/xml');
});

/**
 * Domains
 */

router.get('/:domain/rss.xml', async function(req, res, next) {
  const output = await feedHelper.fetchSiteRss(req.params.domain, Cacheism.Status.preferCache);
  sendCachedOutput(req, res, output, 'application/rss+xml');
});

/**
 * Peers
 */

router.get('/:domain/peers.html', async function (req, res, next) {
  res.render('river', {
    layout: false,
    domain: req.headers.host || req.params.domain,
    title: `Peers of ${req.params.domain}`,
    description: `A river of updates from peers of ${req.params.domain}.`,
    opmlList: `/${req.params.domain}/peers.opml`,
    jsonFeed: `/${req.params.domain}/peers.js`
  });
});

router.get('/:domain/peers.opml', async function (req, res, next) {
  const output = await feedHelper.fetchPeersOpml(req.params.domain, Cacheism.Status.preferCache);
  sendCachedOutput(req, res, output, 'text/xml');
});

router.get('/:domain/peers.js', async function (req, res, next) {
  const callback = req.query.callback || 'onGetRiverStream';
  const peers = await fedwikiHelper.fetchPeers(req.params.domain, Cacheism.Status.preferCache);
  const output = await feedHelper.fetchRiver(`Peers of ${req.params.domain}`, peers.data);
  const json = JSON.stringify(output.data, null, 2);
  sendCachedOutput(req, res, cache.hit(output.cacheName, `${callback}(${json});`), 'application/javascript');
});

router.get('/:domain/peers.json', async function (req, res, next) {
  const peers = await fedwikiHelper.fetchPeers(req.params.domain, Cacheism.Status.preferCache);
  const output = await feedHelper.fetchRiver(`Peers of ${req.params.domain}`, peers.data);
  sendCachedOutput(req, res, output, 'application/json');
});

router.get('/:domain/peers.csv', async function (req, res, next) {
  const peers = await fedwikiHelper.fetchPeers(req.params.domain, Cacheism.Status.preferCache);
  const output = await feedHelper.fetchRiver(`Peers of ${req.params.domain}`, peers.data);
  const flattened = output.data.updatedFeeds.updatedFeed.reduce((items, feed) => {
    for (let item of feed.item) {
      items.push([feed.feedTitle, feed.feedUrl, feed.websiteUrl, feed.feedDescription, feed.whenLastUpdate, item.title, item.link, item.body, item.pubDate, item.permaLink, item.id]);
    }
    return items;
  }, []);
  sendCachedOutput(req, res, cache.hit(output.cacheName, csv.stringify(flattened)), 'text/csv');
});

/**
 * Rosters
 */

router.get('/:domain/:page/roster.html', async function (req, res, next) {
  const roster = await fedwikiHelper.fetchRoster(req.params.domain, req.params.page, Cacheism.Status.preferCache);
  res.render('river', {
    layout: false,
    domain: req.headers.host || req.params.domain,
    title: roster.data.title,
    description: roster.data.description,
    opmlList: `/${req.params.domain}/${req.params.page}/roster.opml`,
    jsonFeed: `/${req.params.domain}/${req.params.page}/roster.js`
  });
});

router.get('/:domain/:page/roster.opml', async function (req, res, next) {
  let allrosters = (await fedwikiHelper.fetchAllRosters()).data;
  allrosters[`${req.params.domain}/${req.params.page}`] = {
    domain: req.params.domain,
    page: req.params.page,
    lastRequest: dayjs().toISOString()
  };
  await fedwikiHelper.saveAllRosters(allrosters);

  const output = await feedHelper.fetchRosterOpml(req.params.domain, req.params.page, Cacheism.Status.preferCache);
  sendCachedOutput(req, res, output, 'text/xml');
});

router.get('/:domain/:page/roster.js', async function (req, res, next) {
  let allrosters = (await fedwikiHelper.fetchAllRosters()).data;
  allrosters[`${req.params.domain}/${req.params.page}`] = {
    domain: req.params.domain,
    page: req.params.page,
    lastRequest: dayjs().toISOString()
  };
  await fedwikiHelper.saveAllRosters(allrosters);

  const callback = req.query.callback || 'onGetRiverStream';
  const roster = await fedwikiHelper.fetchRoster(req.params.domain, req.params.page, Cacheism.Status.preferCache);
  const output = await feedHelper.fetchRiver(`Roster from ${req.params.domain}/${req.params.page}`, roster.data.domains);
  const json = JSON.stringify(output.data, null, 2);
  sendCachedOutput(req, res, cache.hit(output.cacheName, `${callback}(${json});`), 'application/javascript');
});

router.get('/:domain/:page/roster.json', async function (req, res, next) {
  let allrosters = (await fedwikiHelper.fetchAllRosters()).data;
  allrosters[`${req.params.domain}/${req.params.page}`] = {
    domain: req.params.domain,
    page: req.params.page,
    lastRequest: dayjs().toISOString()
  };
  await fedwikiHelper.saveAllRosters(allrosters);

  const roster = await fedwikiHelper.fetchRoster(req.params.domain, req.params.page, Cacheism.Status.preferCache);
  const output = await feedHelper.fetchRiver(`Roster from ${req.params.domain}/${req.params.page}`, roster.data.domains);
  sendCachedOutput(req, res, output, 'application/json');
});

router.get('/:domain/:page/roster.csv', async function (req, res, next) {
  let allrosters = (await fedwikiHelper.fetchAllRosters()).data;
  allrosters[`${req.params.domain}/${req.params.page}`] = {
    domain: req.params.domain,
    page: req.params.page,
    lastRequest: dayjs().toISOString()
  };
  await fedwikiHelper.saveAllRosters(allrosters);

  const roster = await fedwikiHelper.fetchRoster(req.params.domain, req.params.page, Cacheism.Status.preferCache);
  const output = await feedHelper.fetchRiver(`Roster from ${req.params.domain}/${req.params.page}`, roster.data.domains);
  const flattened = output.data.updatedFeeds.updatedFeed.reduce((items, feed) => {
    for (let item of feed.item) {
      items.push([feed.feedTitle, feed.feedUrl, feed.websiteUrl, feed.feedDescription, feed.whenLastUpdate, item.title, item.link, item.body, item.pubDate, item.permaLink, item.id]);
    }
    return items;
  }, []);
  sendCachedOutput(req, res, cache.hit(output.cacheName, csv.stringify(flattened)), 'text/csv');
});

module.exports = router;
