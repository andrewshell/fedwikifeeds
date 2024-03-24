const fs = require('fs');
const path = require('path');
const package = require('./package.json');

const blacklistPath = './blacklist.json';
const cnamePath = './cname.json';
let blacklist = [];
let cname = [];

if (fs.existsSync(path.resolve(__dirname, blacklistPath))) {
    blacklist = require(blacklistPath);
} else {
    fs.writeFileSync(path.resolve(__dirname, blacklistPath), JSON.stringify(cname), 'utf8');
}

if (fs.existsSync(path.resolve(__dirname, cnamePath))) {
    cname = require(cnamePath);
} else {
    fs.writeFileSync(path.resolve(__dirname, cnamePath), JSON.stringify(cname), 'utf8');
}

const config = {};

config.datadir = process.env.DATA_DIR || path.resolve(__dirname, './data');
config.port = process.env.PORT || '3000';
config.docroot = process.env.DOC_ROOT || `http://localhost:${config.port}`;
config.generator = `${package.name} ${package.version}`;
config.riverLimit = process.env.RIVER_LIMIT || 300;
config.blacklist = blacklist;
config.cname = cname;

module.exports = config;
