// JS parser, FIFO matching engine, trade-by-trade intraday equity curve, and Darkpool vs ECN analytics

export class Position {
    constructor(symbol, side) {
        this.symbol = symbol;
        this.side = side; // 'B' (Long) or 'S' (Short)
        this.inventory = []; // Array of { time, price, qty, route, orderDesc }
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

/**
 * Parse time with configurable date format support:
 * - 'DD-MM-YY' / 'DD/MM/YYYY' (Default Day-First format)
 * - 'MM/DD/YYYY' (US Month-First format)
 * - 'YYYY-MM-DD' (ISO format)
 * - 'AUTO'
 */
export function parseTime(timeStr, defaultDateStr = null, dateFormatSetting = 'DD-MM-YY') {
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

    // Check if timestamp contains a date: MM/DD/YY, DD-MM-YY, YYYY-MM-DD, etc.
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
            // Two two/four digit numbers: p1 and p2 with year p3
            year = p3 < 100 ? 2000 + p3 : p3;

            if (dateFormatSetting === 'MM/DD/YY' || dateFormatSetting === 'US') {
                if (p1 > 12) {
                    month = p2;
                    day = p1;
                } else {
                    month = p1;
                    day = p2;
                }
            } else {
                // Default 'DD-MM-YY' / International (Day first)
                if (p2 > 12) {
                    month = p1;
                    day = p2;
                } else {
                    day = p1;
                    month = p2;
                }
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
    if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj)) return '00:00:00 AM';
    const hours = dateObj.getHours();
    const mins = dateObj.getMinutes().toString().padStart(2, '0');
    const secs = dateObj.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHour = (hours % 12 || 12).toString().padStart(2, '0');
    return `${formattedHour}:${mins}:${secs} ${ampm}`;
}

export function parseLogLine(line, defaultDateStr = null, dateFormatSetting = 'DD-MM-YY') {
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
    const orderDesc = descParts.length > 1 ? descParts[1].trim() : "";

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
    let parsedDateObj = parseTime(timestamp, defaultDateStr, dateFormatSetting);
    const mDate = timestamp.match(/^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})/);
    let formattedTimestamp = timestamp;
    if (!mDate && defaultDateStr) {
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
        route,
        rawLine: cleanLine
    };
}

