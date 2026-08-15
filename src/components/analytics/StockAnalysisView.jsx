import React from 'react';
import {
  Sparkles,
  Search,
  ExternalLink,
  ArrowUpRight,
  Percent,
  Layers
} from 'lucide-react';

export function StockAnalysisView({
  stockViewMode,
  setStockViewMode,
  customStockSearchInput,
  setCustomStockSearchInput,
  selectedStockTicker,
  setSelectedStockTicker,
  tickerStats = [],
  stockMarketMeta,
  selectedStockPersonalHistory = { totalPnl: 0, netPnl: 0, winRate: 0, totalShares: 0, tradesCount: 0, sessions: [] },
  settings = {},
  onInspectSession
}) {
  const formatHoldTime = (secs) => {
    if (!secs || secs < 0) return '0s';
    if (secs < 60) return `${Math.round(secs)}s`;
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}m ${s}s`;
  };

  return (
    <div>
      {/* Top Mode Switcher Bar */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="mode-toggle-bar">
          <button
            className={`mode-toggle-btn ${stockViewMode === 'simple' ? 'active' : ''}`}
            onClick={() => setStockViewMode('simple')}
          >
            Simple Table Mode
          </button>
          <button
            className={`mode-toggle-btn ${stockViewMode === 'advanced' ? 'active' : ''}`}
            onClick={() => setStockViewMode('advanced')}
          >
            <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Advanced Finviz Terminal
          </button>
        </div>

        {stockViewMode === 'advanced' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search ticker (e.g. CZFS)..."
                value={customStockSearchInput}
                onChange={(e) => setCustomStockSearchInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customStockSearchInput) {
                    setSelectedStockTicker(customStockSearchInput.trim().toUpperCase());
                  }
                }}
                style={{ paddingLeft: '30px', paddingRight: '10px', width: '220px', fontSize: '0.82rem' }}
              />
            </div>
            {customStockSearchInput && (
              <button
                className="btn"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                onClick={() => setSelectedStockTicker(customStockSearchInput.trim().toUpperCase())}
              >
                Load Ticker
              </button>
            )}
          </div>
        )}
      </div>

      {/* MODE 1: ADVANCED FINVIZ FINANCIAL TERMINAL */}
      {stockViewMode === 'advanced' && (
        <div>
          {/* Horizontal Ticker Selection Pill List with Flex Wrap */}
          <div className="ticker-pill-bar">
            {tickerStats.map(stat => (
              <div
                key={stat.symbol}
                className={`ticker-pill ${selectedStockTicker === stat.symbol ? 'active' : ''}`}
                onClick={() => setSelectedStockTicker(stat.symbol)}
              >
                {stat.symbol} <span style={{ opacity: 0.85 }}>({(stat.pnl || 0) >= 0 ? '+' : ''}${Math.round(stat.pnl || 0)})</span>
              </div>
            ))}
          </div>

          {/* Finviz Live Scraped Terminal Card */}
          {selectedStockTicker && (
            <div className="stock-terminal-header">
              <div className="stock-terminal-title">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="stock-terminal-symbol">{selectedStockTicker}</span>
                    <span className="badge badge-route" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', border: 'none' }}>
                      {stockMarketMeta ? stockMarketMeta.sector : 'Financials'}
                    </span>
                    <span className="badge badge-darkpool" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#a7f3d0', border: 'none' }}>
                      {stockMarketMeta ? stockMarketMeta.industry : 'Regional Banks'}
                    </span>
                  </div>
                  <div className="stock-terminal-name">
                    {stockMarketMeta ? stockMarketMeta.companyName : `${selectedStockTicker} Inc.`}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div className="stock-terminal-price-box">
                    <div className="stock-terminal-price">${stockMarketMeta ? stockMarketMeta.price : '0.00'}</div>
                    <div className={`stock-terminal-change ${stockMarketMeta && stockMarketMeta.change?.includes('-') ? 'change-red' : 'change-green'}`}>
                      {stockMarketMeta ? stockMarketMeta.change : '0.00%'}
                    </div>
                  </div>

                  <a 
                    href={`https://finviz.com/quote.ashx?t=${selectedStockTicker}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    <ExternalLink size={14} /> Open on Finviz
                  </a>
                </div>
              </div>

              {/* Grouped Finviz stock metrics into 4 cards with clean 2x2 grid layout */}
              {stockMarketMeta && stockMarketMeta.metrics && (
                <div className="finviz-grouped-cards">
                  {/* Card 1: Valuation & Financial Info */}
                  <div className="metrics-group-card">
                    <div className="metrics-group-title">Valuation &amp; Financial Info</div>
                    <div className="metrics-inner-grid">
                      {[
                        { key: 'Index', label: 'Index' },
                        { key: 'Market Cap', label: 'Market Cap' },
                        { key: 'P/E', label: 'P/E Ratio' },
                        { key: 'Target Price', label: 'Target Price' },
                        { key: 'Short Float', label: 'Short Float' }
                      ].map(item => {
                        const val = stockMarketMeta.metrics[item.key] || stockMarketMeta[item.key.toLowerCase()] || '-';
                        return (
                          <div key={item.key} className="metric-item">
                            <span className="finviz-metric-label">{item.label}</span>
                            <span className="finviz-metric-value">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card 2: Technicals & Price Range */}
                  <div className="metrics-group-card">
                    <div className="metrics-group-title">Technicals &amp; Price Range</div>
                    <div className="metrics-inner-grid">
                      {[
                        { key: 'Price', label: 'Last Price' },
                        { key: 'Prev Close', label: 'Prev Close' },
                        { key: 'ATR (14)', label: 'ATR (14)' },
                        { key: 'Volatility', label: 'Volatility Range' },
                        { key: '52W High', label: '52-Week High' },
                        { key: '52W Low', label: '52-Week Low' }
                      ].map(item => {
                        const val = stockMarketMeta.metrics[item.key] || stockMarketMeta[item.key.toLowerCase()] || '-';
                        return (
                          <div key={item.key} className="metric-item">
                            <span className="finviz-metric-label">{item.label}</span>
                            <span className="finviz-metric-value">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card 3: Volume & Liquidity */}
                  <div className="metrics-group-card">
                    <div className="metrics-group-title">Volume &amp; Liquidity</div>
                    <div className="metrics-inner-grid">
                      {[
                        { key: 'Volume', label: 'Session Volume' },
                        { key: 'Avg Volume', label: 'Avg Volume (3M)' },
                        { key: 'IPO', label: 'IPO Date' }
                      ].map(item => {
                        const val = stockMarketMeta.metrics[item.key] || stockMarketMeta[item.key.toLowerCase()] || '-';
                        return (
                          <div key={item.key} className="metric-item">
                            <span className="finviz-metric-label">{item.label}</span>
                            <span className="finviz-metric-value">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card 4: Corporate Calendar */}
                  <div className="metrics-group-card">
                    <div className="metrics-group-title">Corporate Calendar</div>
                    <div className="metrics-inner-grid">
                      {[
                        { key: 'Earnings', label: 'Earnings Release' },
                        { key: 'Dividend Ex-Date', label: 'Ex-Dividend Date' }
                      ].map(item => {
                        const val = stockMarketMeta.metrics[item.key] || stockMarketMeta[item.key.toLowerCase()] || '-';
                        return (
                          <div key={item.key} className="metric-item">
                            <span className="finviz-metric-label">{item.label}</span>
                            <span className="finviz-metric-value">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Personal Trading Summary Card for Selected Stock */}
          <div className="grid-cards" style={{ marginBottom: '1.5rem' }}>
            <div className="card card-hero">
              <div className="card-top">
                <span className="card-title">My Realized P&amp;L on {selectedStockTicker}</span>
                <button className="card-icon-btn"><ArrowUpRight size={16} /></button>
              </div>
              <div className="card-value">
                {(selectedStockPersonalHistory.totalPnl || 0) >= 0 ? '+' : ''}${((selectedStockPersonalHistory.totalPnl || 0)).toFixed(2)}
              </div>
              <span className="card-footer-tag tag-profit">
                {settings?.enableFees ? `Net: $${((selectedStockPersonalHistory.netPnl ?? selectedStockPersonalHistory.totalPnl) || 0).toFixed(2)}` : 'Personal Symbol Performance'}
              </span>
            </div>

            <div className="card">
              <div className="card-top">
                <span className="card-title">Win Rate on {selectedStockTicker}</span>
                <button className="card-icon-btn"><Percent size={16} /></button>
              </div>
              <div className="card-value">
                {(selectedStockPersonalHistory.winRate || 0).toFixed(2)}%
              </div>
              <span className="card-footer-tag tag-profit">
                {selectedStockPersonalHistory.tradesCount || 0} Trades Closed
              </span>
            </div>

            <div className="card">
              <div className="card-top">
                <span className="card-title">Volume Traded</span>
                <button className="card-icon-btn"><Layers size={16} /></button>
              </div>
              <div className="card-value">
                {(selectedStockPersonalHistory.totalShares || 0).toLocaleString()} Shares
              </div>
              <span className="card-footer-tag" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                Across {(selectedStockPersonalHistory.sessions || []).length} Sessions
              </span>
            </div>
          </div>

          {/* Day-by-Day Trade Log Table for Selected Stock */}
          <div className="card">
            <div className="card-top">
              <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                Session-by-Session Performance Log for {selectedStockTicker}
              </span>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Session Date</th>
                    <th>Realized P&amp;L</th>
                    {settings?.enableFees && <th>Net P&amp;L</th>}
                    <th>Trades</th>
                    <th>Shares Traded</th>
                    <th>Avg Buy Price</th>
                    <th>Avg Sell Price</th>
                    <th>Avg Hold</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStockPersonalHistory.sessions && selectedStockPersonalHistory.sessions.length > 0 ? (
                    selectedStockPersonalHistory.sessions.map(s => (
                      <tr key={s.date}>
                        <td style={{ fontWeight: 800 }}>{s.date}</td>
                        <td style={{ fontWeight: 800, color: (s.pnl || 0) >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                          {(s.pnl || 0) >= 0 ? '+' : ''}${(s.pnl || 0).toFixed(2)}
                        </td>
                        {settings?.enableFees && (
                          <td style={{ fontWeight: 700, color: ((s.netPnl ?? s.pnl) || 0) >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                            {((s.netPnl ?? s.pnl) || 0) >= 0 ? '+' : ''}${((s.netPnl ?? s.pnl) || 0).toFixed(2)}
                          </td>
                        )}
                        <td>{s.tradesCount || 0}</td>
                        <td>{(s.totalQty || 0).toLocaleString()} shs</td>
                        <td>${(s.avgBuyPrice || 0).toFixed(2)}</td>
                        <td>${(s.avgSellPrice || 0).toFixed(2)}</td>
                        <td>{formatHoldTime(s.avgHoldTime || 0)}</td>
                        <td>
                          <button className="btn btn-secondary" style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }} onClick={() => onInspectSession(s.date)}>
                            Inspect Session
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={settings?.enableFees ? 9 : 8} style={{ textAlign: 'center', padding: '2rem 0', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                        No trade logs found for ticker {selectedStockTicker}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: SIMPLE TABLE MODE */}
      {stockViewMode === 'simple' && (
        <div className="card">
          <div className="card-top">
            <span className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>
              Stock-by-Stock Accumulated Performance
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Ticker Symbol</th>
                  <th>Total Realized P&amp;L</th>
                  <th>Total Trades</th>
                  <th>Win Rate</th>
                  <th>Shares Traded</th>
                  <th>Avg Hold Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tickerStats.map(stat => (
                  <tr key={stat.symbol}>
                    <td style={{ fontWeight: 800 }}>{stat.symbol}</td>
                    <td style={{ fontWeight: 800, color: (stat.pnl || 0) >= 0 ? 'var(--hero-green)' : 'var(--rose-text)' }}>
                      {(stat.pnl || 0) >= 0 ? '+' : ''}${(stat.pnl || 0).toFixed(2)}
                    </td>
                    <td>{stat.tradesCount || 0}</td>
                    <td>{(stat.winRate || 0).toFixed(2)}%</td>
                    <td>{(stat.volume || 0).toLocaleString()}</td>
                    <td>{formatHoldTime(stat.avgHoldTime || 0)}</td>
                    <td>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          setSelectedStockTicker(stat.symbol);
                          setStockViewMode('advanced');
                        }}
                      >
                        Inspect Finviz Terminal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
