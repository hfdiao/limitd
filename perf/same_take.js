const path    = require('path');
const async   = require('async');
const rimraf  = require('rimraf');
const _       = require('lodash');
const Stats   = require('fast-stats').Stats;
const Table   = require('cli-table');
const spawn   = require('child_process').spawn;
const cluster = require('cluster');
const os      = require('os');

const requests =  100000;
const concurrency = 1000;
const client_count =  os.cpus().length - 1;

function spawn_server() {

  try{
    const db_file = path.join(__dirname, 'db', 'perf.tests.db');
    rimraf.sync(db_file);
  } catch(err){}

  const run_with_profile = process.argv.indexOf('--profile') > -1;
  const flame_graph = process.argv.indexOf('--0x') > -1;


  var limitd_args = [
                      path.normalize(__dirname + '/../bin/limitd'),
                      '--config-file',
                      'config.yml'
                    ];

  if (flame_graph) {
    limitd_args = [
      'node',
      '--trace-hydrogen',
      '--trace-phase=Z',
      '--trace-deopt',
      '--code-comments',
      '--hydrogen-track-positions',
      '--redirect-code-traces',
      '--redirect-code-traces-to=code.asm'
    ].concat(limitd_args);
  }

  if (run_with_profile) {
    limitd_args.push('--profile');
  }

  const executable = flame_graph ? '0x' : 'node';

  return spawn(executable, limitd_args, { stdio: 'inherit' });
}

function render_results(started_at, results) {
  var took    = new Date() - started_at;
  var errored = _.filter(results, 'err');

  var times = _(results).filter(function (r) { return !r.err; }).map('took').value();
  var stats = new Stats().push(times);

  var table = new Table();

  table.push(
      { 'Requests':    requests * client_count         },
      { 'Concurrency': concurrency * client_count      },
      { 'Total time':  took + ' ms'                    },
      { 'Errored':     errored.length                  },
      { 'Mean':        stats.amean().toFixed(2)        },
      { 'P50':         stats.percentile(50).toFixed(2) },
      { 'P95':         stats.percentile(95).toFixed(2) },
      { 'P97':         stats.percentile(97).toFixed(2) },
      { 'Max':         _.max(times)                    },
      { 'Min':         _.min(times)                    }
  );

  console.log(table.toString());
}

if (cluster.isMaster) {
  process.title = 'limitd perfomance master';

  var results = [];
  const started_at = new Date();

  const server = spawn_server();

  const workers = _.range(client_count).map(() => cluster.fork());


  workers.forEach((worker) => {
    worker.once('message', (message) => {
      results = results.concat(message.results);
      if (results.length === client_count * requests) {
        render_results(started_at, _.flatten(results));
        server.kill('SIGINT');
        try{
          const db_file = path.join(__dirname, 'db', 'perf.tests.db');
          rimraf.sync(db_file);
        } catch(err){}
      }
      worker.kill();
    });
  });

  return;
}


const LimitdClient = require('limitd-client');

const clients = _.range(0, 10).map(() => new LimitdClient({host: 'limitd://localhost:19001', timeout: 60000 }));

clients.forEach(c => c.once('ready', waitAll));

function waitAll(){
  if(clients.every(c => c.socket && c.socket.connected)){
    run_tests();
  }
}

function run_tests () {
  async.mapLimit(_.range(requests), concurrency, function (i, done) {
    const date = new Date();
    const client = clients.shift();
    clients.push(client);
    return client.take('ip', '10.0.0.1', function (err, result) {
    // return client.take('ip', `${process.pid}-${i}-pipi`, function (err, result) {
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

    process.send({
      type: 'finish',
      results
    });
  });
}

