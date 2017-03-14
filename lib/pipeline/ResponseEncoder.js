'use strict';

const _              = require('lodash');
const Transform      = require('stream').Transform;
const protocol       = require('../../messages/protocol_buffers');
const Response       = protocol.Response;
const TakeResponse   = protocol.TakeResponse;
const PutResponse    = protocol.PutResponse;
const PongResponse   = protocol.PongResponse;
const ErrorResponse  = protocol.ErrorResponse;
const StatusResponse = protocol.StatusResponse;

const mappers = {
  'TAKE': (request, response) => {
    return Response.create({
      request_id: request.id,
      '.limitd.TakeResponse.response': TakeResponse.create(response)
    });
  },
  'WAIT': (request, response) => {
    return Response.create({
      request_id: request.id,
      '.limitd.TakeResponse.response': TakeResponse.create(response)
    });
  },
  'PUT': (request, response) => {
    return Response.create({
      request_id: request.id,
      '.limitd.PutResponse.response': PutResponse.create(response)
    });
  },
  'PING': (request, response) => {
    return Response.create({
      request_id: request.id,
      '.limitd.PongResponse.response': PongResponse.create(response)
    });
  },
  'STATUS': (request, response) => {
    return StatusResponse.create({
      request_id: request.id,
      '.limitd.StatusResponse.response': StatusResponse.create({
        items: response.items.map(i => ({
          remaining: i.remaining,
          reset:     i.reset,
          limit:     i.limit,
          instance:  i.key
        }))
      })
    });
  },
  'UNKNOWN_BUCKET_TYPE': (request) => {
    return Response.create({
      request_id: request.id,
      '.limitd.ErrorResponse.response': ErrorResponse.create({
        type: ErrorResponse.Type.UNKNOWN_BUCKET_TYPE,
      })
    });
  }
};

class ResponseEncoder extends Transform {
  constructor(options) {
    super(_.extend(options||{}, {
      objectMode: true
    }));
  }

  _transform(rr, encoding, callback) {
    var response;

    if (rr.response.error === 'UNKNOWN_BUCKET_TYPE') {
      response = mappers.UNKNOWN_BUCKET_TYPE(rr.request);
    } else {
      response = mappers[rr.request.method](rr.request, rr.response);
    }

    const encoded = Response.encodeDelimited(response).finish();
    this.push(encoded);
    callback();
  }
}

module.exports = ResponseEncoder;
