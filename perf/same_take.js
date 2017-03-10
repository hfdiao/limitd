const path         = require('path');
const async        = require('async');
const rimraf       = require('rimraf');
const _            = require('lodash');
const Stats        = require('fast-stats').Stats;
const Table        = require('cli-table');
const ProgressBar  = require('progress');
const cluster      = require('cluster');
const LimitdServer = require('../server');
const profiler     = require('v8-profiler');
const fs           = require('fs');

if (cluster.isMaster) {
  process.title = 'limitd server';

  const run_with_profile = process.argv.indexOf('--profile') > -1;

  const db_file = path.join(__dirname, 'db', 'perf.tests.db');

  if (run_with_profile) {
    console.log('starting profiler');
    profiler.startProfiling('1', true);
  }

  // var fs = require('fs');
  // var profile1 = profiler.stopProfiling();
  // profiler.startProfiling('2', true);
  // var profile2 = profiler.stopProfiling();

  // console.log(snapshot1.getHeader(), snapshot2.getHeader());

  // profile1.export(function(error, result) {
  //   fs.writeFileSync('profile1.json', result);
  //   profile1.delete();
  // });

  try{
    rimraf.sync(db_file);
  } catch(err){}

  var server = new LimitdServer({
    db:        db_file,
    log_level: 'error',
    buckets: {
      ip: {
        size: 1000,
        override: {
          '10.0.0.1': {
            size: 1000,
            unlimited: true
          }
        }
      }
    }
  });


  server.start(function (err, address) {
    if (err) {
      console.error(err.message);
      return process.exit(1);
    }
    cluster.fork({LIMITD_HOST: `limitd://${address.address}:${address.port}`});
  });

  cluster.on('exit', (worker, code) => {
    if (!run_with_profile) {
      return process.exit(code);
    }

    var profile = profiler.stopProfiling();

    profile.export()
      .pipe(fs.createWriteStream(`${Date.now()}.cpuprofile`))
      .on('finish', function() {
        profile.delete();
        process.exit(code);
      });
  });

  return;
}

process.title = 'limitd client';

const LimitdClient = require('limitd-client');

const client = new LimitdClient({ timeout: '60s', host: process.env.LIMITD_HOST });

client.once('ready', run_tests);


function run_tests () {
  var client = this;
  var started_at = new Date();

  var requests = 200000;
  var concurrency = 5000;

  var progress = new ProgressBar(':bar', { total: requests , width: 50 });

  async.mapLimit(_.range(requests), concurrency, function (i, done) {
    var date = new Date();

    return client.take('ip', '10.0.0.1', function (err, result) {
      progress.tick();
      if (err) {
        console.dir(err);
        return process.exit(1);
      }
      done(null, {
        err: err,
        result: result,
        took: new Date() - date
      });
    });

  }, function (err, results) {
    if (err) {
      console.error(err.message);
      return process.exit(1);
    }

    var took    = new Date() - started_at;
    var errored = _.filter(results, 'err');

    var times = _(results).filter(function (r) { return !r.err; }).map('took').value();
    var stats = new Stats().push(times);

    var table = new Table();


    table.push(
        { 'Requests':   requests                        },
        { 'Total time': took + ' ms'                    },
        { 'Errored':    errored.length                  },
        { 'Mean':       stats.amean().toFixed(2)        },
        { 'P50':        stats.percentile(50).toFixed(2) },
        { 'P95':        stats.percentile(95).toFixed(2) },
        { 'P97':        stats.percentile(97).toFixed(2) },
        { 'Max':        _.max(times)                    },
        { 'Min':        _.min(times)                    }
    );

    console.log(table.toString());

    process.exit(0);

  });
}

