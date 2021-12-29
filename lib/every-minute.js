const oneMinuteMs = 60000;

let expectedCycleTime = Date.now();

function everyMinute(callback) {
    callback();

    expectedCycleTime += oneMinuteMs;

    // function calls itself after delay of adjustedInterval
    setTimeout(everyMinute.bind(null, callback), oneMinuteMs - (Date.now() - expectedCycleTime));
}

module.exports = everyMinute;
