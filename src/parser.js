// JS parser, FIFO matching engine, trade-by-trade intraday equity curve, and Darkpool vs ECN analytics

export class Position {
    constructor(symbol, side) {
        this.symbol = symbol;
        this.side = side; // 'B' (Long) or 'S' (Short)
        this.inventory = []; // Array of { time, price, qty, route }
    }
}

export const LIT_ECNS = new Set([
    'NSDQ', 'ARCA', 'EDGX', 'EDGA', 'NYSE', 'NSX', 'IEXG', 'CHX', 'NQPX', 'LTSE', 'MEMX', 'MIAX', 'AMEX', 'BATS', 'BATY', 'BOSX', 'STOP', 'NQBX'
]);

export function isDarkpool(route) {
    if (!route || route === 'DIRECT') return false;
    const r = route.toUpperCase();
    return !LIT_ECNS.has(r);
}

export function parseTime(timeStr) {
    const m = timeStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{2,4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) {
        const m2 = timeStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{2,4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
        if (!m2) {
            throw new Error("Could not parse time: " + timeStr);
        }
        let [_, month, day, year, hour, minute, second] = m2;
        month = parseInt(month, 10);
        day = parseInt(day, 10);
        year = parseInt(year, 10);
        if (year < 100) year += 2000;
        hour = parseInt(hour, 10);
        minute = parseInt(minute, 10);
        second = parseInt(second, 10);
        return new Date(year, month - 1, day, hour, minute, second);
    }
    let [_, month, day, year, hour, minute, second, ampm] = m;
    month = parseInt(month, 10);
    day = parseInt(day, 10);
    year = parseInt(year, 10);
    if (year < 100) year += 2000;
    hour = parseInt(hour, 10);
    minute = parseInt(minute, 10);
    second = parseInt(second, 10);
    
    if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
        if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    }
    
    return new Date(year, month - 1, day, hour, minute, second);
}

export function formatTimeLabel(dateObj) {
    const hours = dateObj.getHours();
    const mins = dateObj.getMinutes().toString().padStart(2, '0');
    const secs = dateObj.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHour = (hours % 12 || 12).toString().padStart(2, '0');
    return `${formattedHour}:${mins}:${secs} ${ampm}`;
}

export function parseLogLine(line) {
    const parts = line.split('\t');
    if (parts.length < 4) return null;
    const [timestamp, symbol, status, desc] = parts;
    
    const descParts = desc.split(' : ');
    const execDesc = descParts[0];
    const orderDesc = descParts.length > 1 ? descParts[1] : "";
    
    const mExec = execDesc.match(/^(Sold|Bought)\s+(\S+)\s+(\d+)\s+@\s+([\d\.]+)/);
    if (!mExec) return null;
    
    const [_, action, execSymbol, qtyStr, priceStr] = mExec;
    const execQty = parseInt(qtyStr, 10);
    const execPrice = parseFloat(priceStr);
    
    // Extract ECN Route (e.g. "Route to NSDQ Hidden", "Route to SIGMAX Hidden")
    const mRoute = desc.match(/Route\s+to\s+([A-Z0-9]+)/i);
    let route = mRoute ? mRoute[1].toUpperCase() : 'DIRECT';
    
    // Route Aliasing Normalization
    if (route === 'STOP') route = 'BATS';
    if (route === 'NQBX') route = 'BOSX';
    
    const mOrder = orderDesc.match(/^(SHORT|BUY|SELL)\s+(\d+)\s+(\S+)/);
    let orderSide, orderQty;
    if (mOrder) {
        const [__, sideStr, orderQtyStr, orderSymbol] = mOrder;
        orderSide = sideStr;
        orderQty = parseInt(orderQtyStr, 10);
    } else {
        orderSide = action === 'Bought' ? 'BUY' : 'SELL';
        orderQty = execQty;
    }
    
    return {
        timestamp,
        symbol,
        status,
        action,
        execQty,
        execPrice,
        orderSide,
        orderQty,
        orderDesc,
        route
    };
}

export function extractExecutions(rawText) {
    if (!rawText) return [];
    const lines = rawText.split('\n');
    const executions = [];
    for (let line of lines) {
        if (!line.trim()) continue;
        if (/^\d{2}\/\d{2}\/\d{2}/.test(line.trim())) {
            try {
                const parsed = parseLogLine(line.trim());
                if (parsed) {
                    executions.push(parsed);
                }
            } catch (e) {
                console.error("Error parsing line: " + line, e);
            }
        }
    }
    return executions;
}

