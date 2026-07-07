const fs = require('fs');
const path = require('path');
const package = require('./package.json');

const datadir = process.env.DATA_DIR || path.resolve(__dirname, './data');
const blacklistPath = path.join(datadir, 'blacklist.json');
const cnamePath = path.join(datadir, 'cname.json');
let blacklist = [];
let cname = [];

fs.mkdirSync(datadir, { recursive: true });

if (fs.existsSync(blacklistPath)) {
    blacklist = require(blacklistPath);
} else {
    fs.writeFileSync(blacklistPath, JSON.stringify(blacklist), 'utf8');
}

if (fs.existsSync(cnamePath)) {
    cname = require(cnamePath);
} else {
    fs.writeFileSync(cnamePath, JSON.stringify(cname), 'utf8');
}

const config = {};

config.datadir = datadir;
config.port = process.env.PORT || '3000';
config.docroot = process.env.DOC_ROOT || `http://localhost:${config.port}`;
config.generator = `${package.name} ${package.version}`;
config.riverLimit = process.env.RIVER_LIMIT || 300;
config.blacklist = blacklist;
config.cname = cname;

module.exports = config;
