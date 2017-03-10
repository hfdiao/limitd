const Response     = require('../../messages/protocol_buffers').Response;
const TakeResponse = require('../../messages/protocol_buffers').TakeResponse;
const agent        = require('auth0-instrumentation');

function build_wait_response (message, delayed, bucket) {
  const takeResponse = TakeResponse.create({
    conformant: true,
    delayed: delayed,
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
  agent.metrics.increment('requests.incoming.wait');

  log.debug({
    method:  'WAIT',
    'type': message['type'],
    key:     message.key,
    count:   message.count
  }, 'waiting tokens');

  var since = Date.now();

  bucket_type.waitToken(message.key, message.count, function (err, delayed, bucket) {
    if (err) {
      agent.metrics.increment('requests.processed.wait');
      agent.metrics.histogram('requests.processed.wait.time', (new Date() - since));
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
      method:     'WAIT',
      'type':     message['type'],
      key:        message.key,
      count:      message.count,
      delayed:    delayed,
      waited:     Date.now() - since,
      remaining:  Math.floor(bucket.content),
      limit:      bucket.size,
      beforeDrip: bucket.beforeDrip,
      isNew:      bucket.isNew,
    }, 'WAIT');

    var result = build_wait_response(message, delayed, bucket);
    agent.metrics.increment('requests.processed.wait');
    agent.metrics.histogram('requests.processed.wait.time', (new Date() - since));
    done(null, result);
  });
};
