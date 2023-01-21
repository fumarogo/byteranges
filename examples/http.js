const { parse } = require('byteranges');
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

    const contentType = res.headers['content-type'];
    if (!/multipart\/byteranges/i.test(contentType)) {
        return;
    }

    const match = /boundary=(\w+)/i.exec(contentType);
    if (match === null) {
        return;
    }

    const chunks = [];
    res.on('data', chunk => {
        chunks.push(chunk);
    });
    res.on('end', () => {
        const boundary = match[1];
        const body = Buffer.concat(chunks);
        const parts = parse(body, boundary);
        console.log(JSON.stringify(parts));
    });
});
