'use strict';

let getNewEthContributions = (() => {
  var _ref = _asyncToGenerator(function* (walletAddr) {
    let filteredEthTransactions = [];
    let failedTxs = [];
    try {
      let ethTransactionsReq = yield _axios2.default.get(`${ETHERSCAN_URL}?module=account&action=txlist&address=${walletAddr}&startblock=0&endblock=99999999&apikey=${ETHERSCAN_KEY}&sort=desc`);

      if (ethTransactionsReq.data && ethTransactionsReq.data.result && Array.isArray(ethTransactionsReq.data.result) && ethTransactionsReq.data.result.length) {
        const ethTransactions = ethTransactionsReq.data.result;

        for (let i = 0; i < ethTransactions.length; i++) {
          let t = ethTransactions[i];

          // check if transaction is an input to our wallet
          if (t.to.toLowerCase() !== walletAddr.toLowerCase()) continue;

          // check if transaction was already added to DB
          let transExist = yield _mysqlDB2.default.query(`Select * From ${TXS_TABLE} Where txHash=?`, [t.hash]);

          if (Array.isArray(transExist) && transExist.length) continue;

          if (t.isError === '1') {
            failedTxs.push({
              txHash: t.hash,
              received_date: new Date(t.timeStamp * 1000),
              received_from: t.from,
              value: t.value / Math.pow(10, 18),
              destinationAddress: walletAddr
            });
            continue;
          }

          filteredEthTransactions.push({
            txHash: t.hash,
            received_date: new Date(t.timeStamp * 1000),
            received_from: t.from,
            value: t.value / Math.pow(10, 18),
            destinationAddress: walletAddr
          });
        }

        if (failedTxs.length) {
          try {
            yield _mysqlDB2.default.query(`INSERT INTO ${FAILED_TXS} (txHash, received_date, received_from, value, destinationAddress) VALUES ?`, [failedTxs.map(function (t) {
              return Object.values(t);
            })]);
          } catch (err) {
            yield logInfo('error', 'Failed Txs insert Error', err);
          }
        }
      }

      return filteredEthTransactions;
    } catch (err) {
      yield logInfo('error', `getNewEthContributions`, err);
    }
  });

  return function getNewEthContributions(_x) {
    return _ref.apply(this, arguments);
  };
})();

let getPriceList = (() => {
  var _ref2 = _asyncToGenerator(function* (minTimestamp, coin) {

    let list = [];
    let e = coin === 'BTC' ? BTC_PRICE_SOURCE : ETH_PRICE_SOURCE;
    try {
      let listReq = yield _axios2.default.get(`${CRYPTOCOMPARE}/data/histohour?fsym=${coin}&tsym=USD&e=${e}&limit=1000&toTs=${minTimestamp}`);

      if (listReq.data && listReq.data.Response === 'Success' && Array.isArray(listReq.data.Data) && listReq.data.Data.length) {
        list = listReq.data.Data;
      }
    } catch (err) {
      yield logInfo('error', 'getPriceList', err);
    }

    return list;
  });

  return function getPriceList(_x2, _x3) {
    return _ref2.apply(this, arguments);
  };
})();

let newContributionsCheck = (() => {
  var _ref3 = _asyncToGenerator(function* () {
    try {
      if (IsCheckingRunning) return;
      IsCheckingRunning = true;
      yield logInfo("info", `newContributionsCheck started @${new Date()}`);
      let ethTxs = [];

      for (let i = 0; i < ETH_WALLETS.length; i++) {
        ethTxs = [...ethTxs, ...(yield getNewEthContributions(ETH_WALLETS[i]))];
      }

      if (ethTxs.length) {
        let ethTimeStamps = ethTxs.map(function (t) {
          return t.received_date.getTime();
        });
        let minEthTimeStamp = Math.min(...ethTimeStamps);

        let ethPrices = yield getPriceList(minEthTimeStamp, 'ETH');

        if (!ethPrices || !ethPrices.length) {
          IsCheckingRunning = false;
          return;
        }

        for (let j = 0; j < ethTxs.length; j++) {
          let trans = ethTxs[j];

          let priceAtTransTime = getPriceForTransaction(trans, ethPrices);
          trans.price = priceAtTransTime ? JSON.stringify(Object.assign({}, priceAtTransTime, { date: new Date(priceAtTransTime.time * 1000) })) : null;
        }

        const result = yield _mysqlDB2.default.query(`INSERT INTO ${TXS_TABLE} (txHash, received_date, received_from, value, destinationAddress, price) VALUES ?`, [ethTxs.map(function (t) {
          return Object.values(t);
        })]);
      }

      IsCheckingRunning = false;
    } catch (err) {
      IsCheckingRunning = false;
      yield logInfo('error', 'New Contributions Check Error', err);
    }
  });

  return function newContributionsCheck() {
    return _ref3.apply(this, arguments);
  };
})();

