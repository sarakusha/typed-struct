import { inspect } from 'node:util';
import { randomBytes } from 'node:crypto';
import { Console } from 'node:console';
import { PassThrough } from 'node:stream';
import { Buffer } from 'node:buffer';
import { Struct, ExtractType, getMask, PropType, typed } from './node';

const random = (offset: number, length: number): number =>
  Math.floor(Math.random() * length) + offset;

const float = Buffer.alloc(4);

const randomFor = (type: PropType): (() => number) => {
  switch (type) {
    case PropType.Int8:
      return () => random(-128, 256);
    case PropType.UInt8:
      return () => random(0, 256);
    case PropType.Int16:
      return () => random(-(1 << 15), 1 << 16);
    case PropType.UInt16:
      return () => random(0, 1 << 16);
    case PropType.Int32:
      return () => random(1 << 31, ((1 << 31) >>> 0) * 2);
    case PropType.UInt32:
      return () => random(0, ((1 << 31) >>> 0) * 2);
    case PropType.Float32:
      return () => {
        float.writeFloatLE(Math.random() * 1000);
        return float.readFloatLE();
      };
    case PropType.Float64:
      return () => Math.random() * 1000;
    case PropType.BCD:
      return () => random(0, 100);
    default:
      return () => 0;
  }
};

const byteRnd = randomFor(PropType.UInt8);
const bigintRnd = (): bigint => BigInt(`0x${randomBytes(8).toString('hex')}`);

const randomize = (buffer: Buffer): Buffer => {
  buffer.forEach((_, index) => {
    buffer[index] = byteRnd();
  });
  return buffer;
};

