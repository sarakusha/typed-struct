/* eslint-disable @typescript-eslint/no-explicit-any */
import type { decode as Decode, encode as Encode } from 'iconv-lite';

export type ExtractType<C, clear extends boolean = true> = C extends new () => infer T
  ? clear extends true
    ? Omit<T, '__struct' | 'toJSON'>
    : T
  : never;

let iconvDecode: typeof Decode | undefined;
let iconvEncode: typeof Encode | undefined;
let inspect: (((...args: any[]) => string) & { custom: symbol }) | undefined;

if (typeof process !== 'undefined' && typeof process.versions.node !== 'undefined') {
  void import('util').then(util => {
    inspect = util.inspect;
  });
}

import('iconv-lite')
  .then(({ encode, decode }) => {
    iconvEncode = encode;
    iconvDecode = decode;
  })
  .catch(
    /* istanbul ignore next */
    () => {
      iconvEncode = undefined;
      iconvDecode = undefined;
    }
  );

let useColors = false;
let colors: number[] = [0];

import('debug')
  .then(debug => {
    colors = debug.colors.map(color =>
      typeof color === 'string' ? parseInt(color.slice(1), 16) : color
    );
    useColors = debug.useColors() && colors && colors.length > 1;
  })
  .catch(
    /* istanbul ignore next */
    () => {
      useColors = false;
      colors.length = 1;
    }
  );

type FilterFlags<Base, Condition> = {
  [Key in keyof Base]: Base[Key] extends Condition ? Key : never;
};

type FilterNames<Base, Condition> = FilterFlags<Base, Condition>[keyof Base];

type OmitType<Base, Condition> = Omit<Base, FilterNames<Base, Condition>>;

type ConditionalExtend<Base, Extender, Condition extends boolean> = Condition extends true
  ? Base & Extender
  : Base;

interface StructGuard<ClassName extends string> {
  /**
   * fake field `__struct` is only used as a type guard and should not be used
   */
  readonly __struct: ClassName;
}

type Constructable = new (...args: any[]) => any;

/** Cosmetic use only, makes the tooltips expand the type, can be removed */
type Id<T> = {} & { [P in keyof T]: T[P] };

type ReplaceDistributive<Base, Condition, Target> = Base extends any
  ? Base extends Condition
    ? Target
    : Base extends Record<PropertyKey, unknown>
      ? Id<ReplaceRecursively<Base, Condition, Target>>
      : Base extends string
        ? string
        : Base extends Iterable<unknown>
          ? Id<ReplaceDistributive<IteratorType<Base>, Condition, Target>>[]
          : Base
  : never;

type ReplaceDistributiveNot<Base, Condition, Target> = Base extends any
  ? Base extends Condition
    ? Base
    : Base extends Record<PropertyKey, unknown>
      ? Id<ReplaceRecursivelyNot<Base, Condition, Target>>
      : Base extends string
        ? string
        : Base extends Iterable<unknown>
          ? Id<ReplaceDistributiveNot<IteratorType<Base>, Condition, Target>>[]
          : Target
  : never;

type IteratorType<T> = T extends Iterable<infer E> ? E : never;

type ReplaceRecursively<Base, Condition, Target> = {
  [P in keyof Base]: ReplaceDistributive<Base[P], Condition, Target>;
};

type ReplaceRecursivelyNot<Base, Condition, Target> = {
  [P in keyof Base]: ReplaceDistributiveNot<Base[P], Condition, Target>;
};

type OmitTypeDistributive<Base, Condition> = Base extends any
  ? Base extends Record<PropertyKey, unknown>
    ? Id<OmitTypeRecursively<Base, Condition>>
    : Base
  : never;

type OmitTypeRecursively<Base, Condition> = OmitType<
  {
    [P in keyof Base]: OmitTypeDistributive<Base[P], Condition>;
  },
  Condition
>;

type Item<A> = A extends any ? (A extends readonly (infer T)[] ? T : A) : never;

type DeepWriteable<T> = {
  -readonly [P in keyof T]: T[P] extends Record<PropertyKey, unknown>
    ? Id<DeepWriteable<T[P]>>
    : T[P];
};

type POJO<T> = Id<
  DeepWriteable<
    ReplaceRecursivelyNot<
      ReplaceRecursively<
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        OmitTypeRecursively<T, Function | undefined>,
        Date | bigint,
        string
      >,
      string | number | boolean | null,
      unknown
    >
  >
>;

/**
 * Predefined property types
 */
export enum PropType {
  /** An unsigned 8-bit integer */
  UInt8,
  /** A signed 8-bit integer */
  Int8,
  /** An unsigned 16-bit integer */
  UInt16,
  /** A signed 16-bit integer */
  Int16,
  /** An unsigned 32-bit integer */
  UInt32,
  /** A signed 32-bit integer */
  Int32,
  /** A 32-bit float */
  Float32,
  /** A 64-bit double */
  Float64,
  /** An 8-bit boolean */
  Boolean8,
  /** A 16-bit boolean */
  Boolean16,
  /** A 32-bit boolean */
  Boolean32,
  /** A binary-coded decimal */
  BCD,
  /** Nested type */
  Struct,
  /** Buffer type */
  Buffer,
  String,
  StringArray,
  BigInt64,
  BigUInt64,
}

/**
 * Continuous bit mask.<br/>
 * * **offset**: offset of the first bit in the mask, starting with the most significant bit
 * * **length**: bit-length of fields
 *
 * <pre>
 * // |------> bit order
 * // 012<u>3</u>4567 offset
 * // 000<u>1111</u>0 mask
 * </pre>
 * ```typescript
 * const mask: BitMask = [3, 4]
 * ```
 */
export type BitMask = readonly [offset: number, length: number];

export type BitMaskN<M extends number> = readonly [offset: BitOffset<M>, length: BitLength<M>];

type SignedIntegerTypes = PropType.Int8 | PropType.Int16 | PropType.Int32 | PropType.BigInt64;

type UnsignedIntegerTypes = PropType.UInt8 | PropType.UInt16 | PropType.UInt32 | PropType.BigUInt64;

type IntegerTypes = SignedIntegerTypes | UnsignedIntegerTypes;

type BigIntTypes = PropType.BigInt64 | PropType.BigUInt64;

type NumericTypes = IntegerTypes | PropType.BCD | PropType.Float32 | PropType.Float64;

type BooleanTypes = PropType.Boolean8 | PropType.Boolean16 | PropType.Boolean32;

type SimpleTypes = NumericTypes | BooleanTypes;

type AssignableTypes = number | boolean | string | Date | bigint;

type NativeType<T extends PropType | string> = T extends BigIntTypes
  ? bigint
  : T extends NumericTypes
    ? number
    : T extends BooleanTypes
      ? boolean
      : T extends PropType.String
        ? string
        : T extends PropType.Buffer
          ? Buffer
          : any;

/**
 * Getter for custom types. Should return the property value, or `undefined` if the type is
 * unknown.
 */
export type Getter<R> = (type: string, buffer: Buffer) => R | undefined;

/**
 * Setter for custom types. Should return `false` if the type is unknown.
 */
export type Setter<R> = (type: string, buffer: Buffer, value: R) => boolean;

const isSimpleType = (desc: PropDesc): desc is PropDesc<SimpleTypes, number | boolean | bigint> =>
  desc.struct === undefined &&
  typeof desc.type !== 'string' &&
  desc.type !== PropType.Buffer &&
  desc.type !== PropType.String &&
  desc.type !== PropType.StringArray;

/**
 * Property description type
 */
interface PropDesc<T extends PropType | string = PropType | string, R = NativeType<T>> {
  /** predefined property type or custom type */
  type: T;
  /** offset in bytes from the beginning of the buffer */
  offset: number;
  /** array, buffer or string length */
  len?: number;
  /** start bit and bit field length */
  mask?: BitMask;
  /** Big-Endian, default Little-Endian */
  be?: boolean;
  /** nested struct */
  struct?: StructConstructor<Item<R>, any>;
  /** make a buffer from the remaining bytes */
  tail?: boolean;
  /** The fixed value */
  literal?: R;
  /** custom getter */
  getter?: Getter<R>;
  /** custom setter */
  setter?: Setter<R>;
  /** iconv-lite encoding if installed or BufferEncoding */
  encoding?: string;
  /** Length of a string in an array of strings */
  size?: number;
  /** Checksum function */
  calc?: CRCCalc;
  /** Initial value. Default 0 */
  initial?: number;
  /** Zero-based index at which to start calculation. Default 0 */
  start?: number;
}

