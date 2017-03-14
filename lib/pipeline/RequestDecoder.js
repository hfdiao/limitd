'use strict';

const ProtocolBufferRequest = require('../../messages/protocol_buffers').Request;
const Transform = require('stream').Transform;

class RequestDecoder extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk, encoding, callback) {
    const decoded = ProtocolBufferRequest.decode(chunk).toJSON();
    this.push(decoded);
    callback();
  }
}

module.exports = RequestDecoder;
