const Response     = require('../../messages/protocol_buffers').Response;
const PongResponse = require('../../messages/protocol_buffers').PongResponse;
const agent        = require('auth0-instrumentation');

function build_pong_response(message) {
  const response = new Response({});
  response.set('request_id', message.id, true);

  const pongResponse = new PongResponse({});
  response.set('.limitd.PongResponse.response', pongResponse, true);

  return response;
}

module.exports.handle = function (buckets, log, message, done) {
  agent.metrics.increment('requests.incoming.ping');

  log.info({
    method:     'PING',
    'type':     message['type'],
    key:        message.key,
    count:      message.count,
    all:        message.all,
  }, 'PING');

  var start = new Date();
  var result = build_pong_response(message);
  agent.metrics.increment('requests.processed.ping');
  agent.metrics.histogram('requests.processed.ping.time', (new Date() - start));
  setImmediate(done, null, result);
};
