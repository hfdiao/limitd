'use strict';

const Duplex   = require('stream').Duplex;
const Deque    = require('double-ended-queue');

class RequestHandler extends Duplex {
  constructor(options) {
    super({
      objectMode: true,
      writableObjectMode: true,
      readableObjectMode: true
    });

    this.buckets = options.buckets;
    this.logger = options.logger;
    this.queue = new Deque();
    this.db = options.db;
  }

  _write(request, encoding, callback) {
    const method = request.method;

    switch(method) {
      case 'PING':
        this._queueResponse(request, { request_id: request.id });
        break;
      case 'TAKE':
      case 'WAIT':
      case 'PUT':
        this.db[method.toLowerCase()](request, (err, result) => {
          if (err) {
            if (err.message.indexOf('undefined bucket type') > -1) {
              return this._queueResponse(request, { error: { type: 'UNKNOWN_BUCKET_TYPE' } });
            }
            return this.emit('error', err);
          }
          this._queueResponse(request, result);
        });
        break;
      case 'STATUS':
        this.db.status({type: request.type, prefix: request.key}, (err, result) => {
          if (err) { return this.emit('error', err); }
          this._queueResponse(request, result);
        });
        break;
      default:
        return callback(new Error(`unknown method ${method}`));
    }

    process.nextTick(callback);
  }

  _queueResponse(request, response) {
    this.queue.push({ request, response });
    this._flush();
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
