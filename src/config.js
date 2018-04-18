export default {
  mysql: {
    connectionLimit: 10,
    host: 'localhost',
    user: 'test',
    password: '',
    database : 'test',
    port: 3306
  },
  TXS_TABLE: 'eth_transactions',
  LOG_TABLE: 'logs',
  FAILED_TXS: 'failed_txs',
  ETH_WALLETS: [],
  CHECKING_FREQUENCY_MS: 7200000,
  ETHERSCAN_URL: 'https://api.etherscan.io/api',
  ETHERSCAN_KEY: '',
  CRYPTOCOMPARE: 'https://min-api.cryptocompare.com',
  BTC_PRICE_SOURCE: 'Bitstamp',
  ETH_PRICE_SOURCE: 'Coinbase',
}