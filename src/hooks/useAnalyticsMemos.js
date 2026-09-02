import { useMemo } from 'react';
import { parseLogFile, isDarkpool } from '../parser';

/**
 * Module-level platform fee calculation utility
 */
export function getMonthPlatformFee(monthStr, settings) {
  if (!settings || !settings.enableMonthlyPlatformFee || !monthStr) return 0;
  const defaultFee = Number(settings.monthlyPlatformFee !== undefined ? settings.monthlyPlatformFee : 120);

  if (settings.platformFeeMonths && settings.platformFeeMonths[monthStr] !== undefined) {
    const val = settings.platformFeeMonths[monthStr];
    if (typeof val === 'boolean') {
      return val ? defaultFee : 0;
    }
    if (typeof val === 'number') {
      return val >= 0 ? val : 0;
    }
    if (typeof val === 'object' && val !== null) {
      if (!val.enabled) return 0;
      return Number(val.fee !== undefined ? val.fee : defaultFee);
    }
  }

  if (settings.platformFeeStartMonth) {
    return monthStr >= settings.platformFeeStartMonth ? defaultFee : 0;
  }

  return defaultFee;
}

export function useAnalyticsMemos({
  logs,
  sessionDate,
  settings,
  timezone,
  dashboardMonthFilter,
  selectedStockTicker,
  selectedHeatmapYear,
  heatmapActiveOnly
}) {
  const topTradesCount = settings?.journalTopTradesCount !== undefined ? settings.journalTopTradesCount : 2;

  // 1. Daily Stats Map
  const dailyStatsMap = useMemo(() => {
    const map = {};
    Object.keys(logs || {}).forEach(dateStr => {
      try {
        const analysis = parseLogFile(
          logs[dateStr],
          settings?.feePerShare,
          settings?.enableFees,
          settings?.dateFormat,
          timezone,
          topTradesCount
        );
        if (analysis) {
          map[dateStr] = analysis;
        }
      } catch (e) {
        console.error(`Error parsing log for ${dateStr}:`, e);
      }
    });
    return map;
  }, [logs, settings?.feePerShare, settings?.enableFees, settings?.dateFormat, timezone, topTradesCount]);

  // 2. Single Session Analytics
  const singleSessionAnalytics = useMemo(() => {
    if (!sessionDate || !logs || !logs[sessionDate]) return null;
    try {
      return parseLogFile(
        logs[sessionDate],
        settings?.feePerShare,
        settings?.enableFees,
        settings?.dateFormat,
        timezone,
        topTradesCount
      );
    } catch (e) {
      console.error("Error computing single session analytics:", e);
      return null;
    }
  }, [sessionDate, logs, settings?.feePerShare, settings?.enableFees, settings?.dateFormat, timezone, topTradesCount]);

  // 3. Available Months
  const availableMonths = useMemo(() => {
    const monthsSet = new Set();
    Object.keys(dailyStatsMap).forEach(d => {
      if (d.length >= 7) monthsSet.add(d.substring(0, 7));
    });
    return Array.from(monthsSet).sort().reverse();
  }, [dailyStatsMap]);

  // 4. Available Years
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    yearsSet.add(new Date().getFullYear());
    Object.keys(dailyStatsMap).forEach(d => {
      const y = parseInt(d.split('-')[0], 10);
      if (!isNaN(y)) yearsSet.add(y);
    });
    return Array.from(yearsSet).sort().reverse();
  }, [dailyStatsMap]);

  // 5. Filtered Dashboard Analytics
  const filteredDashboardAnalytics = useMemo(() => {
    const validDates = Object.keys(dailyStatsMap).filter(d => {
      if (dashboardMonthFilter === 'ALL') return true;
      return d.startsWith(dashboardMonthFilter);
    }).sort();

    let totalPnl = 0;
    let grossPnl = 0;
    let totalFees = 0;
    let totalTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalShares = 0;
    let roundTripShares = 0;
    let totalHoldTimeAcrossTrades = 0;
    let tradesCountForHoldTime = 0;
    let totalWinShares = 0;
    let totalLossShares = 0;
    let longTradesCount = 0;
    let shortTradesCount = 0;
    let longPnl = 0;
    let shortPnl = 0;

    const activeMonthsSet = new Set();
    const billedMonthsMap = new Map();
    const monthsFirstSeen = new Set();
    const equityCurve = [];
    let runningCumulative = 0;

    validDates.forEach(dateStr => {
      const day = dailyStatsMap[dateStr];
      if (!day) return;
      const monthKey = dateStr && dateStr.length >= 7 ? dateStr.substring(0, 7) : null;
      if (monthKey) {
        activeMonthsSet.add(monthKey);
        if (!billedMonthsMap.has(monthKey)) {
          const fee = getMonthPlatformFee(monthKey, settings);
          if (fee > 0) billedMonthsMap.set(monthKey, fee);
        }
      }

      const pnlVal = settings?.enableFees ? (day.netPnl ?? day.pnl) : (day.grossPnl ?? day.pnl);
      totalPnl += pnlVal || 0;
      grossPnl += (day.grossPnl !== undefined ? day.grossPnl : day.pnl) || 0;
      totalFees += day.fees || 0;
      totalTrades += day.totalOrders || 0;
      winningTrades += day.winningTrades || 0;
      losingTrades += day.losingTrades || 0;
      grossProfit += (day.grossProfit !== undefined ? day.grossProfit : (day.pnl > 0 ? day.pnl : 0)) || 0;
      grossLoss += (day.grossLoss !== undefined ? day.grossLoss : (day.pnl < 0 ? Math.abs(day.pnl) : 0)) || 0;
      totalShares += (day.totalVolume || (day.roundTripShares ? day.roundTripShares * 2 : 0)) || 0;
      roundTripShares += day.roundTripShares || 0;
      totalWinShares += day.winSharesTotal || 0;
      totalLossShares += day.lossSharesTotal || 0;

      if (day.longStats) {
        longTradesCount += day.longStats.count || 0;
        longPnl += day.longStats.pnl || 0;
      }
      if (day.shortStats) {
        shortTradesCount += day.shortStats.count || 0;
        shortPnl += day.shortStats.pnl || 0;
      }

      if (day.stockBreakdown) {
        day.stockBreakdown.forEach(s => {
          if (s.matchedTrades) {
            s.matchedTrades.forEach(t => {
              tradesCountForHoldTime++;
              totalHoldTimeAcrossTrades += (t.holdingSeconds || 0);
            });
          }
        });
      }

      let dayContribution = pnlVal;
      if (settings?.enableMonthlyPlatformFee && monthKey && !monthsFirstSeen.has(monthKey)) {
        monthsFirstSeen.add(monthKey);
        const feeToDeduct = getMonthPlatformFee(monthKey, settings);
        dayContribution -= feeToDeduct;
      }

      runningCumulative += dayContribution;
      equityCurve.push({
        date: dateStr,
        dayPnl: pnlVal,
        cumulativePnl: runningCumulative
      });
    });

    let totalPlatformFees = 0;
    billedMonthsMap.forEach(fee => { totalPlatformFees += fee; });

    const totalExecutionFees = settings?.enableFees ? totalFees : 0;
    const totalAllFees = totalExecutionFees + (settings?.enableMonthlyPlatformFee ? totalPlatformFees : 0);
    const finalNetPnl = grossPnl - totalAllFees;

    let maxDrawdown = 0;
    let runningPeak = 0;
    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let greenDaysCount = 0;
    let redDaysCount = 0;

    validDates.forEach(dateStr => {
      const day = dailyStatsMap[dateStr];
      if (!day) return;
      const pnlVal = settings?.enableFees ? (day.netPnl ?? day.pnl) : (day.grossPnl ?? day.pnl);

      if (pnlVal > 0) {
        greenDaysCount++;
        currentWinStreak++;
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      } else if (pnlVal < 0) {
        redDaysCount++;
        currentWinStreak = 0;
      }
    });

    equityCurve.forEach(pt => {
      if (pt.cumulativePnl > runningPeak) {
        runningPeak = pt.cumulativePnl;
      }
      const dd = runningPeak - pt.cumulativePnl;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }
    });

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99.99 : 0);
    const avgHoldTime = tradesCountForHoldTime > 0 ? totalHoldTimeAcrossTrades / tradesCountForHoldTime : 0;

    const displayNetPnl = (settings?.enableFees || settings?.enableMonthlyPlatformFee) ? finalNetPnl : grossPnl;
    const netCentsPerShare = roundTripShares > 0 ? (displayNetPnl / roundTripShares) * 100 : 0;
    const avgCentsPerWinShare = totalWinShares > 0
      ? (grossProfit / totalWinShares) * 100
      : (roundTripShares > 0 && winningTrades > 0 ? (grossProfit / (roundTripShares * (winningTrades / (totalTrades || 1)))) * 100 : 0);
    const avgCentsPerLossShare = totalLossShares > 0
      ? (grossLoss / totalLossShares) * 100
      : (roundTripShares > 0 && losingTrades > 0 ? (grossLoss / (roundTripShares * (losingTrades / (totalTrades || 1)))) * 100 : 0);
    const pnlPer1kShares = roundTripShares > 0 ? (displayNetPnl / roundTripShares) * 1000 : 0;
    const totalDirTrades = longTradesCount + shortTradesCount;

    return {
      totalPnl: displayNetPnl,
      grossPnl,
      totalFees: totalAllFees,
      totalExecutionFees,
      totalPlatformFees,
      billedMonthsCount: billedMonthsMap.size,
      activeMonthsCount: activeMonthsSet.size,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      profitFactor,
      totalShares,
      roundTripShares,
      avgHoldTime,
      netCentsPerShare,
      avgCentsPerWinShare: isNaN(avgCentsPerWinShare) ? 0 : avgCentsPerWinShare,
      avgCentsPerLossShare: isNaN(avgCentsPerLossShare) ? 0 : avgCentsPerLossShare,
      pnlPer1kShares,
      longTradesCount,
      shortTradesCount,
      longPnl,
      shortPnl,
      longRatio: totalDirTrades > 0 ? Math.round((longTradesCount / totalDirTrades) * 100) : 50,
      shortRatio: totalDirTrades > 0 ? Math.round((shortTradesCount / totalDirTrades) * 100) : 50,
      maxDrawdown,
      greenDaysCount,
      redDaysCount,
      currentWinStreak,
      maxWinStreak,
      equityCurve
    };
  }, [
    dailyStatsMap,
    dashboardMonthFilter,
    settings?.enableFees,
    settings?.enableMonthlyPlatformFee,
    settings?.monthlyPlatformFee,
    settings?.platformFeeMonths,
    settings?.platformFeeStartMonth
  ]);

  // 6. Overall Ticker & Hourly Stats
  const overallAnalytics = useMemo(() => {
    try {
      const stockMap = {};
      const hourMap = {};

      Object.keys(dailyStatsMap || {}).forEach(dateStr => {
        const day = dailyStatsMap[dateStr];
        if (!day) return;
        (day.stockBreakdown || []).forEach(s => {
          if (!stockMap[s.symbol]) {
            stockMap[s.symbol] = {
              symbol: s.symbol,
              pnl: 0,
              grossPnl: 0,
              netPnl: 0,
              tradesCount: 0,
              winningTrades: 0,
              volume: 0,
              roundTripShares: 0,
              totalHoldTime: 0,
              sessions: []
            };
          }
          const pnlVal = settings?.enableFees ? (s.netPnl ?? s.pnl) : s.pnl;
          stockMap[s.symbol].pnl += pnlVal;
          stockMap[s.symbol].grossPnl += s.pnl || 0;
          stockMap[s.symbol].netPnl += (s.netPnl ?? s.pnl) || 0;
          stockMap[s.symbol].tradesCount += s.tradesCount || 0;

          const stockWins = s.wins !== undefined
            ? s.wins
            : (s.winRate !== undefined
              ? Math.round((s.winRate / 100) * (s.tradesCount || 1))
              : ((s.pnl || 0) > 0 ? (s.tradesCount || 1) : 0));
          stockMap[s.symbol].winningTrades += stockWins;

          stockMap[s.symbol].volume += s.totalQty || 0;
          stockMap[s.symbol].roundTripShares += s.roundTripShares || 0;
          stockMap[s.symbol].totalHoldTime += (s.avgHoldTime || 0) * (s.tradesCount || 1);
          stockMap[s.symbol].sessions.push({
            date: dateStr,
            pnl: s.pnl || 0,
            netPnl: (s.netPnl ?? s.pnl) || 0,
            tradesCount: s.tradesCount || 0,
            totalQty: s.totalQty || 0,
            roundTripShares: s.roundTripShares || 0,
            avgBuyPrice: s.avgBuyPrice || 0,
            avgSellPrice: s.avgSellPrice || 0,
            avgHoldTime: s.avgHoldTime || 0
          });
        });

        const daySlots = day.stockTimeMatrix?.overallSlots || day.timeOfDayAnalytics || {};
        Object.keys(daySlots).forEach(slotKey => {
          const slot = daySlots[slotKey];
          if (!slot || !slot.tradesCount) return;
          if (!hourMap[slotKey]) {
            hourMap[slotKey] = {
              slotKey,
              hourLabel: slot.slotLabel || slot.hourLabel || slotKey,
              pnl: 0,
              netPnl: 0,
              tradesCount: 0,
              winningTrades: 0
            };
          }
          hourMap[slotKey].pnl += slot.pnl || 0;
          hourMap[slotKey].netPnl += slot.pnl || 0;
          hourMap[slotKey].tradesCount += slot.tradesCount || 0;
          hourMap[slotKey].winningTrades += (slot.wins !== undefined ? slot.wins : (slot.winningTrades || 0));
        });
      });

      const tickerStats = Object.values(stockMap).map(s => ({
        ...s,
        winRate: s.tradesCount > 0 ? (s.winningTrades / s.tradesCount) * 100 : 0,
        avgHoldTime: s.tradesCount > 0 ? s.totalHoldTime / s.tradesCount : 0,
        centsPerShare: s.roundTripShares > 0 ? (s.netPnl / s.roundTripShares) * 100 : 0
      })).sort((a, b) => b.pnl - a.pnl);

      const hourlyStats = Object.values(hourMap).map(h => ({
        ...h,
        winRate: h.tradesCount > 0 ? (h.winningTrades / h.tradesCount) * 100 : 0
      })).sort((a, b) => a.slotKey.localeCompare(b.slotKey));

      return { tickerStats: tickerStats || [], hourlyStats: hourlyStats || [] };
    } catch (e) {
      console.error("Error calculating overall analytics:", e);
      return { tickerStats: [], hourlyStats: [] };
    }
  }, [dailyStatsMap, settings?.enableFees]);

  const hourlyAnalytics = overallAnalytics?.hourlyStats || [];

  // 7. Selected Stock Personal History
  const selectedStockPersonalHistory = useMemo(() => {
    if (!selectedStockTicker) {
      return { totalPnl: 0, netPnl: 0, winRate: 0, totalShares: 0, tradesCount: 0, sessions: [] };
    }

    const sessions = [];
    let totalPnl = 0;
    let totalNetPnl = 0;
    let totalShares = 0;
    let totalTrades = 0;
    let wins = 0;

    Object.keys(dailyStatsMap || {}).sort().reverse().forEach(date => {
      const dayStats = dailyStatsMap[date];
      if (dayStats && dayStats.stockBreakdown) {
        const item = dayStats.stockBreakdown.find(s => s.symbol === selectedStockTicker);
        if (item) {
          totalPnl += item.pnl || 0;
          totalNetPnl += (item.netPnl ?? item.pnl) || 0;
          totalShares += item.totalQty || 0;
          totalTrades += item.tradesCount || 0;

          const winsInSession = item.matchedTrades && item.matchedTrades.length > 0
            ? item.matchedTrades.filter(t => (t.pnl || 0) > 0).length
            : (item.wins !== undefined
              ? item.wins
              : (item.winRate !== undefined
                ? Math.round((item.winRate / 100) * (item.tradesCount || 1))
                : ((item.pnl || 0) > 0 ? (item.tradesCount || 1) : 0)));
          wins += winsInSession;

          const buys = item.executions ? item.executions.filter(e => e.action === 'Bought') : [];
          const sells = item.executions ? item.executions.filter(e => e.action === 'Sold') : [];

          const avgBuyPrice = buys.length > 0 ? (buys.reduce((a, b) => a + (b.execPrice || 0) * (b.execQty || 0), 0) / (buys.reduce((a, b) => a + (b.execQty || 0), 0) || 1)) : (item.avgBuyPrice || 0);
          const avgSellPrice = sells.length > 0 ? (sells.reduce((a, b) => a + (b.execPrice || 0) * (b.execQty || 0), 0) / (sells.reduce((a, b) => a + (b.execQty || 0), 0) || 1)) : (item.avgSellPrice || 0);

          sessions.push({
            date,
            pnl: item.pnl || 0,
            netPnl: (item.netPnl ?? item.pnl) || 0,
            tradesCount: item.tradesCount || 0,
            totalQty: item.totalQty || 0,
            avgBuyPrice,
            avgSellPrice,
            avgHoldTime: item.avgHoldTime || 0
          });
        }
      }
    });

    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    return {
      totalPnl,
      netPnl: totalNetPnl,
      winRate,
      totalShares,
      tradesCount: totalTrades,
      sessions
    };
  }, [selectedStockTicker, dailyStatsMap]);

  // 8. Global ECN Analytics
  const globalECNAnalytics = useMemo(() => {
    let totalVolume = 0;
    let litVolume = 0;
    let darkpoolVolume = 0;
    const venueMap = {};
    const stockDarkpoolMap = {};

    Object.keys(dailyStatsMap).forEach(dateStr => {
      const day = dailyStatsMap[dateStr];
      (day.ecnBreakdown || []).forEach(e => {
        totalVolume += e.volume;
        if (e.isDarkpool) darkpoolVolume += e.volume;
        else litVolume += e.volume;

        if (!venueMap[e.route]) {
          venueMap[e.route] = {
            route: e.route,
            isDarkpool: e.isDarkpool,
            typeLabel: e.isDarkpool ? 'Darkpool' : 'ECN',
            volume: 0,
            fills: 0
          };
        }
        venueMap[e.route].volume += e.volume;
        venueMap[e.route].fills += e.fills;
      });

      (day.stockBreakdown || []).forEach(s => {
        if (s.darkpoolVolume > 0) {
          if (!stockDarkpoolMap[s.symbol]) {
            stockDarkpoolMap[s.symbol] = {
              symbol: s.symbol,
              darkpoolVolume: 0,
              entryDarkpools: new Set(),
              exitDarkpools: new Set()
            };
          }
          stockDarkpoolMap[s.symbol].darkpoolVolume += s.darkpoolVolume;
          (s.executions || []).forEach(ex => {
            if (ex.route && isDarkpool(ex.route)) {
              if (ex.action === 'Bought') stockDarkpoolMap[s.symbol].entryDarkpools.add(ex.route);
              else stockDarkpoolMap[s.symbol].exitDarkpools.add(ex.route);
            }
          });
        }
      });
    });

    const routeStats = Object.values(venueMap).map(v => ({
      ...v,
      pctVolume: totalVolume > 0 ? (v.volume / totalVolume) * 100 : 0
    })).sort((a, b) => b.volume - a.volume);

    const stockDarkpoolSummary = Object.values(stockDarkpoolMap).map(s => ({
      symbol: s.symbol,
      darkpoolVolume: s.darkpoolVolume,
      entryDarkpools: Array.from(s.entryDarkpools),
      exitDarkpools: Array.from(s.exitDarkpools)
    })).sort((a, b) => b.darkpoolVolume - a.darkpoolVolume);

    const litPct = totalVolume > 0 ? (litVolume / totalVolume) * 100 : 0;
    const darkpoolPct = totalVolume > 0 ? (darkpoolVolume / totalVolume) * 100 : 0;

    return {
      totalVolume,
      litVolume,
      darkpoolVolume,
      litPct,
      darkpoolPct,
      routeStats,
      stockDarkpoolSummary
    };
  }, [dailyStatsMap]);

  // 9. Calendar Heatmap Data
  const heatmapData = useMemo(() => {
    const year = selectedHeatmapYear || new Date().getFullYear();
    const monthNamesArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = monthNamesArr.map((name, monthIndex) => ({
      name: `${name} ${year}`,
      monthIndex
    }));

    const result = months.map(m => {
      const days = [];
      const daysInMonth = new Date(year, m.monthIndex + 1, 0).getDate();
      const startWeekday = new Date(year, m.monthIndex, 1).getDay();

      for (let i = 0; i < startWeekday; i++) {
        days.push({ dayNum: null, dateStr: null });
      }
      let hasData = false;
      for (let d = 1; d <= daysInMonth; d++) {
        const mm = (m.monthIndex + 1).toString().padStart(2, '0');
        const dd = d.toString().padStart(2, '0');
        const dateStr = `${year}-${mm}-${dd}`;
        if (dailyStatsMap[dateStr]) hasData = true;
        days.push({ dayNum: d, dateStr });
      }
      return { ...m, days, hasData };
    });

    return heatmapActiveOnly ? result.filter(m => m.hasData) : result;
  }, [dailyStatsMap, heatmapActiveOnly, selectedHeatmapYear]);

  // 10. Heatmap Day Color Utility
  const getHeatmapDayColor = (dateStr) => {
    if (!dateStr || !dailyStatsMap[dateStr]) return '#f3f4f6';
    const pnl = settings?.enableFees ? dailyStatsMap[dateStr].netPnl : dailyStatsMap[dateStr].pnl;
    if (pnl > 300) return '#059669';
    if (pnl > 100) return '#10b981';
    if (pnl > 0) return '#6ee7b7';
    if (pnl === 0) return '#e5e7eb';
    if (pnl > -100) return '#fda4af';
    if (pnl > -300) return '#f43f5e';
    return '#e11d48';
  };

  return {
    dailyStatsMap,
    singleSessionAnalytics,
    availableMonths,
    availableYears,
    filteredDashboardAnalytics,
    overallAnalytics,
    hourlyAnalytics,
    selectedStockPersonalHistory,
    globalECNAnalytics,
    heatmapData,
    getHeatmapDayColor
  };
}
