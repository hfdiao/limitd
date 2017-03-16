'use strict';

const Transform = require('stream').Transform;

/**
 * I use this in some tests. Please do not use.
 */

class RequestHandler extends Transform {
  constructor(options) {
    super({
      objectMode: true
    });

    this.buckets = options.buckets;
    this.logger = options.logger;
    this.db = options.db;
  }

  _transform(request, encoding, callback) {
    const method = request.method;

    switch(method) {
      case 'PING':
        callback(null, { request, response: {} });
        break;
      case 'TAKE':
      case 'WAIT':
      case 'PUT':
        // console.log(`got\t${request.id}`);
        this.db[method.toLowerCase()](request, (err, result) => {
          if (err) {
            if (err.message.indexOf('undefined bucket type') > -1) {
              return callback(null, { request, response: { error: { type: 'UNKNOWN_BUCKET_TYPE' } } });
            }
            return this.emit('error', err);
          }
          callback(null, { request, response: result });
        });
        break;
      case 'STATUS':
        this.db.status({type: request.type, prefix: request.key}, (err, result) => {
          if (err) { return this.emit('error', err); }
          callback(null, { request, response: result });
        });
        break;
      default:
        return callback(new Error(`unknown method ${method}`));
    }
  }
}

module.exports = RequestHandler;
