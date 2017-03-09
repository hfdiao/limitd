const EventEmitter = require('events').EventEmitter;

const util   = require('util');
const logger = require('./lib/logger');
const _      = require('lodash');
const net = require('net');
const Buckets = require('./lib/buckets');

const RequestHandler = require('./lib/pipeline/RequestHandler');
const RequestDecoder = require('./lib/pipeline/RequestDecoder');
const ResponseEncoder = require('./lib/pipeline/ResponseEncoder');
const lps = require('length-prefixed-stream');
const lps_encode = require('./lib/lps_encode');
const validateConfig = require('./lib/config_validator');
const agent = require('auth0-instrumentation');

const db = require('./lib/db');
const enableDestroy = require('server-destroy');

const defaults = {
  port:      9231,
  hostname:  '0.0.0.0',
  log_level: 'info'
};

/*
 * Creates an instance of LimitdServer.
 *
 * Options:
 *
 *  - `db` the path to the database. Required.
 *  - `port` the port to listen to. Defaults to 9231.
 *  - `hostname` the hostname to bind to. Defaults to INADDR_ANY
 *  - `log_level` the verbosity of the logs. Defaults to 'info'.
 *  - `metrics_api_key`, the DataDog api key to log metrics to. Defaults to undefined.
 *
 */
function LimitdServer (options) {
  EventEmitter.call(this);
  var self = this;


  if (!options.db) {
    throw new TypeError('"db" is required');
  }

  this._config = _.extend({}, defaults, options);
  var configError = validateConfig(this._config);
  if (configError) {
    throw new Error(configError);
  }

  this._logger = logger(this._config.log_level);
  this._server = net.createServer(this._handler.bind(this));
  enableDestroy(this._server);

  this._server.on('error', function (err) {
    self.emit('error', err);
  });

  this._db = db(this._config.db);
  this._buckets = new Buckets(this._db, this._config);

  agent.init({
    'name': 'limitd'
  }, {
    'COLLECT_RESOURCE_USAGE': true,
    'STATSD_HOST': this._config.statsd_host,
    'METRICS_API_KEY': this._config.metrics_api_key,
    'ERROR_REPORTER_URL': this._config.error_reporter_url
  });
}

util.inherits(LimitdServer, EventEmitter);

LimitdServer.prototype._handler = function (socket) {
  const sockets_details = _.pick(socket, ['remoteAddress', 'remotePort']);
  const log = this._logger;

  socket.on('error', function (err) {
    log.debug(_.extend(sockets_details, {
      err: {
        code:    err.code,
        message: err.message
      }
    }), 'connection error');
  }).on('close', function () {
    log.debug(sockets_details, 'connection closed');
  });

  log.debug(sockets_details, 'connection accepted');

  const decoder = new RequestDecoder();

  decoder.on('error', function () {
    log.debug(sockets_details, 'unknown message format');
    return socket.end();
  });

  const request_handler = new RequestHandler({
    buckets: this._buckets,
    logger: this._logger,
  });

  const encoder = new ResponseEncoder();

  socket.pipe(lps.decode())
        .pipe(decoder)
        .pipe(request_handler)
        .pipe(encoder)
        .pipe(lps_encode())
        .pipe(socket);
};

LimitdServer.prototype.start = function (done) {
  var self = this;
  var log = self._logger;

  self._server.listen(this._config.port, this._config.hostname, function(err) {
    if (err) {
      log.error(err, 'error starting server');
      self.emit('error', err);
      if (done) {
        done(err);
      }
      return;
    }

    var address = self._server.address();
    log.debug(address, 'server started');
    self.emit('started', address);
    if (done) {
      done(null, address);
    }
  });

  return this;
};

LimitdServer.prototype.stop = function () {
  var self = this;
  var log = self._logger;
  var address = self._server.address();

  this._server.destroy(function() {
    log.debug(address, 'server closed');
    self.emit('close');
  });
};


module.exports = LimitdServer;

