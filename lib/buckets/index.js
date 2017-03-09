const Bucket = require('./bucket');
const _      = require('lodash');
const ms     = require('ms');

const INTERVAL_TO_MS = {
  'per_second': ms('1s'),
  'per_minute': ms('1m'),
  'per_hour':   ms('1h'),
  'per_day':    ms('1d'),
};

const INTERVAL_SHORT_HANDS = new Set([
  'per_second',
  'per_minute',
  'per_hour',
  'per_day',
  'per_month'
]);

function normalize_time(config) {
  const result = {};

  Object.keys(config)
    .forEach(function (k) {
      if (INTERVAL_SHORT_HANDS.has(k)) {
        result.interval = INTERVAL_TO_MS[k];
        result.per_interval = config[k];
      } else if (k === 'override') {
        result[k] = _.mapValues(config[k], normalize_time);
      } else {
        result[k] = config[k];
      }
    });

  if (typeof result.size === 'undefined') {
    result.size = result.per_interval;
  }

  return result;
}

function Buckets (db, config) {
  this._db = db;
  this._config = config;
  this._buckets = {};

  const self = this;

  Object.keys(config.buckets)
        .forEach(function (key) {
          const bucket_config = normalize_time(config.buckets[key]);
          const db = self._db.create(key);
          self._buckets[key] = new Bucket(db, bucket_config);
        });
}

Buckets.prototype.get = function (name) {
  return this._buckets[name];
};

module.exports = Buckets;
