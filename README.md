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
const http = require('http');
const { parse } = require('byteranges');

http.get('http://www.columbia.edu/~fdc/picture-of-something.jpg', {
    headers: {
        Range: 'bytes=1-10,101-150'
    }
}, res => {
    const { statusCode } = res;
    const contentType = res.headers['content-type'];

    if (statusCode !== 206 && !/multipart\/byteranges/i.test(contentType)) {
        res.resume();
        return;
    }

    const chunks = [];

    res.on('data', chunk => {
        chunks.push(chunk);
    });

    res.on('end', () => {
        const match = /boundary=(\w+)/i.exec(contentType);

        if (match !== null) {
            const boundary = match[1];
            const body = Buffer.concat(chunks);
            const parts = parse(body, boundary);
            console.log(JSON.stringify(parts));
        }
    });
});
```