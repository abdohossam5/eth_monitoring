'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

var _log = require('./lib/log');

var _log2 = _interopRequireDefault(_log);

var _mysql = require('mysql');

var _mysql2 = _interopRequireDefault(_mysql);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

let onAcquire = connection => {
  (0, _log2.default)('d', 'i', 'mysql connection %d acquired', connection.threadId);
};

let onConnection = connection => {
  (0, _log2.default)('d', 'i', 'mysql new connection', connection);
};

let onEnqueue = () => {
  (0, _log2.default)('d', 'i', 'mysql connection queued');
};

let onRelease = connection => {
  (0, _log2.default)('d', 'i', 'mysql connection %d released', connection.threadId);
};

let pool = _mysql2.default.createPool(_config2.default.mysql);

pool.on('acquire', onAcquire);
pool.on('connection', onConnection);
pool.on('enqueue', onEnqueue);
pool.on('release', onRelease);

let connection = {
  query() {
    var _arguments = arguments;
    return _asyncToGenerator(function* () {

      let sql_args = [];
      let args = [];
      for (let i = 0; i < _arguments.length; i++) {
        args.push(_arguments[i]);
      }
      if (args.length > 1) {
        sql_args = args[1];
      }
      // var callback = args[args.length-1]; //last arg is callback


      return new Promise((() => {
        var _ref = _asyncToGenerator(function* (resolve, reject) {

          pool.query(args[0], sql_args, function (err, result) {

            if (err) {
              reject(err);
            }

            resolve(result);
          });
        });

        return function (_x, _x2) {
          return _ref.apply(this, arguments);
        };
      })());
    })();
  },
  transaction(stages) {
    return _asyncToGenerator(function* () {
      return new Promise((() => {
        var _ref2 = _asyncToGenerator(function* (resolve, reject) {

          if (!stages || !Array.isArray(stages) || !stages.length) {
            reject({ msg: `no stages provided for transaction` });
          }

          pool.getConnection(function (err, conn) {

            if (err) {
              reject(err);
              return;
            }

            conn.beginTransaction(function (err) {
              let response = [];
              if (err) {
                reject(err);
                return;
              }

              stages.forEach(function (s, idx, arr) {

                conn.query(s.statement, s.postdata || {}, function (error, results, fields) {

                  if (error) {
                    return conn.rollback(function () {
                      conn.release();
                      reject(error);
                    });
                  }

                  response.push(results);

                  if (idx === arr.length - 1) {

                    conn.commit(function (err) {

                      if (err) {
                        return conn.rollback(function () {
                          conn.release();
                          reject(err);
                        });
                      }

                      conn.release();
                      response.push(results);
                      resolve(response);
                    });
                  }
                });
              });
            });
          });
        });

        return function (_x3, _x4) {
          return _ref2.apply(this, arguments);
        };
      })());
    })();
  },
  getConnection: cb => pool.getConnection(cb)
};

