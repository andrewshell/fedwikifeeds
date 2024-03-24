const config = require('../config');
const express = require('express');
const router = express.Router();
const fedwikiHelper = require('../lib/fedwiki-helper');
const feedHelper = require('../lib/feed-helper');
const dayjs = require('../lib/day.js');

function domainSort(a, b) {
    const aParts = a.split('.');
    const bParts = b.split('.');

    let aTld = aParts.pop();
    let bTld = bParts.pop();

    while (aTld && bTld && 0 === aTld.localeCompare(bTld)) {
        aTld = aParts.pop();
        bTld = bParts.pop();
    }

    if (null == aTld && null == bTld) {
        return 0;
    }

    if (null == aTld) {
        return -1;
    }

    if (null == bTld) {
        return 1;
    }

    return aTld.localeCompare(bTld);
}

router.get('/', async (req, res) => {
  const output = await fedwikiHelper.fetchAllFeeds();
  const domains = Object.keys(output.data).sort().map((domain) => {
      return output.data[domain];
  });

  res.render('debug/index', { domains });
})

module.exports = router;