export function matchTradesFIFO(executions) {
    const openPositions = {};
    const completedTrades = [];
    
    const sortedExecs = [...executions].sort((a, b) => {
        return parseTime(a.timestamp) - parseTime(b.timestamp);
    });

    for (let exec of sortedExecs) {
        const symbol = exec.symbol;
        const execSide = exec.action === 'Bought' ? 'B' : 'S';
        const execTime = parseTime(exec.timestamp);
        
        if (!openPositions[symbol] || openPositions[symbol].side === null) {
            const pos = new Position(symbol, execSide);
            pos.inventory.push({
                time: execTime,
                price: exec.execPrice,
                qty: exec.execQty,
                route: exec.route
            });
            openPositions[symbol] = pos;
        } else {
            const pos = openPositions[symbol];
            if (pos.side === execSide) {
                pos.inventory.push({
                    time: execTime,
                    price: exec.execPrice,
                    qty: exec.execQty,
                    route: exec.route
                });
            } else {
                let remainingQty = exec.execQty;
                
                while (remainingQty > 0 && pos.inventory.length > 0) {
                    const first = pos.inventory[0];
                    const matchQty = Math.min(remainingQty, first.qty);
                    
                    let tradePnl = 0;
                    if (pos.side === 'B') {
                        tradePnl = (exec.execPrice - first.price) * matchQty;
                    } else {
                        tradePnl = (first.price - exec.execPrice) * matchQty;
                    }
                    
                    const entryTime = first.time;
                    const exitTime = execTime;
                    const holdingSeconds = Math.max(0, (exitTime - entryTime) / 1000);
                    
                    completedTrades.push({
                        symbol: symbol,
                        side: pos.side,
                        qty: matchQty,
                        entryPrice: first.price,
                        exitPrice: exec.execPrice,
                        entryTime: entryTime,
                        exitTime: exitTime,
                        pnl: tradePnl,
                        holdingSeconds: holdingSeconds,
                        entryRoute: first.route,
                        exitRoute: exec.route
                    });
                    
                    first.qty -= matchQty;
                    remainingQty -= matchQty;
                    
                    if (first.qty === 0) {
                        pos.inventory.shift();
                    }
                }
                
                if (remainingQty > 0) {
                    pos.side = execSide;
                    pos.inventory.push({
                        time: execTime,
                        price: exec.execPrice,
                        qty: remainingQty,
                        route: exec.route
                    });
                } else if (pos.inventory.length === 0) {
                    pos.side = null;
                }
            }
        }
    }
    
    return completedTrades;
}

