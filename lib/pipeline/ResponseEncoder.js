'use strict';

const _ = require('lodash');
const Transform = require('readable-stream').Transform;
const Response = require('../../messages/protocol_buffers').Response;

class ResponseEncoder extends Transform {
  constructor(options) {
    super(_.extend(options||{}, {
      objectMode: true
    }));
  }

  _transform(message, encoding, callback) {
    const encoded = Response.encode(message).finish();
    this.push(encoded);
    callback();
  }
}

module.exports = ResponseEncoder;
