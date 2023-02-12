import { Buffer } from 'node:buffer';


/**
 * `InclRange` objects are used to represent inclusive ranges.
 */
export class InclRange {
    constructor(public readonly start: number, public readonly end: number) { }
}

export type InclRangeOrStar = InclRange | '*';

export type CompleteLengthOrStar = number | '*';


/**
 * `ContentRange` objects are used to represent content ranges.
 */
export class ContentRange<T extends InclRangeOrStar = InclRangeOrStar, U extends CompleteLengthOrStar = CompleteLengthOrStar> {
    constructor(public readonly unit: string, public readonly range: T, public readonly length: U) { }
}


/**
 * `BodyPart` objects are used to represent body parts.
 */
export class BodyPart<T extends InclRangeOrStar = InclRangeOrStar, U extends CompleteLengthOrStar = CompleteLengthOrStar> {
    constructor(public readonly range: ContentRange<T, U>, public readonly octets: Buffer, public readonly type?: string) { }
}

const crlf = Buffer.from([0x0D, 0x0A]);
const crlfcrlf = Buffer.concat([crlf, crlf]);
const crvre = /(\w+)\s+(?:(\d+)-(\d+)\/(\d+|\*)|(\*)\/(\d+))/i;
const crkvre = /content-range:\s+(\w+)\s+(?:(\d+)-(\d+)\/(\d+|\*)|(\*)\/(\d+))/i;
const ctkvre = /content-type:\s+(.+)/i;

function getContentRangeInternal(match: RegExpExecArray): ContentRange {
    let unit: string = match[1];
    let range: InclRangeOrStar;
    let length: CompleteLengthOrStar;

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

/**
 * Parses a HTTP Content-Range header `value`.
 * Returns a `ContentRange` instance.
 * 
 * Throws if the format of the supplied `value` is invalid.
 * 
 * @param value HTTP Content-Range header value.
 * @returns A `ContentRange` instance.
 */
export function getContentRange(value: string): ContentRange {
    const match = crvre.exec(value);

    if (match === null) {
        throw new Error('Invalid Content-Range value');
    }

    return getContentRangeInternal(match);
}

function getPartContentRange(headers: string): ContentRange {
    const match = crkvre.exec(headers);

    if (match === null) {
        throw new Error('Content-Range header not found');
    }

    return getContentRangeInternal(match);
}

function getPartContentType(headers: string): string | undefined {
    const match = ctkvre.exec(headers);

    return match === null ? undefined : match[1];
}


/**
 * Type guard function that narrows the supplied `ContentRange` instance to a `ContentRange<InclRange>` instance.
 * 
 * Returns `true` if the supplied `ContentRange` instance represents a satisfiable range.
 * 
 * @param range A `ContentRange` instance.
 * @returns `true` if `range` is a `ContentRange<InclRange>` instance, `false` otherwise.
 */
export function isSatisfiableRange(range: ContentRange): range is ContentRange<InclRange> {
    return range.range instanceof InclRange;
}

/**
 * Type guard function that narrows the supplied `ContentRange` instance to a `ContentRange<InclRange, number>` instance.
 * 
 * Returns `true` if the supplied `ContentRange` instance represents a complete-length range.
 * 
 * @param range A `ContentRange` instance.
 * @returns `true` if `range` is a `ContentRange<InclRange, number>` instance, `false` otherwise.
 */
export function isCompleteLengthRange(range: ContentRange): range is ContentRange<InclRange, number> {
    return isSatisfiableRange(range) && typeof range.length === 'number';
}


/**
 * Parses a HTTP `multipart/byteranges` response `body` delimited by the specified `boundary`.
 * Returns an array of `BodyPart<InclRange>` instances.
 * 
 * Throws if it cannot find part boundaries or valid (satisfiable) ranges.
 *   
 * @param body A `Buffer` instance.
 * @param boundary The body parts boundary.
 * @returns Array of body parts.
 */
export function parse(body: Buffer, boundary: string): BodyPart<InclRange>[] {
    const parts: BodyPart<InclRange>[] = [];

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
        const range = getPartContentRange(headers);

        if (!isSatisfiableRange(range)) {
            throw new Error('Unsatisfied range');
        }

        const type = getPartContentType(headers);
        const begin = end + 4;

        if (range.unit.toLowerCase() === 'bytes') {
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

/**
 * Type guard function that narrows the supplied `BodyPart[]` instance to a `BodyPart<InclRange, number>[]` instance.
 * 
 * Returns `true` if the supplied `BodyPart[]` instance represents an array of complete-length range parts.
 * 
 * @param range A `BodyPart[]` instance.
 * @returns `true` if `parts` is a `BodyPart<InclRange, number>[]` instance, `false` otherwise.
 */
export function isCompleteLengthRangeParts(parts: BodyPart[]): parts is BodyPart<InclRange, number>[] {
    return !parts.some(part => !isCompleteLengthRange(part.range));
}
