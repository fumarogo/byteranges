import { Buffer } from 'node:buffer';

export class InclRange {
    constructor(public readonly start: number, public readonly end: number) { }
}

export class ContentRange {
    constructor(public readonly unit: string, public readonly range: InclRange | '*', public readonly length: number | '*') { }
}

export class BodyPart {
    constructor(public readonly range: ContentRange, public readonly octets: Buffer, public readonly type?: string) { }
}

const crlf = Buffer.from([0x0D, 0x0A]);
const crlfcrlf = Buffer.concat([crlf, crlf]);
const crre = /content-range:\s+(\w+)\s+(?:(\d+)-(\d+)\/(\d+|\*)|(\*)\/(\d+))/i;
const ctre = /content-type:\s+(.+)/i;

export function getContentRange(headers: string): ContentRange {
    const match = crre.exec(headers);

    if (match === null) {
        throw new Error('Content-Range header not found');
    }

    let unit: string = match[1];
    let range: InclRange | '*';
    let length: number | '*';

    if (match[5] === '*') {
        range = '*';
        length = +match[6];
    } else if (match[4] === '*') {
        range = new InclRange(+match[2], +match[3]);
        length = '*';
    } else {
        range = new InclRange(+match[2], +match[3]);
        length = +match[4];
    }

    return new ContentRange(unit, range, length);
}

export function getContentType(headers: string): string | undefined {
    const match = ctre.exec(headers);

    return match === null ? undefined : match[1];
}

export function parse(body: Buffer, boundary: string): BodyPart[] {
    const parts: BodyPart[] = [];

    boundary = '--' + boundary;

    let index = body.indexOf(boundary);

    if (index === -1) {
        throw new Error('Boundary not found');
    }

    while (index !== -1) {
        index += boundary.length;

        if (body[index] === 0x2D && body[index + 1] === 0x2D) {
            // --boudary-- indicates that no further body parts will follow
            break;
        }

        // discard transport padding and CRLF
        index = body.indexOf(crlf, index) + 2;

        if (index === -1) {
            throw new Error('Range begin not found');
        }

        let end = body.indexOf(crlfcrlf, index);

        if (end === -1) {
            throw new Error('Headers not found');
        }

        const headers = body.toString('ascii', index, end);
        const range = getContentRange(headers);
        const type = getContentType(headers);
        const begin = end + 4;

        if (range.unit.toLowerCase() === 'bytes' && range.range instanceof InclRange) {
            end = begin + range.range.end - range.range.start + 1;
            index = body.indexOf(boundary, end);
        } else {
            index = body.indexOf(boundary, begin);
            end = index - 2;
        }

        if (index === -1) {
            throw new Error('Range end not found');
        }

        const octets = body.subarray(begin, end);

        parts.push(new BodyPart(range, octets, type));
    }

    return parts;
}
