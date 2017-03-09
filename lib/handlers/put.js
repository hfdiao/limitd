var Response = require('../../messages/protocol_buffers').Response;
var PutResponse = require('../../messages/protocol_buffers').PutResponse;
var agent = require('auth0-instrumentation');

function build_put_response (message, bucket) {
  var response = new Response({
    request_id: message.id,
  });

  var takeResponse = new PutResponse({
    remaining: Math.floor(bucket.content),
    reset: bucket.reset,
    limit: bucket.size
  });

  response.set('.limitd.PutResponse.response', takeResponse);

  return response;
}

module.exports.handle = function (buckets, log, message, done) {
  agent.metrics.increment('requests.incoming.put');

  var bucket_type = buckets.get(message['type']);

  log.debug({
    method:  'PUT',
    'type': message['type'],
    key:     message.key,
    count:   message.count
  }, 'adding tokens');

  var start = new Date();

  bucket_type.putToken(message.key, message.all || message.count, function (err, bucket) {
    if (err) {
      agent.metrics.increment('requests.processed.put');
      agent.metrics.histogram('requests.processed.put.time', (new Date() - start));
      var errorContext = {
        err:    err,
        method: 'PUT',
        'type': message['type'],
        key:    message.key,
        count:  message.count,
        all:    message.all,
      };
      agent.errorReporter.captureException(err.message, { extra: errorContext });
      return log.error(errorContext, err.message);
    }

    log.info({
      err:        err,
      method:     'PUT',
      'type':     message['type'],
      key:        message.key,
      count:      message.count,
      all:        message.all,
      remaining:  Math.floor(bucket.content) || 0,
      limit:      bucket.size,
      took:       new Date() - start,
      beforeDrip: bucket.beforeDrip,
      isNew:      bucket.isNew,
    }, 'PUT/RESET');

    var result = build_put_response (message, bucket);
    agent.metrics.increment('requests.processed.put');
    agent.metrics.histogram('requests.processed.put.time', (new Date() - start));
    done(null, result);
  });
};
