import { Buffer } from 'buffer/index.js';
import { initializeAPI, initializeBuffer } from './struct';

export * from './struct';

initializeBuffer(Buffer as unknown as typeof globalThis.Buffer);

initializeAPI({
  getString: (buf, encoding) => {
    let end: number | undefined = buf.indexOf(0);
    if (end < 0) end = buf.length;
    return buf.toString(encoding as BufferEncoding, 0, end);
  },
  setString: (buf, encoding, value) => {
    const encoded = Buffer.from(value, encoding as BufferEncoding);
    if (encoded.length > buf.length) throw new TypeError(`String is too long`);
    encoded.copy(buf as unknown as Buffer);
    buf.fill(0, encoded.length);
  },
  inspect: undefined,
  colorPrint: (c, msg) => msg,
});
