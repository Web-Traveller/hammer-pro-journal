import { describe, it, expect } from 'vitest';
import {
  matchTradesFIFOWithOpenPos,
  compileStockTimeMatrix,
  compileHourlyAnalytics,
  compileSingleDayAnalytics,
  isDarkpool
} from '../src/parser.js';
import { createUSMarketDate } from '../src/services/timeService.js';

describe('Level 2 Tape Scalper Financial Math Engine', () => {

  describe('1. FIFO Trade Matching & Mathematical Precision', () => {
    it('correctly matches a simple long trade with exact P&L', () => {
      const execs = [
        { symbol: 'NVDA', action: 'Bought', execQty: 100, execPrice: 120.50, dateObj: createUSMarketDate('2026-09-04', '09:31:00'), route: 'ARCA', orderDesc: '' },
        { symbol: 'NVDA', action: 'Sold', execQty: 100, execPrice: 121.75, dateObj: createUSMarketDate('2026-09-04', '09:31:45'), route: 'ARCA', orderDesc: '' }
      ];

      const { completedTrades, openPositionsSummary } = matchTradesFIFOWithOpenPos(execs);
      expect(completedTrades.length).toBe(1);
      expect(openPositionsSummary.length).toBe(0);
      expect(completedTrades[0].symbol).toBe('NVDA');
      expect(completedTrades[0].side).toBe('B');
      expect(completedTrades[0].qty).toBe(100);
      expect(completedTrades[0].pnl).toBe(125.00); // (121.75 - 120.50) * 100
      expect(completedTrades[0].holdingSeconds).toBe(45);
    });

    it('correctly matches a short scalp with exact profit calculation', () => {
      const execs = [
        { symbol: 'TSLA', action: 'Sold', execQty: 200, execPrice: 220.00, dateObj: createUSMarketDate('2026-09-04', '10:00:00'), route: 'NSDQ', orderDesc: '' },
        { symbol: 'TSLA', action: 'Bought', execQty: 200, execPrice: 218.80, dateObj: createUSMarketDate('2026-09-04', '10:00:15'), route: 'NSDQ', orderDesc: '' }
      ];

      const { completedTrades } = matchTradesFIFOWithOpenPos(execs);
      expect(completedTrades.length).toBe(1);
      expect(completedTrades[0].side).toBe('S');
      expect(completedTrades[0].pnl).toBe(240.00); // (220.00 - 218.80) * 200
      expect(completedTrades[0].holdingSeconds).toBe(15);
    });

    it('handles multiple scale-ins and scale-outs with partial fills accurately without decimal drift', () => {
      const execs = [
        { symbol: 'AAPL', action: 'Bought', execQty: 100, execPrice: 150.10, dateObj: createUSMarketDate('2026-09-04', '09:35:00'), route: 'ARCA', orderDesc: '' },
        { symbol: 'AAPL', action: 'Bought', execQty: 100, execPrice: 150.30, dateObj: createUSMarketDate('2026-09-04', '09:35:10'), route: 'ARCA', orderDesc: '' },
        // Sell 150 shares (covers 100 @ 150.10, and 50 @ 150.30)
        { symbol: 'AAPL', action: 'Sold', execQty: 150, execPrice: 150.80, dateObj: createUSMarketDate('2026-09-04', '09:35:30'), route: 'ARCA', orderDesc: '' },
        // Sell final 50 shares
        { symbol: 'AAPL', action: 'Sold', execQty: 50, execPrice: 151.00, dateObj: createUSMarketDate('2026-09-04', '09:36:00'), route: 'ARCA', orderDesc: '' }
      ];

      const { completedTrades, openPositionsSummary } = matchTradesFIFOWithOpenPos(execs);
      expect(completedTrades.length).toBe(3);
      expect(openPositionsSummary.length).toBe(0);

      // Trade 1: 100 shares bought @ 150.10, sold @ 150.80 -> PnL = +$70.00
      expect(completedTrades[0].qty).toBe(100);
      expect(completedTrades[0].pnl).toBe(70.00);

      // Trade 2: 50 shares bought @ 150.30, sold @ 150.80 -> PnL = +$25.00
      expect(completedTrades[1].qty).toBe(50);
      expect(completedTrades[1].pnl).toBe(25.00);

      // Trade 3: 50 shares bought @ 150.30, sold @ 151.00 -> PnL = +$35.00
      expect(completedTrades[2].qty).toBe(50);
      expect(completedTrades[2].pnl).toBe(35.00);

      const totalPnL = completedTrades.reduce((acc, t) => acc + t.pnl, 0);
      expect(totalPnL).toBe(130.00);
    });

    it('correctly reports remaining open positions at end of day', () => {
      const execs = [
        { symbol: 'AMD', action: 'Bought', execQty: 300, execPrice: 140.00, dateObj: createUSMarketDate('2026-09-04', '15:58:00'), route: 'ARCA', orderDesc: '' },
        { symbol: 'AMD', action: 'Sold', execQty: 100, execPrice: 141.00, dateObj: createUSMarketDate('2026-09-04', '15:59:00'), route: 'ARCA', orderDesc: '' }
      ];

      const { completedTrades, openPositionsSummary } = matchTradesFIFOWithOpenPos(execs);
      expect(completedTrades.length).toBe(1);
      expect(completedTrades[0].qty).toBe(100);
      expect(completedTrades[0].pnl).toBe(100.00);

      expect(openPositionsSummary.length).toBe(1);
      expect(openPositionsSummary[0].symbol).toBe('AMD');
      expect(openPositionsSummary[0].side).toBe('B');
      expect(openPositionsSummary[0].qty).toBe(200);
      expect(openPositionsSummary[0].avgPrice).toBe(140.00);
    });
  });

  describe('2. Tape Scalper Hold Time Speed Categorization', () => {
    it('accurately buckets sub-10 second hyper scalps and momentum scalps', () => {
      const execs = [
        // 5 second Hyper Scalp
        { symbol: 'NVDA', action: 'Bought', execQty: 100, execPrice: 120.00, dateObj: createUSMarketDate('2026-09-04', '09:31:00'), route: 'ARCA', orderDesc: '' },
        { symbol: 'NVDA', action: 'Sold', execQty: 100, execPrice: 120.25, dateObj: createUSMarketDate('2026-09-04', '09:31:05'), route: 'ARCA', orderDesc: '' },
        // 25 second Quick Scalp
        { symbol: 'AMD', action: 'Bought', execQty: 100, execPrice: 140.00, dateObj: createUSMarketDate('2026-09-04', '09:32:00'), route: 'NSDQ', orderDesc: '' },
        { symbol: 'AMD', action: 'Sold', execQty: 100, execPrice: 140.50, dateObj: createUSMarketDate('2026-09-04', '09:32:25'), route: 'NSDQ', orderDesc: '' },
        // 90 second Momentum Scalp
        { symbol: 'TSLA', action: 'Bought', execQty: 50, execPrice: 200.00, dateObj: createUSMarketDate('2026-09-04', '09:35:00'), route: 'ARCA', orderDesc: '' },
        { symbol: 'TSLA', action: 'Sold', execQty: 50, execPrice: 201.00, dateObj: createUSMarketDate('2026-09-04', '09:36:30'), route: 'ARCA', orderDesc: '' }
      ];

      const dayStats = compileSingleDayAnalytics(execs, 0.05, true, 'US_EASTERN', 2);
      expect(dayStats.holdTimeBuckets.hyperScalp.count).toBe(1);
      expect(dayStats.holdTimeBuckets.hyperScalp.pnl).toBe(25.00);

      expect(dayStats.holdTimeBuckets.quickScalp.count).toBe(1);
      expect(dayStats.holdTimeBuckets.quickScalp.pnl).toBe(50.00);

      expect(dayStats.holdTimeBuckets.momentum.count).toBe(1);
      expect(dayStats.holdTimeBuckets.momentum.pnl).toBe(50.00);
    });
  });

  describe('3. Extended Hours (Premarket & Postmarket) Bucketing', () => {
    it('maintains exactly 8 core slots for pure regular hours sessions (zero bloat)', () => {
      const rthExecs = [
        { symbol: 'AAPL', action: 'Bought', execQty: 100, execPrice: 150.0, dateObj: createUSMarketDate('2026-09-04', '09:35:00'), route: 'ARCA', orderDesc: '' },
        { symbol: 'AAPL', action: 'Sold', execQty: 100, execPrice: 151.0, dateObj: createUSMarketDate('2026-09-04', '09:40:00'), route: 'ARCA', orderDesc: '' },
        { symbol: 'TSLA', action: 'Bought', execQty: 50, execPrice: 200.0, dateObj: createUSMarketDate('2026-09-04', '14:15:00'), route: 'NSDQ', orderDesc: '' },
        { symbol: 'TSLA', action: 'Sold', execQty: 50, execPrice: 202.0, dateObj: createUSMarketDate('2026-09-04', '14:20:00'), route: 'NSDQ', orderDesc: '' }
      ];

      const res = compileStockTimeMatrix(rthExecs, 0.05, true, 'US_EASTERN');
      expect(res.timeSlots.length).toBe(8);
      expect(res.timeSlots[0]).toBe('09:30-10:00');
      expect(res.timeSlots[7]).toBe('15:00-16:00');

      const day = compileSingleDayAnalytics(rthExecs, 0.05, true, 'US_EASTERN', 2);
      expect(day.sessionPhases.hasExtendedHours).toBe(false);
    });

    it('dynamically prepends premarket slots and appends postmarket slots only when active', () => {
      const extendedExecs = [
        // Premarket 07:15 AM
        { symbol: 'NVDA', action: 'Bought', execQty: 200, execPrice: 120.0, dateObj: createUSMarketDate('2026-09-04', '07:15:00'), route: 'ARCA', orderDesc: '' },
        { symbol: 'NVDA', action: 'Sold', execQty: 200, execPrice: 121.5, dateObj: createUSMarketDate('2026-09-04', '07:25:00'), route: 'ARCA', orderDesc: '' },
        // Premarket 08:45 AM
        { symbol: 'AMD', action: 'Bought', execQty: 100, execPrice: 140.0, dateObj: createUSMarketDate('2026-09-04', '08:45:00'), route: 'NSDQ', orderDesc: '' },
        { symbol: 'AMD', action: 'Sold', execQty: 100, execPrice: 142.0, dateObj: createUSMarketDate('2026-09-04', '08:50:00'), route: 'NSDQ', orderDesc: '' },
        // Regular 10:15 AM
        { symbol: 'AAPL', action: 'Bought', execQty: 100, execPrice: 150.0, dateObj: createUSMarketDate('2026-09-04', '10:15:00'), route: 'ARCA', orderDesc: '' },
        { symbol: 'AAPL', action: 'Sold', execQty: 100, execPrice: 151.0, dateObj: createUSMarketDate('2026-09-04', '10:20:00'), route: 'ARCA', orderDesc: '' },
        // Postmarket 16:35 PM
        { symbol: 'META', action: 'Bought', execQty: 50, execPrice: 500.0, dateObj: createUSMarketDate('2026-09-04', '16:35:00'), route: 'EDGX', orderDesc: '' },
        { symbol: 'META', action: 'Sold', execQty: 50, execPrice: 505.0, dateObj: createUSMarketDate('2026-09-04', '16:45:00'), route: 'EDGX', orderDesc: '' }
      ];

      const res = compileStockTimeMatrix(extendedExecs, 0.05, true, 'US_EASTERN');
      // Should contain 8 core slots + '07:00-08:00' + '08:00-09:00' + '16:00-17:00' = 11 slots
      expect(res.timeSlots.length).toBe(11);
      expect(res.timeSlots).toContain('07:00-08:00');
      expect(res.timeSlots).toContain('08:00-09:00');
      expect(res.timeSlots).toContain('16:00-17:00');
      // Unused extended slots must NOT be included:
      expect(res.timeSlots).not.toContain('04:00-07:00');
      expect(res.timeSlots).not.toContain('17:00-18:00');
      expect(res.timeSlots).not.toContain('18:00-20:00');

      const hourly = compileHourlyAnalytics(extendedExecs, 0.05, true, 'US_EASTERN');
      expect(hourly.length).toBe(11);
      expect(hourly[0].slotKey).toBe('07:00-08:00');
      expect(hourly[10].slotKey).toBe('16:00-17:00');
    });

    it('accurately computes sessionPhases breakdown for Premarket, RTH, and After-Hours', () => {
      const extendedExecs = [
        // Premarket 07:15 AM
        { symbol: 'NVDA', action: 'Bought', execQty: 200, execPrice: 120.0, dateObj: createUSMarketDate('2026-09-04', '07:15:00'), route: 'ARCA', orderDesc: '' },
        { symbol: 'NVDA', action: 'Sold', execQty: 200, execPrice: 121.5, dateObj: createUSMarketDate('2026-09-04', '07:25:00'), route: 'ARCA', orderDesc: '' },
        // Regular 10:15 AM
        { symbol: 'AAPL', action: 'Bought', execQty: 100, execPrice: 150.0, dateObj: createUSMarketDate('2026-09-04', '10:15:00'), route: 'ARCA', orderDesc: '' },
        { symbol: 'AAPL', action: 'Sold', execQty: 100, execPrice: 151.0, dateObj: createUSMarketDate('2026-09-04', '10:20:00'), route: 'ARCA', orderDesc: '' },
        // Postmarket 16:35 PM
        { symbol: 'META', action: 'Bought', execQty: 50, execPrice: 500.0, dateObj: createUSMarketDate('2026-09-04', '16:35:00'), route: 'EDGX', orderDesc: '' },
        { symbol: 'META', action: 'Sold', execQty: 50, execPrice: 505.0, dateObj: createUSMarketDate('2026-09-04', '16:45:00'), route: 'EDGX', orderDesc: '' }
      ];

      const day = compileSingleDayAnalytics(extendedExecs, 0.05, true, 'US_EASTERN', 2);
      expect(day.sessionPhases.hasExtendedHours).toBe(true);
      expect(day.sessionPhases.premarket.tradesCount).toBe(1);
      expect(day.sessionPhases.premarket.volume).toBe(200);
      expect(day.sessionPhases.premarket.pnl).toBe(290.00); // Gross 300 - fees (200 * 0.05) = 290

      expect(day.sessionPhases.regular.tradesCount).toBe(1);
      expect(day.sessionPhases.regular.volume).toBe(100);
      expect(day.sessionPhases.regular.pnl).toBe(95.00); // Gross 100 - fees (100 * 0.05) = 95

      expect(day.sessionPhases.postmarket.tradesCount).toBe(1);
      expect(day.sessionPhases.postmarket.volume).toBe(50);
      expect(day.sessionPhases.postmarket.pnl).toBe(247.50); // Gross 250 - fees (50 * 0.05) = 247.5
    });

    it('formats IST timezone labels accurately with [PRE] and [POST] badges', () => {
      const execs = [
        { symbol: 'NVDA', action: 'Bought', execQty: 100, execPrice: 120.0, dateObj: createUSMarketDate('2026-09-04', '07:15:00'), route: 'ARCA', orderDesc: '' },
        { symbol: 'NVDA', action: 'Sold', execQty: 100, execPrice: 121.0, dateObj: createUSMarketDate('2026-09-04', '07:25:00'), route: 'ARCA', orderDesc: '' }
      ];

      const res = compileStockTimeMatrix(execs, 0.05, true, 'INDIA_IST');
      expect(res.slotLabels['07:00-08:00']).toContain('(IST) [PRE]');
      expect(res.slotLabels['16:00-17:00']).toContain('(IST) [POST]');
    });
  });

  describe('4. ECN vs Darkpool Route Detection', () => {
    it('accurately identifies lit vs dark routes', () => {
      expect(isDarkpool('ARCA')).toBe(false);
      expect(isDarkpool('NSDQ')).toBe(false);
      expect(isDarkpool('BATS')).toBe(false);
      expect(isDarkpool('EDGX')).toBe(false);

      expect(isDarkpool('DARK')).toBe(true);
      expect(isDarkpool('ADF')).toBe(true);
      expect(isDarkpool('FINRA')).toBe(true);
      expect(isDarkpool('TRF')).toBe(true);
      expect(isDarkpool('DPOOL')).toBe(true);
    });
  });
});
