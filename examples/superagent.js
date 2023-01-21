const { parse } = require('byteranges');
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
            return;
        }

        const match = /boundary=(\w+)/i.exec(contentType);
        if (match !== null) {
            const boundary = match[1];
            const parts = parse(res.body, boundary);
            console.log(JSON.stringify(parts));
        }
    });