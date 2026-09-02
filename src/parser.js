// JS parser, FIFO matching engine, Level 2 Scalper analytics, Intraday Stock x Time Matrix, and Defensive Date Engine
import { formatInTimezone, getTimeBucket, createUSMarketDate } from './services/timeService.js';

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
 * Defensive Mathematical Date/Time Parser:
 * - Mathematical Impossibility Detection: If month > 12 (e.g. 27-07-2026), automatically swaps day and month.
 * - Handles 2-digit & 4-digit years.
 * - Converts seamlessly to canonical US Market Date ground truth.
 */
export function parseTime(timeStr, defaultDateStr = null, dateFormatSetting = 'DD-MM-YY') {
    try {
        if (!timeStr) {
            const fallbackDateStr = defaultDateStr || new Date().toISOString().split('T')[0];
            return {
                dateObj: createUSMarketDate(fallbackDateStr, '09:30:00'),
                hasExplicitDate: false,
                formattedDateStr: fallbackDateStr,
                formattedTimeStr: '09:30:00'
            };
        }
        const str = timeStr.trim();

        // Default fallback date components
        let year = new Date().getFullYear();
        let month = new Date().getMonth() + 1;
        let day = new Date().getDate();

        if (defaultDateStr && typeof defaultDateStr === 'string') {
            const cleanDef = defaultDateStr.trim().split('T')[0];
            const mIso = cleanDef.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
            if (mIso) {
                year = parseInt(mIso[1], 10);
                month = parseInt(mIso[2], 10);
                day = parseInt(mIso[3], 10);
            } else {
                const mDmy = cleanDef.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
                if (mDmy) {
                    let p1 = parseInt(mDmy[1], 10);
                    let p2 = parseInt(mDmy[2], 10);
                    let p3 = parseInt(mDmy[3], 10);
                    if (p3 < 100) p3 = 2000 + p3;
                    year = p3;
                    if (p1 > 12 && p2 <= 12) { day = p1; month = p2; }
                    else if (p2 > 12 && p1 <= 12) { day = p2; month = p1; }
                    else { day = p1; month = p2; }
                }
            }
        }

        let timePart = str;
        let hasExplicitDate = false;

        // Check if timestamp contains a full date: e.g. 27-07-2026 09:34:12, 07/27/26 09:34:12, 2026-07-27 09:34:12
        const dateMatch = str.match(/^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})\s*(.*)$/);
        if (dateMatch) {
            let p1 = parseInt(dateMatch[1], 10);
            let p2 = parseInt(dateMatch[2], 10);
            let p3 = parseInt(dateMatch[3], 10);
            timePart = dateMatch[4] || '09:30:00';
            hasExplicitDate = true;

            if (p1 > 1000) {
                // ISO format: YYYY-MM-DD or YYYY-DD-MM
                year = p1;
                if (p2 > 12 && p3 <= 12) {
                    day = p2;
                    month = p3;
                } else {
                    month = Math.min(Math.max(p2, 1), 12);
                    day = Math.min(Math.max(p3, 1), 31);
                }
            } else {
                year = p3 < 100 ? 2000 + p3 : p3;
                if (p1 > 12 && p2 <= 12) {
                    day = p1;
                    month = p2;
                } else if (p2 > 12 && p1 <= 12) {
                    day = p2;
                    month = p1;
                } else {
                    if (dateFormatSetting === 'MM/DD/YY' || dateFormatSetting === 'US') {
                        month = p1;
                        day = p2;
                    } else {
                        day = p1;
                        month = p2;
                    }
                }
            }
        }

        month = Math.min(Math.max(month || 1, 1), 12);
        day = Math.min(Math.max(day || 1, 1), 31);

        const timeMatch = timePart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
        let hour = 9, minute = 30, second = 0;

        if (timeMatch) {
            hour = parseInt(timeMatch[1], 10);
            minute = parseInt(timeMatch[2], 10);
            second = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
            const ampm = timeMatch[4] ? timeMatch[4].toUpperCase() : null;

            if (ampm === 'PM' && hour < 12) hour += 12;
            if (ampm === 'AM' && hour === 12) hour = 0;
        }

        const pad = (n) => n.toString().padStart(2, '0');
        const formattedDateStr = `${year}-${pad(month)}-${pad(day)}`;
        const formattedTimeStr = `${pad(hour)}:${pad(minute)}:${pad(second)}`;

        const dateObj = createUSMarketDate(formattedDateStr, formattedTimeStr);
        return {
            dateObj,
            hasExplicitDate,
            formattedDateStr,
            formattedTimeStr
        };
    } catch (e) {
        console.error("Defensive parseTime recovery:", e);
        const fallbackDateStr = defaultDateStr || new Date().toISOString().split('T')[0];
        return {
            dateObj: new Date(),
            hasExplicitDate: false,
            formattedDateStr: fallbackDateStr,
            formattedTimeStr: '09:30:00'
        };
    }
}

/**
 * Format time with timezone support (US Eastern vs Indian Standard Time)
 */