exports.default = connection;
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm15c3FsREIuanMiXSwibmFtZXMiOlsib25BY3F1aXJlIiwiY29ubmVjdGlvbiIsInRocmVhZElkIiwib25Db25uZWN0aW9uIiwib25FbnF1ZXVlIiwib25SZWxlYXNlIiwicG9vbCIsImNyZWF0ZVBvb2wiLCJteXNxbCIsIm9uIiwicXVlcnkiLCJzcWxfYXJncyIsImFyZ3MiLCJpIiwibGVuZ3RoIiwicHVzaCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZXJyIiwicmVzdWx0IiwidHJhbnNhY3Rpb24iLCJzdGFnZXMiLCJBcnJheSIsImlzQXJyYXkiLCJtc2ciLCJnZXRDb25uZWN0aW9uIiwiY29ubiIsImJlZ2luVHJhbnNhY3Rpb24iLCJyZXNwb25zZSIsImZvckVhY2giLCJzIiwiaWR4IiwiYXJyIiwic3RhdGVtZW50IiwicG9zdGRhdGEiLCJlcnJvciIsInJlc3VsdHMiLCJmaWVsZHMiLCJyb2xsYmFjayIsInJlbGVhc2UiLCJjb21taXQiLCJjYiJdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztBQUVBOzs7O0FBQ0E7Ozs7QUFDQTs7Ozs7Ozs7QUFHQSxJQUFJQSxZQUFhQyxVQUFELElBQWM7QUFDNUIscUJBQUksR0FBSixFQUFTLEdBQVQsRUFBYSw4QkFBYixFQUE2Q0EsV0FBV0MsUUFBeEQ7QUFDRCxDQUZEOztBQUlBLElBQUlDLGVBQWdCRixVQUFELElBQWM7QUFDL0IscUJBQUksR0FBSixFQUFTLEdBQVQsRUFBYSxzQkFBYixFQUFxQ0EsVUFBckM7QUFDRCxDQUZEOztBQUlBLElBQUlHLFlBQVksTUFBSTtBQUNsQixxQkFBSSxHQUFKLEVBQVMsR0FBVCxFQUFhLHlCQUFiO0FBQ0QsQ0FGRDs7QUFJQSxJQUFJQyxZQUFhSixVQUFELElBQWM7QUFDNUIscUJBQUksR0FBSixFQUFTLEdBQVQsRUFBYSw4QkFBYixFQUE2Q0EsV0FBV0MsUUFBeEQ7QUFDRCxDQUZEOztBQUlBLElBQUlJLE9BQU8sZ0JBQU1DLFVBQU4sQ0FBaUIsaUJBQU9DLEtB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QkQ7QUE2QkQsZUEvQkQ7QUFpQ0QsYUF4Q0Q7QUEyQ0QsV0FsREQ7QUFtREQsU0F6RE07O0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FBUDtBQUR1QjtBQTJEeEIsR0F2RmM7QUF3RmZILGlCQUFnQmdCLEVBQUQsSUFBUXBDLEtBQUtvQixhQUFMLENBQW1CZ0IsRUFBbkI7QUF4RlIsQ0FBakI7O2tCQTJGZXpDLFUiLCJmaWxlIjoibXlzcWxEQi5qcyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IGNvbmZpZyBmcm9tICcuL2NvbmZpZyc7XG5pbXBvcnQgbG9nIGZyb20gJy4vbGliL2xvZyc7XG5pbXBvcnQgbXlzcWwgZnJvbSAnbXlzcWwnO1xuXG5cbmxldCBvbkFjcXVpcmUgPSAoY29ubmVjdGlvbik9PntcbiAgbG9nKCdkJywgJ2knLCdteXNxbCBjb25uZWN0aW9uICVkIGFjcXVpcmVkJywgY29ubmVjdGlvbi50aHJlYWRJZClcbn07XG5cbmxldCBvbkNvbm5lY3Rpb24gPSAoY29ubmVjdGlvbik9PntcbiAgbG9nKCdkJywgJ2knLCdteXNxbCBuZXcgY29ubmVjdGlvbicsIGNvbm5lY3Rpb24pXG59O1xuXG5sZXQgb25FbnF1ZXVlID0gKCk9PntcbiAgbG9nKCdkJywgJ2knLCdteXNxbCBjb25uZWN0aW9uIHF1ZXVlZCcpXG59O1xuXG5sZXQgb25SZWxlYXNlID0gKGNvbm5lY3Rpb24pPT57XG4gIGxvZygnZCcsICdpJywnbXlzcWwgY29ubmVjdGlvbiAlZCByZWxlYXNlZCcsIGNvbm5lY3Rpb24udGhyZWFkSWQpXG59O1xuXG5sZXQgcG9vbCA9IG15c3FsLmNyZWF0ZVBvb2woY29uZmlnLm15c3FsKTtcblxucG9vbC5vbignYWNxdWlyZScsIG9uQWNxdWlyZSk7XG5wb29sLm9uKCdjb25uZWN0aW9uJywgb25Db25uZWN0aW9uKTtcbnBvb2wub24oJ2VucXVldWUnLCBvbkVucXVldWUpO1xucG9vbC5vbigncmVsZWFzZScsIG9uUmVsZWFzZSk7XG5cblxubGV0IGNvbm5lY3Rpb24gPSB7XG4gIGFzeW5jIHF1ZXJ5ICgpe1xuXG4gICAgbGV0IHNxbF9hcmdzID0gW107XG4gICAgbGV0IGFyZ3MgPSBbXTtcbiAgICBmb3IobGV0IGk9MDsgaTxhcmd1bWVudHMubGVuZ3RoOyBpKyspe1xuICAgICAgYXJncy5wdXNoKGFyZ3VtZW50c1tpXSk7XG4gICAgfVxuICAgIGlmKGFyZ3MubGVuZ3RoID4gMSl7XG4gICAgICBzcWxfYXJncyA9IGFyZ3NbMV1cbiAgICB9XG4gICAgLy8gdmFyIGNhbGxiYWNrID0gYXJnc1thcmdzLmxlbmd0aC0xXTsgLy9sYXN0IGFyZyBpcyBjYWxsYmFja1xuXG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG4gICAgICBwb29sLnF1ZXJ5KGFyZ3NbMF0sc3FsX2FyZ3MsIChlcnIsIHJlc3VsdCk9PntcblxuICAgICAgICBpZihlcnIpe1xuICAgICAgICAgcmVqZWN0KGVycilcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc29sdmUocmVzdWx0KVxuXG5cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuICBhc3luYyB0cmFuc2FjdGlvbihzdGFnZXMpe1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cbiAgICAgIGlmKCFzdGFnZXMgfHwgIUFycmF5LmlzQXJyYXkoc3RhZ2VzKSB8fCAhc3RhZ2VzLmxlbmd0aCl7XG4gICAgICAgIHJlamVjdCh7bXNnOmBubyBzdGFnZXMgcHJvdmlkZWQgZm9yIHRyYW5zYWN0aW9uYH0pXG4gICAgICB9XG5cbiAgICAgIHBvb2wuZ2V0Q29ubmVjdGlvbigoZXJyLGNvbm4pPT57XG5cbiAgICAgICAgaWYoZXJyKXtcbiAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25uLmJlZ2luVHJhbnNhY3Rpb24oKGVycik9PntcbiAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBbXTtcbiAgICAgICAgICBpZihlcnIpe1xuICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc3RhZ2VzLmZvckVhY2goKHMsIGlkeCAsIGFycik9PntcblxuICAgICAgICAgICAgY29ubi5xdWVyeShzLnN0YXRlbWVudCxzLnBvc3RkYXRhIHx8IHt9LCAoZXJyb3IsIHJlc3VsdHMsIGZpZWxkcyk9PntcblxuICAgICAgICAgICAgICBpZihlcnJvcil7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbm4ucm9sbGJhY2soKCk9PntcbiAgICAgICAgICAgICAgICAgIGNvbm4ucmVsZWFzZSgpO1xuICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHJlc3BvbnNlLnB1c2gocmVzdWx0cyk7XG5cbiAgICAgICAgICAgICAgaWYoaWR4ID09PSBhcnIubGVuZ3RoLTEpe1xuXG4gICAgICAgICAgICAgICAgY29ubi5jb21taXQoKGVycik9PntcblxuICAgICAgICAgICAgICAgICAgaWYoZXJyKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbm4ucm9sbGJhY2soKCk9PntcbiAgICAgICAgICAgICAgICAgICAgICBjb25uLnJlbGVhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgIGNvbm4ucmVsZWFzZSgpO1xuICAgICAgICAgICAgICAgICAgcmVzcG9uc2UucHVzaChyZXN1bHRzKTtcbiAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICB9KVxuXG4gICAgICAgIH0pXG5cblxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG4gIGdldENvbm5lY3Rpb246IChjYikgPT4gcG9vbC5nZXRDb25uZWN0aW9uKGNiKVxufTtcblxuZXhwb3J0IGRlZmF1bHQgY29ubmVjdGlvbjtcblxuXG4iXX0=