type PropertyMap<T> = Map<keyof Required<T>, PropDesc>;

type BitMaskSize = 8 | 16 | 32;

const getShift = (start: number, length: number, size: BitMaskSize): number =>
  size - start - length;

/**
 * Create continuous bit mask.
 * @param offset - offset of the first bit in the mask, starting with the most significant bit
 * @param length - bit-length of fields
 * @param size - 8 | 16 | 32
 */
export const getMask = (offset: number, length: number, size: BitMaskSize): number => {
  if (offset < 0 || length <= 0 || offset + length > size) throw new TypeError('Invalid params');
  return length === 32 ? 0xffffffff : ((1 << length) - 1) << getShift(offset, length, size);
};

const getBits = (src: number, [start, length]: BitMask, size: BitMaskSize): number =>
  (src & getMask(start, length, size)) >>> getShift(start, length, size);

const setBits = (
  dest: number,
  [start, length]: BitMask,
  value: number,
  size: BitMaskSize
): number => {
  if (length === 32) return value >>> 0;
  const mask = getMask(start, length, size);
  const save = dest & ~mask;
  return (save | ((value << getShift(start, length, size)) & mask)) >>> 0;
};

const getUnsigned = (value: number, size: number): number =>
  (size < 32 ? value & ((1 << size) - 1) : value) >>> 0;

function getSize(type: SimpleTypes): 1 | 2 | 4 | 8;
function getSize(type: string): undefined;
function getSize(type: PropType | string): 1 | 2 | 4 | 8 | undefined;
function getSize(type: PropType | string): 1 | 2 | 4 | 8 | undefined {
  switch (type) {
    case PropType.Int8:
    case PropType.UInt8:
    case PropType.Boolean8:
    case PropType.BCD:
      return 1;
    case PropType.Int16:
    case PropType.UInt16:
    case PropType.Boolean16:
      return 2;
    case PropType.Int32:
    case PropType.UInt32:
    case PropType.Boolean32:
    case PropType.Float32:
      return 4;
    case PropType.Float64:
    case PropType.BigInt64:
    case PropType.BigUInt64:
      return 8;
    default:
      return undefined;
  }
}

const decodeMaskedValue = (src: number, size: BitMaskSize, mask?: BitMask): number =>
  mask ? getBits(src, mask, size) : getUnsigned(src, size);

const encodeMaskedValue = (
  dest: number,
  value: number,
  size: BitMaskSize,
  mask?: BitMask
): number => (mask ? setBits(dest, mask, value, size) : getUnsigned(value, size));

const getValue = <T extends SimpleTypes>(
  info: PropDesc<T>,
  data: Buffer
): NativeType<T> | bigint | number | boolean | undefined => {
  // if (!isSimpleType(info)) throw new TypeError('Invalid type');
  const { len, offset, type, mask, be, tail } = info;
  /* istanbul ignore next */
  if ((len && len > 0) || tail) throw new TypeError('Array not allowed');

  switch (type) {
    case PropType.UInt8:
      // offset may be negative
      return decodeMaskedValue(data.subarray(offset).readUInt8(), 8, mask);
    case PropType.Int8:
      /* istanbul ignore next */
      if (mask !== undefined) throw new TypeError('Signed types do not support bit masks');
      return data.readInt8(offset);
    case PropType.UInt16:
      // offset may be negative
      return decodeMaskedValue(
        be ? data.subarray(offset).readUInt16BE() : data.subarray(offset).readUInt16LE(),
        16,
        mask
      );
    case PropType.Int16:
      /* istanbul ignore next */
      if (mask !== undefined) throw new TypeError('Signed types do not support bit masks');
      return be ? data.readInt16BE(offset) : data.readInt16LE(offset);
    case PropType.UInt32:
      // offset may be negative
      return decodeMaskedValue(
        be ? data.subarray(offset).readUInt32BE() : data.subarray(offset).readUInt32LE(),
        32,
        mask
      );
    case PropType.Int32:
      /* istanbul ignore next */
      if (mask !== undefined) throw new TypeError('Signed types do not support bit masks');
      return be ? data.readInt32BE(offset) : data.readInt32LE(offset);
    case PropType.Float32:
      /* istanbul ignore next */
      if (mask !== undefined) throw new TypeError('Float type do not support bit masks');
      return be ? data.readFloatBE(offset) : data.readFloatLE(offset);
    case PropType.Float64:
      /* istanbul ignore next */
      if (mask !== undefined) throw new TypeError('Double type do not support bit masks');
      return be ? data.readDoubleBE(offset) : data.readDoubleLE(offset);
    case PropType.Boolean8:
      return !!decodeMaskedValue(data.readUInt8(offset), 8, mask);
    case PropType.Boolean16:
      return !!decodeMaskedValue(data.readUInt16LE(offset), 16, mask);
    case PropType.Boolean32:
      return !!decodeMaskedValue(data.readUInt32LE(offset), 32, mask);
    case PropType.BCD:
      return Math.floor(data[0] / 16) * 10 + (data[0] % 16);
    case PropType.BigInt64:
      return be ? data.readBigInt64BE(offset) : data.readBigInt64LE(offset);
    case PropType.BigUInt64:
      return be ? data.readBigUInt64BE(offset) : data.readBigUInt64LE(offset);
    /* istanbul ignore next */
    default:
      return undefined;
  }
};

const setValue = <T extends SimpleTypes>(
  info: PropDesc<T>,
  data: Buffer,
  value: NativeType<T>
): boolean => {
  // if (!isSimpleType(info)) throw new TypeError('Invalid type');
  const { mask, ...other } = info;
  const { len, offset, type, be, tail } = other;
  /* istanbul ignore next */
  if ((len && len > 0) || tail) throw new TypeError('Array not allowed');

  const encode = (val: number | boolean | bigint, size: BitMaskSize): number => {
    const numValue = Number(val);
    // if (Number.isNaN(numValue)) throw new TypeError('Numeric value expected');
    return encodeMaskedValue(getValue(other, data) as number, numValue, size, mask);
  };
  switch (type) {
    case PropType.UInt8:
      // offset may be negative
      data.subarray(offset).writeUInt8(encode(value, 8));
      return true;
    case PropType.Int8:
      /* istanbul ignore next */
      if (mask !== undefined) throw new TypeError('Signed types do not support bit masks');
      data.writeInt8(Number(value), offset);
      return true;
    case PropType.UInt16:
      // offset may be negative
      if (be) data.subarray(offset).writeUInt16BE(encode(value, 16));
      else data.subarray(offset).writeUInt16LE(encode(value, 16));
      return true;
    case PropType.Int16:
      /* istanbul ignore next */
      if (mask !== undefined) throw new TypeError('Signed types do not support bit masks');
      if (be) data.writeInt16BE(Number(value), offset);
      else data.writeInt16LE(Number(value), offset);
      return true;
    case PropType.UInt32:
      // offset may be negative
      if (be) data.subarray(offset).writeUInt32BE(encode(value, 32));
      else data.subarray(offset).writeUInt32LE(encode(value, 32));
      return true;
    case PropType.Int32:
      /* istanbul ignore next */
      if (mask !== undefined) throw new TypeError('Signed types do not support bit masks');
      if (be) data.writeInt32BE(Number(value), offset);
      else data.writeInt32LE(Number(value), offset);
      return true;
    case PropType.Float32:
      /* istanbul ignore next */
      if (mask !== undefined) throw new TypeError('Float type do not support bit masks');
      if (be) data.writeFloatBE(Number(value), offset);
      else data.writeFloatLE(Number(value), offset);
      return true;
    case PropType.Float64:
      /* istanbul ignore next */
      if (mask !== undefined) throw new TypeError('Double type do not support bit masks');
      if (be) data.writeDoubleBE(Number(value), offset);
      else data.writeDoubleLE(Number(value), offset);
      return true;
    case PropType.Boolean8:
      data.writeUInt8(encode(value ? 0xff : 0, 8), offset);
      return true;
    case PropType.Boolean16: {
      const val = encode(value ? 0xffff : 0, 16);
      // if (be) data.writeUInt16BE(val, offset);
      data.writeUInt16LE(val, offset);
      return true;
    }
    case PropType.Boolean32: {
      const val = encode(value ? 0xffffffff : 0, 32);
      // if (be) data.writeUInt32BE(val, offset);
      data.writeUInt32LE(val, offset);
      return true;
    }
    case PropType.BCD:
      data.writeUInt8(Math.floor(Number(value) / 10) * 16 + (Number(value) % 10), offset);
      return true;
    case PropType.BigInt64:
      if (be) data.writeBigInt64BE(BigInt(value), offset);
      else data.writeBigInt64LE(BigInt(value), offset);
      return true;
    case PropType.BigUInt64:
      if (be) data.writeBigUInt64BE(BigInt(value), offset);
      else data.writeBigUInt64LE(BigInt(value), offset);
      return true;
    /* istanbul ignore next */
    default:
      return false;
  }
};