let logInfo = (() => {
  var _ref4 = _asyncToGenerator(function* (type, description, data) {
    try {
      yield _mysqlDB2.default.query(`INSERT INTO ${LOG_TABLE} SET ?`, { type, description, data: JSON.stringify(data) });
    } catch (err) {
      (0, _log2.default)('s', 'e', err);
    }
  });

  return function logInfo(_x4, _x5, _x6) {
    return _ref4.apply(this, arguments);
  };
})();

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _log = require('./lib/log');

var _log2 = _interopRequireDefault(_log);

var _mysqlDB = require('./mysqlDB');

var _mysqlDB2 = _interopRequireDefault(_mysqlDB);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const {
  ETH_WALLETS = [''],
  CHECKING_FREQUENCY_MS,
  ETHERSCAN_URL, ETHERSCAN_KEY,
  CRYPTOCOMPARE,
  BTC_PRICE_SOURCE,
  ETH_PRICE_SOURCE,
  TXS_TABLE,
  LOG_TABLE,
  FAILED_TXS
} = _config2.default;

let IsCheckingRunning = false;

function getPriceForTransaction(trans, list) {
  let transTime = Math.round(trans.received_date.getTime() / 1000);

  return list.find((price, idx, priceList) => {
    let currentPriceTime = price.time;
    let hasMore = idx < priceList.length - 1;
    let nextPriceTime = hasMore ? priceList[idx + 1].time : null;
    if (transTime === currentPriceTime || transTime < currentPriceTime) {
      return true;
    } else if (transTime > currentPriceTime) {
      if (nextPriceTime) {
        return nextPriceTime - transTime > transTime - currentPriceTime;
      } else {
        return true; // if has more try next else use the latest price we can get
      }
    }
  });
}

