const path         = require('path');
const async        = require('async');
const rimraf       = require('rimraf');
const _            = require('lodash');
const Stats        = require('fast-stats').Stats;
const Table        = require('cli-table');
const ProgressBar  = require('progress');
const spawn        = require('child_process').spawn;

(function spawn_server() {
  console.log('spawning server');

  try{
    const db_file = path.join(__dirname, 'db', 'perf.tests.db');
    rimraf.sync(db_file);
  } catch(err){}

  const limitd_args = ['--config-file', 'config.yml'];

  const run_with_profile = process.argv.indexOf('--profile') > -1;

  if (run_with_profile) {
    limitd_args.push('--profile');
  }

  const server = spawn(`${path.normalize(__dirname + '/../bin/limitd')}`, limitd_args, { stdio: 'inherit' });

  process.once('exit', (code) => {
    server.kill();
    process.exit(code);
  });
})();

process.title = 'limitd perfomance client';

const LimitdClient = require('limitd-client');

const clients = _.range(0, 10).map(() => new LimitdClient({host: 'limitd://localhost:19001', timeout: 60000 }));

clients.forEach(c => c.once('ready', waitAll));

function waitAll(){
  if(clients.every(c => c.socket && c.socket.connected)){
    run_tests();
  }
}

function run_tests () {
  const started_at = new Date();

  const requests = 200000;
  const concurrency = 5000;

  const progress = new ProgressBar(':bar', { total: requests , width: 50 });

  async.mapLimit(_.range(requests), concurrency, function (i, done) {
    const date = new Date();
    const client = clients.shift();
    clients.push(client);
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

