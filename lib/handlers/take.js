var Response = require('../../messages/protocol_buffers').Response;
var TakeResponse = require('../../messages/protocol_buffers').TakeResponse;
var agent = require('auth0-instrumentation');

function build_take_response (message, conformant, bucket) {
  const takeResponse = TakeResponse.create({
    conformant: conformant,
    remaining: Math.floor(bucket.content),
    reset: bucket.reset,
    limit: bucket.size
  });


  const response = Response.create({
    request_id: message.id,
    '.limitd.TakeResponse.response': takeResponse
  });
  return response;
}

module.exports.handle = function (bucket_type, log, message, done) {
  agent.metrics.increment('requests.incoming.take');

  log.debug({
    method:  'TAKE',
    'type': message['type'],
    key:     message.key,
    count:   message.count
  }, 'taking tokens');

  const start = new Date();

  bucket_type.removeToken(message.key, message.count, function (err, conformant, bucket) {
    if (err) {
      agent.metrics.increment('requests.processed.take');
      agent.metrics.histogram('requests.processed.take.time', (new Date() - start));
      var errorContext = {
        err:    err,
        method: 'TAKE',
        'type': message['type'],
        key:    message.key,
        count:  message.count,
      };
      agent.errorReporter.captureException(err.message, { extra: errorContext });
      return log.error(errorContext, err.message);
    }

    log.info({
      err:        err,
      method:     'TAKE',
      'type':     message['type'],
      key:        message.key,
      count:      message.count,
      conformant: conformant,
      remaining:  Math.floor(bucket.content),
      limit:      bucket.size,
      beforeDrip: bucket.beforeDrip,
      isNew:      bucket.isNew,
      took:       new Date() - start
    }, 'TAKE');

    var result = build_take_response(message, conformant, bucket);
    agent.metrics.increment('requests.processed.take');
    agent.metrics.histogram('requests.processed.take.time', (new Date() - start));
    done(null, result);
  });
};
