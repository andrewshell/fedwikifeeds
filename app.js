const config = require('./config');
const createError = require('http-errors');
const fedwikiHelper = require('./lib/fedwiki-helper');
const feedHelper = require('./lib/feed-helper');
const fs = require('fs');
const everyMinute = require('./lib/every-minute');
const express = require('express');
const indexRouter = require('./routes/index');
const path = require('path');
const pageCache = require('./lib/page-cache');

if (false === fs.existsSync(config.datadir)) {
  fs.mkdirSync(config.datadir, { recursive: true });
}

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

function arrayChunks(items, num) {
  const itemsCopy = [...items];
  const chunks = [];
  const itemsPerChunk = Math.ceil(itemsCopy.length / num);
  while (0 < itemsCopy.length) {
    chunks.push(itemsCopy.splice(0, itemsPerChunk));
  }
  return chunks;
}

let lastDay = 0, peerDomains = [], inactiveFeedChunks = [];

everyMinute(async (expectedCycleTime) => {
  let domain, homepage, feed;

  console.log('everyMinute: ' + new Date(expectedCycleTime));

  // Daily
  if (expectedCycleTime > lastDay + 86400000) {
    await fedwikiHelper.mergeSearchRoster();
  }

  if (0 === peerDomains.length) {
    peerDomains = await fedwikiHelper.fetchAllPeerDomains();
  }

  domain = peerDomains.shift();
  await feedHelper.fetchPeersOpml(domain);

  if (0 === inactiveFeedChunks.length) {
    inactiveFeedChunks = arrayChunks(Object.values((await fedwikiHelper.fetchAllFeeds()).data)
      .filter(filter => { return false === filter.active; }), 60);
  }

  allFeeds = Object.values((await fedwikiHelper.fetchAllFeeds()).data)
    .filter(filter => filter.active || false)
    .concat(inactiveFeedChunks.shift());

  for (const feed of allFeeds) {
    await feedHelper.fetchSiteRss(feed.text);
  }
});

module.exports = app;