export function formatTimeLabel(dateObj, timezone = 'US_EASTERN') {
    if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
        return '00:00:00 AM';
    }
    return formatInTimezone(dateObj, timezone, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

/**
 * Defensive Log Line Parser
 */
export function parseLogLine(line, defaultDateStr = null, dateFormatSetting = 'DD-MM-YY') {
    const cleanLine = line.trim();
    if (!cleanLine) return null;

    // Split line by tabs, unicode spaces, pipe, or 2+ spaces
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

    // Match Execution pattern:
    // Format 1: "Sold AAPL 100 @ 150.25" or "Bought NVDA 1,000 @ $120.5"
    // Format 2: "Sold 100 AAPL @ 150.25" or "BOT 1000 NVDA @ 120.5"
    let action = '';
    let execSymbol = symbol || '';
    let execQty = 0;
    let execPrice = 0;

    const mExec1 = desc.match(/(Sold|Bought|SLD|BOT|BUY|SELL)\s+([A-Za-z0-9\.\^]+)\s+([\d,]+)\s+@\s+\$?([\d\.]+)/i);
    const mExec2 = desc.match(/(Sold|Bought|SLD|BOT|BUY|SELL)\s+([\d,]+)\s+([A-Za-z0-9\.\^]+)\s+@\s+\$?([\d\.]+)/i);

    if (mExec1 && isNaN(parseInt(mExec1[2], 10))) {
        const rawAct = mExec1[1].toUpperCase();
        action = (rawAct === 'BOUGHT' || rawAct === 'BOT' || rawAct === 'BUY') ? 'Bought' : 'Sold';
        execSymbol = (symbol || mExec1[2]).toUpperCase().trim();
        execQty = parseInt(mExec1[3].replace(/,/g, ''), 10);
        execPrice = parseFloat(mExec1[4]);
    } else if (mExec2) {
        const rawAct = mExec2[1].toUpperCase();
        action = (rawAct === 'BOUGHT' || rawAct === 'BOT' || rawAct === 'BUY') ? 'Bought' : 'Sold';
        execSymbol = (symbol || mExec2[3]).toUpperCase().trim();
        execQty = parseInt(mExec2[2].replace(/,/g, ''), 10);
        execPrice = parseFloat(mExec2[4]);
    } else {
        return null;
    }

    if (isNaN(execQty) || execQty <= 0 || isNaN(execPrice) || execPrice <= 0 || !execSymbol) {
        return null;
    }

    // Extract ECN Route
    const mRoute = desc.match(/Route\s+to\s+([A-Z0-9]+)/i);
    let route = mRoute ? mRoute[1].toUpperCase() : 'DIRECT';
    if (route === 'STOP') route = 'BATS';
    if (route === 'NQBX') route = 'BOSX';

    // Extract order description
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

    // Standardize timestamp date format
    const parsedTime = parseTime(timestamp, defaultDateStr, dateFormatSetting);
    const parsedDateObj = parsedTime.dateObj;
    const hasExplicitDate = parsedTime.hasExplicitDate;
    const extractedDateStr = hasExplicitDate ? parsedTime.formattedDateStr : null;

    let formattedTimestamp = timestamp;
    if (!hasExplicitDate && defaultDateStr) {
        formattedTimestamp = `${defaultDateStr} ${timestamp}`;
    }

    return {
        timestamp: formattedTimestamp,
        dateObj: parsedDateObj,
        hasExplicitDate,
        extractedDateStr,
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

/**
 * Defensive Log Batch Validation
 * Generates an instant sanity report before importing
 */
export function validateLogBatch(rawText, defaultDateStr = null, dateFormatSetting = 'DD-MM-YY') {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
        return { isValid: false, valid: false, message: 'Log content is empty.', executions: [], detectedDate: defaultDateStr || null, hasExplicitDate: false, symbols: [] };
    }

    const cleanRaw = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleanRaw.split('\n');
    const executions = [];
    const anomalies = [];
    const symbols = new Set();
    let detectedDate = null;
    let hasExplicitDate = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
            const parsed = parseLogLine(line, defaultDateStr, dateFormatSetting);
            if (parsed) {
                executions.push(parsed);
                symbols.add(parsed.symbol);
                if (!hasExplicitDate && parsed.hasExplicitDate && parsed.extractedDateStr) {
                    hasExplicitDate = true;
                    detectedDate = parsed.extractedDateStr;
                }
            } else if (line.match(/(Bought|Sold|BOT|SLD|BUY|SELL)/i)) {
                anomalies.push({ lineIndex: i + 1, content: line });
            }
        } catch (e) {
            anomalies.push({ lineIndex: i + 1, content: line, error: e.message });
        }
    }

    if (!detectedDate) {
        detectedDate = defaultDateStr || null;
    }

    let previewGrossPnl = 0;
    let previewShares = 0;
    let previewTrades = 0;
    try {
        if (executions.length > 0) {
            const preview = compileSingleDayAnalytics(executions, 0.005, false, 'US_EASTERN');
            if (preview) {
                previewGrossPnl = preview.grossPnl !== undefined ? preview.grossPnl : (preview.pnl || 0);
                previewShares = preview.roundTripShares || 0;
                previewTrades = preview.totalOrders || executions.length;
            }
        }
    } catch (e) { }

    return {
        isValid: executions.length > 0,
        valid: executions.length > 0,
        message: executions.length > 0 ? 'Valid execution fills found.' : 'No valid trade execution fills found in pasted text.',
        totalLines: lines.length,
        executionsCount: executions.length,
        executions,
        symbols: Array.from(symbols),
        hasExplicitDate,
        detectedDate,
        anomalies,
        previewGrossPnl,
        previewShares,
        previewTrades
    };
}

export function extractExecutions(rawText, defaultDateStr = null, dateFormatSetting = 'DD-MM-YY') {
    const report = validateLogBatch(rawText, defaultDateStr, dateFormatSetting);
    return report.executions;
}

export function matchTradesFIFO(executions) {
    const { completedTrades } = matchTradesFIFOWithOpenPos(executions);
    return completedTrades;
}

