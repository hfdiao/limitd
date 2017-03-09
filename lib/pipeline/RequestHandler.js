'use strict';

const handlers = require('../handlers');
const Duplex = require('stream').Duplex;
const Transform = require('stream').Transform;
const Deque    = require('double-ended-queue');

function BuildProtocolBufferUnknonwnTypeError (message) {
  const ResponseMessage = require('../../messages/protocol_buffers').Response;
  const ErrorResponse   = require('../../messages/protocol_buffers').ErrorResponse;

  const response = new ResponseMessage({
    request_id: message.id
  });

  const errorResponse = new ErrorResponse({
    type: ErrorResponse.Type.UNKNOWN_BUCKET_TYPE,
  });

  response.set('.limitd.ErrorResponse.response', errorResponse);

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
    const finish = (err) => {
      if (err) { return callback(err); }
      if (this.pendingRead) {
        const size = this.pendingRead;
        delete this.pendingRead;
        this._flushQueue(size);
      }
      callback();
    };

    if (message.method !== 'PING') {
      const bucket_type = this.buckets.get(message['type']);
      if (!bucket_type) {
        this.queue.push(BuildProtocolBufferUnknonwnTypeError(message));
        return finish();
      }
    }

    handlers.get(message.method).handle(this.buckets, this.logger, message, (err, result) => {
      if (err) { return finish(err); }
      this.queue.push(result);
      finish();
    });
  }

  _flushQueue(size) {
    for(var i = 0; i < size && !this.queue.isEmpty(); i++){
      const toPush = this.queue.shift();
      this.push(toPush);
    }
  }

  _read(size) {
    if (this.queue.isEmpty()) {
      this.pendingRead = size;
      return;
    }
    this._flushQueue(size);
  }
}

module.exports = RequestHandler;
