const varint = require('varint');
const Transform = require('stream').Transform;

/*
 * This is faster than length-prefixed-stream because of this:
 * https://github.com/mafintosh/length-prefixed-stream/issues/2
 */
module.exports = function () {
  return Transform({
    objectMode: true,
    transform(chunk, enc, callback) {
      const varint_bytes = varint.encode(chunk.length);
      const varint_buffer = new Buffer(varint_bytes);
      const result = Buffer.concat([varint_buffer, chunk]);

      callback(null, result);
    }
  });
};