// Compile Single-Day Deep-Dive Analytics
export function compileSingleDayAnalytics(executions) {
    if (!executions || executions.length === 0) return null;

    const sortedExecs = [...executions].sort((a, b) => parseTime(a.timestamp) - parseTime(b.timestamp));
    const trades = matchTradesFIFO(sortedExecs);

    let totalBoughtQty = 0;
    let totalSoldQty = 0;
    let totalPnl = 0;

    sortedExecs.forEach(exec => {
        if (exec.action === 'Bought') {
            totalBoughtQty += exec.execQty;
            totalPnl -= exec.execQty * exec.execPrice;
        } else {
            totalSoldQty += exec.execQty;
            totalPnl += exec.execQty * exec.execPrice;
        }
    });

    // Long vs Short stats
    const longStats = { count: 0, pnl: 0, volume: 0 };
    const shortStats = { count: 0, pnl: 0, volume: 0 };

    trades.forEach(t => {
        if (t.side === 'B') {
            longStats.count++;
            longStats.pnl += t.pnl;
            longStats.volume += t.qty;
        } else {
            shortStats.count++;
            shortStats.pnl += t.pnl;
            shortStats.volume += t.qty;
        }
    });

    // Per-Stock Summary with Darkpool vs Lit tracking for the single day
    const stockMap = {};
    sortedExecs.forEach(exec => {
        const sym = exec.symbol;
        if (!stockMap[sym]) {
            stockMap[sym] = {
                symbol: sym,
                boughtQty: 0,
                soldQty: 0,
                pnl: 0,
                executions: []
            };
        }
        stockMap[sym].executions.push(exec);
        if (exec.action === 'Bought') {
            stockMap[sym].boughtQty += exec.execQty;
            stockMap[sym].pnl -= exec.execQty * exec.execPrice;
        } else {
            stockMap[sym].soldQty += exec.execQty;
            stockMap[sym].pnl += exec.execQty * exec.execPrice;
        }
    });

    const stockBreakdown = Object.values(stockMap).map(stock => {
        const stockTrades = trades.filter(t => t.symbol === stock.symbol);
        const totalHold = stockTrades.reduce((acc, t) => acc + t.holdingSeconds, 0);
        const avgHoldTime = stockTrades.length > 0 ? totalHold / stockTrades.length : 0;
        
        // Track entry/exit Darkpool venues
        const entryDarkpools = new Set();
        const exitDarkpools = new Set();
        let darkpoolVolume = 0;
        let litVolume = 0;

        stockTrades.forEach(t => {
            if (isDarkpool(t.entryRoute)) entryDarkpools.add(t.entryRoute);
            if (isDarkpool(t.exitRoute)) exitDarkpools.add(t.exitRoute);
        });

        stock.executions.forEach(e => {
            if (isDarkpool(e.route)) {
                darkpoolVolume += e.execQty;
            } else {
                litVolume += e.execQty;
            }
        });

        return {
            symbol: stock.symbol,
            pnl: stock.pnl,
            totalQty: Math.max(stock.boughtQty, stock.soldQty),
            tradesCount: stockTrades.length,
            avgHoldTime,
            executions: stock.executions,
            entryDarkpools: Array.from(entryDarkpools),
            exitDarkpools: Array.from(exitDarkpools),
            darkpoolVolume,
            litVolume
        };
    }).sort((a, b) => b.pnl - a.pnl);

    // Trade-by-Trade Realized Intraday Equity Curve
    const sortedTrades = [...trades].sort((a, b) => a.exitTime - b.exitTime);
    let cumulativeRealizedPnl = 0;
    const intradayEquityCurve = [];

    if (sortedTrades.length > 0) {
        const firstTime = sortedTrades[0].entryTime;
        intradayEquityCurve.push({
            timeLabel: formatTimeLabel(firstTime),
            execPnl: 0,
            tradePnl: 0,
            symbol: 'OPEN',
            qty: 0
        });
    }

    sortedTrades.forEach(t => {
        cumulativeRealizedPnl += t.pnl;
        intradayEquityCurve.push({
            timeLabel: formatTimeLabel(t.exitTime),
            execPnl: cumulativeRealizedPnl,
            tradePnl: t.pnl,
            symbol: t.symbol,
            side: t.side,
            qty: t.qty,
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            entryRoute: t.entryRoute,
            exitRoute: t.exitRoute
        });
    });

    // ECN vs Darkpool breakdown for the single day
    const ecnMap = {};
    let dayDarkpoolVolume = 0;
    let dayLitVolume = 0;

    sortedExecs.forEach(exec => {
        const r = exec.route;
        const dark = isDarkpool(r);
        if (dark) dayDarkpoolVolume += exec.execQty;
        else dayLitVolume += exec.execQty;

        if (!ecnMap[r]) {
            ecnMap[r] = { route: r, volume: 0, fills: 0, isDarkpool: dark };
        }
        ecnMap[r].volume += exec.execQty;
        ecnMap[r].fills++;
    });
    const ecnBreakdown = Object.values(ecnMap).sort((a, b) => b.volume - a.volume);

    return {
        pnl: totalPnl,
        totalBoughtQty,
        totalSoldQty,
        totalFills: sortedExecs.length,
        totalOrders: trades.length,
        longStats,
        shortStats,
        stockBreakdown,
        intradayEquityCurve,
        ecnBreakdown,
        dayDarkpoolVolume,
        dayLitVolume
    };
}

