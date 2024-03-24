const log = require('./log');
const oneMinuteMs = 60000;

function everyMinute(callback, expectedCycleTime) {
  if (undefined === expectedCycleTime) {
    expectedCycleTime = Date.now();
  }

  callback(expectedCycleTime).catch((err) => {
    log.error('every-minute', 'caught: %j', err);
  }).finally(() => {
    do {
      expectedCycleTime += oneMinuteMs;
    } while (expectedCycleTime <= Date.now());

    // function calls itself after delay of adjustedInterval
    setTimeout(everyMinute.bind(null, callback, expectedCycleTime), oneMinuteMs - (Date.now() - expectedCycleTime));
  });
}

module.exports = everyMinute;
