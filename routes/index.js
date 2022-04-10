const config = require('../config');
const express = require('express');
const router = express.Router();
const fedwikiHelper = require('../lib/fedwiki-helper');
const feedHelper = require('../lib/feed-helper');
const csv = require('csv/sync');

const Cache = require('../lib/cache');
const cache = new Cache(require('../lib/cache-store-filesystem')(config));

router.get('/', function(req, res, next) {
  res.render('index', {
    title: 'Federated Wiki Feeds',
    docroot: config.docroot
  });
});

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

router.get('/allfeeds.opml', async function (req, res, next) {
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

router.get('/river.html', async function (req, res, next) {
  res.render('river', {
    layout: false
  });
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

router.get('/:domain/peers.opml', async function (req, res, next) {
  const output = await feedHelper.fetchPeersOpml(req.params.domain, cache.status.preferCache);
  sendCachedOutput(req, res, output, 'text/xml');
});

router.get('/:domain/rss.xml', async function(req, res, next) {
  const output = await feedHelper.fetchSiteRss(req.params.domain, cache.status.preferCache);
  sendCachedOutput(req, res, output, 'application/rss+xml');
});

module.exports = router;
