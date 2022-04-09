const cache = require('../lib/cache');
const express = require('express');
const router = express.Router();
const config = require('../config');
const fedwikiHelper = require('../lib/fedwiki-helper');
const feedHelper = require('../lib/feed-helper');

router.get('/', function(req, res, next) {
  res.render('index', {
    title: 'Federated Wiki Feeds',
    docroot: config.docroot
  });
});

function sendCachedOutput(req, res, cache, contentType) {
  const ifNoneMatch = req.get('if-none-match');
  const ifModifiedSince = req.get('if-modified-since');

  if (cache.isMiss) {
    res.status(404).send('404 Not Found');
  } else if (ifNoneMatch && cache.etag === ifNoneMatch) {
    res.status(304).send();
  } else if (ifModifiedSince && cache.created <= (new Date(ifModifiedSince))) {
    res.status(304).send();
  } else {
    console.log(`etag: ${cache.etag}`);
    res.header("Content-Type", contentType);
    res.header("ETag", cache.etag);
    res.status(200).send(cache.data);
  }
}

router.get('/allfeeds.opml', async function (req, res, next) {
  const output = await feedHelper.fetchAllFeeds();
  sendCachedOutput(req, res, output, 'text/xml');
});

router.get('/river.json', async function (req, res, next) {
  const allfeeds = await fedwikiHelper.fetchAllFeeds();
  const domains = Object.values(allfeeds.data)
      .filter(filter => true === filter.active )
      .map(feed => feed.text);
  const output = await feedHelper.fetchRiver('Federated Wiki River', domains);
  sendCachedOutput(req, res, output, 'application/json');
});

router.get('/river.js', async function (req, res, next) {
  const callback = req.query.callback || 'onGetRiverStream';
  const allfeeds = await fedwikiHelper.fetchAllFeeds();
  const domains = Object.values(allfeeds.data)
      .filter(filter => true === filter.active )
      .map(feed => feed.text);
  const output = await feedHelper.fetchRiver('Federated Wiki River', domains);
  const json = JSON.stringify(cache.data, null, 2);
  output.data = `${callback}(${json});`;
  sendCachedOutput(req, res, output, 'application/javascript');
});

router.get('/activefeeds.opml', async function (req, res, next) {
  const output = await feedHelper.fetchActiveFeeds();
  sendCachedOutput(req, res, output, 'text/xml');
});

router.get('/:domain/peers.opml', async function (req, res, next) {
  console.log(req.params.domain);
  res.json(req.params);
  //const output = await feedHelper.fetchPeersOpml(req.params.domain, cache.status.preferCache);
  //sendCachedOutput(req, res, output, 'text/xml');
});

router.get('/:domain/rss.xml', async function(req, res, next) {
  const output = await feedHelper.fetchSiteRss(req.params.domain, cache.status.preferCache);
  sendCachedOutput(req, res, output, 'application/rss+xml');
});

module.exports = router;
