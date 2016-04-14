// Generated by CoffeeScript 1.10.0
(function() {
  var dnode, http, onSignal, phanta, shoe, spawn, startPhantomProcess, wrap,
    slice = [].slice;

  dnode = require('dnode');

  http = require('http');

  shoe = require('shoe');

  spawn = require('win-spawn');

  phanta = [];

  startPhantomProcess = function(binary, port, hostname, args) {
    var binarySplit;
    binarySplit = binary.split(' ');
    return spawn(binarySplit[0], binarySplit.slice(1).concat(args).concat([__dirname + '/shim.js', port, hostname]));
  };

  onSignal = function() {
    var i, len, phantom;
    for (i = 0, len = phanta.length; i < len; i++) {
      phantom = phanta[i];
      phantom.exit();
    }
    return process.exit();
  };

  process.on('exit', onSignal);

  process.on('SIGINT', onSignal);

  process.on('SIGTERM', onSignal);

  wrap = function(ph) {
    ph.callback = function(fn) {
      return '__phantomCallback__' + fn.toString();
    };
    ph._createPage = ph.createPage;
    return ph.createPage = function(cb) {
      return ph._createPage(function(page) {
        page._evaluate = page.evaluate;
        page.evaluate = function() {
          var args, cb, fn;
          fn = arguments[0], cb = arguments[1], args = 3 <= arguments.length ? slice.call(arguments, 2) : [];
          return page._evaluate.apply(page, [fn.toString(), cb].concat(args));
        };
        page._onResourceRequested = page.onResourceRequested;
        page.onResourceRequested = function() {
          var args, cb, fn;
          fn = arguments[0], cb = arguments[1], args = 3 <= arguments.length ? slice.call(arguments, 2) : [];
          return page._onResourceRequested.apply(page, [fn.toString(), cb].concat(args));
        };
        return cb(page);
      });
    };
  };

  module.exports = {
    create: function() {
      var arg, args, cb, httpServer, i, key, len, options, phantom, ps, ref, sock, value;
      args = [];
      options = {};
      for (i = 0, len = arguments.length; i < len; i++) {
        arg = arguments[i];
        switch (typeof arg) {
          case 'function':
            cb = arg;
            break;
          case 'string':
            args.push(arg);
            break;
          case 'object':
            options = arg;
        }
      }
      if (typeof options.parameters === 'object') {
        ref = options.parameters;
        for (key in ref) {
          value = ref[key];
          args.push('--' + key + '=' + value);
        }
      }
      if (options.path == null) {
        options.path = '';
      }
      if (options.binary == null) {
        options.binary = options.path + 'phantomjs';
      }
      if (options.port == null) {
        options.port = 0;
      }
      if (options.hostname == null) {
        options.hostname = 'localhost';
      }
      if (options.dnodeOpts == null) {
        options.dnodeOpts = {};
      }
      ps = null;
      phantom = null;
      httpServer = http.createServer();
      httpServer.listen(options.port, options.hostname);
      httpServer.on("error", function(err) {
        if (cb != null) {
          return cb(null, err);
        } else {
          throw err;
        }
      });
      httpServer.on('listening', function() {
        var hostname, onExitFunc, port;
        port = httpServer.address().port;
        hostname = httpServer.address().address;
        ps = startPhantomProcess(options.binary, port, hostname, args);
        ps.stdout.on('data', options.onStdout || function(data) {
          return console.log("phantom stdout: " + data);
        });
        ps.stderr.on('data', options.onStderr || function(data) {
          return module.exports.stderrHandler(data.toString('utf8'));
        });
        ps.on('error', function(err) {
          httpServer.close();
          if ((err != null ? err.code : void 0) === 'ENOENT') {
            console.error("phantomjs-node: You don't have 'phantomjs' installed");
          }
          if (cb != null) {
            return cb(null, err);
          } else {
            throw err;
          }
        });
        ps.killProcess(function() {
          ps.kill('SIGHUP');
          return onExitFunc(19391945, 'kill');
        });
        onExitFunc = function(code, signal) {
          var p;
          httpServer.close();
          if (phantom) {
            if (typeof phantom.onExit === "function") {
              phantom.onExit();
            }
            phanta = (function() {
              var j, len1, results;
              results = [];
              for (j = 0, len1 = phanta.length; j < len1; j++) {
                p = phanta[j];
                if (p !== phantom) {
                  results.push(p);
                }
              }
              return results;
            })();
          }
          if (options.onExit) {
            return options.onExit(code, signal);
          } else {
            console.assert(signal == null, "signal killed phantomjs: " + signal);
            if (code !== 0) {
              return process.exit(code);
            }
          }
        };
        return ps.on('exit', function(code, signal) {
          return onExitFunc(code, signal);
        });
      });
      sock = shoe(function(stream) {
        var d;
        d = dnode({}, options.dnodeOpts);
        d.on('remote', function(_phantom) {
          phantom = _phantom;
          wrap(phantom);
          phantom.process = ps;
          phanta.push(phantom);
          return typeof cb === "function" ? cb(phantom, null) : void 0;
        });
        d.pipe(stream);
        return stream.pipe(d);
      });
      return sock.install(httpServer, '/dnode');
    },
    stderrHandler: function(message) {
      if (message.match(/(No such method.*socketSentData)|(CoreText performance note)/)) {
        return;
      }
      return console.warn("phantom stderr: " + message);
    }
  };

}).call(this);