/**
 * Defines the properties of an object
 * @param obj - target object
 * @param props - property descriptions
 * @param data - buffer for storing properties, must belong to the object
 * @returns obj
 */
function defineProps<T>(obj: unknown, props: PropertyMap<T>, data: Buffer): T {
  [...props.entries()].forEach(([name, info]) => {
    Object.defineProperty(obj, name, createPropDesc(info, data));
  });
  return obj as T;
}

const throwUnknownType = (type: string) => {
  throw TypeError(`Unknown type "${type}"`);
};

const getTypedArrayConstructor = (
  type: SimpleTypes
):
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor
  | Float64ArrayConstructor
  | BigInt64ArrayConstructor
  | BigUint64ArrayConstructor => {
  switch (type) {
    case PropType.Int8:
      return Int8Array;
    case PropType.UInt8:
    case PropType.Boolean8:
      return Uint8Array;
    case PropType.Int16:
      return Int16Array;
    case PropType.UInt16:
    case PropType.Boolean16:
      return Uint16Array;
    case PropType.Int32:
      return Int32Array;
    case PropType.UInt32:
    case PropType.Boolean32:
      return Uint32Array;
    case PropType.Float32:
      return Float32Array;
    case PropType.Float64:
      return Float64Array;
    case PropType.BigInt64:
      return BigInt64Array;
    case PropType.BigUInt64:
      return BigUint64Array;
    default:
      throw new TypeError('Invalid array type');
  }
};

const getString = (buf: Buffer, encoding: string): string => {
  let end: number | undefined = buf.indexOf(0);
  if (end < 0) end = buf.length;
  return iconvDecode
    ? iconvDecode(buf.subarray(0, end), encoding)
    : buf.toString(encoding as BufferEncoding, 0, end);
};

const setString = (buf: Buffer, encoding: string, value: string): void => {
  const encoded = iconvEncode
    ? iconvEncode(value, encoding)
    : Buffer.from(value, encoding as BufferEncoding);
  if (encoded.length > buf.length) throw new TypeError(`String is too long`);
  encoded.copy(buf);
  buf.fill(0, encoded.length);
};

const createPropDesc = (info: PropDesc, data: Buffer): PropertyDescriptor => {
  const desc: PropertyDescriptor = { enumerable: true };

  if (typeof info.type === 'string') {
    const { len, getter, setter, offset, type, tail } = info;
    const buf = data.subarray(offset, tail ? undefined : offset + (len ?? 0));
    if (getter) {
      desc.get = () => (getter(type, buf) as unknown) ?? throwUnknownType(type);
    }
    if (setter) {
      desc.set = (value: any) => setter(type, buf, value) || throwUnknownType(type);
    }
    if (!getter && !setter) {
      desc.value = buf;
    }
  } else if (info.type === PropType.Buffer) {
    desc.value = data.subarray(
      info.offset,
      info.len && info.len > 0 ? info.offset + info.len : info.len
    );
  } else if (isSimpleType(info)) {
    if (!isCrc(info) && (info.len || info.tail)) {
      const TypedArray = getTypedArrayConstructor(info.type);
      const len = info.len ?? Math.floor((data.length - info.offset) / getSize(info.type));
      desc.value = new TypedArray(data.buffer, data.byteOffset + info.offset, len);
    } else {
      if (info.literal !== undefined) setValue(info, data, info.literal); // initialize
      desc.get = () => getValue(info, data); // ?? throwUnknownType(info.type);
      desc.set = (value: number | bigint | boolean) => {
        if (info.literal !== undefined && value !== info.literal)
          throw new TypeError(`Invalid value, expected ${info.literal}`);
        else setValue(info, data, value); // || throwUnknownType(info.type);
      };
    }
  } else if (info.struct) {
    const S = info.struct;
    let value: unknown;
    const { len, tail, offset } = info;
    if (len || tail) {
      value = [];
      const count = len ?? Math.floor((data.length - offset) / S.baseSize);
      for (let i = 0; i < count; i += 1) {
        const start = offset + S.baseSize * i;
        (value as unknown[]).push(new S(data.subarray(start, start + S.baseSize)));
      }
      Object.freeze(value);
    } else {
      value = new S(data.subarray(offset, offset + S.baseSize));
    }
    desc.value = value;
  } else if (info.type === PropType.String) {
    const { len, offset, encoding = 'utf-8' } = info;
    const buf = data.subarray(offset, len && len > 0 ? offset + len : len);
    if (typeof info.literal === 'string') setString(buf, encoding, info.literal);
    desc.get = () => getString(buf, encoding);
    desc.set = (newValue: string) => {
      if (typeof info.literal === 'string' && newValue !== info.literal)
        throw new TypeError(`Invalid value, expected "${info.literal}"`);
      setString(buf, encoding, newValue);
    };
  } else if (info.type === PropType.StringArray) {
    const { len, offset, encoding = 'utf-8', size } = info;
    /* istanbul ignore next */
    if (!len || !size) throw new TypeError('Invalid descriptor');
    const getBuf = (index: number): Buffer => {
      if (Number.isInteger(index) && index >= 0 && index < len) {
        const start = offset + index * size;
        return data.subarray(start, start + size);
      }
      /* istanbul ignore next */
      throw RangeError(`The argument must be between 0 and ${len - 1}`);
    };
    const getter = (index: number): string => getString(getBuf(index), encoding);
    const setter = (index: number, value: string): void => {
      setString(getBuf(index), encoding, value);
    };
    const target = [...Array<never>(len)];
    Object.defineProperties(target, {
      length: { value: len },
      ...(inspect && {
        [inspect.custom]: {
          value: (...args: unknown[]) =>
            inspect?.(
              target.map((_, index) => getter(index)),
              ...args.slice(1)
            ),
        },
      }),
      [Symbol.iterator]: {
        value: function* iterator() {
          for (let i = 0; i < len; i += 1) {
            yield getter(i);
          }
        },
      },
    });
    [...Array<never>(len)].forEach((_, index) => {
      Object.defineProperty(target, index.toString(), {
        get: () => getter(index),
        set: (value: string) => {
          setter(index, value);
        },
        enumerable: true,
        configurable: false,
      });
    });
    Object.preventExtensions(target);
    desc.value = target;
  }
  return desc;
};

type ExtendStruct<
  T,
  ClassName extends string,
  N extends string,
  R,
  HasCRC extends boolean = false,
  Readonly = R extends AssignableTypes ? false : true,
> = Struct<
  T & (Readonly extends false ? { [P in N]: R } : { readonly [P in N]: R }),
  ClassName,
  HasCRC
>;

