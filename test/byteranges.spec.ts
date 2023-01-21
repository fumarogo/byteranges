import fs from 'fs/promises';
import chai, { expect } from 'chai';
import chaiBytes from 'chai-bytes';
import { InclRange, getContentRange, getContentType, parse } from '../src/byteranges';

chai.use(chaiBytes);

describe('Byteranges', function () {
    it('should parse content-range when the complete length is known', function () {
        const headers = 'Content-Range: bytes 42-1233/1234';
        const range = getContentRange(headers);
        expect(range).to.be.an('object');
        expect(range.unit).to.equals('bytes');
        expect(range.range).to.be.an('object');
        expect(range.range).to.be.an.instanceOf(InclRange);
        expect((range.range as InclRange).start).to.eq(42);
        expect((range.range as InclRange).end).to.eq(1233);
        expect(range.length).to.equals(1234);
    });

    it('should parse content-range when the complete length is unknown', function () {
        const headers = 'Content-Range: bytes 42-1233/*';
        const range = getContentRange(headers);
        expect(range).to.be.an('object');
        expect(range.unit).to.equals('bytes');
        expect(range.range).to.be.an('object');
        expect(range.range).to.be.an.instanceOf(InclRange);
        expect((range.range as InclRange).start).to.eq(42);
        expect((range.range as InclRange).end).to.eq(1233);
        expect(range.length).to.equals('*');
    });

    it('should parse content-range with unsatisfied range', function () {
        const headers = 'Content-Range: bytes */1234';
        const range = getContentRange(headers);
        expect(range).to.be.an('object');
        expect(range.unit).to.equals('bytes');
        expect(range.range).to.equals('*');
        expect(range.length).to.equals(1234);
    });

    it('should throw an exception', function () {
        const headers = '';
        expect(getContentRange).to.throw();
    });

    it('should parse content-type', function () {
        const headers = 'Content-Type: application/json';
        const type = getContentType(headers);
        expect(type).to.equals('application/json');
    });

    it('should return udefined', function () {
        const headers = '';
        const type = getContentType(headers);
        expect(type).to.equals(undefined);
    });

    it('should parse multipart/byteranges body', async function () {
        const body = await fs.readFile('test/byteranges');
        const parts = parse(body, '00000000000000000002');
        expect(parts).to.be.an('array').of.length(2);
        expect(parts[0].octets).to.equalBytes([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
        expect(parts[1].octets).to.equalBytes([
            105, 110, 116, 101, 114, 108, 97, 99, 101, 100, 61, 48, 32, 98, 108, 117,
            114, 97, 121, 95, 99, 111, 109, 112, 97, 116, 61, 48, 32, 99, 111, 110,
            115, 116, 114, 97, 105, 110, 101, 100, 95, 105, 110, 116, 114, 97, 61, 48,
            32, 98, 102, 114, 97, 109, 101, 115, 61, 51, 32, 98, 95, 112, 121, 114,
            97, 109, 105, 100, 61, 50, 32, 98, 95, 97, 100, 97, 112, 116, 61, 49,
            32, 98, 95, 98, 105, 97, 115, 61, 48, 32, 100, 105, 114, 101, 99, 116,
            61, 49, 32, 119, 101
        ]);
    });
});
