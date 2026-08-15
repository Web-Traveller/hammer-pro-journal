import React, { useEffect, useRef, useState } from 'react';
import { Share2, X, Download, Copy, Check, Sun, Moon } from 'lucide-react';
import { formatDisplayDate } from '../../services/timeService';

export function ShareCardModal({
  isOpen,
  sessionStats,
  analytics,
  sessionDate,
  timezone,
  onClose,
  onToast
}) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [themeMode, setThemeMode] = useState('light'); // 'light' (Ceramic Emerald) | 'dark' (Midnight Obsidian)
  const stats = sessionStats || analytics;

  useEffect(() => {
    if (!isOpen || !canvasRef.current || !stats) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 1200;
    const h = 675;
    canvas.width = w;
    canvas.height = h;

    const isLight = themeMode === 'light';
    const netPnlVal = stats.netPnl !== undefined ? stats.netPnl : (stats.pnl || 0);
    const isProfitable = netPnlVal >= 0;

    // Theme Color Tokens
    const colors = isLight ? {
      bgGradStart: '#ffffff',
      bgGradEnd: '#f8fafc',
      outerBorder: '#e2e8f0',
      brandMain: '#064e3b',
      brandAccent: '#10b981',
      datePillBg: '#ecfdf5',
      datePillBorder: '#a7f3d0',
      datePillText: '#065f46',
      labelMuted: '#64748b',
      subMuted: '#94a3b8',
      textMain: '#0f172a',
      pnlGreen: '#047857',
      pnlRed: '#e11d48',
      cardBg: '#ffffff',
      cardBorder: '#e2e8f0',
      chartPanelBg: '#ffffff',
      chartPanelBorder: '#e2e8f0',
      chartGrid: '#f1f5f9',
      baseline: '#cbd5e1',
      watermark: '#94a3b8'
    } : {
      bgGradStart: '#090d16',
      bgGradEnd: '#0c1220',
      outerBorder: '#1e293b',
      brandMain: '#ffffff',
      brandAccent: '#10b981',
      datePillBg: '#131d31',
      datePillBorder: '#1e293b',
      datePillText: '#94a3b8',
      labelMuted: '#64748b',
      subMuted: '#64748b',
      textMain: '#f8fafc',
      pnlGreen: '#10b981',
      pnlRed: '#f43f5e',
      cardBg: '#111827',
      cardBorder: '#1e293b',
      chartPanelBg: '#0f172a',
      chartPanelBorder: '#1e293b',
      chartGrid: '#1e293b',
      baseline: '#334155',
      watermark: '#475569'
    };

    // 1. Canvas Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, colors.bgGradStart);
    bgGrad.addColorStop(1, colors.bgGradEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle Outer Frame Border
    ctx.strokeStyle = colors.outerBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    // 2. Top Header Brand & Session Pill
    // Brand Logo & Text
    ctx.fillStyle = colors.brandMain;
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
    ctx.fillText('HAMMER PRO', 60, 68);

    ctx.fillStyle = colors.brandAccent;
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
    ctx.fillText('JOURNAL', 208, 67);

    // Verified Session Pill (Top Right)
    const displayDate = formatDisplayDate(sessionDate) || sessionDate;
    const tzBadge = timezone === 'INDIA_IST' ? 'IST' : 'EDT';
    const headerPillText = `SESSION: ${displayDate.toUpperCase()} • ${tzBadge}`;
    
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
    const pillTextWidth = ctx.measureText(headerPillText).width;
    const pillW = pillTextWidth + 32;
    const pillH = 34;
    const pillX = w - 60 - pillW;
    const pillY = 46;

    ctx.fillStyle = colors.datePillBg;
    ctx.strokeStyle = colors.datePillBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.datePillText;
    ctx.fillText(headerPillText, pillX + 16, pillY + 22);

    // 3. Primary Metric: Net Realized Session Return
    ctx.fillStyle = colors.labelMuted;
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
    ctx.letterSpacing = '1.5px';
    ctx.fillText('NET REALIZED SESSION RETURN', 60, 145);
    ctx.letterSpacing = '0px';

    const pnlPrefix = isProfitable ? '+$' : '-$';
    const pnlFormatted = `${pnlPrefix}${Math.abs(netPnlVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    ctx.fillStyle = isProfitable ? colors.pnlGreen : colors.pnlRed;
    ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
    ctx.fillText(pnlFormatted, 60, 215);

    // Gross & Fee Sub-Row
    const grossVal = stats.grossPnl !== undefined ? stats.grossPnl : (stats.pnl || 0);
    const feesVal = stats.fees || 0;
    ctx.fillStyle = colors.labelMuted;
    ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
    ctx.fillText(
      `Gross P&L: $${grossVal.toFixed(2)}    •    Routing & ECN Fees: $${feesVal.toFixed(2)}`,
      60,
      250
    );

    // 4. Four Core Executive KPI Metric Cards
    const winRateVal = stats.totalOrders > 0
      ? ((stats.winningTrades / stats.totalOrders) * 100).toFixed(2)
      : '0.00';
    const edgeVal = (stats.netCentsPerShare !== undefined ? stats.netCentsPerShare : (stats.centsPerShare || 0));

    const metrics = [
      {
        label: 'WIN RATE',
        val: `${winRateVal}%`,
        sub: `${stats.winningTrades || 0}/${stats.totalOrders || 0} Trades Won`
      },
      {
        label: 'PROFIT FACTOR',
        val: `${(stats.profitFactor || 0).toFixed(2)}`,
        sub: 'Gross Win/Loss Ratio'
      },
      {
        label: 'ROUND-TRIP SHARES',
        val: (stats.roundTripShares || 0).toLocaleString(),
        sub: `${(stats.totalVolume || ((stats.roundTripShares || 0) * 2)).toLocaleString()} Total Executed`
      },
      {
        label: 'NET EDGE / SHARE',
        val: `${edgeVal >= 0 ? '+' : ''}${edgeVal.toFixed(2)}¢`,
        sub: 'Average Net Expectancy'
      }
    ];

    const boxW = 255;
    const boxH = 84;
    const startX = 60;
    const startY = 285;

    metrics.forEach((m, idx) => {
      const x = startX + idx * (boxW + 20);

      // Card Background & Border
      ctx.fillStyle = colors.cardBg;
      ctx.strokeStyle = colors.cardBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, startY, boxW, boxH, 10);
      ctx.fill();
      ctx.stroke();

      // Top Label
      ctx.fillStyle = colors.labelMuted;
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
      ctx.fillText(m.label, x + 16, startY + 24);

      // Core Value
      ctx.fillStyle = colors.textMain;
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
      ctx.fillText(m.val, x + 16, startY + 52);

      // Subtitle
      ctx.fillStyle = colors.subMuted;
      ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
      ctx.fillText(m.sub, x + 16, startY + 72);
    });

    // 5. Intraday Realized Equity Trajectory Curve
    const curve = stats.intradayEquityCurve || [];
    const chartX = 60;
    const chartY = 395;
    const chartW = 1080;
    const chartH = 195;

    // Chart Panel Background
    ctx.fillStyle = colors.chartPanelBg;
    ctx.strokeStyle = colors.chartPanelBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(chartX, chartY, chartW, chartH, 12);
    ctx.fill();
    ctx.stroke();

    // Chart Panel Title
    ctx.fillStyle = colors.labelMuted;
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
    ctx.fillText('INTRADAY REALIZED TRAJECTORY CURVE', chartX + 20, chartY + 28);

    if (curve.length > 1) {
      const pnlVals = curve.map(c => c.execPnl || 0);
      const minPnl = Math.min(...pnlVals, 0);
      const maxPnl = Math.max(...pnlVals, 0);
      const range = (maxPnl - minPnl) || 1;

      const innerX = chartX + 24;
      const innerW = chartW - 48;
      const innerY = chartY + 45;
      const innerH = chartH - 65;

      const getY = (val) => innerY + innerH - ((val - minPnl) / range) * innerH;

      // Draw zero baseline
      const zeroY = getY(0);
      ctx.strokeStyle = colors.baseline;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(innerX, zeroY);
      ctx.lineTo(innerX + innerW, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Baseline label ($0.00)
      ctx.fillStyle = colors.subMuted;
      ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
      ctx.fillText('$0.00', innerX + innerW - 35, zeroY - 5);

      // Area Gradient Fill under trajectory
      const areaGrad = ctx.createLinearGradient(0, innerY, 0, innerY + innerH);
      if (isProfitable) {
        areaGrad.addColorStop(0, isLight ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.16)');
        areaGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      } else {
        areaGrad.addColorStop(0, isLight ? 'rgba(225, 29, 72, 0.18)' : 'rgba(244, 63, 94, 0.16)');
        areaGrad.addColorStop(1, 'rgba(225, 29, 72, 0.0)');
      }

      ctx.fillStyle = areaGrad;
      ctx.beginPath();
      curve.forEach((pt, i) => {
        const x = innerX + (i / (curve.length - 1)) * innerW;
        const y = getY(pt.execPnl || 0);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(innerX + innerW, zeroY);
      ctx.lineTo(innerX, zeroY);
      ctx.closePath();
      ctx.fill();

      // Smooth Curve Line
      ctx.strokeStyle = isProfitable ? (isLight ? '#059669' : '#10b981') : (isLight ? '#e11d48' : '#f43f5e');
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      curve.forEach((pt, i) => {
        const x = innerX + (i / (curve.length - 1)) * innerW;
        const y = getY(pt.execPnl || 0);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Final Point Accent Dot
      const finalX = innerX + innerW;
      const finalY = getY(pnlVals[pnlVals.length - 1]);
      ctx.fillStyle = isProfitable ? (isLight ? '#059669' : '#10b981') : (isLight ? '#e11d48' : '#f43f5e');
      ctx.beginPath();
      ctx.arc(finalX, finalY, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = colors.labelMuted;
      ctx.font = 'italic 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
      ctx.fillText('Single trade session — flat execution trajectory', chartX + 20, chartY + 100);
    }

    // 6. Footer Ribbon: Top Performed Symbols & Watermark
    const topSymbols = (stats.stockBreakdown || [])
      .slice(0, 3)
      .map(s => `${s.symbol} (${(s.pnl || 0) >= 0 ? '+' : ''}$${(s.pnl || 0).toFixed(2)})`)
      .join('    •    ');

    ctx.fillStyle = colors.labelMuted;
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
    if (topSymbols) {
      ctx.fillText(`Top Symbols: ${topSymbols}`, 60, 628);
    } else {
      ctx.fillText('Session Verified by Hammer Pro Journal', 60, 628);
    }

    ctx.fillStyle = colors.watermark;
    ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
    ctx.fillText('hammerpro.app', w - 165, 628);

  }, [isOpen, stats, sessionDate, timezone, themeMode]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `HammerPro_Performance_${sessionDate || 'session'}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    if (onToast) onToast('Performance card downloaded as high-res PNG!', 'success');
  };

  const handleCopy = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
          if (onToast) onToast('Performance card copied to clipboard!', 'success');
        }
      });
    } catch (err) {
      console.warn("Clipboard write failed, using dataURL fallback:", err);
      if (onToast) onToast('Please use the Download button on this browser.', 'info');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="custom-modal-overlay" onClick={onClose}>
      <div
        className="custom-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '980px', width: '92vw', background: '#ffffff', border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '1.25rem', boxShadow: '0 25px 60px rgba(0, 0, 0, 0.15)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Share2 size={20} color="#064e3b" />
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              Daily P&amp;L Performance Card
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme Style Switcher */}
            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '999px', padding: '3px', gap: '3px' }}>
              <button
                onClick={() => setThemeMode('light')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: themeMode === 'light' ? '#ffffff' : 'transparent',
                  color: themeMode === 'light' ? '#064e3b' : '#64748b',
                  boxShadow: themeMode === 'light' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Sun size={13} /> Ceramic Light
              </button>

              <button
                onClick={() => setThemeMode('dark')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: themeMode === 'dark' ? '#0f172a' : 'transparent',
                  color: themeMode === 'dark' ? '#ffffff' : '#64748b',
                  boxShadow: themeMode === 'dark' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Moon size={13} /> Obsidian Slate
              </button>
            </div>

            <button
              onClick={onClose}
              className="lightbox-close-btn"
              style={{ position: 'static', background: '#f1f5f9', color: '#0f172a' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Canvas Visual Container */}
        <div style={{
          width: '100%',
          overflow: 'hidden',
          borderRadius: '0.85rem',
          border: '1px solid #e2e8f0',
          backgroundColor: themeMode === 'light' ? '#f8fafc' : '#090d16',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)'
        }}>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block'
            }}
          />
        </div>

        {/* Modal Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            High-definition 1200×675 PNG ready for Twitter, Discord, and trading communities
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleCopy}
              className="btn btn-secondary"
              style={{
                padding: '0.55rem 1.1rem',
                fontSize: '0.85rem'
              }}
            >
              {copied ? <Check size={16} color="#059669" /> : <Copy size={16} />}
              {copied ? 'Copied to Clipboard!' : 'Copy Image'}
            </button>

            <button
              onClick={handleDownload}
              className="btn"
              style={{
                padding: '0.55rem 1.25rem',
                fontSize: '0.85rem'
              }}
            >
              <Download size={16} /> Download High-Res PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
