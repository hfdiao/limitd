const leveldb = require('./leveldb');

module.exports = function (options) {
  if (typeof options === 'string') {
    options = {
      backend: 'leveldb',
      path: options
    };
  }

  return leveldb(options.path);
};
