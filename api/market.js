
const config = require('./config');
const { createLogger } = require('./logger');
const log = createLogger('core/market');

const { marketDataDb } = require('./database');

async function getTokenPrice(coinstatsId, coinstatsSymbol) {
  if (!('apiKey' in config.market) || !config.market.apiKey.length) {
    return [];
  }

  // Get price from DB if it is not older than 8 hours.
  const lastPrice = marketDataDb.getPriceBySymbol(coinstatsSymbol);
  if (lastPrice) {
    const lastPriceAt = new Date(lastPrice.requested_at).valueOf(); 
    const eightHrsAgo = (new Date().valueOf()) - (8 * 60 * 60 * 1000);

    if (lastPriceAt >= eightHrsAgo) {
      return parseFloat(lastPrice.token_price_eur);
    }
  }

  try {
    const endpointUrl = config.market.apiUrl + '/coins';
    const params = [
      'currency=EUR',
      'symbol=' + coinstatsSymbol,
      'coinIds=' + coinstatsId,
    ];
    if (coinstatsId !== 'solana') params.push('blockchains=solana');

    log.info("Requesting price info from CoinStats API: ", {params});

    const response = await fetch(endpointUrl + '?' + params.join('&'), {
      headers: { 'X-API-KEY': config.market.apiKey },
    });

    if (!response.ok) {
      throw new Error(`Error requesting market data: ${response.text()}`);
    }

    const data = await response.json();
    if (!data || !data.result || !data.result.length) {
      throw new Error(`No data returned by API for ${coinstatsSymbol}:${coinstatsId}`);
    }

    const row = data.result[0];
    const insertedRow = marketDataDb.createEntry({
      tokenSymbol: row.symbol,
      tokenPrice: row.price.toFixed(2),
    });

    return parseFloat(row.price.toFixed(2));
  } catch(error) {
    log.error('Error getting market data:', { error: error.message });

    // fallback to DB price if API errored and we have DB data.
    if (lastPrice) {
      log.info("Fallback to lastPrice from DB: ", {time: new Date(lastPrice.requested_at).toISOString()});
      return parseFloat(lastPrice.token_price_eur);
    }

    throw error;
  }
}

module.exports = {
  getTokenPrice
};