// Compile Global ECN & Darkpool Route Analytics across all sessions
export function compileECNAnalytics(executions) {
    if (!executions || executions.length === 0) {
        return {
            totalVolume: 0,
            litVolume: 0,
            darkpoolVolume: 0,
            litPct: 0,
            darkpoolPct: 0,
            routeStats: [],
            stockDarkpoolSummary: []
        };
    }

    let totalVolume = 0;
    let litVolume = 0;
    let darkpoolVolume = 0;
    const ecnMap = {};

    executions.forEach(exec => {
        totalVolume += exec.execQty;
        const r = exec.route || 'DIRECT';
        const dark = isDarkpool(r);

        if (dark) darkpoolVolume += exec.execQty;
        else litVolume += exec.execQty;

        if (!ecnMap[r]) {
            ecnMap[r] = {
                route: r,
                isDarkpool: dark,
                volume: 0,
                fills: 0,
                boughtVolume: 0,
                soldVolume: 0
            };
        }
        ecnMap[r].volume += exec.execQty;
        ecnMap[r].fills++;
        if (exec.action === 'Bought') {
            ecnMap[r].boughtVolume += exec.execQty;
        } else {
            ecnMap[r].soldVolume += exec.execQty;
        }
    });

    const routeStats = Object.values(ecnMap).map(item => {
        return {
            ...item,
            typeLabel: item.isDarkpool ? 'Darkpool' : 'ECN',
            pctVolume: totalVolume > 0 ? (item.volume / totalVolume) * 100 : 0
        };
    }).sort((a, b) => b.volume - a.volume);

    // Stock-by-Stock Darkpool Liquidity Summary
    const trades = matchTradesFIFO(executions);
    const stockDarkMap = {};

    trades.forEach(t => {
        const sym = t.symbol;
        if (!stockDarkMap[sym]) {
            stockDarkMap[sym] = {
                symbol: sym,
                darkpoolVolume: 0,
                litVolume: 0,
                entryDarkpools: new Set(),
                exitDarkpools: new Set(),
                darkpoolFillsCount: 0
            };
        }
        const st = stockDarkMap[sym];
        if (isDarkpool(t.entryRoute)) {
            st.entryDarkpools.add(t.entryRoute);
            st.darkpoolVolume += t.qty;
            st.darkpoolFillsCount++;
        } else {
            st.litVolume += t.qty;
        }
        if (isDarkpool(t.exitRoute)) {
            st.exitDarkpools.add(t.exitRoute);
            st.darkpoolVolume += t.qty;
            st.darkpoolFillsCount++;
        } else {
            st.litVolume += t.qty;
        }
    });

    const stockDarkpoolSummary = Object.values(stockDarkMap)
        .filter(s => s.darkpoolVolume > 0 || s.entryDarkpools.size > 0 || s.exitDarkpools.size > 0)
        .map(s => ({
            symbol: s.symbol,
            darkpoolVolume: s.darkpoolVolume,
            entryDarkpools: Array.from(s.entryDarkpools),
            exitDarkpools: Array.from(s.exitDarkpools),
            darkpoolFillsCount: s.darkpoolFillsCount
        }))
        .sort((a, b) => b.darkpoolVolume - a.darkpoolVolume);

    return {
        totalVolume,
        litVolume,
        darkpoolVolume,
        litPct: totalVolume > 0 ? (litVolume / totalVolume) * 100 : 0,
        darkpoolPct: totalVolume > 0 ? (darkpoolVolume / totalVolume) * 100 : 0,
        routeStats,
        stockDarkpoolSummary
    };
}

export function compileDailyStats(executions) {
    if (!executions || executions.length === 0) return null;
    return compileSingleDayAnalytics(executions);
}

export function compileOverallAnalytics(trades, dailyStatsMap) {
    if (trades.length === 0) {
        return {
            totalPnl: 0,
            winRate: 0,
            profitFactor: 0,
            totalTrades: 0,
            totalShares: 0,
            avgHoldTime: 0,
            tickerStats: [],
            equityCurve: []
        };
    }
    
    let totalPnl = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let grossProfits = 0;
    let grossLosses = 0;
    let totalHoldTime = 0;
    let totalShares = 0;
    
    const tickerMap = {};
    
    trades.forEach(trade => {
        totalPnl += trade.pnl;
        totalHoldTime += trade.holdingSeconds;
        totalShares += trade.qty;
        
        if (trade.pnl > 0) {
            winningTrades++;
            grossProfits += trade.pnl;
        } else if (trade.pnl < 0) {
            losingTrades++;
            grossLosses += Math.abs(trade.pnl);
        }
        
        const sym = trade.symbol;
        if (!tickerMap[sym]) {
            tickerMap[sym] = {
                symbol: sym,
                pnl: 0,
                tradesCount: 0,
                winningTrades: 0,
                volume: 0,
                totalHoldSeconds: 0
            };
        }
        const stat = tickerMap[sym];
        stat.pnl += trade.pnl;
        stat.tradesCount++;
        stat.volume += trade.qty;
        stat.totalHoldSeconds += trade.holdingSeconds;
        if (trade.pnl > 0) {
            stat.winningTrades++;
        }
    });
    
    const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;
    const profitFactor = grossLosses > 0 ? grossProfits / grossLosses : grossProfits;
    const avgHoldTime = trades.length > 0 ? totalHoldTime / trades.length : 0;
    
    const tickerStats = Object.values(tickerMap).map(stat => {
        return {
            symbol: stat.symbol,
            pnl: stat.pnl,
            tradesCount: stat.tradesCount,
            winRate: (stat.winningTrades / stat.tradesCount) * 100,
            volume: stat.volume,
            avgHoldTime: stat.totalHoldSeconds / stat.tradesCount
        };
    }).sort((a, b) => b.pnl - a.pnl);
    
    const dates = Object.keys(dailyStatsMap).sort((a, b) => new Date(a) - new Date(b));
    let runningPnl = 0;
    const equityCurve = dates.map(date => {
        runningPnl += dailyStatsMap[date].pnl;
        return {
            date,
            pnl: dailyStatsMap[date].pnl,
            cumulativePnl: runningPnl
        };
    });
    
    return {
        totalPnl,
        winRate,
        profitFactor,
        totalTrades: trades.length,
        totalShares,
        avgHoldTime,
        tickerStats,
        equityCurve
    };
}
