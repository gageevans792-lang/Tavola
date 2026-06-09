// Static historical annual return dataset (%) — real approximate ETF performance 2010–2024
// Used by the backtest engine to avoid dependency on live Alpaca historical bar data.

export type EtfSymbol = 'VTI' | 'QQQ' | 'BND' | 'GLD' | 'VEA' | 'VWO' | 'SPY';

export const ANNUAL_RETURNS: Record<EtfSymbol, Record<number, number>> = {
  VTI: { 2010:17.3, 2011:1.1,  2012:16.4, 2013:33.5, 2014:12.6, 2015:0.4,  2016:12.7, 2017:21.2, 2018:-5.2,  2019:30.7, 2020:21.0, 2021:25.7, 2022:-19.5, 2023:26.1, 2024:23.8 },
  QQQ: { 2010:19.9, 2011:3.0,  2012:18.1, 2013:36.6, 2014:19.0, 2015:9.4,  2016:6.9,  2017:32.7, 2018:-0.1,  2019:39.0, 2020:48.6, 2021:27.4, 2022:-32.6, 2023:54.9, 2024:25.6 },
  BND: { 2010:6.4,  2011:7.7,  2012:4.2,  2013:-2.0, 2014:5.9,  2015:0.4,  2016:2.6,  2017:3.5,  2018:-0.1,  2019:8.7,  2020:7.7,  2021:-1.7, 2022:-13.1, 2023:5.5,  2024:1.8  },
  GLD: { 2010:29.5, 2011:10.2, 2012:7.0,  2013:-28.3,2014:-1.5, 2015:-10.4,2016:8.6,  2017:13.1, 2018:-1.9,  2019:18.3, 2020:25.1, 2021:-3.6, 2022:-0.8,  2023:13.1, 2024:26.8 },
  VEA: { 2010:7.8,  2011:-12.1,2012:17.7, 2013:22.8, 2014:-5.1, 2015:-0.8, 2016:2.2,  2017:27.2, 2018:-14.7, 2019:22.0, 2020:10.6, 2021:11.3, 2022:-14.5, 2023:18.2, 2024:4.8  },
  VWO: { 2010:19.2, 2011:-18.4,2012:18.6, 2013:-5.0, 2014:-3.9, 2015:-14.9,2016:11.6, 2017:31.7, 2018:-14.6, 2019:18.4, 2020:15.8, 2021:-2.7, 2022:-17.9, 2023:9.8,  2024:7.4  },
  SPY: { 2010:15.1, 2011:2.1,  2012:16.0, 2013:32.4, 2014:13.7, 2015:1.4,  2016:12.0, 2017:21.8, 2018:-4.4,  2019:31.5, 2020:18.4, 2021:28.7, 2022:-18.2, 2023:26.3, 2024:25.0 },
};

export interface CrisisData {
  event: string;
  period: string;
  sp500_return: number;
  etf_returns: Partial<Record<EtfSymbol, number>>;
}

// Static crisis events (sub-annual periods with known extreme returns)
export const STATIC_CRISES: CrisisData[] = [
  {
    event: '2008 Financial Crisis',
    period: 'Oct 2007 – Mar 2009',
    sp500_return: -37.0,
    etf_returns: { VTI: -30, QQQ: -33, BND: 5, GLD: 5, VEA: -45, VWO: -53, SPY: -37 },
  },
  {
    event: 'COVID-19 Crash',
    period: 'Feb – Apr 2020',
    sp500_return: -34.0,
    etf_returns: { VTI: -31, QQQ: -19, BND: 3, GLD: 4, VEA: -30, VWO: -25, SPY: -34 },
  },
];

// Returns the list of years to simulate for a given period key
export function getYears(period: string): number[] {
  switch (period) {
    case '5Y':        return [2019, 2020, 2021, 2022, 2023, 2024];
    case '10Y':       return [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
    case '15Y':
    case 'since2008': return [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
    default:          return [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  }
}