export function matchTradesFIFOWithOpenPos(executions) {
    const openPositions = {};
    const completedTrades = [];

    const sortedExecs = [...executions].sort((a, b) => {
        const timeA = a.dateObj ? a.dateObj.getTime() : 0;
        const timeB = b.dateObj ? b.dateObj.getTime() : 0;
        return timeA - timeB;
    });

    for (let exec of sortedExecs) {
        const symbol = exec.symbol;
        const execSide = exec.action === 'Bought' ? 'B' : 'S';
        const execTime = exec.dateObj || new Date();

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
                    const holdingSeconds = Math.max(0, (exitTime.getTime() - entryTime.getTime()) / 1000);

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

export function consolidateRoundTripTrades(matchedTrades) {
    if (!matchedTrades || matchedTrades.length === 0) return [];

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
            // Partial fills from the same order only: entry prices match within 1 cent ($0.01)
            Math.abs(trade.entryPrice - currentGroup.entryPrice) < 0.01 &&
            // Executed within 10 seconds of initial fill (same broker order execution window)
            Math.abs(trade.entryTime.getTime() - currentGroup.entryTime.getTime()) < 10000
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

/**
 * Level 2 Tape Scalper Deep-Dive Session Analytics
 */
export function compileSingleDayAnalytics(executions, feePerRoundTripShare = 0.05, enableFees = true, timezone = 'US_EASTERN', journalTopTradesCount = 2) {
    if (!executions || executions.length === 0) return null;

    const sortedExecs = [...executions].sort((a, b) => {
        const timeA = a.dateObj ? a.dateObj.getTime() : 0;
        const timeB = b.dateObj ? b.dateObj.getTime() : 0;
        return timeA - timeB;
    });

    const { completedTrades: trades, openPositionsSummary } = matchTradesFIFOWithOpenPos(sortedExecs);

    let totalBoughtQty = 0;
    let totalSoldQty = 0;
    let grossPnl = trades.reduce((acc, t) => acc + t.pnl, 0);

    const buyOrderDescs = new Set();
    const sellOrderDescs = new Set();
    let buyOrderCount = 0;
    let sellOrderCount = 0;

    sortedExecs.forEach(exec => {
        const timeKey = exec.dateObj ? exec.dateObj.getTime() : exec.timestamp;
        if (exec.action === 'Bought') {
            totalBoughtQty += exec.execQty;
            const key = exec.orderDesc ? `B_${exec.symbol}_${exec.orderDesc}_${timeKey}` : `B_${exec.symbol}_${timeKey}_${exec.execQty}`;
            if (!buyOrderDescs.has(key)) {
                buyOrderDescs.add(key);
                buyOrderCount++;
            }
        } else {
            totalSoldQty += exec.execQty;
            const key = exec.orderDesc ? `S_${exec.symbol}_${exec.orderDesc}_${timeKey}` : `S_${exec.symbol}_${timeKey}_${exec.execQty}`;
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

    // Long vs Short & Scalper Metrics
    const longStats = { count: 0, pnl: 0, volume: 0, winShares: 0, lossShares: 0 };
    const shortStats = { count: 0, pnl: 0, volume: 0, winShares: 0, lossShares: 0 };

    let winPnlTotal = 0;
    let winTradesCount = 0;
    let winSharesTotal = 0;

    let lossPnlTotal = 0;
    let lossTradesCount = 0;
    let lossSharesTotal = 0;

    // Hold time speed buckets (Tape Scalper Focus)
    const holdTimeBuckets = {
        hyperScalp: { label: '< 15s (Lightning)', count: 0, pnl: 0 },
        quickScalp: { label: '15s - 60s (Fast)', count: 0, pnl: 0 },
        momentum: { label: '1m - 3m (Momentum)', count: 0, pnl: 0 },
        extended: { label: '3m - 10m (Extended)', count: 0, pnl: 0 },
        dayTrade: { label: '> 10m (Day Trade)', count: 0, pnl: 0 }
    };

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
            winSharesTotal += t.qty;
        } else if (t.pnl < 0) {
            lossPnlTotal += Math.abs(t.pnl);
            lossTradesCount++;
            lossSharesTotal += t.qty;
        }

        // Speed buckets
        const secs = t.holdingSeconds || 0;
        if (secs < 15) {
            holdTimeBuckets.hyperScalp.count++;
            holdTimeBuckets.hyperScalp.pnl += t.pnl;
        } else if (secs <= 60) {
            holdTimeBuckets.quickScalp.count++;
            holdTimeBuckets.quickScalp.pnl += t.pnl;
        } else if (secs <= 180) {
            holdTimeBuckets.momentum.count++;
            holdTimeBuckets.momentum.pnl += t.pnl;
        } else if (secs <= 600) {
            holdTimeBuckets.extended.count++;
            holdTimeBuckets.extended.pnl += t.pnl;
        } else {
            holdTimeBuckets.dayTrade.count++;
            holdTimeBuckets.dayTrade.pnl += t.pnl;
        }
    });

    const avgWin = winTradesCount > 0 ? winPnlTotal / winTradesCount : 0;
    const avgLoss = lossTradesCount > 0 ? lossPnlTotal / lossTradesCount : 0;
    const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin;

    const totalHoldTime = trades.reduce((acc, t) => acc + (t.holdingSeconds || 0), 0);
    const avgHoldTime = trades.length > 0 ? totalHoldTime / trades.length : 0;
    const winRate = trades.length > 0 ? (winTradesCount / trades.length) * 100 : 0;
    const totalShares = totalBoughtQty + totalSoldQty;

    // Cents / Share Scalper Metrics
    const avgCentsPerWinShare = winSharesTotal > 0 ? (winPnlTotal / winSharesTotal) * 100 : 0;
    const avgCentsPerLossShare = lossSharesTotal > 0 ? (lossPnlTotal / lossSharesTotal) * 100 : 0;
    const netCentsPerShare = roundTripShares > 0 ? (netPnl / roundTripShares) * 100 : 0;
    const pnlPer1kShares = roundTripShares > 0 ? (netPnl / roundTripShares) * 1000 : 0;

    const consolidatedTrades = consolidateRoundTripTrades(trades);

    // Per-Stock Summary (True Matched Realized P&L)
    const stockMap = {};
    sortedExecs.forEach(exec => {
        const sym = exec.symbol;
        if (!stockMap[sym]) {
            stockMap[sym] = {
                symbol: sym,
                boughtQty: 0,
                soldQty: 0,
                executions: []
            };
        }
        stockMap[sym].executions.push(exec);
        if (exec.action === 'Bought') {
            stockMap[sym].boughtQty += exec.execQty;
        } else {
            stockMap[sym].soldQty += exec.execQty;
        }
    });

    const stockBreakdown = Object.values(stockMap).map(stock => {
        const stockTrades = trades.filter(t => t.symbol === stock.symbol);
        const stockGrossPnl = stockTrades.reduce((acc, t) => acc + t.pnl, 0); // Realized FIFO PnL
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
        const stockNet = stockGrossPnl - stockFees;
        const stockCentsPerShare = stockRoundTripShares > 0 ? (stockNet / stockRoundTripShares) * 100 : 0;

        const buys = stock.executions.filter(e => e.action === 'Bought');
        const sells = stock.executions.filter(e => e.action === 'Sold');
        const buyCost = buys.reduce((a, b) => a + (b.execPrice * b.execQty), 0);
        const buyQty = buys.reduce((a, b) => a + b.execQty, 0);
        const sellRevenue = sells.reduce((a, b) => a + (b.execPrice * b.execQty), 0);
        const sellQty = sells.reduce((a, b) => a + b.execQty, 0);

        const stockWins = stockTrades.filter(t => t.pnl > 0).length;
        const stockLosses = stockTrades.filter(t => t.pnl < 0).length;
        const stockWinRate = stockTrades.length > 0 ? (stockWins / stockTrades.length) * 100 : 0;
        const stockGrossProfit = stockTrades.filter(t => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
        const stockGrossLoss = stockTrades.filter(t => t.pnl < 0).reduce((acc, t) => acc + Math.abs(t.pnl), 0);

        return {
            symbol: stock.symbol,
            pnl: stockGrossPnl,
            grossPnl: stockGrossPnl,
            netPnl: stockNet,
            fees: stockFees,
            centsPerShare: stockCentsPerShare,
            totalQty: Math.max(stock.boughtQty, stock.soldQty),
            totalVolume: stock.boughtQty + stock.soldQty,
            roundTripShares: stockRoundTripShares,
            tradesCount: stockTrades.length,
            wins: stockWins,
            losses: stockLosses,
            winRate: stockWinRate,
            grossProfit: stockGrossProfit,
            grossLoss: stockGrossLoss,
            avgHoldTime,
            avgBuyPrice: buyQty > 0 ? buyCost / buyQty : 0,
            avgSellPrice: sellQty > 0 ? sellRevenue / sellQty : 0,
            executions: stock.executions,
            matchedTrades: stockTrades,
            entryDarkpools: Array.from(entryDarkpools),
            exitDarkpools: Array.from(exitDarkpools),
            darkpoolVolume,
            litVolume
        };
    }).sort((a, b) => b.pnl - a.pnl);

    // Intraday Realized Equity Curve
    const sortedTrades = [...trades].sort((a, b) => a.exitTime - b.exitTime);
    let cumulativeRealizedPnl = 0;
    const intradayEquityCurve = [];

    if (sortedTrades.length > 0) {
        const firstTime = sortedTrades[0].entryTime;
        intradayEquityCurve.push({
            timeLabel: formatTimeLabel(firstTime, timezone),
            execPnl: 0,
            tradePnl: 0,
            symbol: 'OPEN',
            qty: 0
        });
    }

    sortedTrades.forEach(t => {
        cumulativeRealizedPnl += t.pnl;
        intradayEquityCurve.push({
            timeLabel: formatTimeLabel(t.exitTime, timezone),
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

    // ECN vs Darkpool
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

    // Stock x Time Matrix
    const stockTimeMatrix = compileStockTimeMatrix(sortedExecs, feePerRoundTripShare, enableFees, timezone);

    // Best and worst trades (Respect user configurable count: min 1, max 10, default 2)
    const topN = Math.max(1, Math.min(10, parseInt(journalTopTradesCount, 10) || 2));
    const sortedByPnl = [...consolidatedTrades].sort((a, b) => b.pnl - a.pnl);
    const bestTrades = sortedByPnl.slice(0, topN);
    const worstTrades = sortedByPnl.filter(t => t.pnl < 0).slice(-topN).reverse();

    return {
        pnl: grossPnl,
        grossPnl,
        grossProfit: winPnlTotal,
        grossLoss: lossPnlTotal,
        profitFactor: lossPnlTotal > 0 ? winPnlTotal / lossPnlTotal : (winPnlTotal > 0 ? 99.99 : 0),
        fees: totalFees,
        netPnl,
        winRate,
        avgHoldTime,
        roundTripShares,
        totalShares,
        totalBoughtQty,
        totalSoldQty,
        totalVolume: totalBoughtQty + totalSoldQty,
        winSharesTotal,
        lossSharesTotal,
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
        avgCentsPerWinShare,
        avgCentsPerLossShare,
        netCentsPerShare,
        pnlPer1kShares,
        holdTimeBuckets,
        winTradesCount,
        lossTradesCount,
        winningTrades: winTradesCount,
        losingTrades: lossTradesCount,
        openPositionsSummary,
        stockBreakdown,
        intradayEquityCurve,
        ecnBreakdown,
        dayDarkpoolVolume,
        dayLitVolume,
        stockTimeMatrix,
        timeOfDayAnalytics: stockTimeMatrix ? stockTimeMatrix.overallSlots : {},
        consolidatedTrades,
        bestTrades,
        worstTrades
    };
}

/**
 * Main parser entry point - takes raw text and produces full day analytics
 */
export function parseLogFile(rawText, feePerRoundTripShare = 0.05, enableFees = true, dateFormatSetting = 'DD-MM-YY', timezone = 'US_EASTERN', journalTopTradesCount = 2) {
    if (!rawText || typeof rawText !== 'string') return null;
    const trimmed = rawText.trim();

    // Check if this is a structured Manual Summary Session
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            const manual = JSON.parse(trimmed);
            if (manual && (manual.isManualSummary || manual.type === 'manual_summary' || manual.netPnl !== undefined || manual.pnl !== undefined)) {
                const grossPnl = parseFloat(manual.grossPnl ?? manual.pnl ?? manual.netPnl ?? 0) || 0;
                const totalShares = parseInt(manual.totalShares ?? manual.roundTripShares ?? 0, 10) || 0;
                const roundTripShares = parseInt(manual.roundTripShares ?? manual.totalShares ?? 0, 10) || totalShares;
                
                // Dynamic Fee Calculation:
                // If fees are enabled, compute fees from round-trip shares (e.g. 55 shares * $0.05 = $2.75)
                // unless explicitly provided in manual payload
                let calculatedFees = 0;
                if (enableFees) {
                    if (manual.fees !== undefined && manual.fees !== null && !isNaN(parseFloat(manual.fees)) && parseFloat(manual.fees) > 0) {
                        calculatedFees = parseFloat(manual.fees);
                    } else {
                        calculatedFees = roundTripShares * feePerRoundTripShare;
                    }
                }

                // Net P&L Calculation:
                // Net = Gross P&L - Fees (matching broker log behavior)
                // unless the user entered an explicit custom Net P&L value
                let netPnl = grossPnl - calculatedFees;
                if (manual.netPnl !== undefined && manual.netPnl !== null && !isNaN(parseFloat(manual.netPnl)) && parseFloat(manual.netPnl) !== grossPnl) {
                    netPnl = parseFloat(manual.netPnl);
                    if (enableFees && calculatedFees === 0) {
                        calculatedFees = Math.max(0, grossPnl - netPnl);
                    }
                }

                const totalOrders = parseInt(manual.totalOrders ?? manual.tradesCount ?? manual.totalTrades ?? 1, 10) || 1;
                const tradesCount = parseInt(manual.tradesCount ?? manual.totalTrades ?? totalOrders, 10) || totalOrders;
                const winTradesCount = parseInt(manual.winTradesCount ?? manual.winningTrades ?? 0, 10) || (netPnl > 0 ? tradesCount : 0);
                const lossTradesCount = parseInt(manual.lossTradesCount ?? manual.losingTrades ?? 0, 10) || (netPnl < 0 ? tradesCount : 0);
                const winRate = manual.winRate !== undefined ? parseFloat(manual.winRate) : (tradesCount > 0 ? (winTradesCount / tradesCount) * 100 : 0);
                const longTrades = parseInt(manual.longTrades ?? 0, 10);
                const shortTrades = parseInt(manual.shortTrades ?? 0, 10);
                const symbols = Array.isArray(manual.symbols) ? manual.symbols : (manual.tickers ? String(manual.tickers).split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : []);

                const stockBreakdown = symbols.map(sym => ({
                    symbol: sym,
                    pnl: netPnl / (symbols.length || 1),
                    grossPnl: grossPnl / (symbols.length || 1),
                    netPnl: netPnl / (symbols.length || 1),
                    totalQty: Math.round(totalShares / (symbols.length || 1)),
                    tradesCount: Math.round(tradesCount / (symbols.length || 1)),
                    matchedTrades: []
                }));

                return {
                    isManualSummary: true,
                    pnl: enableFees ? netPnl : grossPnl,
                    grossPnl,
                    netPnl,
                    fees: calculatedFees,
                    totalOrders,
                    totalTrades: tradesCount,
                    tradesCount,
                    roundTripShares,
                    totalShares,
                    totalVolume: totalShares,
                    winTradesCount,
                    lossTradesCount,
                    winningTrades: winTradesCount,
                    losingTrades: lossTradesCount,
                    winRate,
                    profitFactor: manual.profitFactor || (grossPnl > 0 ? 99.99 : 0),
                    avgHoldTime: manual.avgHoldTime || 0,
                    netCentsPerShare: roundTripShares > 0 ? (netPnl / roundTripShares) * 100 : 0,
                    avgCentsPerWinShare: roundTripShares > 0 ? (grossPnl / roundTripShares) * 100 : 0,
                    avgCentsPerLossShare: 0,
                    pnlPer1kShares: roundTripShares > 0 ? (netPnl / roundTripShares) * 1000 : 0,
                    longStats: { count: longTrades, pnl: 0, volume: 0, winShares: 0, lossShares: 0 },
                    shortStats: { count: shortTrades, pnl: 0, volume: 0, winShares: 0, lossShares: 0 },
                    stockBreakdown,
                    matchedTrades: [],
                    consolidatedTrades: [],
                    allExecutions: [],
                    ecnBreakdown: [],
                    openPositionsSummary: [],
                    hourlyStats: [],
                    intradayPoints: [],
                    bestTrades: [],
                    worstTrades: [],
                    holdTimeBuckets: {},
                    stockTimeMatrix: { matrix: [], timeSlots: [], slotLabels: {}, goldenWindow: null, dangerWindow: null },
                    dayDarkpoolVolume: 0,
                    notes: manual.notes || manual.journalNote || '',
                    symbols
                };
            }
        } catch (e) {
            // Not JSON, continue to raw execution logs
        }
    }

    const executions = extractExecutions(rawText, null, dateFormatSetting);
    if (!executions || executions.length === 0) return null;
    const analytics = compileSingleDayAnalytics(executions, feePerRoundTripShare, enableFees, timezone, journalTopTradesCount);
    if (analytics) {
        analytics.allExecutions = executions;
    }
    return analytics;
}

/**
 * Compile Stock x Time Heatmap Matrix (Per-Stock Best/Worst Trading Window)
 */
export function compileStockTimeMatrix(executions, feePerShare = 0.05, enableFees = true, timezone = 'US_EASTERN') {
    if (!executions || executions.length === 0) return { matrix: [], goldenWindow: null, dangerWindow: null, tickerInsights: {} };

    const trades = matchTradesFIFO(executions);
    const timeSlots = [
        '09:30-10:00',
        '10:00-10:30',
        '10:30-11:00',
        '11:00-12:00',
        '12:00-13:00',
        '13:00-14:00',
        '14:00-15:00',
        '15:00-16:00'
    ];

    const isIst = timezone === 'INDIA_IST';
    const slotLabels = {
        '09:30-10:00': isIst ? '07:00 - 07:30 PM (IST)' : '09:30 - 10:00 AM (EDT)',
        '10:00-10:30': isIst ? '07:30 - 08:00 PM (IST)' : '10:00 - 10:30 AM (EDT)',
        '10:30-11:00': isIst ? '08:00 - 08:30 PM (IST)' : '10:30 - 11:00 AM (EDT)',
        '11:00-12:00': isIst ? '08:30 - 09:30 PM (IST)' : '11:00 - 12:00 PM (EDT)',
        '12:00-13:00': isIst ? '09:30 - 10:30 PM (IST)' : '12:00 - 01:00 PM (EDT)',
        '13:00-14:00': isIst ? '10:30 - 11:30 PM (IST)' : '01:00 - 02:00 PM (EDT)',
        '14:00-15:00': isIst ? '11:30 - 12:30 AM (IST)' : '02:00 - 03:00 PM (EDT)',
        '15:00-16:00': isIst ? '12:30 - 01:30 AM (IST)' : '03:00 - 04:00 PM (EDT)'
    };

    // Overall slot aggregates
    const overallSlots = {};
    timeSlots.forEach(s => {
        overallSlots[s] = { slotKey: s, slotLabel: slotLabels[s], pnl: 0, tradesCount: 0, wins: 0, volume: 0 };
    });

    const stockSlots = {};

    trades.forEach(trade => {
        const timeVal = trade.exitTime || trade.entryTime;
        const d = timeVal instanceof Date ? timeVal : new Date(timeVal);

        // Ground truth US Market Time (America/New_York)
        let h = 9, m = 30;
        try {
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                hour: 'numeric',
                minute: 'numeric',
                hour12: false
            }).formatToParts(d);
            for (const p of parts) {
                if (p.type === 'hour') h = parseInt(p.value, 10);
                if (p.type === 'minute') m = parseInt(p.value, 10);
            }
        } catch (e) {
            h = d.getHours();
            m = d.getMinutes();
        }

        let slotKey = '09:30-10:00';
        if (h < 9 || (h === 9 && m < 30)) slotKey = '09:30-10:00';
        else if (h === 9 && m >= 30) slotKey = '09:30-10:00';
        else if (h === 10 && m < 30) slotKey = '10:00-10:30';
        else if (h === 10 && m >= 30) slotKey = '10:30-11:00';
        else if (h === 11) slotKey = '11:00-12:00';
        else if (h === 12) slotKey = '12:00-13:00';
        else if (h === 13) slotKey = '13:00-14:00';
        else if (h === 14) slotKey = '14:00-15:00';
        else if (h >= 15) slotKey = '15:00-16:00';

        const fees = enableFees ? (trade.qty * feePerShare) : 0;
        const net = trade.pnl - fees;

        // Add to overall
        if (overallSlots[slotKey]) {
            overallSlots[slotKey].pnl += net;
            overallSlots[slotKey].tradesCount += 1;
            if (trade.pnl > 0) overallSlots[slotKey].wins += 1;
            overallSlots[slotKey].volume += trade.qty;
        }

        // Add to stock slots
        const sym = trade.symbol;
        if (!stockSlots[sym]) {
            stockSlots[sym] = { symbol: sym, slots: {} };
            timeSlots.forEach(s => {
                stockSlots[sym].slots[s] = { slotKey: s, pnl: 0, tradesCount: 0, wins: 0, volume: 0 };
            });
        }
        stockSlots[sym].slots[slotKey].pnl += net;
        stockSlots[sym].slots[slotKey].tradesCount += 1;
        if (trade.pnl > 0) stockSlots[sym].slots[slotKey].wins += 1;
        stockSlots[sym].slots[slotKey].volume += trade.qty;
    });

    // Find golden window and danger window overall
    const overallArray = Object.values(overallSlots).filter(s => s.tradesCount > 0);
    const sortedByProfit = [...overallArray].sort((a, b) => b.pnl - a.pnl);
    const goldenWindow = sortedByProfit.length > 0 && sortedByProfit[0].pnl > 0 ? sortedByProfit[0] : null;
    const dangerWindow = sortedByProfit.length > 0 && sortedByProfit[sortedByProfit.length - 1].pnl < 0 ? sortedByProfit[sortedByProfit.length - 1] : null;

    // Per-ticker insights (best & worst time per stock)
    const tickerInsights = {};
    Object.keys(stockSlots).forEach(sym => {
        const slotsArr = Object.values(stockSlots[sym].slots).filter(s => s.tradesCount > 0);
        if (slotsArr.length > 0) {
            const sorted = [...slotsArr].sort((a, b) => b.pnl - a.pnl);
            tickerInsights[sym] = {
                symbol: sym,
                bestSlot: sorted[0].pnl > 0 ? { ...sorted[0], slotLabel: slotLabels[sorted[0].slotKey] } : null,
                worstSlot: sorted[sorted.length - 1].pnl < 0 ? { ...sorted[sorted.length - 1], slotLabel: slotLabels[sorted[sorted.length - 1].slotKey] } : null
            };
        }
    });

    const matrix = Object.values(stockSlots).map(stock => {
        const totalPnl = Object.values(stock.slots).reduce((acc, s) => acc + s.pnl, 0);
        return {
            symbol: stock.symbol,
            totalPnl,
            slots: stock.slots
        };
    }).sort((a, b) => b.totalPnl - a.totalPnl);

    return {
        timeSlots,
        slotLabels,
        overallSlots,
        goldenWindow,
        dangerWindow,
        tickerInsights,
        matrix
    };
}

export function compileDailyStats(executions, feePerRoundTripShare = 0.05, enableFees = true, timezone = 'US_EASTERN') {
    if (!executions || executions.length === 0) return null;
    return compileSingleDayAnalytics(executions, feePerRoundTripShare, enableFees, timezone);
}

export function compileOverallAnalytics(trades, dailyStatsMap, feePerRoundTripShare = 0.05, enableFees = true) {
    if (!trades || trades.length === 0) {
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
            avgCentsPerWinShare: 0,
            avgCentsPerLossShare: 0,
            netCentsPerShare: 0,
            pnlPer1kShares: 0,
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
    let winShares = 0;
    let lossShares = 0;

    const tickerMap = {};

    trades.forEach(trade => {
        grossPnl += trade.pnl;
        totalHoldTime += trade.holdingSeconds || 0;
        totalShares += trade.qty || 0;

        if (trade.pnl > 0) {
            winningTrades++;
            grossProfits += trade.pnl;
            winShares += trade.qty || 0;
        } else if (trade.pnl < 0) {
            losingTrades++;
            grossLosses += Math.abs(trade.pnl);
            lossShares += trade.qty || 0;
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
        stat.totalHoldSeconds += trade.holdingSeconds || 0;
        if (trade.pnl > 0) {
            stat.winningTrades++;
        }
    });

    const dates = Object.keys(dailyStatsMap || {}).sort((a, b) => new Date(a) - new Date(b));
    let totalRoundTripShares = 0;
    dates.forEach(d => {
        if (dailyStatsMap[d] && dailyStatsMap[d].roundTripShares) {
            totalRoundTripShares += dailyStatsMap[d].roundTripShares;
        }
    });

    const totalFees = enableFees ? totalRoundTripShares * feePerRoundTripShare : 0;
    const netPnl = grossPnl - totalFees;

    const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;
    const profitFactor = grossLosses > 0 ? grossProfits / grossLosses : (grossProfits > 0 ? 99.99 : 0);
    const avgHoldTime = trades.length > 0 ? totalHoldTime / trades.length : 0;

    const avgCentsPerWinShare = winShares > 0 ? (grossProfits / winShares) * 100 : 0;
    const avgCentsPerLossShare = lossShares > 0 ? (grossLosses / lossShares) * 100 : 0;
    const netCentsPerShare = totalRoundTripShares > 0 ? (netPnl / totalRoundTripShares) * 100 : 0;
    const pnlPer1kShares = totalRoundTripShares > 0 ? (netPnl / totalRoundTripShares) * 1000 : 0;

    const tickerStats = Object.values(tickerMap).map(stat => {
        const closedTradesForSymbol = trades.filter(t => t.symbol === stat.symbol);
        const roundTripShares = closedTradesForSymbol.reduce((acc, t) => acc + t.qty, 0);
        const tFees = enableFees ? roundTripShares * feePerRoundTripShare : 0;
        const tNet = stat.pnl - tFees;
        return {
            symbol: stat.symbol,
            pnl: stat.pnl,
            grossPnl: stat.pnl,
            netPnl: tNet,
            fees: tFees,
            tradesCount: stat.tradesCount,
            winRate: stat.tradesCount > 0 ? (stat.winningTrades / stat.tradesCount) * 100 : 0,
            volume: stat.volume,
            roundTripShares,
            centsPerShare: roundTripShares > 0 ? (tNet / roundTripShares) * 100 : 0,
            avgHoldTime: stat.tradesCount > 0 ? stat.totalHoldSeconds / stat.tradesCount : 0
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
        avgCentsPerWinShare,
        avgCentsPerLossShare,
        netCentsPerShare,
        pnlPer1kShares,
        tickerStats,
        equityCurve
    };
}

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

export function compileHourlyAnalytics(executions, feePerShare = 0.05, enableFees = true, timezone = 'US_EASTERN') {
    const res = compileStockTimeMatrix(executions, feePerShare, enableFees, timezone);
    return Object.values(res.overallSlots || {}).map(item => {
        const winRate = item.tradesCount > 0 ? (item.wins / item.tradesCount) * 100 : 0;
        return {
            slotKey: item.slotKey,
            hourLabel: item.slotLabel,
            pnl: item.pnl,
            netPnl: item.pnl,
            tradesCount: item.tradesCount,
            winRate,
            volume: item.volume
        };
    });
}

function cleanHtmlText(raw) {
    if (!raw) return '';
    let clean = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    clean = clean.replace(/^Dollar change\s*/i, '').replace(/^Percent change\s*/i, '').trim();
    return clean;
}

export async function fetchStockMarketData(symbol, forceRefresh = false) {
    if (!symbol) return null;
    const sym = symbol.toUpperCase().trim();
    const cacheKey = `finviz_meta_v3_${sym}`;

    if (!forceRefresh) {
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.data && parsed.data.price && parsed.data.price !== '0.00' && (Date.now() - parsed.timestamp < 12 * 60 * 60 * 1000)) {
                    return parsed.data;
                }
            }
        } catch (e) {
            console.warn("Cache read error:", e);
        }
    }

    let metaData = {
        symbol: sym,
        companyName: `${sym} Inc.`,
        sector: 'Financial Services',
        industry: 'Trading & Brokerage',
        country: 'USA',
        price: '0.00',
        change: '+0.00%',
        metrics: {}
    };

    try {
        const targetUrl = `https://finviz.com/quote.ashx?t=${sym}`;
        const urlsToTry = [
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
            targetUrl
        ];

        let htmlText = '';
        for (const url of urlsToTry) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const text = await res.text();
                    if (text && (text.includes('snapshot-td') || text.includes('snapshot-table') || text.includes('quote-header'))) {
                        htmlText = text;
                        break;
                    }
                }
            } catch (err) {
                // Try next endpoint
            }
        }

        if (htmlText) {
            const kv = {};

            // Pattern A: standard div snapshot classes
            const reA = /<div[^>]*class="[^"]*snapshot-td-label[^"]*"[^>]*>(.*?)<\/div>\s*<\/td>\s*<td[^>]*class="[^"]*snapshot-td2[^"]*"[^>]*>\s*<div[^>]*class="[^"]*snapshot-td-content[^"]*"[^>]*>(?:<b>)?(.*?)(?:<\/b>)?<\/div>/gi;
            let m;
            while ((m = reA.exec(htmlText)) !== null) {
                const key = cleanHtmlText(m[1]);
                const val = cleanHtmlText(m[2]);
                if (key && val) kv[key] = val;
            }

            // Pattern B: table cells snapshot-td2-cp / snapshot-td2
            if (Object.keys(kv).length === 0) {
                const reB = /<td[^>]*class="[^"]*snapshot-td2-cp[^"]*"[^>]*>(.*?)<\/td>\s*<td[^>]*class="[^"]*snapshot-td2[^"]*"[^>]*>(?:<b>)?(.*?)(?:<\/b>)?<\/td>/gi;
                while ((m = reB.exec(htmlText)) !== null) {
                    const key = cleanHtmlText(m[1]);
                    const val = cleanHtmlText(m[2]);
                    if (key && val) kv[key] = val;
                }
            }

            // Pattern C: general table snapshot row pairs
            if (Object.keys(kv).length === 0) {
                const reC = /<td[^>]*class="table-dark-row-cp"[^>]*>(.*?)<\/td>\s*<td[^>]*class="table-dark-row"[^>]*>(?:<b>)?(.*?)(?:<\/b>)?<\/td>/gi;
                while ((m = reC.exec(htmlText)) !== null) {
                    const key = cleanHtmlText(m[1]);
                    const val = cleanHtmlText(m[2]);
                    if (key && val) kv[key] = val;
                }
            }

            const mComp = htmlText.match(/class="quote-header_ticker-wrapper_company[^"]*"[^>]*>\s*<a[^>]*>(.*?)<\/a>/i) ||
                htmlText.match(/<title>(.*?)<\/title>/i);
            let compName = mComp ? cleanHtmlText(mComp[1]) : `${sym} Corp`;
            if (compName.includes('Stock Quote')) {
                compName = compName.replace(/Stock Quote.*/i, '').trim();
            }

            const mPrice = htmlText.match(/class="quote-price_price"[^"]*>\s*<strong[^>]*>(.*?)<\/strong>/i) ||
                htmlText.match(/class="quote-price_price"[^>]*>(.*?)<\/strong>/i);
            const mChange = htmlText.match(/class="quote-price_change[^"]*"[^>]*>(.*?)<\/span>/i);

            let cleanPrice = mPrice ? cleanHtmlText(mPrice[1]) : kv["Price"] || kv["Prev Close"] || "0.00";
            let cleanChange = mChange ? cleanHtmlText(mChange[1]) : kv["Change %"] || kv["Change"] || "0.00%";

            if (Object.keys(kv).length > 0 || (cleanPrice && cleanPrice !== '0.00')) {
                metaData = {
                    symbol: sym,
                    companyName: compName || `${sym} Inc.`,
                    price: cleanPrice,
                    change: cleanChange,
                    sector: kv["Sector"] || "Equities",
                    industry: kv["Industry"] || "Common Stock",
                    metrics: kv
                };

                // Only cache successful data
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({
                        timestamp: Date.now(),
                        data: metaData
                    }));
                } catch (e) {
                    console.warn("Cache write error:", e);
                }
            }
        }
    } catch (e) {
        console.log(`Finviz fetch note for ${sym}:`, e);
    }

    return metaData;
}
