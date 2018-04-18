import axios from 'axios';
import log from './lib/log';
import Db from './mysqlDB';
import config from './config';

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
} = config;

let IsCheckingRunning = false;

async function getNewEthContributions(walletAddr) {
  let filteredEthTransactions = [];
  let failedTxs = [];
  try{
    let ethTransactionsReq = await axios.get(`${ETHERSCAN_URL}?module=account&action=txlist&address=${walletAddr}&startblock=0&endblock=99999999&apikey=${ETHERSCAN_KEY}&sort=desc`);

    if(ethTransactionsReq.data && ethTransactionsReq.data.result && Array.isArray(ethTransactionsReq.data.result) && ethTransactionsReq.data.result.length){
      const ethTransactions = ethTransactionsReq.data.result;

      for(let i =0; i < ethTransactions.length; i++){
        let t = ethTransactions[i];

        // check if transaction is an input to dacsee wallet
        if(t.to.toLowerCase() !== walletAddr.toLowerCase()) continue;


        // check if transaction was already added to DB
        let transExist = await Db.query(`Select * From ${TXS_TABLE} Where txHash=?`,[t.hash]);

        if(Array.isArray(transExist) && transExist.length) continue;

        if(t.isError === '1'){
          failedTxs.push({
            txHash: t.hash,
            received_date: new Date(t.timeStamp*1000),
            received_from: t.from,
            value: t.value / Math.pow(10,18),
            destinationAddress: walletAddr
          });
          continue
        }

        filteredEthTransactions.push({
          txHash: t.hash,
          received_date: new Date(t.timeStamp*1000),
          received_from: t.from,
          value: t.value / Math.pow(10,18),
          destinationAddress: walletAddr
        })
      }

      if(failedTxs.length){
        try {
          await Db.query(`INSERT INTO ${FAILED_TXS} (txHash, received_date, received_from, value, destinationAddress) VALUES ?`,
          [failedTxs.map(t => Object.values(t))]
        )
        } catch (err){
          await logInfo('error', 'Failed Txs insert Error', err)
        }
      }

    }

    return filteredEthTransactions;
  } catch (err){
    await logInfo('error', `getNewEthContributions`, err);
  }
}

async function getPriceList(minTimestamp, coin) {

  let list = [];
  let e = coin === 'BTC' ? BTC_PRICE_SOURCE : ETH_PRICE_SOURCE;
  try{
    let listReq = await axios.get(`${CRYPTOCOMPARE}/data/histohour?fsym=${coin}&tsym=USD&e=${e}&limit=1000&toTs=${minTimestamp}`)

    if(listReq.data && listReq.data.Response === 'Success' && Array.isArray(listReq.data.Data) && listReq.data.Data.length){
      list = listReq.data.Data;
    }

  } catch (err){
    await logInfo('error', 'getPriceList', err);
    
  }

  return list;
}

async function newContributionsCheck() {
  try{
    if(IsCheckingRunning) return;
    IsCheckingRunning = true;
    await logInfo("info",`newContributionsCheck started @${new Date()}`);
    let ethTxs = [];

    for (let i =0; i < ETH_WALLETS.length; i++) {
      ethTxs = [...ethTxs , ...await getNewEthContributions(ETH_WALLETS[i])];
    }

    if(ethTxs.length){
      let ethTimeStamps = ethTxs.map(t => t.received_date.getTime());
      let minEthTimeStamp =  Math.min(...ethTimeStamps);


      let ethPrices = await getPriceList(minEthTimeStamp, 'ETH');

      if(!ethPrices || !ethPrices.length) {
        IsCheckingRunning = false;
        return;
      }

      for(let j=0; j < ethTxs.length; j++){
        let trans = ethTxs[j];

        let priceAtTransTime = getPriceForTransaction(trans, ethPrices);
        trans.price = priceAtTransTime
        ? JSON.stringify(Object.assign({},priceAtTransTime,{date:new Date(priceAtTransTime.time*1000)}))
        : null;
        
      }

      const result = await Db.query(
        `INSERT INTO ${TXS_TABLE} (txHash, received_date, received_from, value, destinationAddress, price) VALUES ?`,
        [ethTxs.map(t => Object.values(t))]
      );
    }

    IsCheckingRunning = false;

  } catch (err){
    IsCheckingRunning = false;
    await logInfo('error', 'New Contributions Check Error', err)
  }
}

function getPriceForTransaction(trans, list) {
  let transTime = Math.round(trans.received_date.getTime()/1000);

  return list.find( (price, idx, priceList) =>{
    let currentPriceTime = price.time;
    let hasMore = idx < (priceList.length -1);
    let nextPriceTime = hasMore ? priceList[idx+1].time : null;
    if(transTime === currentPriceTime || transTime < currentPriceTime){
      return true;
    } else if(transTime > currentPriceTime){
      if(nextPriceTime){
        return ( (nextPriceTime-transTime) > (transTime-currentPriceTime));
      } else {
        return true; // if has more try next else use the latest price we can get
      }
    }
  });
}

async function logInfo(type, description, data) {
  try {
    await Db.query(`INSERT INTO ${LOG_TABLE} SET ?`, {type, description, data: JSON.stringify(data) });
  } catch (err) {
    log('s', 'e', err);
  }
}

setInterval(newContributionsCheck, CHECKING_FREQUENCY_MS);