describe('Struct', () => {
  describe('align', () => {
    test('align16', () => {
      const Align16 = new Struct('Align16').seek(1).align2().UInt16LE('data').compile();
      expect(Align16.baseSize).toBe(4);
      const align16 = new Align16();
      align16.data = 0x80;
      expect(Align16.raw(align16)).toEqual(Buffer.from([0, 0, 0x80, 0]));
    });
    test('align32', () => {
      const Align32 = new Struct('Align32').seek(1).align4().UInt32LE('data').compile();
      expect(Align32.baseSize).toBe(8);
      const align32 = new Align32();
      align32.data = 0x34;
      expect(Align32.raw(align32)).toEqual(Buffer.from([0, 0, 0, 0, 0x34, 0, 0, 0]));
    });
  });
  describe('numbers', () => {
    const Model = new Struct('Model')
      .UInt8('uint8')
      .Int8('int8')
      .UInt16LE('ule16')
      .Int16LE('le16')
      .UInt16BE('ube16')
      .Int16BE('be16')
      .UInt32LE('ule32')
      .Int32LE('le32')
      .UInt32BE('ube32')
      .Int32BE('be32')
      .Float32LE('fle32')
      .Float32BE('fbe32')
      .Float64LE('fle64')
      .Float64BE('fbe64')
      .BigInt64LE('bile64')
      .BigInt64BE('bibe64')
      .BigUInt64LE('bule64')
      .BigUInt64BE('bube64')
      .compile();
    type Model = ExtractType<typeof Model>;
    const model: Model = {
      uint8: 0x12,
      int8: -1,
      ule16: 0x4567,
      le16: -100,
      ube16: 0x2345,
      be16: -345,
      ule32: 0x12345678,
      le32: -23456,
      ube32: 0x23456789,
      be32: -6789045,
      fle32: 123.44999694824219,
      fle64: 456.56,
      fbe32: -678.3400268554688,
      fbe64: -78.456,
      bile64: 123456n,
      bibe64: 456789n,
      bule64: 987654n,
      bube64: 654321n,
    };
    // noinspection SpellCheckingInspection
    const rawModel = Buffer.from(
      '12ff67459cff2345fea77856341260a4ffff23456789ff98684b66e6f642c42995c3295c8fc2f5887c40c0539d2f1a9fbe7740e2010000000000000000000006f85506120f0000000000000000000009fbf1',
      'hex'
    );
    const item = new Model(rawModel, true);
    test('baseSize', () => {
      expect(Model.baseSize).toBe(rawModel.length);
    });
    test('constructor name', () => {
      expect(item.constructor.name).toBe('Model');
    });
    test('props should be equal', () => {
      expect(item).toEqual(model);
    });
    test('buffers should be equal', () => {
      const copy = new Model();
      Object.assign(copy, model);
      expect(Model.raw(copy)).toEqual(rawModel);
    });
    describe('nested types', () => {
      const Nested = new Struct('Nested').Struct('model1', Model).Struct('model2', Model).compile();
      test('props should be equal', () => {
        const rawNested = Buffer.alloc(rawModel.length * 2);
        rawModel.copy(rawNested as Uint8Array, 0);
        rawModel.copy(rawNested as Uint8Array, rawModel.length);
        expect(new Nested(rawNested)).toEqual({
          model1: model,
          model2: model,
        });
      });
      test('should thrown when assigning an object', () => {
        const nested = new Nested();
        expect(() => {
          // @ts-expect-error: should thrown
          nested.model1 = model;
        }).toThrow();
      });
    });
  });
  describe('boolean', () => {
    const Bool = new Struct('Bool').Boolean8('b8').Boolean16('b16').Boolean32('b32').compile();
    const truthy = {
      b8: true,
      b16: true,
      b32: true,
    };
    const falsy = {
      b8: false,
      b16: false,
      b32: false,
    };
    const bufferFF = Buffer.alloc(7, 0xff);
    const buffer00 = Buffer.alloc(7);
    test('size', () => {
      expect(Bool.baseSize).toBe(7);
    });
    test('props should be equal', () => {
      expect(new Bool(bufferFF).toJSON()).toEqual(truthy);
      expect(new Bool(buffer00).toJSON()).toEqual(falsy);
    });
    test('buffers should be equal', () => {
      expect(Bool.raw(Object.assign(new Bool(), truthy))).toEqual(bufferFF);
      expect(Bool.raw(Object.assign(new Bool(), falsy))).toEqual(buffer00);
    });
  });
  describe('typed arrays', () => {
    const len = 8;

    const Data = new Struct('Data')
      .Int8Array('s8', len)
      .UInt8Array('u8', len)
      .Int16Array('s16', len)
      .UInt16Array('u16', len)
      .Int32Array('s32', len)
      .UInt32Array('u32', len)
      .Float32Array('f32', len)
      .Float64Array('f64', len)
      .BigInt64Array('bi64', len)
      .BigUInt64Array('bu64', len)
      .compile();

    const arrayBuffer = new ArrayBuffer(Data.baseSize);
    const buffer = Buffer.from(arrayBuffer);
    const data = new Data(buffer);

    randomize(buffer);
    const s8 = new Int8Array(arrayBuffer, 0, len);
    const u8 = new Uint8Array(arrayBuffer, s8.byteOffset + s8.length, len);
    const s16 = new Int16Array(arrayBuffer, u8.byteOffset + u8.length, len);
    const u16 = new Uint16Array(arrayBuffer, s16.byteOffset + s16.byteLength, len);
    const s32 = new Int32Array(arrayBuffer, u16.byteOffset + u16.byteLength, len);
    const u32 = new Uint32Array(arrayBuffer, s32.byteOffset + s32.byteLength, len);
    const f32 = new Float32Array(arrayBuffer, u32.byteOffset + u32.byteLength, len);
    const f64 = new Float64Array(arrayBuffer, f32.byteOffset + f32.byteLength, len);
    const bi64 = new BigInt64Array(arrayBuffer, f64.byteOffset + f64.byteLength, len);
    const bu64 = new BigUint64Array(arrayBuffer, bi64.byteOffset + bi64.byteLength, len);

    test('array s8', () => {
      expect(s8).toEqual(data.s8);
      expect(data.s8).toBeInstanceOf(Int8Array);
      const rnd = randomFor(PropType.Int8);
      data.s8.forEach((_, i) => {
        data.s8[i] = rnd();
      });
      expect(data.s8).toEqual(s8);
      const Tailed = new Struct('Tailed').Int8Array('data').compile();
      const tailed = new Tailed(8);
      expect(tailed.data).toHaveLength(8);
    });
    test('array u8', () => {
      expect(u8).toEqual(data.u8);
      const rnd = randomFor(PropType.UInt8);
      data.u8.forEach((_, i) => {
        data.u8[i] = rnd();
      });
      expect(data.u8).toEqual(u8);
      const Tailed = new Struct('Tailed').UInt8Array('data').compile();
      const tailed = new Tailed(8);
      expect(tailed.data).toHaveLength(8);
    });
    test('array s16', () => {
      expect(s16).toEqual(data.s16);
      const rnd = randomFor(PropType.Int16);
      data.s16.forEach((_, i) => {
        data.s16[i] = rnd();
      });
      expect(data.s16).toEqual(s16);
      const Tailed = new Struct('Tailed').Int16Array('data').compile();
      const tailed = new Tailed(8);
      expect(tailed.data).toHaveLength(4);
    });
    test('array u16', () => {
      expect(u16).toEqual(data.u16);
      const rnd = randomFor(PropType.UInt16);
      data.u16.forEach((_, i) => {
        data.u16[i] = rnd();
      });
      expect(data.u16).toEqual(u16);
      const Tailed = new Struct('Tailed').UInt16Array('data').compile();
      const tailed = new Tailed(8);
      expect(tailed.data).toHaveLength(4);
    });
    test('array s32', () => {
      expect(s32).toEqual(data.s32);
      const rnd = randomFor(PropType.Int32);
      data.s32.forEach((_, i) => {
        data.s32[i] = rnd();
      });
      expect(data.s32).toEqual(s32);
      const Tailed = new Struct('Tailed').Int32Array('data').compile();
      const tailed = new Tailed(8);
      expect(tailed.data).toHaveLength(2);
    });
    test('array u32', () => {
      expect(u32).toEqual(data.u32);
      const rnd = randomFor(PropType.UInt32);
      data.u32.forEach((_, i) => {
        data.u32[i] = rnd();
      });
      expect(data.u32).toEqual(u32);
      const Tailed = new Struct('Tailed').UInt32Array('data').compile();
      const tailed = new Tailed(8);
      expect(tailed.data).toHaveLength(2);
    });
    test('array f32', () => {
      expect(f32).toEqual(data.f32);
      const rnd = randomFor(PropType.Float32);
      data.f32.forEach((_, i) => {
        data.f32[i] = rnd();
      });
      expect(data.f32).toEqual(f32);
      const Tailed = new Struct('Tailed').Float32Array('data').compile();
      const tailed = new Tailed(8);
      expect(tailed.data).toHaveLength(2);
    });
    test('array f64', () => {
      expect(f64).toEqual(data.f64);
      const rnd = randomFor(PropType.Float64);
      data.f64.forEach((_, i) => {
        data.f64[i] = rnd();
      });
      expect(data.f64).toEqual(f64);
      const Tailed = new Struct('Tailed').Float64Array('data').compile();
      const tailed = new Tailed(8);
      expect(tailed.data).toHaveLength(1);
    });
    test('array bi64', () => {
      expect(bi64).toEqual(data.bi64);
      const rnd = (): bigint => bigintRnd() - 2n ** 63n;
      data.bi64.forEach((_, i) => {
        data.bi64[i] = rnd();
      });
      expect(data.bi64).toEqual(bi64);
      const Tailed = new Struct('Tailed').BigInt64Array('data').compile();
      const tailed = new Tailed(8);
      expect(tailed.data).toHaveLength(1);
    });
    test('array bu64', () => {
      expect(bu64).toEqual(data.bu64);
      data.bu64.forEach((_, i) => {
        data.bu64[i] = bigintRnd();
      });
      expect(data.bu64).toEqual(bu64);
      const Tailed = new Struct('Tailed').BigUInt64Array('data').compile();
      const tailed = new Tailed(8);
      expect(tailed.data).toHaveLength(1);
    });
  });
  test('struct array', () => {
    const Point = new Struct('Point').Int8('x').Int8('y').compile();
    const Vector = new Struct('Vector').StructArray('points', Point, 2).compile();
    const vector = new Vector([10, 20, 30, 40]);
    const Polygon = new Struct('Polygon').StructArray('vertices', Point).compile();
    const PolygonWithName = new Struct('PolygonWithName')
      .String('name', 20)
      .StructArray('vertices', Point)
      .compile();
    expect(Vector.baseSize).toBe(4);
    expect(vector.points).toHaveLength(2);
    expect(Polygon.baseSize).toBe(0);
    expect(PolygonWithName.baseSize).toBe(20);
    const polygon = new Polygon([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    vector.points[0].x = -1;
    vector.points[1].y = -2;
    const empty = new Polygon([0]);
    expect(empty.vertices).toHaveLength(0);
    const buf = Buffer.alloc(PolygonWithName.baseSize);
    buf.write('name');
    const named = new PolygonWithName(buf);
    expect(named.vertices).toHaveLength(0);
    expect(named.name).toBe('name');
    expect(Vector.raw(vector)).toEqual(Buffer.from([0xff, 20, 30, 0xfe]));
    expect(vector.points).toBe(vector.points);
    expect(vector).toEqual({ points: [new Point([-1, 20]), new Point([30, -2])] });
    expect(polygon.vertices).toHaveLength(5);
    expect(() => (vector.points[0] = new Point([1, 2]))).toThrow(
      "Cannot assign to read only property '0' of object '[object Array]'"
    );
    expect(() => vector.points.push(new Point([1, 2]))).toThrow(
      new TypeError('Cannot add property 2, object is not extensible')
    );
  });
  test('custom type', () => {
    const getter = jest.fn(
      (type: string, buf: Buffer): Date => new Date(buf.readDoubleLE() * 1000)
    );
    const setter = jest.fn(
      (type: string, buf: Buffer, value: Date) => buf.writeDoubleLE(value.getTime() / 1000) > 0
    );
    const Custom = new Struct('DateHolder').Custom(['date', 'value'], 8, getter, setter).compile();
    const custom = new Custom();
    const date = new Date();
    custom.date = date;
    expect(custom.date).toEqual(date);
    expect(getter.mock.calls).toHaveLength(1);
    expect(setter.mock.calls).toHaveLength(1);
    expect(getter.mock.calls[0][0]).toBe('date');
    expect(setter.mock.calls[0][0]).toBe('date');
    const rawCustom = Custom.raw(custom);
    expect(rawCustom.readDoubleLE() * 1000).toBe(date.getTime());
  });
  test('Unknown custom', () => {
    const Custom = new Struct('Custom')
      .Custom(
        'unknown',
        1,
        () => undefined,
        () => false
      )
      .compile();
    const custom = new Custom();
    expect(() => custom.unknown).toThrow(new TypeError('Unknown type "unknown"'));
    expect(() => (custom.unknown = undefined)).toThrow(new TypeError('Unknown type "unknown"'));
  });
  // test('empty custom', () => {
  //   const Trivial = new Struct('Trivial').Custom('value').compile();
  //   const trivial = new Trivial(10);
  //   expect(trivial.value).toHaveLength(10);
  //   expect(trivial.value).toBeInstanceOf(Buffer);
  // });
  test('BCD', () => {
    const BCD = new Struct('BCD').BCD('a').BCD('b').compile();
    expect(BCD.baseSize).toBe(2);
    const bcd = new BCD();
    bcd.a = 43;
    bcd.b = 56;
    expect(BCD.raw(bcd)).toEqual(Buffer.from([0x43, 0x56]));
    expect(new BCD(Buffer.from([0x56, 0x43]))).toEqual({ a: 56, b: 43 });
  });
  describe('CRC', () => {
    const len = 8;
    const sum = (buf: Buffer, previous = 0): number =>
      buf.reduce((crc, value) => (value + crc) & 0xff, previous);
    test('throws Invalid tail buffer length', () => {
      expect(() => {
        new Struct('CRC').Buffer('data', -3).CRC8('crc').compile();
      }).toThrow(new TypeError('Invalid tail buffer length. Expected -1'));
    });
    test('CRC8', () => {
      const CRC8 = new Struct('CRC8').Buffer('data').CRC8('crc').compile();
      expect(CRC8.baseSize).toBe(1);
      const buffer = randomize(Buffer.alloc(len));
      const crc8 = new CRC8(buffer);
      expect(crc8.data.length + CRC8.baseSize).toBe(len);
      const crc = byteRnd();
      crc8.crc = crc;
      expect(CRC8.raw(crc8).slice(-CRC8.baseSize).readUInt8()).toBe(crc);
    });
    test('CRC16LE', () => {
      const CRC16LE = new Struct('CRC16LE')
        .Buffer('data', len - 2)
        .CRC16LE('crc')
        .compile();
      expect(CRC16LE.baseSize).toBe(len);
      const buffer = randomize(Buffer.alloc(len));
      const crc16LE = new CRC16LE(buffer);
      const crc = randomFor(PropType.UInt16)();
      crc16LE.crc = crc;
      expect(CRC16LE.raw(crc16LE).slice(CRC16LE.getOffsetOf('crc')).readUInt16LE()).toBe(crc);
    });
    test('CRC16BE', () => {
      const CRC16BE = new Struct('CRC16BE').Buffer('data').CRC16BE('crc').compile();
      expect(CRC16BE.baseSize).toBe(2);
      const buffer = randomize(Buffer.alloc(len));
      const crc16BE = new CRC16BE(buffer);
      expect(crc16BE.data.length + CRC16BE.baseSize).toBe(len);
      const crc = randomFor(PropType.UInt16)();
      crc16BE.crc = crc;
      expect(CRC16BE.raw(crc16BE).slice(-CRC16BE.baseSize).readUInt16BE()).toBe(crc);
    });
    test('CRC32LE', () => {
      const CRC32LE = new Struct('CRC32LE').Buffer('data').CRC32LE('crc').compile();
      expect(CRC32LE.baseSize).toBe(4);
      const buffer = randomize(Buffer.alloc(len));
      const crc32LE = new CRC32LE(buffer);
      expect(crc32LE.data.length + CRC32LE.baseSize).toBe(len);
      const crc = randomFor(PropType.UInt32)();
      crc32LE.crc = crc;
      expect(CRC32LE.raw(crc32LE).slice(-CRC32LE.baseSize).readUInt32LE()).toBe(crc);
    });
    test('CRC32BE', () => {
      const CRC32BE = new Struct('CRC32BE').Buffer('data').CRC32BE('crc').compile();
      expect(CRC32BE.baseSize).toBe(4);
      const buffer = randomize(Buffer.alloc(len));
      const crc32BE = new CRC32BE(buffer);
      expect(crc32BE.data.length + CRC32BE.baseSize).toBe(len);
      const crc = randomFor(PropType.UInt32)();
      crc32BE.crc = crc;
      expect(CRC32BE.raw(crc32BE).slice(-CRC32BE.baseSize).readUInt32BE()).toBe(crc);
    });
    test('calculate and update CRC', () => {
      const crc = byteRnd();
      const calc = jest.fn<number, [Buffer, number | undefined]>(() => crc);
      const Foo = new Struct('Foo').Int32LE('bar').Buffer('data').CRC8('crc', calc, 10).compile();
      const raw = randomize(Buffer.alloc(21));
      const foo = new Foo(raw);
      const old = foo.crc;
      expect(Foo.crc(foo)).toBe(crc);
      expect(foo.crc).toBe(old);
      expect(Foo.crc(foo, true)).toBe(crc);
      expect(calc.mock.calls.length).toBe(2);
      expect(calc.mock.calls[0][0]).toEqual(raw.slice(0, -1));
      expect(calc.mock.calls[0][1]).toBe(10);
      expect(foo.crc).toBe(crc);
    });
    test('Checksum calculation starting from position 4', () => {
      const calc = jest.fn<number, [Buffer, number | undefined]>(sum);
      const Foo = new Struct('Foo')
        .Int32LE('bar', 0x1234)
        .Buffer('data')
        .CRC8('crc', {
          calc,
          start: 4,
        })
        .compile();
      const foo = new Foo(100);
      const data = randomize(foo.data);
      expect(sum(data)).toBe(Foo.crc(foo));
      expect(calc.mock.calls[0][0]).toEqual(data);
      expect(calc.mock.calls[0][1]).toBe(0);
    });
    test('There is no CRC field', () => {
      const Foo = new Struct('Foo').Int32LE('bar').Buffer('data').compile();
      expect(Foo).not.toHaveProperty('crc');
      const Baz = new Struct('Baz').Buffer('data', 10).CRC8('crc').compile();
      expect(Baz).not.toHaveProperty('crc');
    });
  });
  test('aliases', () => {
    const Ab = new Struct().UInt8(['a', 'b']).compile();
    const ab = new Ab();
    const value = byteRnd();
    ab.a = value;
    expect(Ab.baseSize).toBe(1);
    expect(ab).toEqual({
      a: value,
      b: value,
    });
  });
  test('Unit', () => {
    const Abc = new Struct().Int16LE('s16').Int8('a').back().UInt8('b').compile();
    const abc = new Abc();
    abc.a = -1;
    expect(Abc.baseSize).toBe(3);
    expect(abc.a).toBe(-1);
    expect(abc.b).toBe(255);
  });
  test('Invalid argument: back', () => {
    expect(() => {
      new Struct().Int8('foo').back(2).compile();
    }).toThrow(new TypeError('Invalid argument: back. Expected 0..1'));
  });
  test('typed', () => {
    expect(typed()).toBeUndefined();
  });
  test('offsets', () => {
    const Foo = new Struct('Foo')
      .Int8('offset0')
      .UInt16BE('offset1')
      .UInt32LE('offset3')
      .back()
      .UInt32BE('offset_3')
      .back(0)
      .UInt8('offset_0')
      .seek(0)
      .UInt8('offset7')
      .compile();
    expect(Foo.getOffsets()).toEqual({
      offset0: 0,
      offset1: 1,
      offset3: 3,
      offset_3: 3,
      offset_0: 0,
      offset7: 7,
    });
  });
  test('constant value', () => {
    const value = 0x1234;
    const Header = new Struct('Header').UInt16BE('value', value).compile();
    const header = new Header();
    expect(header.value).toBe(value);
    expect(Header.raw(header)).toEqual(Buffer.from([0x12, 0x34]));
    expect(() => {
      // @ts-expect-error: should thrown
      header.value = 0;
    }).toThrow(new TypeError(`Invalid value, expected ${value}`));
  });
  test('buffer length', () => {
    const Data = new Struct('Data').Int32LE('value').compile();
    expect(() => {
      new Data(3);
    }).toThrow(new TypeError('[Data]: Buffer size must be at least 4 (3)'));
  });
  describe('swap', () => {
    test('swap16 property', () => {
      const Uint16 = new Struct('Uint16').UInt16LE('value').compile();
      const uint16 = new Uint16();
      uint16.value = 0xabcd;
      Uint16.swap(uint16, 'value');
      expect(uint16.value).toEqual(0xcdab);
    });
    test('swap8', () => {
      const len = 4;
      const arrayBuffer = new ArrayBuffer(Int8Array.BYTES_PER_ELEMENT * len);
      const buffer = Buffer.from(arrayBuffer);
      const array = new Int8Array(arrayBuffer);
      randomize(buffer);
      const Array8 = new Struct('Array8').Int8Array('data', len).compile();
      const value = new Array8(buffer, true);
      expect(array).toEqual(value.data);
      Array8.swap(value, 'data');
      expect(array).toEqual(value.data);
    });
    test('swap16', () => {
      const len = 4;
      const arrayBuffer = new ArrayBuffer(Int16Array.BYTES_PER_ELEMENT * len);
      const buffer = Buffer.from(arrayBuffer);
      const array = new Int16Array(arrayBuffer);
      randomize(buffer);
      const Array16 = new Struct('Array16').Int16Array('data', len).compile();
      const value = new Array16(buffer, true);
      expect(array).toEqual(value.data);
      buffer.swap16();
      Array16.swap(value, 'data');
      expect(array).toEqual(value.data);
    });
    test('swap32', () => {
      const len = 4;
      const arrayBuffer = new ArrayBuffer(Int32Array.BYTES_PER_ELEMENT * len);
      const buffer = Buffer.from(arrayBuffer);
      const array = new Int32Array(arrayBuffer);
      randomize(buffer);
      const Array32 = new Struct('Array32').Int32Array('data', len).compile();
      const value = new Array32(buffer, true);
      expect(array).toEqual(value.data);
      buffer.swap32();
      Array32.swap(value, 'data');
      expect(array).toEqual(value.data);
    });
    test('swap64', () => {
      const len = 4;
      const arrayBuffer = new ArrayBuffer(Float64Array.BYTES_PER_ELEMENT * len);
      const buffer = Buffer.from(arrayBuffer);
      const array = new Float64Array(arrayBuffer);
      randomize(buffer);
      const Array64 = new Struct('Array64').Float64Array('data', len).compile();
      const value = new Array64(buffer, true);
      expect(array).toEqual(value.data);
      buffer.swap64();
      Array64.swap(value, 'data');
      expect(array).toEqual(value.data);
    });
  });
  describe('bit fields', () => {
    test('mask', () => {
      expect(getMask(1, 4, 8)).toBe(0x78);
      expect(getMask(0, 8, 8)).toBe(0xff);
      expect(() => getMask(0, 10, 8)).toThrow(new TypeError('Invalid params'));
    });
    test('32 bit', () => {
      const Bits32 = new Struct('Bits32').Bits32({ value: [0, 32] }).compile();
      const item = new Bits32();
      const value = 0x12345678;
      item.value = value;
      expect(item.value).toBe(value);
    });
    test('throws "Invalid params"', () => {
      expect(() => {
        // @ts-expect-error: should thrown
        new Struct('BitFields').Bits8({ a: [0, 12] });
      });
    });
    test('throws "Property a already exists"', () => {
      expect(() => {
        new Struct()
          .Bits8({
            a: [0, 1],
          })
          .Bits8({
            a: [0, 8],
          });
      }).toThrow('Property a already exists');
    });
    test('Bits8', () => {
      const Bits8 = new Struct('Bits8')
        .Bits8({
          a: [0, 1],
          b: [1, 2],
          c: [3, 3],
          d: [6, 2],
        })
        .Bits8({
          e: [0, 8],
        })
        .compile();
      expect(Bits8.baseSize).toBe(2);
      const value = new Bits8();
      value.a = 1;
      value.b = 3;
      value.c = 7;
      value.d = 0xff;
      value.e = 0x80;
      expect(Bits8.raw(value)).toEqual(Buffer.from([0xff, 0x80]));
    });
    test('Bits16', () => {
      const Bits16 = new Struct('Bits16')
        .Bits16({
          a: [0, 1],
          b: [1, 2],
          c: [3, 3],
          d: [6, 4],
          e: [10, 5],
          f: [15, 1],
          ab: [0, 3],
        })
        .compile();
      expect(Bits16.baseSize).toBe(2);
      const value = new Bits16(Buffer.from([0xab, 0xcd]));
      expect(value).toEqual({
        a: 1,
        b: 1,
        c: 2,
        d: 15,
        e: 6,
        f: 1,
        ab: 5,
      });
    });
    test('UserReferenceTimerStatus', () => {
      const UserReferenceTimerStatus = new Struct('UserReferenceTimerStatus')
        .UInt8('id', 38)
        .Bits32({
          alarm0: [7, 1],
          alarm1: [6, 1],
          alarm2: [5, 1],
          alarm3: [4, 1],
          alarm4: [3, 1],
          alarm5: [2, 1],
          alarm6: [1, 1],
          alarm7: [0, 1],
          overflow: [24, 1],
        })
        .compile();
      const data = new UserReferenceTimerStatus(Buffer.from([0x26, 0x01, 0x00, 0x00, 0x80]));
      expect(data.toJSON()).toEqual({
        id: 38,
        alarm0: 1,
        alarm1: 0,
        alarm2: 0,
        alarm3: 0,
        alarm4: 0,
        alarm5: 0,
        alarm6: 0,
        alarm7: 0,
        overflow: 1,
      });
    });
    test('Bits32', () => {
      const Bits32 = new Struct('Bits32')
        .Bits32({
          a: [0, 1],
          b: [1, 2],
          c: [3, 3],
          d: [6, 4],
          e: [10, 5],
          f: [15, 6],
          g: [21, 7],
          h: [28, 4],
        })
        .compile();
      expect(Bits32.baseSize).toBe(4);
      const value = new Bits32(Buffer.from([0xab, 0xcd, 0xef, 0x12]));
      expect(value).toEqual({
        a: 1,
        b: 1,
        c: 2,
        d: 15,
        e: 6,
        f: 61,
        g: 113,
        h: 2,
      });
      value.g = 0;
      expect(Bits32.raw(value)).toEqual(Buffer.from([0xab, 0xcd, 0xe8, 0x02]));
    });
  });
  test('throws "Unknown property name test"', () => {
    expect(() => {
      const Test = new Struct('Test').UInt32LE('a').compile();
      const test = new Test();
      // @ts-expect-error: should thrown
      Test.swap(test, 'test');
    }).toThrow('Unknown property name "test"');
  });
  test('Property already exists', () => {
    expect(() => {
      new Struct().Int8('foo').UInt8('foo').compile();
    }).toThrow(new TypeError('Property "foo" already exists'));
  });
  test('Tail buffer', () => {
    expect(() => {
      new Struct().Buffer('data').Int8('value').compile();
    }).toThrow(new TypeError('Invalid property "value". The tail buffer already created'));
  });
  test('crc should be the last field after the buffer', () => {
    expect(() => {
      new Struct().CRC8('bar').compile();
    }).toThrow(TypeError('CRC should not to be first'));
    expect(() => {
      new Struct().Buffer('data', -2).CRC16LE('crc').compile();
    }).not.toThrow();
    expect(() => {
      new Struct().Buffer('data', -3).CRC16LE('crc');
    }).toThrow(new TypeError('Invalid tail buffer length. Expected -2'));
  });
  test('Struct size', () => {
    expect(new Struct().UInt32LE('data').getSize()).toBe(4);
  });
  test('Undefined offset', () => {
    expect(new Struct().Int8('bar').getOffsetOf('foo' as 'bar')).toBeUndefined();
  });
  test('JSON', () => {
    const getter = (type: string, buf: Buffer): Date => new Date(buf.readDoubleLE() * 1000);
    const setter = (type: string, buf: Buffer, value: Date) =>
      buf.writeDoubleLE(value.getTime() / 1000) > 0;
    const Foo = new Struct('Foo')
      .Boolean8('baz')
      .Int8('bar')
      .UInt8Array('array', 3)
      .Struct('s', new Struct().Int8Array('values', 2).compile())
      .Buffer('buf', 2)
      .Custom('date', 8, getter, setter)
      .BigUInt64LE('bu64')
      .align8()
      .BigUInt64Array('abu64', 1)
      .compile();
    const bu64 = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]); // randomBytes(8);
    const abu64 = randomBytes(8);
    const bigint64 = (a: Buffer): string => BigInt(`0x${a.toString('hex')}`).toString();
    const raw = [
      0xff,
      0xfd,
      1,
      2,
      3,
      0xfe,
      0xfd,
      0xc0,
      0xde,
      0,
      0,
      0,
      0,
      0x02,
      0x98,
      0x9a,
      0x41,
      ...[...bu64].reverse(),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      ...[...abu64].reverse(),
    ];
    const foo = new Foo(raw);
    const json = foo.toJSON();
    expect(Object.getPrototypeOf(json)).toBe(Object.prototype);
    expect(json).toEqual({
      baz: true,
      bar: -3,
      array: [1, 2, 3],
      s: { values: [-2, -3] },
      buf: [0xc0, 0xde],
      date: foo.date.toJSON(),
      bu64: bigint64(bu64),
      abu64: [bigint64(abu64)],
    });
  });
  test('string', () => {
    const Text = new Struct('Text')
      .String('title', 'win1251', 20)
      .String('author')
      .CRC8('crc')
      .compile();
    const text = new Text(30);
    text.title = 'Привет User';
    text.author = 'Andrei';
    expect(text.title).toHaveLength(11);
    expect(text.author).toHaveLength(6);
    expect(Text.raw(text)).toEqual(
      Buffer.from('cff0e8e2e5f22055736572000000000000000000416e6472656900000000', 'hex')
    );
    expect(text.title).toBe('Привет User');
    text.title = 'A'.repeat(20);
    expect(text.title).toHaveLength(20);
    expect(() => {
      text.title = 'E'.repeat(21);
    }).toThrow('String is too long');
    expect(() => {
      text.author = 'Андрей';
    }).toThrow('String is too long');
    const StringLiteral = new Struct('StringLiteral')
      .String('value', {
        literal: 'Lorem ipsum',
      })
      .compile();
    const literal = new StringLiteral();
    expect(literal.value).toBe('Lorem ipsum');
    expect(() => {
      // @ts-expect-error: should thrown
      literal.value = 'Bla-bla';
    }).toThrow(new TypeError('Invalid value, expected "Lorem ipsum"'));
    expect(() => {
      literal.value = 'Lorem ipsum';
    }).not.toThrow();
    const raw = StringLiteral.raw(literal);
    expect(raw).toHaveLength(11);
    const expected = Buffer.alloc(11);
    Buffer.from('Lorem ipsum').copy(expected as Uint8Array);
    expect(raw).toEqual(expected);
  });
  test('string array', () => {
    const Text = new Struct('Text')
      .StringArray('lines', {
        length: 20,
        lines: 5,
      })
      .compile();
    expect(Text.baseSize).toBe(100);
    const text = new Text();
    expect(Array.isArray(text.lines)).toBe(true);
    expect(text.lines).toHaveLength(5);
    const expected: string[] = [];
    for (let i = 0; i < text.lines.length; i += 1) {
      const line = `line ${i}`;
      expected[i] = line;
      text.lines[i] = line;
    }
    const lines = text.lines;
    expect(text.lines).toEqual(expected);
    expect([...text.lines]).toEqual(expected);
    expect(text.toJSON()).toEqual({ lines: expected });
    expect(text.lines).toBe(text.lines);
    expect(text.lines[0]).toBe(text.lines[0]);
    const raw = Text.raw(text);
    raw[0] = 'L'.charCodeAt(0);
    expected[0] = 'Line 0';
    expect(text.lines).toEqual(expected);
    expect(lines).toEqual(expected);
    expect(lines).toBe(text.lines);
    expect(() => {
      text.lines[6] = 'Lorem ipsum';
    }).toThrow(new TypeError('Cannot add property 6, object is not extensible'));
    expect(Object.isExtensible(text.lines)).toBe(false);
    expect(inspect(expected)).toBe(inspect(text.lines));
  });
  test('multiple tiles', () => {
    const A = new Struct('A').UInt8('value').compile();
    const B = new Struct('B').UInt16LE('value').compile();
    const Wrapper = new Struct('Wrapper').StructArray('a', A).back().StructArray('b', B).compile();
    const bytes = [1, 2, 3, 4];
    const words = [0x201, 0x403];
    const item = new Wrapper(bytes).toJSON();
    expect(item.a.map(({ value }) => value)).toEqual(bytes);
    expect(item.b.map(({ value }) => value)).toEqual(words);
    const BinData = new Struct('BinData').UInt8Array('bytes').back().UInt16Array('words').compile();
    const binData = new BinData(bytes);
    expect(binData.bytes).toEqual(new Uint8Array(bytes));
    expect(binData.words).toEqual(new Uint16Array(words));
  });
  test('debug', async () => {
    const Model = new Struct('Model').UInt8('foo').BigInt64LE('bar').Buffer('baz', 6).compile();
    const Root = new Struct('Root').StructArray('models', Model, 2).compile();
    const root = new Root();
    root.models[0].foo = 1;
    root.models[0].bar = 2345678n;
    root.models[0].baz.fill(0xff);
    expect(Object.getOwnPropertySymbols(root)).toEqual(
      expect.arrayContaining([Symbol.toPrimitive, inspect.custom])
    );
    const stream = new PassThrough();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mockWrite = jest.fn((_: string) => true);
    stream.write = mockWrite;
    const cons = new Console(stream);
    cons.log(root);
    expect(mockWrite.mock.calls[0][0]).toBe(
      `{
  models: [
    { foo: 1, bar: 2345678n, baz: <Buffer ff ff ff ff ff ff> },
    { foo: 0, bar: 0n, baz: <Buffer 00 00 00 00 00 00> }
  ]
}
`
    );
    if (process.stdout.isTTY) {
      const colored = (str: string): string => `\\x1b\\[.+;1m${str}\\x1b\\[0m`;
      const chunks = [
        ['01', 'ce-ca-23-00-00-00-00-00', 'ff-ff-ff-ff-ff-ff'],
        ['00', '00-00-00-00-00-00-00-00', '00-00-00-00-00-00'],
      ];
      const re = new RegExp(
        colored(chunks.map(item => item.map(colored).join('=')).join(colored('=')))
      );
      // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions
      expect(`${root}`).toMatch(re);
      // console.log(`${root.models[0]}`);
    }
    jest.resetModules(); // unload debug
    const { Struct: S } = await import('./node');
    const M = new S('Model').UInt8('foo').BigInt64LE('bar').Buffer('baz', 6).compile();
    // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions
    expect(`${new M()}`).toBe('00=00-00-00-00-00-00-00-00=00-00-00-00-00-00');
  });
  test('assign', () => {
    const Point = new Struct('Point').Int16LE('x').Int16LE('y').compile();
    const Line = new Struct('Line').Struct('start', Point).Struct('end', Point).compile();
    const line = new Line();
    Line.safeAssign(line, { start: { x: 10, y: 20 }, end: { x: 30, y: 40 } });
    expect(line).toEqual({ start: { x: 10, y: 20 }, end: { x: 30, y: 40 } });
    const Polygon = new Struct('Polygon').StructArray('vertices', Point).compile();
    const polygon = new Polygon(3 * Point.baseSize);
    Polygon.safeAssign(polygon, {
      vertices: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ],
    });
    expect(polygon.vertices).toHaveLength(3);
    expect(polygon).toEqual({
      vertices: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ],
    });

    Line.safeAssign(line, { end: { x: 80 } });
    expect(line).toEqual({
      start: { x: 10, y: 20 },
      end: { x: 80, y: 40 },
    });
    // eslint-disable-next-line no-sparse-arrays
    Polygon.safeAssign(polygon, { vertices: [, { x: 3, y: 4 }, { x: 7, y: 8 }] });
    expect(polygon).toEqual({
      vertices: [
        { x: 10, y: 20 },
        { x: 3, y: 4 },
        { x: 7, y: 8 },
      ],
    });
  });
});
