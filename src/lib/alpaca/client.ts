import Alpaca from '@alpacahq/alpaca-trade-api';

export const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY!,
  secretKey: process.env.ALPACA_SECRET_KEY!,
  paper: process.env.ALPACA_PAPER === 'true',
});
