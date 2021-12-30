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

let lastHour = 0, allDomains = [];

everyMinute(async (expectedCycleTime) => {
  let allFeeds;

  console.log('everyMinute: ' + new Date(expectedCycleTime));

  if (0 === allDomains.length) {
    allDomains = (await fedwikiHelper.fetchSearchRoster()).data;
  }

  for (const domain of allDomains.splice(0, 5)) {
    await feedHelper.fetchPeersOpml(domain);
  }

  if (expectedCycleTime > lastHour + 3600000) {
    lastHour = expectedCycleTime;
    allFeeds = Object.values((await fedwikiHelper.fetchAllFeeds()).data);
  } else {
    allFeeds = allFeeds = Object.values((await fedwikiHelper.fetchAllFeeds()).data)
      .filter(filter => { return filter.active || false; });
  }

  for (const feed of allFeeds) {
    await feedHelper.fetchSiteRss(feed.text);
  }
});

module.exports = app;
