const fetch = require('node-fetch');

const etags = {};

let lastFetch = 0;

function wait(milisec) {
    return new Promise(resolve => {
        setTimeout(() => { resolve('') }, milisec);
    })
}

async function getJsonIfNew(url, rate) {
    const headers = {};

    if (null == rate) {
        rate = 0;
    }

    if (undefined != etags[url]) {
        headers['If-None-Match'] = etags[url];
    }

    const elapsed = Date.now() - lastFetch;
    if (elapsed < rate) {
        await wait(rate - elapsed);
    }
    lastFetch = Date.now();

    const response = await fetch(url, {
        headers
    });

    const etag = response.headers.get('ETag');

    if (etag) {
        etags[url] = etag;
    }

    if (200 === response.status) {
        return response.json();
    } else {
        return false;
    }
}

module.exports = {
    json: getJsonIfNew
};
