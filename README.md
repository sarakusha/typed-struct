# typed-struct

A JavaScript utility library (written in TypeScript) for creating objects and classes that store
their properties in a buffer for serialization/deserialization
similar to structures in C.

[![NPM version](https://img.shields.io/npm/v/typed-struct.svg)](https://www.npmjs.com/package/typed-struct)
[![NPM version](https://img.shields.io/npm/dm/typed-struct.svg)](https://www.npmjs.com/package/typed-struct)
[![codecov](https://codecov.io/gh/sarakusha/typed-struct/branch/main/graph/badge.svg?token=6F26I7FO73)](https://codecov.io/gh/sarakusha/typed-struct)
[![CircleCI](https://circleci.com/gh/sarakusha/typed-struct.svg?style=shield)](https://circleci.com/gh/sarakusha/typed-struct)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/sarakusha/typed-struct.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/sarakusha/typed-struct/context:javascript)
[![NPM](https://nodei.co/npm/typed-struct.png?downloads=true)](https://nodei.co/npm/typed-struct/)

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

- Integer (1, 2, 4, 8 bytes)
- Boolean (1, 2, 4 bytes)
- Float (4 bytes)
- Double (8 bytes)
- Bit fields (1, 2, 4 bytes)
- Binary-decoded decimal (1 byte)
- Buffer
- String (with [iconv-lite](https://github.com/ashtuchkin/iconv-lite) encodings)  
- Custom type (requires custom getter/setter)

Fixed values, endianness, nested types and arrays are also supported.

The generated structures will be strongly typed,
which will provide better documentation and allow TypeScript
to validate that your code is working correctly.

## [API](https://sarakusha.github.io/typed-struct/)

## Examples

### Create a data structure by chaining the appropriate method calls

```ts
const Struct = require('typed-struct').default;
// or
import Struct from 'typed-struct';

const MyStructure = new Struct('MyStructure') // give a name to the constructor
  .Int8('foo')        // signed 8-bit integer field `foo`
  .UInt16LE('bar')    // unsigned, little-endian 16-bit integer field `bar`
  .compile();         // create a constructor for the structure, called last

// You can use the compiled constructor as if you had made a class.
// If you are using a typescript, you will also get
// the exact type of the generated structure
const item1 = new MyStructure();      // creates an instance
expect(item1.constructor.name).toBe('MyStructure');

// This class has useful static properties and methods.
const raw = MyStructure.raw(item1);   // get the underlying buffer
expect(MyStructure.baseSize).toBe(3); // the minimum base size of the structure
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
Foo.swap(foo, 'items');

// ...

// change back
Foo.swap(foo, 'items');
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
// but
expect(() => {
  baz.struct[3] = new MyStructure();
}).toThrow(new TypeError('Cannot assign to read only property "3"'))

expect(() => {
  baz.structs.push(new MyStructure());
}).toThrow(new TypedError('Cannot add property 10, object is not extensible'));

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

### Unions

```ts
const Word = new Struct('Word')
  .UInt16LE('value')
  // We take a step back or two bytes back, which the previous field takes up
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
    (type, buf) => new Date(buf.readDoubleLE() * 1000),
    // setter, must return `false` for unknown type or `true` if everything is ok
    (type, buf, value) => buf.writeDoubleLE(value.getTime() / 1000) > 0
  )
  .compile();
expect(BirthCertificate.baseSize).toBe(8);

const cert = new BirthCertificate();
cert.birthday = new Date(1973, 6, 15);
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

### Enumerated fields (Typescript)

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
```
### CRC

The checksum is often used to verify data integrity,
it is usually stored in the last bytes of the buffer.

```ts
const Exact = new Struct('Exact')
  .UInt16LE('length')
  .Buffer('data')
  // Only the checksum can go after the tail buffer
  .CRC16LE('crc')
  .compile();
expect(Exact.baseSize).toBe(4);
```

If you pass the checksum function as parameters, then your structure will have the static `crc` method that you can use to calculate and update this field.

Let's slightly modify the previous example:

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
  // New static method `Exact.crc`
  item.crc = Exact.crc(item);
  // or the same thing - calculate and update the field
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

You can specify the encoding, the default is UTF8.
You can use the encodings supported by [`Buffer`](https://nodejs.org/dist/latest-v16.x/docs/api/buffer.html#buffer_buffers_and_character_encodings)
or install [iconv-lite](https://github.com/ashtuchkin/iconv-lite) package
to add support for all encodings defined in this package.

```ts
const Foo = new Struct('Foo')
  // Specify the desired encoding and size in bytes like this
  .String('bar', 'win1251', 10)
  // or so
  .String('baz', 10, 'ucs2')
  // or even so
  .String('quux', { length: 10, encoding: 'koi8-r', literal: 'Андрей' })
  .compile();
```

If you do not specify the length, then the `string field` will take up all the remaining space.

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

```
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

### JSON
e.g.
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
output: (`$raw` is a hidden property and is shown for clarity)
```
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
If you only need a parser, you can avoid overheads like getters and setters
and hidden buffers by using the method `toJSON`. The result contains only data,
as opposed to methods or internal state. Its `prototype` is `Object.prototype` 
and all numeric iterable types (buffer, typed arrays) are replaced with `number[]`,
all custom types other than `number`, `boolean`, `string`, `string[]` and numeric
iterables are replaced with the result of executing `toJSON` or `toString` methods.

```ts
console.log(model.toJSON());
```
output:
```
{
  foo: 16,
  bars: [ 1, 2, 3, 4 ],
  nested: { value: 32, items: [ 5, 6, 7, 8 ] }
}
```
<br/>

##### Note:
>Starting from version 2.3.0 in the environment of node.js, the expression
>``console.log(model)`` behaves the same as ``console.log(model.toJSON())``.
> This is done to make debugging easier.

### toString()
For ease of debugging, the generated structures have an overridden ``toString`` method
that outputs a string of hexadecimal bytes separated by an equals sign at field boundaries.
If there is a [debug](https://www.npmjs.com/package/debug) package in the dependencies, then these fields will be colored
depending on the field name.


>console.log(\`${model}\`);
> 
><span style="color:lightblue">01</span>=<span style="color: lightgreen">ce-ca-23-00-00-00-00-00</span>=<span style="color: orange">ff-ff-ff-ff-ff-ff</span>




### A typical example of working with binary data via a serial port

Package.ts

```ts
import Struct, { typed, ExtractType } from 'typed-struct';
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
