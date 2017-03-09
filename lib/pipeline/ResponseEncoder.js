'use strict';

const _ = require('lodash');
const Transform = require('stream').Transform;

class ResponseEncoder extends Transform {
  constructor(options) {
    super(_.extend(options||{}, {
      objectMode: true
    }));
  }

  _transform(message, encoding, callback) {
    callback(null, message.encode().toBuffer());
  }
}

module.exports = ResponseEncoder;
