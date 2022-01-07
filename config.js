const path = require('path');
const package = require('./package.json');

const config = {};

config.datadir = process.env.DATA_DIR || path.resolve(__dirname, './data');
config.port = process.env.PORT || '3000';
config.docroot = process.env.DOC_ROOT || `http://localhost:${config.port}`;
config.generator = `${package.name} ${package.version}`;
config.riverLimit = process.env.RIVER_LIMIT || 300;

config.blacklist = [
    'bookmark-outpost-proof.glitch.me',
];

module.exports = config;
