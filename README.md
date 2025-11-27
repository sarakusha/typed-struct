# typed-struct

A JavaScript/TypeScript utility library for creating objects and classes whose properties are stored in a binary buffer for efficient serialization and deserialization—similar to C-style structs.

[![NPM version](https://img.shields.io/npm/v/typed-struct.svg)](https://www.npmjs.com/package/typed-struct)
[![NPM version](https://img.shields.io/npm/dm/typed-struct.svg)](https://www.npmjs.com/package/typed-struct)
[![codecov](https://codecov.io/gh/sarakusha/typed-struct/branch/main/graph/badge.svg?token=6F26I7FO73)](https://codecov.io/gh/sarakusha/typed-struct)
[![CircleCI](https://circleci.com/gh/sarakusha/typed-struct.svg?style=shield)](https://circleci.com/gh/sarakusha/typed-struct)

## Getting started

Install via npm or yarn:

```bash
npm install typed-struct
# or
yarn add typed-struct
```

If you use this module in a browser environment, you also need to install the [buffer](https://github.com/feross/buffer) package to provide Node.js Buffer API:

```bash
npm install buffer
```

## Features

 Supported types include:

- Integer (1, 2, 4, 8 bytes)
- Boolean (1, 2, 4 bytes)
- Float (4 bytes)
- Double (8 bytes)
- Bit fields (1, 2, 4 bytes)
- Binary-coded decimal (1 byte)
- Buffer
- String (supports [iconv-lite](https://github.com/ashtuchkin/iconv-lite) encodings)
- Custom types (with custom getter/setter)
- Compatible with Node.js and browsers (requires [buffer](https://github.com/feross/buffer) for browsers)

Additional features:

- Supports fixed values, endianness, nested types, and arrays.

- Generated structures are strongly typed, providing better documentation and allowing TypeScript to validate your code.


## [API](https://sarakusha.github.io/typed-struct/)

## Examples

### Create a data structure by chaining the appropriate method calls

```ts
const { Struct } = require('typed-struct');
// or
import { Struct } from 'typed-struct';

const MyStructure = new Struct('MyStructure') // specify a name for the structure
  .Int8('foo')        // 8-bit signed integer field 'foo'
  .UInt16LE('bar')    // 16-bit unsigned little-endian integer field 'bar'
  .compile();         // compile the structure

// Create an instance
const item1 = new MyStructure();
expect(item1.constructor.name).toBe('MyStructure');

// Access static properties and methods
const raw = MyStructure.raw(item1);   // underlying buffer
expect(MyStructure.baseSize).toBe(3); // minimum structure size
expect(raw.length).toBe(MyStructure.baseSize);

// Changing structure properties updates the buffer
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
import { Struct } from 'typed-struct';

const Foo = new Struct('Foo')
  .UInt16Array('items', 10)
  .compile();

const foo = new Foo();
expect(foo.items).toHaveLength(10);           // array length is 10
expect(foo.items).toBeInstanceOf(Uint16Array); // items is a Uint16Array
expect(Foo.raw(foo)).toHaveLength(20);        // buffer size is 20 bytes

// If the byte order in your data differs from the system, use swap
Foo.swap(foo, 'items');

// ...

// Swap back
Foo.swap(foo, 'items');
```

### Array of structures

Using the `MyStructure` from the previous example:

```ts
const Baz = new Struct('Baz')
  .StructArray('structs', MyStructure, 10)
  .compile();

const baz = new Baz();
expect(baz.structs).toHaveLength(10);      // array of 10 structures
baz.structs[3].foo = 123;                  // access nested structure property

// Direct assignment is not allowed
expect(() => {
  baz.structs[3] = new MyStructure();
}).toThrow(new TypeError('Cannot assign to read only property "3"'));

// Array length is fixed
expect(() => {
  baz.structs.push(new MyStructure());
}).toThrow(new TypeError('Cannot add property 10, object is not extensible'));
```

### Nested types

Using the `MyStructure` from the previous example:

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

// Direct assignment to a nested structure is not allowed
expect(() => {
  xyz.bat = bat;
}).toThrow(new TypeError('Cannot assign to read only property bat'));
```

### Unions

```ts
const Word = new Struct('Word')
  .UInt16LE('value')
  // Move back two bytes (size of previous field)
  // You can also use .seek(-2)
  .back()
  .UInt8('low')
  .UInt8('high')
  .compile();

const word = new Word();
word.value = 0x1234;
expect(word.low).toBe(0x34);   // lower byte
expect(word.high).toBe(0x12);  // higher byte
expect(Word.baseSize).toBe(2);
```

### Custom types

```ts
const BirthCertificate = new Struct('BirthCertificate')
  .Custom(
    'birthday',
    8, // field size in bytes
    // getter: returns property value or undefined for unknown type
    (type, buf) => new Date(buf.readDoubleLE() * 1000),
    // setter: returns true if successful, false for unknown type
    (type, buf, value) => buf.writeDoubleLE(value.getTime() / 1000) > 0
  )
  .compile();
expect(BirthCertificate.baseSize).toBe(8);

const cert = new BirthCertificate();
cert.birthday = new Date(1973, 6, 15);
```

### Aliases

Using the `BirthCertificate` structure from the previous example:

```ts
const Twins = new Struct('Twins')
  // 'John' and 'Jimmy' refer to the same property
  .Struct(['John', 'Jimmy'], BirthCertificate)
  .compile();

expect(Twins.baseSize).toBe(8);

const twins = new Twins();
twins.John.birthday = new Date(1973, 6, 15);
expect(twins.Jimmy.birthday).toBe(twins.John.birthday);
```

### Fixed values

```ts
const Request = new Struct('Request')
  .UInt32BE('header', 0xDEADBEEF)
  .Buffer('data', 16)
  .compile();

const req = new Request();

// 'header' is initialized with the fixed value
expect(req.header).toBe(0xDEADBEEF);

// Assigning a different value is not allowed
expect(() => {
  // eslint or IDE will also highlight this
  req.header = 0xDEADC0DE;
}).toThrow(new TypeError('Invalid value, expected 0xDEADBEEF'));

// ... but assigning the fixed value is allowed
req.header = 0xDEADBEEF;
```

### Enumerated fields (Typescript)

```ts
import { Struct, typed } from 'typed-struct';

enum ErrorType {
  Success,
  Timeout,
  InvalidCommand,
  ServerError,
}

const REQUEST = 0xAA;
const RESPONSE = 0x55;

// Refine numeric types with TypeScript
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
res.error = ErrorType.Success; // enum value
```

### Variable length structures

```ts
const Package = new Struct('Package')
  .UInt16LE('length')
  // If you don't specify the buffer length,
  // it will use all remaining space. Only one such field is allowed, and it must be last.
  // You can specify a negative length (-N) to leave N bytes at the end unused.
  // Since the buffer size is dynamic, `baseSize` ignores its length.
  .Buffer('data')
  .compile();
expect(Package.baseSize).toBe(2);

function createPackage(data: Buffer): Package {
  const pkg = new Package(Package.baseSize + data.length);
  data.copy(pkg.data);
  pkg.length = data.length;
  return pkg;
}
```

### CRC

Checksums are often used to verify data integrity and are usually stored in the last bytes of the buffer.

```ts
const Exact = new Struct('Exact')
  .UInt16LE('length')
  .Buffer('data')
  // Only the checksum can follow a dynamic buffer
  .CRC16LE('crc')
  .compile();
expect(Exact.baseSize).toBe(4);
```

If you provide a checksum function, your structure will have a static `crc` method to calculate and update this field.

Here's a modified example:

```ts
import { crc16 } from 'crc';

const Exact = new Struct('Exact')
  .UInt16LE('length')
  .Buffer('data')
  // checksum function and initial value
  .CRC16LE('crc', crc16, 0xffff)
  .compile();

function createExact(data: Buffer): Exact {
  const item = new Exact(Exact.baseSize + data.length);
  data.copy(item.data);
  item.length = data.length;
  // Calculate and update CRC
  item.crc = Exact.crc(item);
  // or update the field directly
  Exact.crc(item, true);
  return item;
}
```

### Strings

```ts
const Person = new Struct('Person')
  .String('name', 30)
  .String('surname', 40)
  .compile();

expect(Person.baseSize).toBe(70);

const walterGreen = new Person();
walterGreen.name = 'Walter';
walterGreen.surname = 'Green';
```

You can specify the encoding for string fields; the default is UTF-8. Supported encodings are those provided by [`Buffer`](https://nodejs.org/dist/latest-v16.x/docs/api/buffer.html#buffer_buffers_and_character_encodings). For additional encodings, install [iconv-lite](https://github.com/ashtuchkin/iconv-lite).

Examples:

```ts
const Foo = new Struct('Foo')
  // Specify encoding and length in bytes
  .String('bar', 'win1251', 10)
  // or
  .String('baz', 10, 'ucs2')
  // or with options object
  .String('quux', { length: 10, encoding: 'koi8-r', literal: 'Андрей' })
  .compile();
```

If you do not specify the length, the string field will use all remaining space in the buffer.

### String Arrays

```ts
const Page = new Struct('Page')
  .StringArray('body', {
    length: 80,        // string length in bytes (required)
    lines: 25,         // number of lines (required)
    encoding: 'ascii'
  })
  .compile();

const page = new Page();
expect(Page.baseSize).toBe(80 * 25);
expect(Array.isArray(page.body)).toBe(true);
const body = page.body;
body[0] = 'Lorem ipsum';
expect(page.body[0]).toBe(body[0]);
const raw = Page.raw(page);
raw[Page.getOffsetOf('body')] = 'l'.charCodeAt(0);
expect(body[0]).toBe('lorem ipsum');
console.log(page);
```

output

```ts
Page {
  body: [
    'lorem ipsum', '', '',
    '',            '', '',
    '',            '', '',
    '',            '', '',
    '',            '', '',
    '',            '', '',
    '',            '', '',
    '',            '', '',
    ''
  ]
}
```

### Bit fields

```ts
// Bit order: most significant to least significant
// 01234567 - bit offset
// 00011110 - mask
//   \  /
//    \/
// Example: bit field with offset 3 and length 4
const Foo = new Struct('Foo')
  .Bits8({
    // Specify offset and length for each property
    high: [0, 4],
    low: [4, 4],
    // Properties may overlap
    value: [0, 8]
  })
  .compile();

expect(Foo.baseSize).toBe(1); // structure size is 1 byte
const foo = new Foo();
foo.value = 0x36;
expect(foo.high).toBe(3); // high bits
expect(foo.low).toBe(6);  // low bits
```

### Reserved fields

```ts
const Bar = new Struct('Bar')
  .Int16LE('baz')
  // Skip 2 bytes (reserved space)
  // You can use negative values for unions, or zero to move to the end
  .seek(2)
  .compile();

expect(Bar.baseSize).toBe(4); // total structure size is 4 bytes
```

### JSON

```ts
const Model = new Struct('Model')
  .Int8('foo')
  .UInt8Array('bars', 4)
  .Struct('nested', new Struct('Nested').Int8('value').Buffer('items', 4).compile())
  .compile();

const model = new Model([0x10, 1, 2, 3, 4, 0x20, 5, 6, 7, 8]);
```

Let's see what the `model` is <sup>[[note*]](#note)</sup>

```ts
console.log(model);
```

Output: (`$raw` is a hidden property and is shown for clarity)

```js
Model {
  foo: [Getter/Setter],
  bars: Uint8Array(4) [ 1, 2, 3, 4 ],
  nested: Nested {
    value: [Getter/Setter],
    items: <Buffer 05 06 07 08>
  }
  $raw: <Buffer 10 01 02 03 04 20 05 06 07 08>
}
```

If you only need a parser, you can avoid overheads like getters/setters and hidden buffers by using the `toJSON` method. The result contains only data, without methods or internal state. All buffers are replaced with `number[]`, and custom types are replaced with their `toJSON` or `toString` result.

```ts
console.log(model.toJSON());
```

Output:

```js
{
  foo: 16,
  bars: [ 1, 2, 3, 4 ],
  nested: { value: 32, items: [ 5, 6, 7, 8 ] }
}
```

#### Note

Since version 2.3.0 (Node.js only), `console.log(model)` automatically outputs the same result as `console.log(model.toJSON())` for easier debugging.

### Initialization and Assignment

If you need to initialize an object or update some of its properties, especially when it contains nested fields or arrays, direct assignment will fail due to readonly properties. For these cases, use the static method `safeAssign`.

This method takes an instance and a partial object of your type. All provided properties will be updated, while others remain unchanged. You can also use sparse arrays for partial updates.

```ts
const Point = new Struct('Point').Int16LE('x').Int16LE('y').compile();
const Line = new Struct('Line').Struct('start', Point).Struct('end', Point).compile();
const line = new Line();
// Initialization
Line.safeAssign(line, { start: { x: 10, y: 20 }, end: { x: 30, y: 40 } });
expect(line).toEqual({ start: { x: 10, y: 20 }, end: { x: 30, y: 40 } });
// Partial update
Line.safeAssign(line, { end: { x: 80 } });
expect(line).toEqual({
  start: { x: 10, y: 20 },
  end: { x: 80, y: 40 },
});

// Array initialization
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

// Partial update with sparse array
Polygon.safeAssign(polygon, { vertices: [, { x: 3, y: 4 }, { x: 7, y: 8 }] });
expect(polygon).toEqual({
  vertices: [
    { x: 10, y: 20 },
    { x: 3, y: 4 },
    { x: 7, y: 8 },
  ],
});
```

### toString()

For easier debugging, all generated structs override the `toString()` method. It returns a string of hexadecimal bytes, with field boundaries marked by `=`.

If the [debug](https://www.npmjs.com/package/debug) package is installed, each field is colorized according to its name.

```ts
console.log(`${model}`);
```

Example output:

<span style="color:lightblue">01</span>=<span style="color: lightgreen">ce-ca-23-00-00-00-00-00</span>=<span style="color: orange">ff-ff-ff-ff-ff-ff</span>

### A typical example of working with binary data via a serial port

Package.ts

```ts
import { Struct, typed, type ExtractType } from 'typed-struct';
import { crc16 } from 'crc';

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
  .CRC16LE('crc', crc16)
  .compile();


// If you need a "plain" type without helpers:
export type PackageType = ExtractType<typeof Package>;
/*
type PackageType = {
  header: 0x1234;
  source: number;
  destination: number;
  command: Command;
  length: number;
  data: Buffer;
  crc: number;
}
*/

// If you need a type with type guard and helper methods:
export type Package = ExtractType<typeof Package, false>;
/*
type Package = {
  __struct: 'Package';
  header: 0x1234;
  source: number;
  destination: number;
  command: Command;
  length: number;
  data: Buffer;
  crc: number;
  toJSON: () => POJO<PackageType>;
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

import { Package, PREAMBLE } from './Package';

const preamble = Buffer.alloc(2);
preamble.writeInt16BE(PREAMBLE);

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
    for (let offset = 0;;) {
      const rest = data.length - offset;
      if (rest <= 0) return empty;
      const start = data.indexOf(rest < preamble.length ? preamble.slice(0, rest) : preamble, offset);
      if (start === -1) return empty;
      const frame = data.slice(start);
      if (frame.length < Package.baseSize) return frame;
      const length = frame.readUInt16LE(lengthOffset);
      if (length <= MAX_LENGTH) {

        // calculate the total size of structure
        const total = length + Package.baseSize;
        if (frame.length < total) return frame;

        // deserialize Package from the buffer
        const pkg = new Package(frame.slice(0, total));

        // crc check
        if (Package.crc(pkg) === pkg.crc) {

          // push decoded package
          this.push(pkg);
          offset = start + total;
        }
      }
      
      if (offset <= start) {
        offset = start + 1;
      }
    }
  }
}
```

Encoder.ts

```ts
import { Transform, TransformCallback, TransformOptions } from 'stream';

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
        Package.crc(pkg, true);
        
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
