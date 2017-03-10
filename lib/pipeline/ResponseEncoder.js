'use strict';

const _ = require('lodash');
const Transform = require('stream').Transform;
const Response = require('../../messages/protocol_buffers').Response;

class ResponseEncoder extends Transform {
  constructor(options) {
    super(_.extend(options||{}, {
      objectMode: true
    }));
  }

  _transform(message, encoding, callback) {
    var encoded = Response.encode(message).finish();
    callback(null, encoded);
  }
}

module.exports = ResponseEncoder;