setInterval(newContributionsCheck, CHECKING_FREQUENCY_MS);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LmpzIl0sIm5hbWVzIjpbIndhbGxldEFkZHIiLCJmaWx0ZXJlZEV0aFRyYW5zYWN0aW9ucyIsImZhaWxlZFR4cyIsImV0aFRyYW5zYWN0aW9uc1JlcSIsImdldCIsIkVUSEVSU0NBTl9VUkwiLCJFVEhFUlNDQU5fS0VZIiwiZGF0YSIsInJlc3VsdCIsIkFycmF5IiwiaXNBcnJheSIsImxlbmd0aCIsImV0aFRyYW5zYWN0aW9ucyIsImkiLCJ0IiwidG8iLCJ0b0xvd2VyQ2FzZSIsInRyYW5zRXhpc3QiLCJxdWVyeSIsIlRYU19UQUJMRSIsImhhc2giLCJpc0Vycm9yIiwicHVzaCIsInR4SGFzaCIsInJlY2VpdmVkX2RhdGUiLCJEYXRlIiwidGltZVN0YW1wIiwicmVjZWl2ZWRfZnJvbSIsImZyb20iLCJ2YWx1ZSIsIk1hdGgiLCJwb3ciLCJkZXN0aW5hdGlvbkFkZHJlc3MiLCJGQUlMRURfVFhTIiwibWFwIiwiT2JqZWN0IiwidmFsdWVzIiwiZXJyIiwibG9nSW5mbyIsImdldE5ld0V0aENvbnRyaWJ1dGlvbnMiLCJtaW5UaW1lc3RhbXAiLCJjb2luIiwibGlzdCIsImUiLCJCVENfUFJJQ0VfU09VUkNFIiwiRVRIX1BSSUNFX1NPVVJDRSIsImxpc3RSZXEiLCJDUllQVE9DT01QQVJFIiwiUmVzcG9uc2UiLCJEYXRhIiwiZ2V0UHJpY2VMaXN0IiwiSXNDaGVja2luZ1J1bm5pbmciLCJldGhUeHMiLCJFVEhfV0FMTEVUUyIsImV0aFRpbWVTdGFtcHMiLCJnZXRUaW1lIiwibWluRXRoVGltZVN0YW1wIiwibWluIiwiZXRoUHJpY2VzIiwiaiIsInRyYW5zIiwicHJpY2VBdFRyYW5zVGltZSIsImdldFByaWNlRm9yVHJhbnNhY3Rpb24iLCJwcmljZSIsIkpTT04iLCJzdHJpbmdpZnkiLCJhc3NpZ24iLCJkYXRlIiwidGltZSIsIm5ld0NvbnRyaWJ1dGlvbnNDaGVjayIsInR5cGUiLCJkZXNjcmlwdGlvbiIsIkxPR19UQUJMRSIsIkNIRUNLSU5HX0ZSRVFVRU5DWV9NUyIsInRyYW5zVGltZSIsInJvdW5kIiwiZmluZCIsImlkeCIsInByaWNlTGlzdCIsImN1cnJlbnRQcmljZVRpbWUiLCJoYXNNb3JlIiwibmV4dFByaWNlVGltZSIsInNldEludGVydmFsIl0sIm1hcHBpbmdzIjoiOzs7K0JBbUJBLFdBQXNDQSxVQUF0QyxFQUFrRDtBQUNoRCxRQUFJQywwQkFBMEIsRUFBOUI7QUFDQSxRQUFJQyxZQUFZLEVBQWhCO0FBQ0EsUUFBRztBQUNELFVBQUlDLHFCQUFxQixNQUFNLGdCQUFNQyxHQUFOLENBQVcsR0FBRUMsYUFBYyx5Q0FBd0NMLFVBQVcsMENBQXlDTSxhQUFjLFlBQXJJLENBQS9COztBQUVBLFVBQUdILG1CQUFtQkksSUFBbkIsSUFBMkJKLG1CQUFtQkksSUFBbkIsQ0FBd0JDLE1BQW5ELElBQTZEQyxNQUFNQyxPQUFOLENBQWNQLG1CQUFtQkksSUFBbkIsQ0FBd0JDLE1BQXRDLENBQTdELElBQThHTCxtQkFBbUJJLElBQW5CLENBQXdCQyxNQUF4QixDQUErQkcsTUFBaEosRUFBdUo7QUFDckosY0FBTUMsa0JBQWtCVCxtQkFBbUJJLElBQW5CLENBQXdCQyxNQUFoRDs7QUFFQSxhQUFJLElBQUlLLElBQUcsQ0FBWCxFQUFjQSxJQUFJRCxnQkFBZ0JELE1BQWxDLEVBQTBDRSxHQUExQyxFQUE4QztBQUM1QyxjQUFJQyxJQUFJRixnQkFBZ0JDLENBQWhCLENBQVI7O0FBRUE7QUFDQSxjQUFHQyxFQUFFQyxFQUFGLENBQUtDLFdBQUwsT0FBdUJoQixXQUFXZ0IsV0FBWCxFQUExQixFQUFvRDs7QUFHcEQ7QUFDQSxjQUFJQyxhQUFhLE1BQU0sa0JBQUdDLEtBQUgsQ0FBVSxpQkFBZ0JDLFNBQVUsaUJBQXBDLEVBQXFELENBQUNMLEVBQUVNLElBQUgsQ0FBckQsQ0FBdkI7O0FBRUEsY0FBR1gsTUFBTUMsT0FBTixDQUFjTyxVQUFkLEtBQTZCQSxXQUFXTixNQUEzQyxFQUFtRDs7QUFFbkQsY0FBR0csRUFBRU8sT0FBRixLQUFjLEdBQWpCLEVBQXFCO0FB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LGNBQWNLLGdCQUFkLElBQWtDTCxZQUFZSyxnQkFBakQsRUFBa0U7QUFDaEUsYUFBTyxJQUFQO0FBQ0QsS0FGRCxNQUVPLElBQUdMLFlBQVlLLGdCQUFmLEVBQWdDO0FBQ3JDLFVBQUdFLGFBQUgsRUFBaUI7QUFDZixlQUFVQSxnQkFBY1AsU0FBZixHQUE2QkEsWUFBVUssZ0JBQWhEO0FBQ0QsT0FGRCxNQUVPO0FBQ0wsZUFBTyxJQUFQLENBREssQ0FDUTtBQUNkO0FBQ0Y7QUFDRixHQWJNLENBQVA7QUFjRDs7QUFVREcsWUFBWWIscUJBQVosRUFBbUNJLHFCQUFuQyIsImZpbGUiOiJpbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBheGlvcyBmcm9tICdheGlvcyc7XG5pbXBvcnQgbG9nIGZyb20gJy4vbGliL2xvZyc7XG5pbXBvcnQgRGIgZnJvbSAnLi9teXNxbERCJztcbmltcG9ydCBjb25maWcgZnJvbSAnLi9jb25maWcnO1xuXG5jb25zdCB7XG4gIEVUSF9XQUxMRVRTID0gWycnXSxcbiAgQ0hFQ0tJTkdfRlJFUVVFTkNZX01TLFxuICBFVEhFUlNDQU5fVVJMLCBFVEhFUlNDQU5fS0VZLFxuICBDUllQVE9DT01QQVJFLFxuICBCVENfUFJJQ0VfU09VUkNFLFxuICBFVEhfUFJJQ0VfU09VUkNFLFxuICBUWFNfVEFCTEUsXG4gIExPR19UQUJMRSxcbiAgRkFJTEVEX1RYU1xufSA9IGNvbmZpZztcblxubGV0IElzQ2hlY2tpbmdSdW5uaW5nID0gZmFsc2U7XG5cbmFzeW5jIGZ1bmN0aW9uIGdldE5ld0V0aENvbnRyaWJ1dGlvbnMod2FsbGV0QWRkcikge1xuICBsZXQgZmlsdGVyZWRFdGhUcmFuc2FjdGlvbnMgPSBbXTtcbiAgbGV0IGZhaWxlZFR4cyA9IFtdO1xuICB0cnl7XG4gICAgbGV0IGV0aFRyYW5zYWN0aW9uc1JlcSA9IGF3YWl0IGF4aW9zLmdldChgJHtFVEhFUlNDQU5fVVJMfT9tb2R1bGU9YWNjb3VudCZhY3Rpb249dHhsaXN0JmFkZHJlc3M9JHt3YWxsZXRBZGRyfSZzdGFydGJsb2NrPTAmZW5kYmxvY2s9OTk5OTk5OTkmYXBpa2V5PSR7RVRIRVJTQ0FOX0tFWX0mc29ydD1kZXNjYCk7XG5cbiAgICBpZihldGhUcmFuc2FjdGlvbnNSZXEuZGF0YSAmJiBldGhUcmFuc2FjdGlvbnNSZXEuZGF0YS5yZXN1bHQgJiYgQXJyYXkuaXNBcnJheShldGhUcmFuc2FjdGlvbnNSZXEuZGF0YS5yZXN1bHQpICYmIGV0aFRyYW5zYWN0aW9uc1JlcS5kYXRhLnJlc3VsdC5sZW5ndGgpe1xuICAgICAgY29uc3QgZXRoVHJhbnNhY3Rpb25zID0gZXRoVHJhbnNhY3Rpb25zUmVxLmRhdGEucmVzdWx0O1xuXG4gICAgICBmb3IobGV0IGkgPTA7IGkgPCBldGhUcmFuc2FjdGlvbnMubGVuZ3RoOyBpKyspe1xuICAgICAgICBsZXQgdCA9IGV0aFRyYW5zYWN0aW9uc1tpXTtcblxuICAgICAgICAvLyBjaGVjayBpZiB0cmFuc2FjdGlvbiBpcyBhbiBpbnB1dCB0byBvdXIgd2FsbGV0XG4gICAgICAgIGlmKHQudG8udG9Mb3dlckNhc2UoKSAhPT0gd2FsbGV0QWRkci50b0xvd2VyQ2FzZSgpKSBjb250aW51ZTtcblxuXG4gICAgICAgIC8vIGNoZWNrIGlmIHRyYW5zYWN0aW9uIHdhcyBhbHJlYWR5IGFkZGVkIHRvIERCXG4gICAgICAgIGxldCB0cmFuc0V4aXN0ID0gYXdhaXQgRGIucXVlcnkoYFNlbGVjdCAqIEZyb20gJHtUWFNfVEFCTEV9IFdoZXJlIHR4SGFzaD0/YCxbdC5oYXNoXSk7XG5cbiAgICAgICAgaWYoQXJyYXkuaXNBcnJheSh0cmFuc0V4aXN0KSAmJiB0cmFuc0V4aXN0Lmxlbmd0aCkgY29udGludWU7XG5cbiAgICAgICAgaWYodC5pc0Vycm9yID09PSAnMScpe1xuICAgICAgICAgIGZhaWxlZFR4cy5wdXNoKHtcbiAgICAgICAgICAgIHR4SGFzaDogdC5oYXNoLFxuICAgICAgICAgICAgcmVjZWl2ZWRfZGF0ZTogbmV3IERhdGUodC50aW1lU3RhbXAqMTAwMCksXG4gICAgICAgICAgICByZWNlaXZlZF9mcm9tOiB0LmZyb20sXG4gICAgICAgICAgICB2YWx1ZTogdC52YWx1ZSAvIE1hdGgucG93KDEwLDE4KSxcbiAgICAgICAgICAgIGRlc3RpbmF0aW9uQWRkcmVzczogd2FsbGV0QWRkclxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICBmaWx0ZXJlZEV0aFRyYW5zYWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICB0eEhhc2g6IHQuaGFzaCxcbiAgICAgICAgICByZWNlaXZlZF9kYXRlOiBuZXcgRGF0ZSh0LnRpbWVTdGFtcCoxMDAwKSxcbiAgICAgICAgICByZWNlaXZlZF9mcm9tOiB0LmZyb20sXG4gICAgICAgICAgdmFsdWU6IHQudmFsdWUgLyBNYXRoLnBvdygxMCwxOCksXG4gICAgICAgICAgZGVzdGluYXRpb25BZGRyZXNzOiB3YWxsZXRBZGRyXG4gICAgICAgIH0pXG4gICAgICB9XG5cbiAgICAgIGlmKGZhaWxlZFR4cy5sZW5ndGgpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IERiLnF1ZXJ5KGBJTlNFUlQgSU5UTyAke0ZBSUxFRF9UWFN9ICh0eEhhc2gsIHJlY2VpdmVkX2RhdGUsIHJlY2VpdmVkX2Zyb20sIHZhbHVlLCBkZXN0aW5hdGlvbkFkZHJlc3MpIFZBTFVFUyA/YCxcbiAgICAgICAgICBbZmFpbGVkVHhzLm1hcCh0ID0+IE9iamVjdC52YWx1ZXModCkpXVxuICAgICAgICApXG4gICAgICAgIH0gY2F0Y2ggKGVycil7XG4gICAgICAgICAgYXdhaXQgbG9nSW5mbygnZXJyb3InLCAnRmFpbGVkIFR4cyBpbnNlcnQgRXJyb3InLCBlcnIpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgIH1cblxuICAgIHJldHVybiBmaWx0ZXJlZEV0aFRyYW5zYWN0aW9ucztcbiAgfSBjYXRjaCAoZXJyKXtcbiAgICBhd2FpdCBsb2dJbmZvKCdlcnJvcicsIGBnZXROZXdFdGhDb250cmlidXRpb25zYCwgZXJyKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRQcmljZUxpc3QobWluVGltZXN0YW1wLCBjb2luKSB7XG5cbiAgbGV0IGxpc3QgPSBbXTtcbiAgbGV0IGUgPSBjb2luID09PSAnQlRDJyA/IEJUQ19QUklDRV9TT1VSQ0UgOiBFVEhfUFJJQ0VfU09VUkNFO1xuICB0cnl7XG4gICAgbGV0IGxpc3RSZXEgPSBhd2FpdCBheGlvcy5nZXQoYCR7Q1JZUFRPQ09NUEFSRX0vZGF0YS9oaXN0b2hvdXI/ZnN5bT0ke2NvaW59JnRzeW09VVNEJmU9JHtlfSZsaW1pdD0xMDAwJnRvVHM9JHttaW5UaW1lc3RhbXB9YClcblxuICAgIGlmKGxpc3RSZXEuZGF0YSAmJiBsaXN0UmVxLmRhdGEuUmVzcG9uc2UgPT09ICdTdWNjZXNzJyAmJiBBcnJheS5pc0FycmF5KGxpc3RSZXEuZGF0YS5EYXRhKSAmJiBsaXN0UmVxLmRhdGEuRGF0YS5sZW5ndGgpe1xuICAgICAgbGlzdCA9IGxpc3RSZXEuZGF0YS5EYXRhO1xuICAgIH1cblxuICB9IGNhdGNoIChlcnIpe1xuICAgIGF3YWl0IGxvZ0luZm8oJ2Vycm9yJywgJ2dldFByaWNlTGlzdCcsIGVycik7XG4gICAgXG4gIH1cblxuICByZXR1cm4gbGlzdDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbmV3Q29udHJpYnV0aW9uc0NoZWNrKCkge1xuICB0cnl7XG4gICAgaWYoSXNDaGVja2luZ1J1bm5pbmcpIHJldHVybjtcbiAgICBJc0NoZWNraW5nUnVubmluZyA9IHRydWU7XG4gICAgYXdhaXQgbG9nSW5mbyhcImluZm9cIixgbmV3Q29udHJpYnV0aW9uc0NoZWNrIHN0YXJ0ZWQgQCR7bmV3IERhdGUoKX1gKTtcbiAgICBsZXQgZXRoVHhzID0gW107XG5cbiAgICBmb3IgKGxldCBpID0wOyBpIDwgRVRIX1dBTExFVFMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGV0aFR4cyA9IFsuLi5ldGhUeHMgLCAuLi5hd2FpdCBnZXROZXdFdGhDb250cmlidXRpb25zKEVUSF9XQUxMRVRTW2ldKV07XG4gICAgfVxuXG4gICAgaWYoZXRoVHhzLmxlbmd0aCl7XG4gICAgICBsZXQgZXRoVGltZVN0YW1wcyA9IGV0aFR4cy5tYXAodCA9PiB0LnJlY2VpdmVkX2RhdGUuZ2V0VGltZSgpKTtcbiAgICAgIGxldCBtaW5FdGhUaW1lU3RhbXAgPSAgTWF0aC5taW4oLi4uZXRoVGltZVN0YW1wcyk7XG5cblxuICAgICAgbGV0IGV0aFByaWNlcyA9IGF3YWl0IGdldFByaWNlTGlzdChtaW5FdGhUaW1lU3RhbXAsICdFVEgnKTtcblxuICAgICAgaWYoIWV0aFByaWNlcyB8fCAhZXRoUHJpY2VzLmxlbmd0aCkge1xuICAgICAgICBJc0NoZWNraW5nUnVubmluZyA9IGZhbHNlO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGZvcihsZXQgaj0wOyBqIDwgZXRoVHhzLmxlbmd0aDsgaisrKXtcbiAgICAgICAgbGV0IHRyYW5zID0gZXRoVHhzW2pdO1xuXG4gICAgICAgIGxldCBwcmljZUF0VHJhbnNUaW1lID0gZ2V0UHJpY2VGb3JUcmFuc2FjdGlvbih0cmFucywgZXRoUHJpY2VzKTtcbiAgICAgICAgdHJhbnMucHJpY2UgPSBwcmljZUF0VHJhbnNUaW1lXG4gICAgICAgID8gSlNPTi5zdHJpbmdpZnkoT2JqZWN0LmFzc2lnbih7fSxwcmljZUF0VHJhbnNUaW1lLHtkYXRlOm5ldyBEYXRlKHByaWNlQXRUcmFuc1RpbWUudGltZSoxMDAwKX0pKVxuICAgICAgICA6IG51bGw7XG4gICAgICAgIFxuICAgICAgfVxuXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBEYi5xdWVyeShcbiAgICAgICAgYElOU0VSVCBJTlRPICR7VFhTX1RBQkxFfSAodHhIYXNoLCByZWNlaXZlZF9kYXRlLCByZWNlaXZlZF9mcm9tLCB2YWx1ZSwgZGVzdGluYXRpb25BZGRyZXNzLCBwcmljZSkgVkFMVUVTID9gLFxuICAgICAgICBbZXRoVHhzLm1hcCh0ID0+IE9iamVjdC52YWx1ZXModCkpXVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBJc0NoZWNraW5nUnVubmluZyA9IGZhbHNlO1xuXG4gIH0gY2F0Y2ggKGVycil7XG4gICAgSXNDaGVja2luZ1J1bm5pbmcgPSBmYWxzZTtcbiAgICBhd2FpdCBsb2dJbmZvKCdlcnJvcicsICdOZXcgQ29udHJpYnV0aW9ucyBDaGVjayBFcnJvcicsIGVycilcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRQcmljZUZvclRyYW5zYWN0aW9uKHRyYW5zLCBsaXN0KSB7XG4gIGxldCB0cmFuc1RpbWUgPSBNYXRoLnJvdW5kKHRyYW5zLnJlY2VpdmVkX2RhdGUuZ2V0VGltZSgpLzEwMDApO1xuXG4gIHJldHVybiBsaXN0LmZpbmQoIChwcmljZSwgaWR4LCBwcmljZUxpc3QpID0+e1xuICAgIGxldCBjdXJyZW50UHJpY2VUaW1lID0gcHJpY2UudGltZTtcbiAgICBsZXQgaGFzTW9yZSA9IGlkeCA8IChwcmljZUxpc3QubGVuZ3RoIC0xKTtcbiAgICBsZXQgbmV4dFByaWNlVGltZSA9IGhhc01vcmUgPyBwcmljZUxpc3RbaWR4KzFdLnRpbWUgOiBudWxsO1xuICAgIGlmKHRyYW5zVGltZSA9PT0gY3VycmVudFByaWNlVGltZSB8fCB0cmFuc1RpbWUgPCBjdXJyZW50UHJpY2VUaW1lKXtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSBpZih0cmFuc1RpbWUgPiBjdXJyZW50UHJpY2VUaW1lKXtcbiAgICAgIGlmKG5leHRQcmljZVRpbWUpe1xuICAgICAgICByZXR1cm4gKCAobmV4dFByaWNlVGltZS10cmFuc1RpbWUpID4gKHRyYW5zVGltZS1jdXJyZW50UHJpY2VUaW1lKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gaWYgaGFzIG1vcmUgdHJ5IG5leHQgZWxzZSB1c2UgdGhlIGxhdGVzdCBwcmljZSB3ZSBjYW4gZ2V0XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbG9nSW5mbyh0eXBlLCBkZXNjcmlwdGlvbiwgZGF0YSkge1xuICB0cnkge1xuICAgIGF3YWl0IERiLnF1ZXJ5KGBJTlNFUlQgSU5UTyAke0xPR19UQUJMRX0gU0VUID9gLCB7dHlwZSwgZGVzY3JpcHRpb24sIGRhdGE6IEpTT04uc3RyaW5naWZ5KGRhdGEpIH0pO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBsb2coJ3MnLCAnZScsIGVycik7XG4gIH1cbn1cblxuc2V0SW50ZXJ2YWwobmV3Q29udHJpYnV0aW9uc0NoZWNrLCBDSEVDS0lOR19GUkVRVUVOQ1lfTVMpOyJdfQ==
