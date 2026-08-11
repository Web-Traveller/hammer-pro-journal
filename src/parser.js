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

export function parseTime(timeStr, defaultDateStr = null) {
    if (!timeStr) {
        return defaultDateStr ? new Date(defaultDateStr) : new Date();
    }
    const str = timeStr.trim();

    // Default fallback date components
    const fallback = defaultDateStr ? new Date(defaultDateStr) : new Date();
    let year = fallback.getFullYear();
    let month = fallback.getMonth() + 1; // 1-based
    let day = fallback.getDate();
    let timePart = str;

    // Check if timestamp contains a date: MM/DD/YY, MM-DD-YY, YYYY-MM-DD, etc.
    const dateMatch = str.match(/^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})\s+(.*)$/);
    if (dateMatch) {
        let p1 = parseInt(dateMatch[1], 10);
        let p2 = parseInt(dateMatch[2], 10);
        let p3 = parseInt(dateMatch[3], 10);
        timePart = dateMatch[4];

        if (p1 > 1000) {
            // YYYY-MM-DD
            year = p1;
            month = p2;
            day = p3;
        } else {
            // MM-DD-YY or DD-MM-YY or MM/DD/YYYY
            year = p3 < 100 ? 2000 + p3 : p3;
            // Standard US format MM/DD/YY: month=p1, day=p2
            if (p1 > 12) {
                // DD/MM/YY
                month = p2;
                day = p1;
            } else {
                month = p1;
                day = p2;
            }
        }
    }

    // Parse time part: HH:MM:SS or HH:MM:SS AM/PM or HH:MM
    const timeMatch = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!timeMatch) {
        return new Date(year, month - 1, day, 12, 0, 0);
    }

    let [_, hourStr, minStr, secStr, ampm] = timeMatch;
    let hour = parseInt(hourStr, 10);
    let minute = parseInt(minStr, 10);
    let second = secStr ? parseInt(secStr, 10) : 0;

    if (ampm) {
        const u = ampm.toUpperCase();
        if (u === 'PM' && hour < 12) hour += 12;
        if (u === 'AM' && hour === 12) hour = 0;
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

export function parseLogLine(line, defaultDateStr = null) {
    const cleanLine = line.trim();
    if (!cleanLine) return null;

    // Split line by tabs, unicode space characters (\u2004, \u2003, \u00A0), pipe, or 2+ spaces
    const parts = cleanLine.split(/\t|\u2004+|\u2003+|\u00A0+|\||\s{2,}/);

    let timestamp = "";
    let symbol = "";
    let status = "Executed";
    let desc = "";

    if (parts.length >= 4) {
        timestamp = parts[0];
        symbol = parts[1];
        status = parts[2];
        desc = parts.slice(3).join(" ");
    } else if (parts.length >= 2) {
        timestamp = parts[0];
        desc = parts.slice(1).join(" ");
    } else {
        desc = cleanLine;
    }

    // Match Execution pattern: "Sold AAPL 100 @ 150.25" or "Bought NVDA 10 @ 120.5"
    const mExec = desc.match(/(Sold|Bought)\s+(\S+)\s+(\d+)\s+@\s+([\d\.]+)/i);
    if (!mExec) return null;

    const action = mExec[1].charAt(0).toUpperCase() + mExec[1].slice(1).toLowerCase(); // Normalized "Bought" or "Sold"
    const execSymbol = symbol || mExec[2];
    const execQty = parseInt(mExec[3], 10);
    const execPrice = parseFloat(mExec[4]);

    // Extract ECN Route (e.g. "Route to NSDQ Hidden", "Route to SIGMAX Hidden")
    const mRoute = desc.match(/Route\s+to\s+([A-Z0-9]+)/i);
    let route = mRoute ? mRoute[1].toUpperCase() : 'DIRECT';

    // Route Aliasing Normalization
    if (route === 'STOP') route = 'BATS';
    if (route === 'NQBX') route = 'BOSX';

    // Extract order description details
    const descParts = desc.split(' : ');
    const orderDesc = descParts.length > 1 ? descParts[1] : "";

    const mOrder = orderDesc.match(/(SHORT|BUY|SELL)\s+(\d+)\s+(\S+)/i);
    let orderSide, orderQty;
    if (mOrder) {
        orderSide = mOrder[1].toUpperCase();
        orderQty = parseInt(mOrder[2], 10);
    } else {
        orderSide = action === 'Bought' ? 'BUY' : 'SELL';
        orderQty = execQty;
    }

    // Standardize timestamp date format if missing
    let parsedDateObj = parseTime(timestamp, defaultDateStr);
    const mDate = timestamp.match(/^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})/);
    let formattedTimestamp = timestamp;
    if (!mDate && defaultDateStr) {
        // Timestamp only had time (e.g. 13:19:19), attach default date
        formattedTimestamp = `${defaultDateStr} ${timestamp}`;
    }

    return {
        timestamp: formattedTimestamp,
        dateObj: parsedDateObj,
        symbol: execSymbol,
        status: status || 'Filled',
        action,
        execQty,
        execPrice,
        orderSide,
        orderQty,
        orderDesc,
        route
    };
}

