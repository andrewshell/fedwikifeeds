const config = require('./config');
const createError = require('http-errors');
const fedwikiHelper = require('./lib/fedwiki-helper');
const feedHelper = require('./lib/feed-helper');
const everyMinute = require('./lib/every-minute');
const express = require('express');
const indexRouter = require('./routes/index');
const debugRouter = require('./routes/debug');
const path = require('path');
const dayjs = require('./lib/day');
const log = require('./lib/log');
const logPrefix = 'app           ';

const Cacheism = require('@andrewshell/cacheism');
const cache = new Cacheism(Cacheism.store.filesystem(config));

const app = express();

// view engine setup
const hbs  = require('hbs');
hbs.registerHelper('raw', function (options) { return options.fn(this); });
hbs.registerHelper('json', function (options) { return JSON.stringify(options, null, 2) });

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// route cname.json records
app.use(function(req, res, next) {
  const match = config.cname.find((cname) => {
    return (cname[0] === req.headers.host || cname[1] === req.path);
  });
  if (null != match) {
    let scheme = match[2] ?? 'http://';
    if (match[0] === req.headers.host && '/' === req.path) {
      req.url = match[1];
    } else if (match[1] === req.path && match[0] !== req.headers.host) {
      return res.redirect(301, `${scheme}${match[0]}/`);
    } else if ('/allfeeds.opml' == req.path) {
      log.error(logPrefix, 'Deprecated path: %s', req.path);
      return res.redirect(301, `${scheme}${req.headers.host}/river.opml`);
    }
  }
  next();
});

app.use('/', indexRouter);
app.use('/debug', debugRouter);

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

let lastDay = 0, peerDomains = [], inactiveFeedChunks = [], watchedRosters = [];
const twoWeeksAgo = dayjs().subtract(2, 'week');

everyMinute(async (expectedCycleTime) => {
  let domain, homepage, feed, roster;

  log.info(logPrefix, 'everyMinute: %s', new Date(expectedCycleTime));

  // Daily
  if (expectedCycleTime > lastDay + 86400000) {
    await fedwikiHelper.mergeSearchRoster();
  }

  if (0 === peerDomains.length) {
    peerDomains = await fedwikiHelper.fetchAllPeerDomains();
  }

  domain = peerDomains.shift().toLowerCase();
  if (null != domain) {
    await feedHelper.fetchPeersOpml(domain, Cacheism.Status.cacheOnFail);
  }

  if (0 === inactiveFeedChunks.length) {
    inactiveFeedChunks = arrayChunks(Object.values((await fedwikiHelper.fetchAllFeeds()).data)
      .filter(filter => { return false === filter.active; }), 60);
  }

  if (0 === watchedRosters.length) {
    watchedRosters = Object.values((await fedwikiHelper.fetchAllRosters()).data).filter((roster) => {
      return dayjs(roster.lastRequest).isAfter(twoWeeksAgo, 'day');
    });
  }
  roster = watchedRosters.shift();
  if (null != roster) {
    await feedHelper.fetchRosterOpml(roster.domain, roster.page, Cacheism.Status.cacheOnFail);
  }

  allFeeds = Object.values((await fedwikiHelper.fetchAllFeeds()).data)
    .filter(filter => filter.active || false)
    .concat(inactiveFeedChunks.shift());

  for (const feed of allFeeds) {
    await feedHelper.fetchSiteRss(feed.text, Cacheism.Status.cacheOnFail);
  }
});

module.exports = app;
