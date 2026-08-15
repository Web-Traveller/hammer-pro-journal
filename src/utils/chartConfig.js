/**
 * Dynamic Profit/Loss Gradient: Emerald above $0, Rose Red below $0
 */
export function getEquityGradient(context) {
  const chart = context.chart;
  const { ctx, chartArea, scales } = chart;
  if (!chartArea || !scales.y) return 'rgba(16, 185, 129, 0.1)';

  const zeroY = scales.y.getPixelForValue(0);
  const top = chartArea.top;
  const bottom = chartArea.bottom;
  const height = bottom - top;
  if (height <= 0) return 'rgba(16, 185, 129, 0.1)';

  const zeroRatio = Math.max(0, Math.min(1, (zeroY - top) / height));

  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  // Above 0: Emerald Green
  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.32)');
  gradient.addColorStop(Math.max(0, zeroRatio - 0.01), 'rgba(16, 185, 129, 0.02)');
  // Below 0: Rose Red
  gradient.addColorStop(Math.min(1, zeroRatio + 0.01), 'rgba(244, 63, 94, 0.02)');
  gradient.addColorStop(1, 'rgba(244, 63, 94, 0.32)');

  return gradient;
}

/**
 * Rich Intraday Tooltip displaying stock, action, price, route, and cumulative balance
 */
export function getIntradayChartOptions(curve = []) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#94a3b8',
        bodyColor: '#f8fafc',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        titleFont: { size: 12, weight: '700' },
        bodyFont: { size: 12, weight: '600' },
        displayColors: false,
        callbacks: {
          title: (items) => {
            if (!items.length) return '';
            const raw = curve[items[0].dataIndex];
            if (!raw) return '';
            if (raw.symbol === 'OPEN') return 'Session Open (9:30 AM)';
            return `${raw.timeLabel} • ${raw.symbol}`;
          },
          label: (context) => {
            const raw = curve[context.dataIndex];
            if (!raw) return `P&L: $${((context?.raw || 0)).toFixed(2)}`;
            if (raw.symbol === 'OPEN') return 'Starting Balance: $0.00';
            const sideText = raw.side === 'B' ? 'BUY / Long' : 'SELL / Short';
            const tradePnlStr = ((raw.tradePnl || 0) >= 0 ? '+' : '') + '$' + ((raw.tradePnl || 0)).toFixed(2);
            const totalStr = ((raw.execPnl || 0) >= 0 ? '+' : '') + '$' + ((raw.execPnl || 0)).toFixed(2);
            const routeStr = raw.exitRoute ? `Route: ${raw.exitRoute}` : '';
            const priceStr = raw.exitPrice ? `@ $${((raw.exitPrice || 0)).toFixed(2)}` : '';
            return [
              `Trade: ${raw.symbol} (${sideText} ${raw.qty || 0} shs ${priceStr})`,
              `Trade Realized P&L: ${tradePnlStr}`,
              `Cumulative Day P&L: ${totalStr}`,
              routeStr
            ].filter(Boolean);
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 9, color: '#9ca3af', font: { size: 11, weight: '600' } }
      },
      y: {
        grid: { color: '#f3f4f6' },
        ticks: {
          color: '#9ca3af',
          font: { size: 11, weight: '600' },
          callback: (val) => {
            const num = Number(val);
            return isNaN(num) ? '$0.00' : (num >= 0 ? '$' : '-$') + Math.abs(num).toFixed(2);
          }
        }
      }
    }
  };
}

export const smoothIntradayChartOptions = getIntradayChartOptions([]);

export const smoothEquityChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0f172a',
      titleColor: '#94a3b8',
      bodyColor: '#10b981',
      borderColor: '#334155',
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (context) => {
          const num = Number(context.raw);
          const formatted = isNaN(num) ? '0.00' : (num >= 0 ? '+$' : '-$') + Math.abs(num).toFixed(2);
          return `Accumulated Equity: ${formatted}`;
        }
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, color: '#9ca3af', font: { size: 11 } }
    },
    y: {
      grid: { color: '#f3f4f6' },
      ticks: {
        color: '#9ca3af',
        font: { size: 11 },
        callback: (val) => {
          const num = Number(val);
          return isNaN(num) ? '$0.00' : (num >= 0 ? '$' : '-$') + Math.abs(num).toFixed(2);
        }
      }
    }
  }
};
