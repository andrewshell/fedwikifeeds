const log = require('npmlog');

log.level = process.env.NODE_ENV === 'production' ? 'notice' : 'info';

module.exports = log;