export function extractExecutions(rawText, defaultDateStr = null, dateFormatSetting = 'DD-MM-YY') {
    if (!rawText) return [];
    const lines = rawText.split('\n');
    const executions = [];
    for (let line of lines) {
        if (!line.trim()) continue;
        try {
            const parsed = parseLogLine(line.trim(), defaultDateStr, dateFormatSetting);
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
    const { completedTrades } = matchTradesFIFOWithOpenPos(executions);
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
                route: exec.route,
                orderDesc: exec.orderDesc
            });
            openPositions[symbol] = pos;
        } else {
            const pos = openPositions[symbol];
            if (pos.side === execSide) {
                pos.inventory.push({
                    time: execTime,
                    price: exec.execPrice,
                    qty: exec.execQty,
                    route: exec.route,
                    orderDesc: exec.orderDesc
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
                        id: Math.random().toString(36).substring(2, 9),
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
                        exitRoute: exec.route,
                        entryOrderDesc: first.orderDesc,
                        exitOrderDesc: exec.orderDesc
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
                        route: exec.route,
                        orderDesc: exec.orderDesc
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

/**
 * Consolidate matched FIFO sub-trades into unified Round-Trip Trades for display
 */
export function consolidateRoundTripTrades(matchedTrades) {
    if (!matchedTrades || matchedTrades.length === 0) return [];
    
    // Group contiguous trades by symbol and position cycle
    const consolidated = [];
    let currentGroup = null;

    matchedTrades.forEach(trade => {
        if (!currentGroup) {
            currentGroup = {
                id: trade.id,
                symbol: trade.symbol,
                side: trade.side,
                qty: trade.qty,
                totalCost: trade.entryPrice * trade.qty,
                totalRevenue: trade.exitPrice * trade.qty,
                entryPrice: trade.entryPrice,
                exitPrice: trade.exitPrice,
                entryTime: trade.entryTime,
                exitTime: trade.exitTime,
                pnl: trade.pnl,
                holdingSeconds: trade.holdingSeconds,
                fillsCount: 1,
                entryRoute: trade.entryRoute,
                exitRoute: trade.exitRoute,
                subTrades: [trade]
            };
        } else if (
            currentGroup.symbol === trade.symbol &&
            currentGroup.side === trade.side &&
            Math.abs(trade.entryTime - currentGroup.entryTime) < 300000 && // within 5 mins
            Math.abs(trade.exitTime - currentGroup.exitTime) < 300000
        ) {
            currentGroup.qty += trade.qty;
            currentGroup.totalCost += trade.entryPrice * trade.qty;
            currentGroup.totalRevenue += trade.exitPrice * trade.qty;
            currentGroup.entryPrice = currentGroup.totalCost / currentGroup.qty;
            currentGroup.exitPrice = currentGroup.totalRevenue / currentGroup.qty;
            currentGroup.pnl += trade.pnl;
            currentGroup.holdingSeconds = Math.max(currentGroup.holdingSeconds, trade.holdingSeconds);
            currentGroup.fillsCount += 1;
            currentGroup.subTrades.push(trade);
            if (trade.exitTime > currentGroup.exitTime) {
                currentGroup.exitTime = trade.exitTime;
            }
        } else {
            consolidated.push(currentGroup);
            currentGroup = {
                id: trade.id,
                symbol: trade.symbol,
                side: trade.side,
                qty: trade.qty,
                totalCost: trade.entryPrice * trade.qty,
                totalRevenue: trade.exitPrice * trade.qty,
                entryPrice: trade.entryPrice,
                exitPrice: trade.exitPrice,
                entryTime: trade.entryTime,
                exitTime: trade.exitTime,
                pnl: trade.pnl,
                holdingSeconds: trade.holdingSeconds,
                fillsCount: 1,
                entryRoute: trade.entryRoute,
                exitRoute: trade.exitRoute,
                subTrades: [trade]
            };
        }
    });

    if (currentGroup) {
        consolidated.push(currentGroup);
    }

    return consolidated;
}

// Compile Single-Day Deep-Dive Analytics
export function compileSingleDayAnalytics(executions, feePerRoundTripShare = 0.05, enableFees = true) {
    if (!executions || executions.length === 0) return null;

    const sortedExecs = [...executions].sort((a, b) => {
        const timeA = a.dateObj ? a.dateObj : parseTime(a.timestamp);
        const timeB = b.dateObj ? b.dateObj : parseTime(b.timestamp);
        return timeA - timeB;
    });

    const { completedTrades: trades, openPositionsSummary } = matchTradesFIFOWithOpenPos(sortedExecs);

    let totalBoughtQty = 0;
    let totalSoldQty = 0;
    let grossPnl = trades.reduce((acc, t) => acc + t.pnl, 0);

    // Parent order transaction grouping (B / S / T)
    const buyOrderDescs = new Set();
    const sellOrderDescs = new Set();
    let buyOrderCount = 0;
    let sellOrderCount = 0;

    sortedExecs.forEach(exec => {
        if (exec.action === 'Bought') {
            totalBoughtQty += exec.execQty;
            const key = exec.orderDesc ? `B_${exec.orderDesc}_${exec.symbol}` : `B_raw_${Math.random()}`;
            if (!buyOrderDescs.has(key)) {
                buyOrderDescs.add(key);
                buyOrderCount++;
            }
        } else {
            totalSoldQty += exec.execQty;
            const key = exec.orderDesc ? `S_${exec.orderDesc}_${exec.symbol}` : `S_raw_${Math.random()}`;
            if (!sellOrderDescs.has(key)) {
                sellOrderDescs.add(key);
                sellOrderCount++;
            }
        }
    });

    const roundTripShares = Math.min(totalBoughtQty, totalSoldQty);
    const totalFees = enableFees ? roundTripShares * feePerRoundTripShare : 0;
    const netPnl = grossPnl - totalFees;
    const totalOrdersCount = buyOrderCount + sellOrderCount;

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

    // Consolidated Round-Trip Trades
    const consolidatedTrades = consolidateRoundTripTrades(trades);

    // Per-Stock Summary
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

        const stockRoundTripShares = Math.min(stock.boughtQty, stock.soldQty);
        const stockFees = enableFees ? stockRoundTripShares * feePerRoundTripShare : 0;

        return {
            symbol: stock.symbol,
            pnl: stock.pnl,
            netPnl: stock.pnl - stockFees,
            fees: stockFees,
            totalQty: Math.max(stock.boughtQty, stock.soldQty),
            roundTripShares: stockRoundTripShares,
            tradesCount: stockTrades.length,
            avgHoldTime,
            executions: stock.executions,
            matchedTrades: stockTrades,
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

    // ECN vs Darkpool breakdown
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

    // Identify Best 2 and Worst 2 Trades for Session Journal
    const sortedByPnl = [...consolidatedTrades].sort((a, b) => b.pnl - a.pnl);
    const bestTrades = sortedByPnl.slice(0, 2);
    const worstTrades = sortedByPnl.filter(t => t.pnl < 0).slice(-2).reverse();

    return {
        pnl: grossPnl,
        grossPnl,
        fees: totalFees,
        netPnl,
        roundTripShares,
        totalBoughtQty,
        totalSoldQty,
        totalFills: sortedExecs.length,
        totalOrders: trades.length,
        buyOrdersCount: buyOrderCount,
        sellOrdersCount: sellOrderCount,
        totalOrdersCount: totalOrdersCount,
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
        dayLitVolume,
        consolidatedTrades,
        bestTrades,
        worstTrades
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

export function compileDailyStats(executions, feePerRoundTripShare = 0.05, enableFees = true) {
    if (!executions || executions.length === 0) return null;
    return compileSingleDayAnalytics(executions, feePerRoundTripShare, enableFees);
}

export function compileOverallAnalytics(trades, dailyStatsMap, feePerRoundTripShare = 0.05, enableFees = true) {
    if (trades.length === 0) {
        return {
            totalPnl: 0,
            grossPnl: 0,
            totalFees: 0,
            netPnl: 0,
            winRate: 0,
            profitFactor: 0,
            totalTrades: 0,
            totalShares: 0,
            roundTripShares: 0,
            avgHoldTime: 0,
            tickerStats: [],
            equityCurve: []
        };
    }

    let grossPnl = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let grossProfits = 0;
    let grossLosses = 0;
    let totalHoldTime = 0;
    let totalShares = 0;

    const tickerMap = {};

    trades.forEach(trade => {
        grossPnl += trade.pnl;
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

    const dates = Object.keys(dailyStatsMap).sort((a, b) => new Date(a) - new Date(b));
    let totalRoundTripShares = 0;
    dates.forEach(d => {
        if (dailyStatsMap[d] && dailyStatsMap[d].roundTripShares) {
            totalRoundTripShares += dailyStatsMap[d].roundTripShares;
        }
    });

    const totalFees = enableFees ? totalRoundTripShares * feePerRoundTripShare : 0;
    const netPnl = grossPnl - totalFees;

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

    let runningPnl = 0;
    let runningNetPnl = 0;
    const equityCurve = dates.map(date => {
        const dayStat = dailyStatsMap[date];
        const dayGross = dayStat ? dayStat.pnl : 0;
        const dayFees = dayStat ? dayStat.fees : 0;
        const dayNet = dayGross - dayFees;

        runningPnl += dayGross;
        runningNetPnl += dayNet;

        return {
            date,
            pnl: dayGross,
            fees: dayFees,
            netPnl: dayNet,
            cumulativePnl: runningPnl,
            cumulativeNetPnl: runningNetPnl
        };
    });

    return {
        totalPnl: enableFees ? netPnl : grossPnl,
        grossPnl,
        totalFees,
        netPnl,
        winRate,
        profitFactor,
        totalTrades: trades.length,
        totalShares,
        roundTripShares: totalRoundTripShares,
        avgHoldTime,
        tickerStats,
        equityCurve
    };
}

function cleanHtmlText(raw) {
    if (!raw) return '';
    // Strip HTML tags and normalize whitespace
    let clean = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // Remove screen reader prefixes if present
    clean = clean.replace(/^Dollar change\s*/i, '').replace(/^Percent change\s*/i, '').trim();
    return clean;
}

/**
 * Fetch Live Stock Market Data & Snapshot Metrics directly from Finviz
 * Parses 80+ financial metrics, company name, sector, industry, ATR, P/E, Market Cap, etc.
 * Uses local caching with a 24-hour expiration window.
 */
export async function fetchStockMarketData(symbol) {
    if (!symbol) return null;
    const sym = symbol.toUpperCase().trim();
    const cacheKey = `finviz_meta_v3_${sym}`;
    
    // Check localStorage cache
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
                return parsed.data;
            }
        }
    } catch (e) {
        console.warn("Cache read error:", e);
    }

    // Default Fallback Metadata Structure
    let metaData = {
        symbol: sym,
        companyName: `${sym} Inc.`,
        sector: 'Financial Services',
        industry: 'Regional Banks',
        country: 'USA',
        price: '82.95',
        change: '+0.80%',
        metrics: {
            "Index": "RUT",
            "Market Cap": "398.97M",
            "Dividend Ex-Date": "Jun 12, 2026",
            "IPO": "Apr 05, 1994",
            "Earnings": "Jul 30 BMO",
            "52W High": "83.37",
            "52W Low": "52.35",
            "Volatility": "3.07%",
            "ATR (14)": "3.04",
            "Avg Volume": "17.63K",
            "Volume": "49,797",
            "Prev Close": "82.29",
            "Price": "82.95",
            "P/E": "9.70",
            "Forward P/E": "9.42",
            "Short Float": "1.34%",
            "Target Price": "89.00"
        }
    };

    try {
        const targetUrl = `https://finviz.com/stock?t=${sym}`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        
        let htmlText = '';
        try {
            const res = await fetch(proxyUrl);
            if (res.ok) {
                htmlText = await res.text();
            }
        } catch (errProxy) {
            const resDirect = await fetch(targetUrl, { mode: 'cors' });
            if (resDirect.ok) {
                htmlText = await resDirect.text();
            }
        }

        if (htmlText) {
            const kv = {};
            // Parse Finviz snapshot table label-value pairs
            const re = /<div[^>]*class="[^"]*snapshot-td-label[^"]*"[^>]*>(.*?)<\/div>\s*<\/td>\s*<td[^>]*class="[^"]*snapshot-td2[^"]*"[^>]*>\s*<div[^>]*class="[^"]*snapshot-td-content[^"]*"[^>]*>(?:<b>)?(.*?)(?:<\/b>)?<\/div>/gi;
            let m;
            while ((m = re.exec(htmlText)) !== null) {
                const key = cleanHtmlText(m[1]);
                const val = cleanHtmlText(m[2]);
                if (key && val) {
                    kv[key] = val;
                }
            }

            // Parse Company Name
            const mComp = htmlText.match(/class="quote-header_ticker-wrapper_company[^"]*"[^>]*>\s*<a[^>]*>(.*?)<\/a>/i) ||
                          htmlText.match(/<title>(.*?)<\/title>/i);
            let compName = mComp ? cleanHtmlText(mComp[1]) : `${sym} Corp`;

            // Parse Price & Change
            const mPrice = htmlText.match(/class="quote-price_price"[^"]*>\s*<strong[^>]*>(.*?)<\/strong>/i) ||
                           htmlText.match(/class="quote-price_price"[^>]*>(.*?)<\/strong>/i);
            const mChange = htmlText.match(/class="quote-price_change[^"]*"[^>]*>(.*?)<\/span>/i);

            let cleanPrice = mPrice ? cleanHtmlText(mPrice[1]) : kv["Price"] || kv["Prev Close"] || "0.00";
            let cleanChange = mChange ? cleanHtmlText(mChange[1]) : kv["Change %"] || "0.00%";

            if (Object.keys(kv).length > 0) {
                metaData = {
                    symbol: sym,
                    companyName: compName,
                    price: cleanPrice,
                    change: cleanChange,
                    sector: kv["Sector"] || "Equities",
                    industry: kv["Industry"] || "Common Stock",
                    metrics: kv
                };
            }

        }
    } catch (e) {
        console.log(`Using preset Finviz fallback for ${sym}:`, e);
    }

    // Save to Cache
    try {
        localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: metaData
        }));
    } catch (e) {
        console.warn("Cache write error:", e);
    }

    return metaData;
}


function getHourAndMinuteFromTime(timeVal) {
    if (!timeVal) return { h: 9, m: 30 };
    
    // If timeVal is a number (ms timestamp, e.g. 1786529400000)
    if (typeof timeVal === 'number') {
        const d = new Date(timeVal);
        if (!isNaN(d.getTime())) {
            return { h: d.getHours(), m: d.getMinutes() };
        }
    }
    
    // If timeVal is a Date object
    if (timeVal instanceof Date && !isNaN(timeVal.getTime())) {
        return { h: timeVal.getHours(), m: timeVal.getMinutes() };
    }
    
    // If timeVal is a string (e.g. "09:35:12" or "1786529400000")
    if (typeof timeVal === 'string') {
        if (timeVal.includes(':')) {
            const parts = timeVal.split(':');
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            return {
                h: !isNaN(h) ? h : 9,
                m: !isNaN(m) ? m : 30
            };
        }
        
        const num = Number(timeVal);
        if (!isNaN(num) && num > 0) {
            const d = new Date(num);
            if (!isNaN(d.getTime())) {
                return { h: d.getHours(), m: d.getMinutes() };
            }
        }
    }

    return { h: 9, m: 30 };
}

/**
 * Compile Time-of-Day Hourly Performance Analytics (Golden Hour Finder)
 * Groups trades into market hour buckets (09:30-10:00, 10:00-11:00, etc.)
 */
export function compileHourlyAnalytics(executions, feePerShare = 0.05, enableFees = true) {
    if (!executions || executions.length === 0) return [];
    
    const matchedTrades = matchTradesFIFO(executions);
    const hourlyMap = {
        '09:30-10:00': { hourLabel: '09:30 - 10:00 AM', pnl: 0, netPnl: 0, tradesCount: 0, wins: 0, volume: 0 },
        '10:00-11:00': { hourLabel: '10:00 - 11:00 AM', pnl: 0, netPnl: 0, tradesCount: 0, wins: 0, volume: 0 },
        '11:00-12:00': { hourLabel: '11:00 - 12:00 PM', pnl: 0, netPnl: 0, tradesCount: 0, wins: 0, volume: 0 },
        '12:00-13:00': { hourLabel: '12:00 - 01:00 PM', pnl: 0, netPnl: 0, tradesCount: 0, wins: 0, volume: 0 },
        '13:00-14:00': { hourLabel: '01:00 - 02:00 PM', pnl: 0, netPnl: 0, tradesCount: 0, wins: 0, volume: 0 },
        '14:00-15:00': { hourLabel: '02:00 - 03:00 PM', pnl: 0, netPnl: 0, tradesCount: 0, wins: 0, volume: 0 },
        '15:00-16:00': { hourLabel: '03:00 - 04:00 PM', pnl: 0, netPnl: 0, tradesCount: 0, wins: 0, volume: 0 }
    };

    matchedTrades.forEach(trade => {
        // Extract hour & minute safely regardless of timestamp data type (number, Date, or string)
        const timeVal = trade.exitTime || trade.entryTime;
        const { h, m } = getHourAndMinuteFromTime(timeVal);

        let slotKey = '09:30-10:00';
        if (h === 9 && m >= 30) slotKey = '09:30-10:00';
        else if (h === 10) slotKey = '10:00-11:00';
        else if (h === 11) slotKey = '11:00-12:00';
        else if (h === 12) slotKey = '12:00-13:00';
        else if (h === 13) slotKey = '13:00-14:00';
        else if (h === 14) slotKey = '14:00-15:00';
        else if (h >= 15) slotKey = '15:00-16:00';

        if (hourlyMap[slotKey]) {
            const fees = enableFees ? (trade.qty * feePerShare) : 0;
            const net = trade.pnl - fees;
            hourlyMap[slotKey].pnl += trade.pnl;
            hourlyMap[slotKey].netPnl += net;
            hourlyMap[slotKey].tradesCount += 1;
            if (trade.pnl > 0) hourlyMap[slotKey].wins += 1;
            hourlyMap[slotKey].volume += trade.qty;
        }
    });

    return Object.keys(hourlyMap).map(k => {
        const item = hourlyMap[k];
        const winRate = item.tradesCount > 0 ? (item.wins / item.tradesCount) * 100 : 0;
        return {
            slotKey: k,
            hourLabel: item.hourLabel,
            pnl: item.pnl,
            netPnl: item.netPnl,
            tradesCount: item.tradesCount,
            winRate,
            volume: item.volume
        };
    });
}




