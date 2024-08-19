import { inspect } from 'node:util';
import { Buffer } from 'node:buffer';
import { initializeAPI, initializeBuffer } from './struct';

export * from './struct';

initializeBuffer(Buffer);

void Promise.allSettled([import('debug'), import('iconv-lite')]).then(([debug, iconv]) => {
  initializeAPI({
    getString: (buf, encoding) => {
      const iconvDecode = iconv.status === 'fulfilled' && iconv.value.decode;
      let end: number | undefined = buf.indexOf(0);
      if (end < 0) end = buf.length;
      return iconvDecode
        ? iconvDecode(buf.subarray(0, end), encoding)
        : buf.toString(encoding as BufferEncoding, 0, end);
    },
    setString: (buf, encoding, value) => {
      const iconvEncode = iconv.status === 'fulfilled' && iconv.value.encode;
      const encoded = iconvEncode
        ? iconvEncode(value, encoding)
        : Buffer.from(value, encoding as BufferEncoding);
      if (encoded.length > buf.length) throw new TypeError(`String is too long`);
      encoded.copy(buf);
      buf.fill(0, encoded.length);
    },
    inspect,
    colorPrint: (c, msg) => {
      if (debug.status === 'rejected') return msg;
      const colors = debug.value.colors.map(color =>
        typeof color === 'string' ? parseInt(color.slice(1), 16) : color
      );
      const selectColor = (name: string): number =>
        colors[
          Math.abs([...name].reduce((hash, ch) => ((hash << 5) - hash + ch.charCodeAt(0)) | 0, 0)) %
            (colors.length || 1)
        ];
      const code = typeof c === 'number' ? c : selectColor(msg);
      const colorCode = `\u001B[3${code < 8 ? code : `8;5;${c}`}`;
      return `${colorCode};1m${msg}\u001B[0m`;
    },
  });
});