type TypedArrayType<T extends NumericTypes> = T extends PropType.Int8
  ? Int8Array
  : T extends PropType.UInt8
    ? Uint8Array
    : T extends PropType.Int16
      ? Int16Array
      : T extends PropType.UInt16
        ? Uint16Array
        : T extends PropType.Int32
          ? Int32Array
          : T extends PropType.UInt32
            ? Uint32Array
            : T extends PropType.Float32
              ? Float32Array
              : T extends PropType.Float64
                ? Float64Array
                : T extends PropType.BigInt64
                  ? BigInt64Array
                  : T extends PropType.BigUInt64
                    ? BigUint64Array
                    : never;

const isCrc = (info: {
  len?: number;
  type?: PropType | string;
}): info is {
  len: number;
  type: UnsignedIntegerTypes;
} =>
  info.len === -1 &&
  typeof info.type !== 'string' &&
  info.type !== PropType.Buffer &&
  info.type !== PropType.String;

type StructInstance<T, ClassName extends string> = T & {
  toJSON(): POJO<T>;
} & StructGuard<ClassName>;

/**
 * Checksum function type
 */
export type CRCCalc = (buf: Buffer, previous?: number) => number;

/**
 * CRC field options
 */
export interface CRCOpts {
  /** Checksum function */
  calc: CRCCalc;
  /** Initial value. Default 0 */
  initial?: number;
  /** Zero-based index at which to start calculation. Default 0 */
  start?: number;
}

export interface CRC<T extends Constructable> {
  /**
   * calculate a checksum and possibly update the corresponding field if any
   */
  crc(instance: InstanceType<T>, needUpdate?: boolean): number;
}

export type WithCRC<T extends Constructable, HasCRC extends boolean> = ConditionalExtend<
  T,
  CRC<T>,
  HasCRC
>;

const selectColor = (name: string): number =>
  colors[
    Math.abs([...name].reduce((hash, ch) => ((hash << 5) - hash + ch.charCodeAt(0)) | 0, 0)) %
      (colors.length || 1)
  ];

/**
 * A ready-made constructor with static methods for a custom structure
 */
export interface StructConstructor<T, ClassName extends string> {
  /** Prototype */
  readonly prototype: T & { toJSON(): POJO<T> };
  /** The minimum base size of the structure. */
  readonly baseSize: number;
  /**
   * Structure constructor.
   * Allocates a new `Buffer` of [[baseSize]] bytes and uses that as the underlying buffer
   * Each instantiated instance has a hidden field `$raw`.
   * Use the static method `YourStructureName.raw(instance)` to access the underlying buffer.
   * @return fake field `__struct` is only used as a type guard and should not be used
   */
  new (): StructInstance<T, ClassName>;
  /**
   * Structure constructor.
   * Allocates a new `Buffer` of `size` bytes and uses that as the underlying buffer
   * @param size - Size must be at least [[baseSize]]
   * @return fake field `__struct` is only used as a type guard and should not be used
   */
  new (size: number): StructInstance<T, ClassName>;
  /**
   * Structure constructor.
   * @param raw - use this buffer as an underlying. Buffer length must be at least [[baseSize]]
   * @param clone - create a copy of `raw` to store changes
   * @return fake field `__struct` is only used as a type guard and should not be used
   */
  new (raw: Buffer, clone?: boolean): StructInstance<T, ClassName>;

  /**
   * Structure constructor.
   * Allocates a new `Buffer` using an `array` of bytes in the range 0 – 255 and uses that as
   * the underlying buffer
   * @param array
   * @return fake field `__struct` is only used as a type guard and should not be used
   */
  new (array: number[]): StructInstance<T, ClassName>;
  /**
   * Returns the offset in bytes from the beginning of the structure of the specified field
   * @param name - The field name
   */
  getOffsetOf(name: keyof T): number;
  /**
   * Returns an object where each property stores its offset
   */
  getOffsets(): Record<keyof T, number>;

  /**
   * swaps the byte order to perform a fast in-place conversion between little-endian and big-endian
   * @param instance - the object
   * @param name - property name
   */
  swap(instance: StructInstance<T, ClassName>, name: keyof T): Buffer;
  /**
   * Returns the underlying buffer if the object is a typed structure
   * @param instance - the object from which to get the underlying buffer
   */
  raw(instance: StructInstance<T, ClassName>): Buffer;
  raw(instance: POJO<T>): Buffer | undefined;
}

const isSimpleOrString = (value: unknown): value is number | boolean | string | null | undefined =>
  value === undefined || value === null || ['number', 'boolean', 'string'].includes(typeof value);

const isIterable = (arr: unknown): arr is Iterable<unknown> => Symbol.iterator in Object(arr);

const isObject = (obj: unknown): obj is Record<PropertyKey, unknown> =>
  obj != null &&
  !Array.isArray(obj) &&
  !Buffer.isBuffer(obj) &&
  typeof obj === 'object' &&
  Object.entries(obj).length > 0;
// Object.prototype.toString.call(obj) === '[object Object]';

const toPOJO = (value: any): any => {
  if (typeof value === 'bigint') return value.toString();
  if (isSimpleOrString(value)) return value;
  if (isIterable(value)) return [...value].map(toPOJO);
  if (isObject(value))
    return Object.entries(value).reduce(
      (acc, [name, val]) => ({
        ...acc,
        [name]: toPOJO(val) as unknown,
      }),
      {}
    );
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return typeof value.toJSON === 'function' ? value.toJSON() : JSON.stringify(value);
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return value.toString();
  }
};

const nameIt = <C extends Constructable>(name: string, superClass: C) =>
  ({
    [name]: class extends superClass {
      // constructor(...args: any[]) {
      //   super(...args);
      // }
    },
  })[name];

const printBuffer = (data: Buffer): string =>
  [...data].map(byte => byte.toString(16).padStart(2, '0')).join('-');

const colorPrint = (c: number, msg: string): string => {
  const colorCode = `\u001B[3${c < 8 ? c : `8;5;${c}`}`;
  return `${colorCode};1m${msg}\u001B[0m`;
};

/**
 * Use this function to specify the type of the numeric field
 * ```
 * enum ErrorType {
 *   Success,
 *   Timeout,
 *   InvalidCommand,
 *   ServerError,
 * }
 * const OperationResult = new Struct().UInt8('error', typed<ErrorType>()).compile();
 * const res = new OperationResult();
 * res.error = ErrorType.Success;
 * ```
 */
export function typed<T extends number | bigint | string>(): T | undefined {
  return undefined;
}

/**
 * String options.
 */
export type StringOpts<R extends string> =
  | {
      /**
       * The encoding of `string`. Default: `utf8`.
       * To use the full set of encodings install
       * [iconv-lite](https://github.com/ashtuchkin/iconv-lite) package
       */
      encoding?: string;
      /** The byte length of a string field */
      length: number;
      literal?: undefined;
    }
  | {
      encoding?: string;
      length?: undefined;
      /** The fixed value */
      literal: R;
    };

/**
 * String array options
 * * **lines** - the number of lines in the string array
 */
export type StringArrayOpts = Id<
  Omit<StringOpts<string>, 'literal' | 'length'> & {
    /** the number of rows in the string array */
    lines: number;
    length: number;
  }
>;

type Prepend<A, Prefix> = A extends unknown[]
  ? ((t: Prefix, ...a: A) => void) extends (..._: infer Result) => void
    ? Result
    : never
  : never;

type PrependNextNum<A extends unknown[]> = A['length'] extends infer T ? Prepend<A, T> : never;

type EnumerateInternal<A extends unknown[], N extends number> = {
  0: A;
  1: EnumerateInternal<PrependNextNum<A>, N>;
}[N extends A['length'] ? 0 : 1];

type ArrayItem<A> = A extends (infer E)[] ? E : never;

export type Enumerate<N extends number> = ArrayItem<EnumerateInternal<[], N>>;

export type Range<FROM extends number, TO extends number> = Exclude<Enumerate<TO>, Enumerate<FROM>>;

// type Reverse<Tuple extends any[], Prefix extends any[] = []> = {
//   0: Prefix;
//   1: ((..._: Tuple) => any) extends (_: infer First, ..._1: infer Next) => any
//     ? Reverse<Next, Prepend<Prefix, First>>
//     : never;
// }[Tuple extends [any, ...any[]] ? 1 : 0];

