'use strict';

const ProtocolBufferRequest = require('../../messages/protocol_buffers').Request;
const Transform = require('readable-stream').Transform;
const _ = require('lodash');

class RequestDecoder extends Transform {
  constructor(options) {
    super(_.extend(options || {}, {
      objectMode: true
    }));
  }

  _transform(chunk, encoding, callback) {
    const decoded = ProtocolBufferRequest.decode(chunk).toJSON();
    this.push(decoded);
    callback();
  }
}

module.exports = RequestDecoder;
