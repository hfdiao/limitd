'use strict';

const handlers = require('../handlers');
const Duplex   = require('readable-stream').Duplex;
const Deque    = require('double-ended-queue');

function BuildProtocolBufferUnknonwnTypeError (message) {
  const ResponseMessage = require('../../messages/protocol_buffers').Response;
  const ErrorResponse   = require('../../messages/protocol_buffers').ErrorResponse;

  const errorResponse = ErrorResponse.create({
    type: ErrorResponse.Type.UNKNOWN_BUCKET_TYPE,
  });

  const response = ResponseMessage.create({
    request_id: message.id,
    '.limitd.ErrorResponse.response': errorResponse
  });

  return response;
}

const _ = require('lodash');


class RequestHandler extends Duplex {
  constructor(options) {
    super(_.extend(options || {}, {
      objectMode: true,
      writableObjectMode: true,
      readableObjectMode: true
    }));

    this.buckets = options.buckets;
    this.logger = options.logger;
    this.queue = new Deque();
  }

  _write(message, encoding, callback) {
    const method = message.method;
    const handler = handlers.get(message.method);
    const bucket_type = message['type'] && this.buckets.get(message['type']);
    if (!handler) {
      callback(new Error(`unsupported method ${message.method}`));
    }

    if (method !== 'PING' && !bucket_type) {
      this.queue.push(BuildProtocolBufferUnknonwnTypeError(message));
      setImmediate(() => this._flush());
    } else {
      handler.handle(bucket_type, this.logger, message, (err, result) => {
        // if (err) { return this.emit('error', err); }
        this.queue.push(result);
        this._flush();
      });
    }

    callback();
  }

  _flush() {
    while(this.reading && !this.queue.isEmpty()) {
      const toPush = this.queue.shift();
      this.reading = this.push(toPush);
    }
  }

  _read() {
    this.reading = true;
    this._flush();
  }

}

module.exports = RequestHandler;