// type Take<A extends unknown[], N extends number, Prefix extends unknown[] = []> = {
//   0: Prefix;
//   1: ((..._: A) => unknown) extends (_: infer F, ...__: infer Next) => unknown
//     ? Take<Next, N, Prepend<Prefix, F>>
//     : never;
// }[N extends Prefix['length'] ? 0 : 1];

// type Skip<A, N extends number, Prefix extends unknown[] = []> = A extends unknown[]
//   ? {
//       0: A;
//       1: ((..._: A) => unknown) extends (_: infer F, ...__: infer Next) => unknown
//         ? Skip<Next, N, Prepend<Prefix, F>>
//         : never;
//     }[N extends Prefix['length'] ? 0 : 1]
//   : never;

type BitOffset<N extends number> = Enumerate<N>;

type BitLength<N extends number> = Exclude<BitOffset<N>, 0> | N;

// noinspection JSUnusedGlobalSymbols
/**
 * Factory of structures. You can define your data structure by chaining the appropriate method
 * calls.
 * ```
 * export default class Struct
 * ```
 */
export default class Struct<
  T = object,
  ClassName extends string = 'Structure',
  HasCRC extends boolean = false,
> {
  /** @hidden */
  private props = new Map<keyof T, PropDesc>(); // Record<keyof T, PropDesc> = {} as never;

  /** @hidden */
  private size = 0;

  /** @hidden */
  private currentPosition = 0;

  /** @hidden */
  private tailed = false;

  /**
   * Create a factory for the structure with the specified default name if given. This name can be
   * changed when calling the method [[default.compile]]
   * @param defaultClassName
   */

  constructor(private defaultClassName?: ClassName) {}

  /** @hidden */
  private get position(): number {
    return this.currentPosition;
  }

  /** @hidden */
  private set position(value: number) {
    this.currentPosition = Math.max(0, value);
    this.size = Math.max(this.currentPosition, this.size);
  }

  /**
   * Returns the underlying buffer of the structure
   * @param structure
   */
  static raw = (structure: StructGuard<string>): Buffer =>
    (structure as unknown as { $raw: Buffer }).$raw;

  /**
   * The current size of the structure in bytes
   */
  getSize = (): number => this.size;

  /**
   * Returns the offset in bytes from the beginning of the structure of the specified field
   * @param name - The field name or aliases
   */
  getOffsetOf = (name: keyof T): number | undefined => this.props.get(name)?.offset;

  /**
   * Returns an object where each property stores its offset
   */
  getOffsets = (): Record<keyof T, number> =>
    Object.fromEntries(
      [...this.props.entries()].map(([name, { offset }]) => [name, offset])
    ) as Record<keyof T, number>;

  /**
   * defines a signed, 8-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  Int8 = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      literal,
      type: PropType.Int8,
    });

  /**
   * defines an unsigned, 8-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  UInt8 = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.UInt8,
      literal,
    });

  /**
   * defines a signed, little-endian 16-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  Int16LE = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.Int16,
      literal,
    });

  /**
   * defines an unsigned, little-endian 16-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  UInt16LE = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.UInt16,
      literal,
    });

  /**
   * defines a signed, little-endian 32-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  Int32LE = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.Int32,
      literal,
    });

  /**
   * defines an unsigned, little-endian 32-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  UInt32LE = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.UInt32,
      literal,
    });

  /**
   * defines a signed, big-endian 16-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  Int16BE = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.Int16,
      literal,
      be: true,
    });

  /**
   * defines an unsigned, big-endian 16-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  UInt16BE = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.UInt16,
      literal,
      be: true,
    });

  /**
   * defines a signed, big-endian 32-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  Int32BE = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.Int32,
      literal,
      be: true,
    });

  /**
   * defines an unsigned, big-endian 32-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  UInt32BE = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.UInt32,
      literal,
      be: true,
    });

  /**
   * defines a 32-bit, little-endian float field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  Float32LE = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.Float32,
      literal,
    });

  /**
   * defines a 64-bit, little-endian float field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  Float64LE = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.Float64,
      literal,
    });

  /**
   * defines a 32-bit, big-endian float field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  Float32BE = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.Float32,
      literal,
      be: true,
    });

  /**
   * defines a 64-bit, big-endian float field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  Float64BE = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.Float64,
      literal,
      be: true,
    });

  /**
   * defines a signed, little-endian 64-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  BigInt64LE = <N extends string, R extends bigint>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.BigInt64,
      literal,
    });

  /**
   * defines a signed, big-endian 64-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  BigInt64BE = <N extends string, R extends bigint>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.BigInt64,
      literal,
      be: true,
    });

  /**
   * defines an unsigned, little-endian 64-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  BigUInt64LE = <N extends string, R extends bigint>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.BigUInt64,
      literal,
    });

  /**
   * defines an unsigned, big-endian 64-bit integer field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  BigUInt64BE = <N extends string, R extends bigint>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.BigUInt64,
      literal,
      be: true,
    });

  /**
   * defines an 8-bit boolean field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  Boolean8 = <N extends string, R extends boolean>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.Boolean8,
      literal,
    });

  /**
   * defines a 16-bit boolean field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  Boolean16 = <N extends string, R extends boolean>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.Boolean16,
      literal,
    });

  /**
   * defines a 32-bit boolean field
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  Boolean32 = <N extends string, R extends boolean>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.Boolean32,
      literal,
    });

  /**
   * defines a single-byte binary-coded decimal
   * @param name - The field name or aliases
   * @param literal - The fixed value
   */
  BCD = <N extends string, R extends number>(
    name: N | N[],
    literal?: R
  ): ExtendStruct<T, ClassName, N, R> =>
    this.createProp(name, {
      type: PropType.BCD,
      literal,
    });

  /**
   * defines a nested structure
   * @param name - The field name or aliases
   * @param struct - structure factory
   */
  Struct = <N extends string, S, StructClass extends string>(
    name: N | N[],
    struct: StructConstructor<Item<S>, StructClass>
  ): ExtendStruct<T, ClassName, N, S> =>
    this.createProp<N, PropType.Struct, S, ExtendStruct<T, ClassName, N, S>>(name, {
      type: PropType.Struct,
      struct,
    });

  /**
   * defines unsigned bit fields on one byte
   * @param fields - an object with the name of the fields and their [[BitMask]]
   */
  Bits8 = <N extends string>(
    fields: Record<N, BitMaskN<8>>
  ): ExtendStruct<T, ClassName, N, number> => this.createBitFields(PropType.UInt8, fields);

  /**
   * defines unsigned bit fields on two bytes
   * @param fields - an object with the name of the fields and their [[BitMask]]
   */
  Bits16 = <N extends string>(
    fields: Record<N, BitMaskN<16>>
  ): ExtendStruct<T, ClassName, N, number> => this.createBitFields(PropType.UInt16, fields);

  /**
   * defines unsigned bit fields on four bytes
   * @param fields - an object with the name of the fields and their [[BitMask]]
   */
  Bits32 = <N extends string>(
    fields: Record<N, BitMaskN<32>>
  ): ExtendStruct<T, ClassName, N, number> => this.createBitFields(PropType.UInt32, fields);

  /**
   * defines a buffer field of `length` bytes
   * @param name - The field name or aliases
   * @param length - The desired length of the `Buffer`
   */
  Buffer<N extends string>(name: N | N[], length?: number): ExtendStruct<T, ClassName, N, Buffer> {
    return this.createProp(name, {
      type: PropType.Buffer,
      tail: length === undefined || length < 0,
      len: length,
    });
  }

  /**
   * defines a tailed string field
   * @param name - The field name or aliases
   */
  String<N extends string>(name: N | N[]): ExtendStruct<T, ClassName, N, string>;

  /**
   * defines a string field of `length` bytes
   * @param name - The field name or aliases
   * @param length - The byte length of a string
   */
  String<N extends string>(name: N | N[], length: number): ExtendStruct<T, ClassName, N, string>;

  /**
   * defines an encoded string field
   * @param name - The field name or aliases
   * @param encoding - The encoding of string. Default: `utf8`.
   * To use the full set of encodings install
   * [iconv-lite](https://github.com/ashtuchkin/iconv-lite) package
   */
  String<N extends string>(name: N | N[], encoding: string): ExtendStruct<T, ClassName, N, string>;

  /**
   * defines an encoded string field of `length` bytes
   * @param name - The field name or aliases
   * @param length - The byte length of a string
   * @param encoding - The encoding of string. Default: `utf8`.
   * To use the full set of encodings install
   * [iconv-lite](https://github.com/ashtuchkin/iconv-lite) package
   */
  String<N extends string>(
    name: N | N[],
    length: number,
    encoding: string
  ): ExtendStruct<T, ClassName, N, string>;

  /**
   * defines an encoded string field of `length` bytes
   * @param name - The field name or aliases
   * @param encoding - The encoding of string. Default: `utf8`.
   * To use the full set of encodings install
   * [iconv-lite](https://github.com/ashtuchkin/iconv-lite) package
   * @param length - The byte length of a string
   */
  String<N extends string>(
    name: N | N[],
    encoding: string,
    length: number
  ): ExtendStruct<T, ClassName, N, string>;

  /**
   * defines a string field
   * @param name - The field name or aliases
   * @param opts - The string options
   */
  String<N extends string, R extends string>(
    name: N | N[],
    opts: StringOpts<R>
  ): ExtendStruct<T, ClassName, N, R>;

  String<N extends string, R extends string>(
    name: N | N[],
    arg1?: string | number | StringOpts<R>,
    arg2?: string | number
  ): ExtendStruct<T, ClassName, N, R> {
    let length: number | undefined;
    let encoding: string | undefined;
    let literal: R | undefined;
    if (typeof arg1 === 'object') {
      length = arg1.length ?? arg1.literal.length;
      encoding = arg1.encoding;
      literal = arg1.literal;
    } else {
      [arg1, arg2].forEach(arg => {
        if (typeof arg === 'number') length = arg;
        if (typeof arg === 'string') encoding = arg;
      });
    }
    return this.createProp(name, {
      type: PropType.String,
      tail: length === undefined || length < 0,
      len: length,
      encoding,
      literal,
    });
  }

  /**
   * defines a `Int8Array` typed array represents an array of twos-complement 8-bit signed
   * integers.
   * @param name - The field name or aliases
   * @param length - the number of elements
   */
  Int8Array = <N extends string>(
    name: N | N[],
    length?: number
  ): ExtendStruct<T, ClassName, N, Int8Array> => this.createTypedArray(name, PropType.Int8, length);

  /**
   * defines a `Uint8Array` typed array represents an array of 8-bit unsigned integers.
   * @param name - The field name or aliases
   * @param length - the number of elements
   */
  UInt8Array = <N extends string>(
    name: N | N[],
    length?: number
  ): ExtendStruct<T, ClassName, N, Uint8Array> =>
    this.createTypedArray(name, PropType.UInt8, length);

  /**
   * defines a `Int16Array` typed array represents an array of twos-complement 16-bit signed
   * integers.
   * @param name - The field name or aliases
   * @param length - the number of elements
   */
  Int16Array = <N extends string>(
    name: N | N[],
    length?: number
  ): ExtendStruct<T, ClassName, N, Int16Array> =>
    this.createTypedArray(name, PropType.Int16, length);

  /**
   * defines a `Uint16Array` typed array represents an array of 16-bit unsigned integers.
   * @param name - The field name or aliases
   * @param length - the number of elements
   */
  UInt16Array = <N extends string>(
    name: N | N[],
    length?: number
  ): ExtendStruct<T, ClassName, N, Uint16Array> =>
    this.createTypedArray(name, PropType.UInt16, length);

  /**
   * defines a `Int32Array` typed array represents an array of twos-complement 32-bit signed
   * integers.
   * @param name - The field name or aliases
   * @param length - the number of elements
   */
  Int32Array = <N extends string>(
    name: N | N[],
    length?: number
  ): ExtendStruct<T, ClassName, N, Int32Array> =>
    this.createTypedArray(name, PropType.Int32, length);

  /**
   * defines a `Uint32Array` typed array represents an array of 32-bit unsigned integers.
   * @param name - The field name or aliases
   * @param length - the number of elements
   */
  UInt32Array = <N extends string>(
    name: N | N[],
    length?: number
  ): ExtendStruct<T, ClassName, N, Uint32Array> =>
    this.createTypedArray(name, PropType.UInt32, length);

  /**
   * defines a `Float32Array` typed array represents an array of 32-bit floating numbers.
   * @param name - The field name or aliases
   * @param length - the number of elements
   */
  Float32Array = <N extends string>(
    name: N | N[],
    length?: number
  ): ExtendStruct<T, ClassName, N, Float32Array> =>
    this.createTypedArray(name, PropType.Float32, length);

  /**
   * defines a `Float64Array` typed array represents an array of 64-bit floating numbers.
   * @param name - The field name or aliases
   * @param length - the number of elements
   */
  Float64Array = <N extends string>(
    name: N | N[],
    length?: number
  ): ExtendStruct<T, ClassName, N, Float64Array> =>
    this.createTypedArray(name, PropType.Float64, length);

  /**
   * defines a `BigInt64Array` typed array represents an array of 64-bit signed
   * integers.
   * @param name - The field name or aliases
   * @param length - the number of elements
   */
  BigInt64Array = <N extends string>(
    name: N | N[],
    length?: number
  ): ExtendStruct<T, ClassName, N, BigInt64Array> =>
    this.createTypedArray(name, PropType.BigInt64, length);

  /**
   * defines a `BigUint64Array` typed array represents an array of 64-bit unsigned
   * integers.
   * @param name - The field name or aliases
   * @param length - the number of elements
   */
  BigUInt64Array = <N extends string>(
    name: N | N[],
    length?: number
  ): ExtendStruct<T, ClassName, N, BigUint64Array> =>
    this.createTypedArray(name, PropType.BigUInt64, length);

  /**
   * defines an array of elements of a typed struct
   * @param name - The field name or aliases
   * @param struct - The custom typed struct
   * @param length - the number of elements
   */
  StructArray = <N extends string, S, StructClass extends string>(
    name: N | N[],
    struct: StructConstructor<S, StructClass>,
    length?: number
  ): ExtendStruct<T, ClassName, N, S[]> =>
    this.createProp<N, PropType.Struct, S[]>(name, {
      type: PropType.Struct,
      len: length,
      tail: length === undefined,
      struct: struct,
    });

  /**
   * defines a string array field
   * @param name - The field name or aliases
   * @param opts - The string array options
   */
  StringArray<N extends string>(
    name: N | N[],
    opts: StringArrayOpts
  ): ExtendStruct<T, ClassName, N, string[]> {
    return this.createProp<N, PropType.StringArray, string[]>(name, {
      type: PropType.StringArray,
      len: opts.lines,
      size: opts.length,
      encoding: opts.encoding,
    });
  }

  Custom<N extends string, ReturnType>(
    name: N | N[],
    size: number | undefined,
    getter: Getter<ReturnType>
  ): ExtendStruct<T, ClassName, N, ReturnType, false, true>;

  /**
   * defines a field with a custom getter and setter
   * @param name - The field name or aliases
   * @param size - The field size
   * @param getter - a function which serves as a getter for the property, or undefined if there is
   *   no getter.
   * @param setter - a function which serves as a setter for the property, or undefined if there
   * is no setter.
   */
  Custom<N extends string, ReturnType>(
    name: N | N[],
    size: number | undefined,
    getter: Getter<ReturnType>,
    setter: Setter<ReturnType>
  ): ExtendStruct<T, ClassName, N, ReturnType, false, false>;

  Custom<N extends string, ReturnType>(
    name: N | N[],
    size: number | undefined,
    getter: Getter<ReturnType>,
    setter?: Setter<ReturnType>
  ): ExtendStruct<T, ClassName, N, ReturnType> {
    return this.createProp(name, {
      type: Array.isArray(name) ? name[0] : name,
      len: size,
      tail: size === undefined,
      getter,
      setter,
    });
  }

  /**
   * The last byte in the structure, usually used as a checksum. Typically, used
   * for variable length structures.
   * @param name - The field name or aliases
   */
  CRC8<N extends string>(name: N | N[]): ExtendStruct<T, ClassName, N, number>;

  /**
   * The last byte in the structure, usually used as a checksum. Typically, used
   * for variable length structures.
   * @param name - The field name or aliases
   * @param calc - checksum function
   * @param initial - initial value, default 0.
   */
  CRC8<N extends string>(
    name: N | N[],
    calc: CRCCalc,
    initial?: number
  ): ExtendStruct<T, ClassName, N, number, true>;

  /**
   * The last byte in the structure, usually used as a checksum. Typically, used
   * for variable length structures.
   * @param name - The field name or aliases
   * @param opts - checksum function parameters
   */
  CRC8<N extends string>(name: N, opts: CRCOpts): ExtendStruct<T, ClassName, N, number, true>;

  CRC8<N extends string>(
    name: N | N[],
    arg1?: CRCCalc | CRCOpts,
    arg2?: number
  ): ExtendStruct<T, ClassName, N, number, boolean> {
    return this.createCRCProp(name, PropType.UInt8, false, arg1, arg2);
  }

  /**
   * The last two bytes in the structure storing unsigned, little-endian
   * 16-bit integer usually used as a checksum. Typically, used for variable length structures.
   * @param name - The field name or aliases
   */
  CRC16LE<N extends string>(name: N | N[]): ExtendStruct<T, ClassName, N, number>;

  /**
   * The last two bytes in the structure storing unsigned, little-endian
   * 16-bit integer usually used as a checksum. Typically, used for variable length structures.
   * @param name - The field name or aliases
   * @param calc - checksum function
   * @param initial - initial value, default 0.
   */
  CRC16LE<N extends string>(
    name: N | N[],
    calc: CRCCalc,
    initial?: number
  ): ExtendStruct<T, ClassName, N, number, true>;

  /**
   * The last two bytes in the structure storing unsigned, little-endian
   * 16-bit integer usually used as a checksum. Typically, used for variable length structures.
   * @param name - The field name or aliases
   * @param opts - checksum function parameters
   */
  CRC16LE<N extends string>(name: N, opts: CRCOpts): ExtendStruct<T, ClassName, N, number, true>;

  CRC16LE<N extends string>(
    name: N | N[],
    arg1?: CRCCalc | CRCOpts,
    arg2?: number
  ): ExtendStruct<T, ClassName, N, number, boolean> {
    return this.createCRCProp(name, PropType.UInt16, false, arg1, arg2);
  }

  /**
   * The last two bytes in the structure storing unsigned, big-endian
   * 16-bit integer usually used as a checksum. Typically, used for variable length structures.
   * @param name - The field name or aliases
   */
  CRC16BE<N extends string>(name: N | N[]): ExtendStruct<T, ClassName, N, number>;

  /**
   * The last two bytes in the structure storing unsigned, big-endian
   * 16-bit integer usually used as a checksum. Typically, used for variable length structures.
   * @param name - The field name or aliases
   * @param calc - checksum function
   * @param initial - initial value, default 0.
   */
  CRC16BE<N extends string>(
    name: N | N[],
    calc: CRCCalc,
    initial?: number
  ): ExtendStruct<T, ClassName, N, number, true>;

  /**
   * The last two bytes in the structure storing unsigned, big-endian
   * 16-bit integer usually used as a checksum. Typically, used for variable length structures.
   * @param name - The field name or aliases
   * @param opts - checksum function parameters
   */
  CRC16BE<N extends string>(name: N, opts: CRCOpts): ExtendStruct<T, ClassName, N, number, true>;

  CRC16BE<N extends string>(
    name: N | N[],
    arg1?: CRCCalc | CRCOpts,
    arg2?: number
  ): ExtendStruct<T, ClassName, N, number, boolean> {
    return this.createCRCProp(name, PropType.UInt16, true, arg1, arg2);
  }

  /**
   * The last four bytes in the structure storing unsigned, little-endian
   * 32-bit integer usually used as a checksum. Typically, used for variable length structures.
   * @param name - The field name or aliases
   */
  CRC32LE<N extends string>(name: N | N[]): ExtendStruct<T, ClassName, N, number>;

  /**
   * The last four bytes in the structure storing unsigned, little-endian
   * 32-bit integer usually used as a checksum. Typically, used for variable length structures.
   * @param name - The field name or aliases
   * @param calc - checksum function
   * @param initial - initial value, default 0.
   */
  CRC32LE<N extends string>(
    name: N | N[],
    calc: CRCCalc,
    initial?: number
  ): ExtendStruct<T, ClassName, N, number, true>;

  /**
   * The last four bytes in the structure storing unsigned, little-endian
   * 32-bit integer usually used as a checksum. Typically, used for variable length structures.
   * @param name - The field name or aliases
   * @param opts - checksum function parameters
   */
  CRC32LE<N extends string>(name: N, opts: CRCOpts): ExtendStruct<T, ClassName, N, number, true>;

  CRC32LE<N extends string>(
    name: N | N[],
    arg1?: CRCCalc | CRCOpts,
    arg2?: number
  ): ExtendStruct<T, ClassName, N, number, boolean> {
    return this.createCRCProp(name, PropType.UInt32, false, arg1, arg2);
  }

  /**
   * The last four bytes in the structure storing unsigned, big-endian
   * 32-bit integer usually used as a checksum. Typically, used for variable length structures.
   * @param name - The field name or aliases
   */
  CRC32BE<N extends string>(name: N | N[]): ExtendStruct<T, ClassName, N, number>;

  /**
   * The last four bytes in the structure storing unsigned, big-endian
   * 32-bit integer usually used as a checksum. Typically, used for variable length structures.
   * @param name - The field name or aliases
   * @param calc - checksum function
   * @param initial - initial value, default 0.
   */
  CRC32BE<N extends string>(
    name: N | N[],
    calc: CRCCalc,
    initial?: number
  ): ExtendStruct<T, ClassName, N, number, true>;

  /**
   * The last four bytes in the structure storing unsigned, big-endian
   * 32-bit integer usually used as a checksum. Typically, used for variable length structures.
   * @param name - The field name or aliases
   * @param opts - checksum function parameters
   */
  CRC32BE<N extends string>(name: N, opts: CRCOpts): ExtendStruct<T, ClassName, N, number, true>;

  CRC32BE<N extends string>(
    name: N | N[],
    arg1?: CRCCalc | CRCOpts,
    arg2?: number
  ): ExtendStruct<T, ClassName, N, number, boolean> {
    return this.createCRCProp(name, PropType.UInt32, true, arg1, arg2);
  }

  /**
   * Skip the specified number of bytes. If the value is negative, the pointer in the buffer will
   *   move backward, if the value is 0 then the pointer will point to the
   *   end of the current buffer.
   * @see [[default.back]]
   * @param bytes
   */
  seek(bytes: number): this {
    if (bytes === 0) this.position = this.size;
    else this.position += bytes;
    return this;
  }

  /**
   * Move the current pointer in the buffer to the offset of the property that was **N** steps back.
   * @see [[default.seek]]
   * @param steps - the number of steps back, if the value is 0 then the pointer will point to the
   *   beginning of the buffer
   */
  back(steps = 1): this {
    if (steps < 0 || steps > this.props.size)
      throw new TypeError(`Invalid argument: back. Expected 0..${this.props.size}`);
    if (steps === 0) this.position = 0;
    else {
      const [prop] = [...this.props.values()].slice(-steps);
      this.position = prop.offset;
    }
    return this;
  }

  /**
   * Align the current pointer to a two-byte boundary
   */
  align2(): this {
    this.position += this.position % 2;
    return this;
  }

  /**
   * Align the current pointer to a four-byte boundary
   */
  align4(): this {
    const remainder = this.position % 4;
    if (remainder) this.position += 4 - remainder;
    return this;
  }

  /**
   * Align the current pointer to an eight-byte boundary
   */
  align8(): this {
    const remainder = this.position % 8;
    if (remainder) this.position += 8 - remainder;
    return this;
  }

  /**
   * Create structure constructor
   * @param className - The constructor name
   */
  compile(
    className: string | undefined = this.defaultClassName
  ): WithCRC<StructConstructor<Id<T>, ClassName>, HasCRC> {
    const { size: baseSize, props, getOffsetOf, getOffsets, swap } = this;
    type Instance = StructInstance<T, ClassName>;

    // noinspection JSUnusedGlobalSymbols
    class Structure {
      static readonly baseSize = baseSize;

      static getOffsetOf = getOffsetOf;

      static getOffsets = getOffsets;

      constructor(size: number);

      constructor(raw: number[]);

      constructor(raw?: Buffer, clone?: boolean);

      constructor(rawOrSize: number | number[] | Buffer | undefined, clone = false) {
        const size =
          Buffer.isBuffer(rawOrSize) || Array.isArray(rawOrSize)
            ? rawOrSize.length
            : (rawOrSize ?? baseSize);
        if (size < baseSize)
          throw TypeError(`[${className}]: Buffer size must be at least ${baseSize} (${size})`);
        let $raw: Buffer;
        if (typeof rawOrSize === 'number' || rawOrSize === undefined) {
          $raw = Buffer.alloc(size);
        } else {
          $raw = clone || Array.isArray(rawOrSize) ? Buffer.from(rawOrSize) : rawOrSize;
        }
        defineProps(this, props, $raw);
        const toString = () => {
          const { length } = $raw;
          const offsets = Object.entries<number>(getOffsets())
            .map<[keyof T, number]>(([name, offset]) => [
              name as keyof T,
              offset < 0 ? offset + length : offset,
            ])
            .sort(([, a], [, b]) => a - b);
          if (offsets.length === 0) return '';
          const chunks: [keyof T, string][] = [];
          for (let i = 0; i < offsets.length; i += 1) {
            const [name, start] = offsets[i];
            const prop = props.get(name);
            switch (prop?.type) {
              case PropType.Struct: {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                const value = (this as any)[name];
                if (prop.len === undefined) chunks.push([name, `${value}`]);
                else if (Array.isArray(value))
                  chunks.push([
                    name,
                    value.map(v => `${v}`).join(useColors ? colorPrint(2, '=') : '='),
                  ]);
                break;
              }
              default: {
                const [, end] = i + 1 < offsets.length ? offsets[i + 1] : [];
                const buf = $raw.subarray(start, end);
                if (buf.length > 0) chunks.push([name, printBuffer(buf)]);
              }
            }
          }
          return chunks
            .map(([name, value]) =>
              useColors ? colorPrint(selectColor(name.toString()), value) : value
            )
            .join('=');
        };
        Object.defineProperties(this, {
          $raw: { value: $raw },
          ...(inspect && {
            [inspect.custom]: {
              value: (...args: unknown[]) => inspect?.({ ...this }, ...args.slice(1)),
            },
          }),
          [Symbol.toPrimitive]: { value: toString },
          toString: { value: toString },
        });
        // Object.preventExtensions(this);
      }

      static swap = (instance: Instance, name: keyof T): Buffer => swap(name, Struct.raw(instance));

      static raw = (instance: Instance): Buffer => Struct.raw(instance);

      toJSON(): POJO<T> {
        return toPOJO(this) as POJO<T>;
      }
    }

    const [name, info] = Array.from(props.entries()).pop() ?? [];
    if (info && isCrc(info)) {
      const { calc, initial, start } = info;
      if (calc) {
        (Structure as WithCRC<StructConstructor<T, ClassName>, true>).crc = (
          instance: Instance,
          needUpdate = false
        ): number => {
          const size = getSize(info.type);
          const sum = calc(Structure.raw(instance).subarray(start, -size), initial);
          if (needUpdate && name) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            instance[name] = sum as any;
          }
          return sum;
        };
      }
    }

    return (className ? nameIt(className, Structure) : Structure) as WithCRC<
      StructConstructor<T, ClassName>,
      HasCRC
    >;
  }

  /** @hidden */
  protected swap = (name: keyof T, raw: Buffer): Buffer => {
    const prop = this.props.get(name);
    if (!prop) throw new TypeError(`Unknown property name "${String(name)}"`);
    const { type, offset, len = 1 } = prop;
    const itemSize = getSize(type) ?? 1;
    const end = offset + itemSize * len;
    switch (itemSize) {
      case 1:
        return raw.subarray(offset, end);
      case 2:
        return raw.subarray(offset, end).swap16();
      case 4:
        return raw.subarray(offset, end).swap32();
      case 8:
        return raw.subarray(offset, end).swap64();
      /* istanbul ignore next */
      default:
        throw new TypeError(
          `Invalid type ${typeof type === 'number' ? PropType[type] : type} for field ${String(name)}`
        );
    }
  };

  /** @hidden */
  private createProp<
    N extends string,
    Y extends PropType | string,
    R = NativeType<Y>,
    S extends ExtendStruct<T, ClassName, N, R, boolean> = ExtendStruct<T, ClassName, N, R>,
  >(nameOrAliases: N | N[], info: Omit<PropDesc<Y, R>, 'offset'>): S {
    const self = this as unknown as S;
    const names: N[] = Array.isArray(nameOrAliases) ? nameOrAliases : [nameOrAliases];
    const [exists] = names.filter(name => self.props.has(name));
    if (exists !== undefined) throw TypeError(`Property "${exists}" already exists`);
    if (this.tailed && !isCrc(info) && !info.tail)
      throw TypeError(`Invalid property "${names[0]}". The tail buffer already created`);
    const itemSize = info.struct?.baseSize ?? info.size ?? getSize(info.type) ?? 1;
    if (info.tail) this.tailed = true;
    if (isCrc(info)) {
      const prev = Array.from(self.props.values()).pop();
      if (!prev) throw new TypeError('CRC should not to be first');
      if (prev.len === undefined) {
        prev.len = -itemSize;
      } else if (prev.len < 0) {
        if (prev.len !== -itemSize)
          throw new TypeError(`Invalid tail buffer length. Expected ${-itemSize}`);
        // size has already been calculated in the previous field
        return self;
      }
    }
    names.forEach(name => {
      self.props.set(name, { offset: isCrc(info) ? -itemSize : this.position, ...info });
    });
    const size =
      Math.abs(
        info.len ??
          // (this.position === 0 || info ? 1 : 0)
          (info.type === PropType.Buffer || info.tail ? 0 : 1)
      ) * itemSize;
    this.position += size;
    return self;
  }

  /** @hidden */
  private createTypedArray = <
    N extends string,
    Y extends NumericTypes,
    A = TypedArrayType<Y>,
    S extends ExtendStruct<T, ClassName, N, A> = ExtendStruct<T, ClassName, N, A>,
  >(
    name: N | N[],
    type: Y,
    length?: number
  ): S =>
    this.createProp<N, Y, A, S>(name, {
      type,
      len: length,
      tail: length === undefined,
    });

  /** @hidden */
  private createBitFields<
    N extends string,
    Y extends Exclude<UnsignedIntegerTypes, BigIntTypes>,
    S extends ExtendStruct<T, ClassName, N, number> = ExtendStruct<T, ClassName, N, number>,
  >(type: Y, fields: Record<N, BitMask>): S {
    const self = this as unknown as S;
    Object.entries<BitMask>(fields).forEach(([name, mask]) => {
      if (self.props.has(name as N)) throw TypeError(`Property ${name} already exists`);
      self.props.set(name as N, {
        offset: this.position,
        type,
        mask,
        be: true,
      });
    });
    this.position += getSize(type);
    return self;
  }

  /** @hidden */
  private createCRCProp<N extends string>(
    name: N | N[],
    type: Exclude<UnsignedIntegerTypes, BigIntTypes>,
    be: boolean,
    arg1?: CRCCalc | CRCOpts,
    arg2?: number
  ): ExtendStruct<T, ClassName, N, number, true> {
    let calc;
    let initial;
    let start;
    if (typeof arg1 === 'function') {
      calc = arg1;
      initial = arg2 ?? 0;
    } else if (arg1) {
      calc = arg1.calc;
      initial = arg1.initial ?? 0;
      start = arg1.start ?? 0;
    }
    return this.createProp(name, {
      type,
      len: -1,
      be,
      calc,
      initial,
      start,
    });
  }
}
