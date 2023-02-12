# byteranges

A JavaScript `multipart/byteranges` parser library.

## Overview

This library parses `multipart/byteranges` response body of [HTTP range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests).

The Range HTTP request header indicates the part of a document that the server should return. Several parts can be requested with one Range header at once, and the server may send back these ranges in a multipart document.

## Install

```
npm install byteranges
```

## Usage

```js
const { parse, getContentRange, BodyPart } = require('../build/byteranges');
const http = require('http');

http.get('http://www.columbia.edu/~fdc/picture-of-something.jpg', {
    headers: {
        Range: 'bytes=1-10,101-150'
    }
}, res => {
    const { statusCode } = res;
    if (statusCode !== 206) {
        res.resume();
        return;
    }

    const chunks = [];
    res.on('data', chunk => {
        chunks.push(chunk);
    });
    res.on('end', () => {
        const body = Buffer.concat(chunks);
        const contentType = res.headers['content-type'];

        if (!/multipart\/byteranges/i.test(contentType)) {
            const range = getContentRange(res.headers['content-range']);
            const part = new BodyPart(range, body, contentType);
            console.log(JSON.stringify(part));
            return;
        }

        const match = /boundary=(\w+)/i.exec(contentType);
        if (match === null) {
            return;
        }

        const boundary = match[1];
        const parts = parse(body, boundary);
        console.log(JSON.stringify(parts));
    });
});
```

Using [superagent](https://github.com/ladjs/superagent):

```js
const { parse, getContentRange, BodyPart } = require('../build/byteranges');
const superagent = require('superagent');

superagent
    .get('http://www.columbia.edu/~fdc/picture-of-something.jpg')
    .set('Range', 'bytes=1-10,101-150')
    .buffer(true)
    .parse(superagent.parse['application/octet-stream'])
    .end((err, res) => {
        if (err) {
            console.log(err);
            return;
        }

        if (res.status !== 206) {
            return;
        }

        const contentType = res.headers['content-type'];
        if (!/multipart\/byteranges/i.test(contentType)) {
            const range = getContentRange(res.headers['content-range']);
            const part = new BodyPart(range, res.body, contentType);
            console.log(JSON.stringify(part));
            return;
        }

        const match = /boundary=(\w+)/i.exec(contentType);
        if (match !== null) {
            const boundary = match[1];
            const parts = parse(res.body, boundary);
            console.log(JSON.stringify(parts));
        }
    });
```