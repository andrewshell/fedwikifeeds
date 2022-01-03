const express = require('express');
const router = express.Router();
const config = require('../config');
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

  if (false === cache) {
    res.status(404).send('404 Not Found');
  } else if (ifNoneMatch && cache.etag === ifNoneMatch) {
    res.status(304).send();
  } else if (ifModifiedSince && cache.created <= (new Date(ifModifiedSince))) {
    res.status(304).send();
  } else {
    res.header("Content-Type", contentType);
    res.header("ETag", cache.etag);
    res.status(200).send(cache.data);
  }
}

router.get('/allfeeds.opml', async function (req, res, next) {
  let cache = await feedHelper.fetchAllFeeds();
  sendCachedOutput(req, res, cache, 'text/xml');
});

router.get('/activefeeds.opml', async function (req, res, next) {
  let cache = await feedHelper.fetchActiveFeeds();
  sendCachedOutput(req, res, cache, 'text/xml');
});

router.get('/:domain/peers.opml', async function (req, res, next) {
  let cache = await feedHelper.fetchPeersOpml(req.params.domain, true);
  sendCachedOutput(req, res, cache, 'text/xml');
});

router.get('/:domain/rss.xml', async function(req, res, next) {
  let cache = await feedHelper.fetchSiteRss(req.params.domain, true);
  sendCachedOutput(req, res, cache, 'application/rss+xml');
});

module.exports = router;