export function extractExecutions(rawText, defaultDateStr = null) {
    if (!rawText) return [];
    const lines = rawText.split('\n');
    const executions = [];
    for (let line of lines) {
        if (!line.trim()) continue;
        try {
            const parsed = parseLogLine(line.trim(), defaultDateStr);
            if (parsed) {
                executions.push(parsed);
            }
        } catch (e) {
            console.error("Error parsing line: " + line, e);
        }
    }
    return executions;
}

export function matchTradesFIFO(executions) {
    const openPositions = {};
    const completedTrades = [];

    const sortedExecs = [...executions].sort((a, b) => {
        const timeA = a.dateObj ? a.dateObj : parseTime(a.timestamp);
        const timeB = b.dateObj ? b.dateObj : parseTime(b.timestamp);
        return timeA - timeB;
    });

    for (let exec of sortedExecs) {
        const symbol = exec.symbol;
        const execSide = exec.action === 'Bought' ? 'B' : 'S';
        const execTime = exec.dateObj ? exec.dateObj : parseTime(exec.timestamp);

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

export function matchTradesFIFOWithOpenPos(executions) {
    const openPositions = {};
    const completedTrades = [];

    const sortedExecs = [...executions].sort((a, b) => {
        const timeA = a.dateObj ? a.dateObj : parseTime(a.timestamp);
        const timeB = b.dateObj ? b.dateObj : parseTime(b.timestamp);
        return timeA - timeB;
    });

    for (let exec of sortedExecs) {
        const symbol = exec.symbol;
        const execSide = exec.action === 'Bought' ? 'B' : 'S';
        const execTime = exec.dateObj ? exec.dateObj : parseTime(exec.timestamp);

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

    const openPositionsSummary = [];
    Object.keys(openPositions).forEach(sym => {
        const pos = openPositions[sym];
        if (pos && pos.side !== null && pos.inventory.length > 0) {
            const totalQty = pos.inventory.reduce((acc, inv) => acc + inv.qty, 0);
            const totalCost = pos.inventory.reduce((acc, inv) => acc + inv.qty * inv.price, 0);
            const avgEntryPrice = totalQty > 0 ? totalCost / totalQty : 0;
            openPositionsSummary.push({
                symbol: sym,
                side: pos.side,
                qty: totalQty,
                avgPrice: avgEntryPrice
            });
        }
    });

    return { completedTrades, openPositionsSummary };
}

// Compile Single-Day Deep-Dive Analytics
export function compileSingleDayAnalytics(executions) {
    if (!executions || executions.length === 0) return null;

    const sortedExecs = [...executions].sort((a, b) => {
        const timeA = a.dateObj ? a.dateObj : parseTime(a.timestamp);
        const timeB = b.dateObj ? b.dateObj : parseTime(b.timestamp);
        return timeA - timeB;
    });

    const { completedTrades: trades, openPositionsSummary } = matchTradesFIFOWithOpenPos(sortedExecs);

    let totalBoughtQty = 0;
    let totalSoldQty = 0;
    let totalPnl = trades.reduce((acc, t) => acc + t.pnl, 0);

    sortedExecs.forEach(exec => {
        if (exec.action === 'Bought') {
            totalBoughtQty += exec.execQty;
        } else {
            totalSoldQty += exec.execQty;
        }
    });

    // Long vs Short stats
    const longStats = { count: 0, pnl: 0, volume: 0 };
    const shortStats = { count: 0, pnl: 0, volume: 0 };

    let winPnlTotal = 0;
    let winTradesCount = 0;
    let lossPnlTotal = 0;
    let lossTradesCount = 0;

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

        if (t.pnl > 0) {
            winPnlTotal += t.pnl;
            winTradesCount++;
        } else if (t.pnl < 0) {
            lossPnlTotal += Math.abs(t.pnl);
            lossTradesCount++;
        }
    });

    const avgWin = winTradesCount > 0 ? winPnlTotal / winTradesCount : 0;
    const avgLoss = lossTradesCount > 0 ? lossPnlTotal / lossTradesCount : 0;
    const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin;

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
        avgWin,
        avgLoss,
        winLossRatio,
        winningTrades: winTradesCount,
        losingTrades: lossTradesCount,
        openPositionsSummary,
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
