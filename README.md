# typed-struct

A TypeScript utility library for creating objects that store
their properties in a buffer for serialization/deserialization
similar to structures in C.

[![codecov](https://codecov.io/gh/sarakusha/typed-struct/branch/main/graph/badge.svg?token=6F26I7FO73)](https://codecov.io/gh/sarakusha/typed-struct)
[![CircleCI](https://circleci.com/gh/sarakusha/typed-struct.svg?style=shield)](https://circleci.com/gh/sarakusha/typed-struct)
## Getting started

Using npm:

```bash
$ npm install --save typed-struct
```
or yarn:

```bash
$ yarn add typed-struct
```

## Features

The following types are supported:

- Integers (1, 2, 4 bytes)
- Booleans (1, 2, 4 bytes)
- Float (4 bytes)
- Double (8 bytes)
- Bit fields (1...32 bits)
- Binary-decoded decimals 
- Buffers
- Custom types (requires custom getter/setter)

Nested types and arrays are also supported.

The generated structures will be strongly typed,
which will provide better documentation and allow TypeScript
to validate that your code is working correctly.

## Examples

### Create a data structure by chaining the appropriate method calls

```ts
import Struct from 'typed-struct';

const MyStructure = new Struct('MyStructure') // give a name to the constructor
  .Int8('foo')        // signed 8-bit integer field `foo`
  .UInt16LE('bar')    // unsigned, little-endian 16-bit integer field `bar`
  .compile();         // create a constructor for the structure, called last

expect(MyStructure.baseSize).toBe(3);

// creates an instance
const item1 = new MyStructure();
expect(item1.constructor.name).toBe('MyStructure');

// get the underlying buffer
const raw = MyStructure.raw(item1);
expect(raw.length).toBe(MyStructure.baseSize);

// Changing the properties of the structure
// changes the underlying buffer
item1.foo = 0x56;
item1.bar = 0x1234;
expect(raw).toEqual(Buffer.from([0x56, 0x34, 0x12]))

// ... and vice versa
raw[0] = 0;
expect(item1.foo).toBe(0);

// deserialization
const item2 = new MyStructure([0x11, 0x22, 0x33]);
expect(item2.foo).toBe(0x11);
expect(item2.bar).toBe(0x3322);
```
### Typed arrays
```ts
import Struct from 'typed-struct';

const Foo = new Struct('Foo')
  .UInt16Array('items', 10)
  .compile();

const foo = new Foo();
expect(foo.items).toHaveLength(10);
expect(foo.items).toBeInstanceOf(Uint16Array);
expect(Foo.raw(foo)).toHaveLength(20);

// If the byte order in the system is different from that used in the data,
// use `swap` method
Foo.swap(foo.bar);

// ...

// change back
Foo.swap(foo.bar);
```
### Array of structures
Using the structure `MyStructure` from the previous examples
```ts
const Baz = new Struct('Baz')
  .StructArray('structs', MyStructure, 10)
  .compile();

const baz = new Baz();
expect(baz.structs).toHaveLength(10);
baz.structs[3].foo = 123;
```

### Nested types
Using the structure `MyStructure` from the previous examples

```ts
const Bat = new Struct('Bat')
  .Float64LE('baz')
  .Struct('quux', MyStructure)
  .compile();

const bat = new Bat();
bat.quux.foo = 123;
bat.quux.bar = 82345;
bat.baz = 3.14;

const Xyz = new Struct('Xyz')
  .Struct('bat', Bat)
  .compile();

const xyz = new Xyz();
xyz.bat.quux.foo = 123;

// but assignment to structure field is not allowed
expect(() => {
  xyz.bat = bat;
}).toThrow(new TypeError('Cannot assign to read only property bat'))
```

### Union
```ts
const Word = new Struct('Word')
  .UInt16LE('value')
  // We take a step back or two bytes back, which takes up the previous field
  // you can also use `seek` method with a negative argument
  .back()
  .UInt8('low')
  .UInt8('high')
  .compile();

const word = new Word();
word.value = 0x1234;
expect(word.low).toBe(0x34);
expect(word.high).toBe(0x12);
expect(Word.baseSize).toBe(2);
```
### Custom types
```ts
const BirthCertificate = new Struct('BirthCertificate')
  .Custom(
    'birthday',
    8, // size
    // getter, must return property value or `undefined` for unknown type
    (type, buf): Date => new Date(buf.readDoubleLE() * 1000),
    // setter, must return `false` for unknown type or `true` if everything is ok
    (type, buf, value) => buf.writeDoubleLE(value.getTime() / 1000) > 0
  )
  .compile();
expect(BirthCertificate.baseSize).toBe(8);

const cert = new BirthCertificate();
cert.birthday = new Date(1973, 7, 15);
```
### Aliases
Using the structure `BirthCertificate` from the previous example.
```ts
const Twins = new Struct('Twins')
  // `John` and `Jimmy` properties are equivalent
  .Struct(['John', 'Jimmy'], BirthCertificate)
  .compile();

expect(Twins.baseSize).toBe(8);

const twins = new Twins();
twins.John.birthday = new Date(1973, 7, 15);
expect(twins.Jimmy.birthday).toBe(twins.John.birthday);
```
### Constant fields
```ts
const Request = new Struct('Request')
  .UInt32BE('header', 0xDEADBEEF)
  .Buffer('data', 16)
  .compile();

const req = new Request();

// `header` property is initialized in the constructor
expect(req.header).toBe(0xDEADBEEF);

// Assigning a value other than the specified one is not allowed
expect(() => {
  // eslint or IDE will also indicate an error
  req.header = 0xDEADC0DE;
}).toThrow(new TypeError(`Invalid value, expected 0xDEADBEEF`));

// ... but
req.header = 0xDEADBEEF;
```
### Enumerated fields
```ts
import Struct, { typed } from 'typed-struct';

enum ErrorType {
  Success,
  Timeout,
  InvalidCommand,
  ServerError,
}

const REQUEST = 0xAA;
const RESPONSE = 0x55;

// Numeric type refinement
const OperationResult = new Struct()
  .UInt8('operation', typed<1 | 2 | 3 | 19>())
  .UInt8('type', typed<typeof REQUEST | typeof RESPONSE>())
  .UInt8('error', typed<ErrorType>())
  .compile();

/*
type OperationResult = {
  operation: 1 | 2 | 3 | 19;
  type: 0xAA | 0x55;
  error: ErrorType;
}
*/

const res = new OperationResult();
res.error = ErrorType.Success;
```
### Variable length structures
```ts
const Package = new Struct('Package')
  .UInt16LE('length')
  // If you do not specify the length of the buffer,
  // it will take all the remaining space.
  // There can only be one such field, and it must be the last.
  // You can specify a negative buffer length (-N),
  // then the buffer will take up all space except for the last N bytes
  // Since the size of the buffer is unknown, `baseSize` ignores its length.
  .Buffer('data')
  .compile();
expect(Package.baseSize).toBe(2);

function createPackage(data: Buffer): Package {
  const pkg = new Package(Package.baseSize + data.length);
  data.copy(pkg.data);
  pkg.length = data.length;
  return pkg;
}

// Often a checksum is used to verify data,
// which is stored in the last bytes of the buffer.
const Exact = new Struct('Exact')
  .UInt16LE('length')
  .Buffer('data')
  // Only the checksum can go after the tail buffer
  .CRC16LE('crc')
  .compile();
expect(Exact.baseSize).toBe(4);

function createExact(data: Buffer): Exact {
  const item = new Exact(Exact.baseSize + data.length);
  data.copy(item.data);
  item.length = data.length;
  const raw = Exact.raw(item);
  item.crc = crc16(raw.slice(0, raw.length - 2));
  return item;
}
```
### Bit fields
```ts
// |------> bit order from the most significant bits to the least significant
// 01234567 offset
// 00011110 mask
//    \  /
//     \/
// bit field with an offset of 3 bits and a length of 4 bits
const Foo = new Struct('Foo')
  .Bits8({
    // for each property, specify the offset and length
    high: [0, 4],
    low: [4, 4],
    // properties may overlap
    value: [0, 8]
  })
  .compile();
expect(Foo.baseSize).toBe(1);
const foo = new Foo();
foo.value = 0x36;
expect(foo.high).toBe(3);
expect(foo.low).toBe(6);
```

###  Reserved fields
```ts
const Bar = new Struct('Bar')
  .Int16LE('baz')
  // Skip two bytes.
  // You can use negative values for unions.
  // Zero moves the current pointer to the end.
  .seek(2)
  .compile();

expect(Bar.baseSize).toBe(4);  
```

### A typical example of working with binary data via a serial port

Package.ts

```ts
import Struct, { typed, ExtractType } from 'typed-struct';

export enum Command {
  Read,
  Write,
  Reset,
  Halt,
}

export const PREAMBLE = 0x1234;

/**
 * Variable length structure 
 * Package.baseSize = 9 - minimal structure size
 */
export const Package = new Struct('Package')
  .UInt16BE('header', PREAMBLE)
  .UInt8('source')
  .UInt8('destination')
  .UInt8('command', typed<Command>())
  .UInt16LE('length')
  .Buffer('data')
  .CRC16LE('crc')
  .compile();

// it's not obligatory
export type Package = ExtractType<typeof Package>;

/*
type Package = {
  header: 0x1234;
  source: number;
  destination: number;
  command: Command;
  length: number;
  data: Buffer;
  crc: number;
}
 */
```

Decoder.ts

```ts
import {
  Transform,
  TransformOptions,
  TransformCallback
} from 'stream';

import { crc16 } from 'crc';

import { Package, PREAMBLE } from './Package';

const preambleBuf = Buffer.alloc(2);
preambleBuf.writeInt16BE(PREAMBLE);

const empty = Buffer.alloc(0);

const lengthOffset = Package.getOffsetOf('length');

export default class Decoder extends Transform {
  private buf = empty;

  constructor(options?: TransformOptions) {
    super({
      ...options,
      readableObjectMode: true,
    });
  }

  _transform(chunk: unknown, encoding: BufferEncoding, callback: TransformCallback) {
    if (Buffer.isBuffer(chunk)) {
      const data = Buffer.concat([this.buf, chunk]);
      if (data.length > 0) {
        this.buf = this.recognize(data);
      }
    }
    callback();
  }
  
  _flush(callback: TransformCallback) {
    this.buf = empty;
    callback();
  }

  private recognize(data: Buffer): Buffer {
    const start = data.indexOf(preambleBuf);
    if (start === -1) return empty;
    const frame = data.slice(start);
    if (frame.length < lengthOffset + 2) return frame;
    const length = frame.readUInt16LE(lengthOffset);
    
    // calculate the total size of structure
    const total = length + Package.baseSize;
    if (frame.length < total) return frame;
    
    // deserialize Package from the buffer
    const pkg = new Package(frame.slice(0, total));
    
    // getting a raw buffer for crc computation
    if (crc16(Package.raw(pkg).slice(0, total - 2)) === pkg.crc) {
      
      // push decoded package
      this.push(pkg);
    }
    return frame.slice(total);
  }
}
```
Encoder.ts
```ts
import { Transform, TransformCallback, TransformOptions } from 'stream';
import { crc16 } from 'crc';

import { Package } from './Package';

export default class Encoder extends Transform {
  constructor(options?: TransformOptions) {
    super({
      ...options,
      writableObjectMode: true,
    });
  }

  public _transform(chunk: unknown, encoding: BufferEncoding, callback: TransformCallback): void {
    const chunks = Array.isArray(chunk) ? chunk : [chunk];
    chunks.forEach(pkg => {
      
      // instance type check
      if (pkg instanceof Package) {
        
        // getting a raw buffer
        const raw = Package.raw(pkg);

        // update length
        pkg.length = pkg.data.length;

        // update crc
        pkg.crc = crc16(raw.slice(0, raw.length - 2));
        
        // serialize
        this.push(raw);
      }
    });
    callback();
  }
}
```

serial.ts
```ts
import pump from 'pump';
import SerialPort from 'serialport';
import Decoder from './Decoder';
import Encoder from './Encoder';
import { Package, Command } from './Package';

// ...

const decoder = new Decoder();
const encoder = new Encoder();
let connected = false;

const serial = new SerialPort(path, { baudRate: 115200 }, err => {
  if (err) {
    console.error(`error while open ${path}`)
  } else {
    // create a pipeline
    pump(encoder, serial, decoder, err => {
      connected = false;
      console.log('pipe finished', err);
    });
    connected = true;
  }
});

decoder.on('data', (res: Package) => {
  // Processing the package
});

// Example function for sending data
async function send(data: Buffer, src: number, dest: number): Promise<void> {
  if (!connected) throw new Error('Connection closed');
  
  // Create a packet with the specified buffer size
  const pkg = new Package(data.length + Package.baseSize);
  
  // Package initialization
  data.copy(pkg.data);
  pkg.source = src;
  pkg.destination = dest;
  pkg.command = Command.Write;
  
  // Sending a package
  if (!encoder.write(pkg)) {
    await new Promise(resolve => encoder.once('drain', resolve));
  }
}

const release = () => {
  serial.isOpen && serial.close();
}
process.on('SIGINT', release);
process.on('SIGTERM', release);
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
