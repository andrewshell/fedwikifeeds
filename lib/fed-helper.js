const getIfNew = require('./get-if-new');
const pageCache = require('./page-cache');

let preferredScheme = {};

async function homepageUrl(domain) {
    if (null == preferredScheme[domain]) {
        await fetchSitemap(domain, true);
    }

    return `${preferredScheme[domain]}://${domain}`;
}

async function fetchUrl(scheme, domain, path, preferCache) {
    let contents = false, url = `${scheme}://${domain}${path}`;

    if (true === preferCache) {
        cache = await pageCache.read(url);
        if (cache) {
            preferredScheme[domain] = scheme;
            return cache;
        }
    }
    if (false === contents) {
        contents = await getIfNew.json(url, 100);
    }
    if (false === contents) {
        cache = await pageCache.read(url);
        if (cache) {
            preferredScheme[domain] = scheme;
            return cache;
        } else {
            console.log(`Can't fetch ${url}`);
        }
    } else {
        preferredScheme[domain] = scheme;
        cache = await pageCache.write(url, contents);
        return cache;
    }

    return contents;
}

async function fetchPath(domain, path, preferCache) {

    let cache = false;
    let schemes = [preferredScheme[domain] || 'http'];
    schemes[1] = 'http' === schemes[0] ? 'https': 'http';

    for (let scheme of schemes) {
        try {
            cache = fetchUrl(scheme, domain, path, preferCache);
            if (false !== cache) {
                return cache;
            }
        } catch (err) {
            console.error(err);
        }
    }

    return cache;
}

async function fetchAllFeeds() {
    let cache = false;

    try {
        cache = await pageCache.read('allfeeds.json');
        if (false !== cache) {
            return cache;
        }
    } catch (err) {
        console.error(err);
    }

    if (false === cache) {
        cache = await pageCache.write('allfeeds.json', []);
    }

    return cache;
}

async function saveAllFeeds(data) {
    return pageCache.write('allfeeds.json', [...new Set(data)]);
}

async function fetchSitemap(domain, preferCache) {
    let cache = false;

    try {
        cache = await fetchPath(domain, '/system/sitemap.json', preferCache)
    } catch (err) {
        console.error(err);
    }

    return cache;
}

async function fetchPeers(domain, preferCache) {
    let cache = false;

    try {
        cache = await fetchPath(domain, '/plugin/present/roll', preferCache);
    } catch (err) {
        console.error(err);
    }

    if (false === cache) {
        // Handle sites that don't have /plugin/present/roll endpoint
        cache = {
            cachename: `http://${domain}/plugin/present/roll`,
            cached: true,
            data: { roll: [ { site: domain } ] },
            created: (new Date()).toISOString()
        };
    }

    cache.data = cache.data.roll.map(site => site.site);

    console.log(cache.data);

    return cache;
}

module.exports = {
    homepageUrl,
    fetchAllFeeds,
    fetchPeers,
    fetchSitemap,
    saveAllFeeds
};
