import React from 'react';
import { Layers, Activity, Zap } from 'lucide-react';

export function ECNAnalyticsView({ globalECNAnalytics = {} }) {
  const safeData = {
    totalVolume: globalECNAnalytics?.totalVolume || 0,
    litVolume: globalECNAnalytics?.litVolume || 0,
    darkpoolVolume: globalECNAnalytics?.darkpoolVolume || 0,
    litPct: globalECNAnalytics?.litPct || 0,
    darkpoolPct: globalECNAnalytics?.darkpoolPct || 0,
    routeStats: globalECNAnalytics?.routeStats || [],
    stockDarkpoolSummary: globalECNAnalytics?.stockDarkpoolSummary || []
  };

  return (
    <div>
      <div className="grid-cards">
        <div className="card card-hero">
          <div className="card-top">
            <span className="card-title">Total Execution Volume</span>
            <button className="card-icon-btn"><Layers size={16} /></button>
          </div>
          <div className="card-value">
            {safeData.totalVolume.toLocaleString()} Shares
          </div>
          <span className="card-footer-tag tag-profit">
            {safeData.routeStats.length} Unique Venues
          </span>
        </div>

        <div className="card">
          <div className="card-top">
            <span className="card-title">ECN Volume</span>
            <button className="card-icon-btn"><Activity size={16} color="var(--emerald)" /></button>
          </div>
          <div className="card-value">
            {safeData.litVolume.toLocaleString()} Shares
          </div>
          <span className="card-footer-tag tag-profit">
            {(safeData.litPct || 0).toFixed(2)}% ECN Market Share
          </span>
        </div>

        <div className="card">
          <div className="card-top">
            <span className="card-title">Darkpool Liquidity Volume</span>
            <button className="card-icon-btn"><Zap size={16} color="var(--purple-text)" /></button>
          </div>
          <div className="card-value" style={{ color: 'var(--purple-text)' }}>
            {safeData.darkpoolVolume.toLocaleString()} Shares
          </div>
          <span className="card-footer-tag" style={{ backgroundColor: 'var(--purple-bg)', color: 'var(--purple-text)' }}>
            {(safeData.darkpoolPct || 0).toFixed(2)}% Darkpool Share
          </span>
        </div>
      </div>

      <div className="row-2-col">
        <div className="card">
          <div className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, marginBottom: '1rem' }}>
            Venue Breakdown (ECNs vs Darkpools)
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Venue Route</th>
                  <th>Type</th>
                  <th>Routed Volume</th>
                  <th>Fills</th>
                  <th>% Share</th>
                </tr>
              </thead>
              <tbody>
                {safeData.routeStats.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className={`badge ${item.isDarkpool ? 'badge-darkpool' : 'badge-route'}`}>
                        {item.route}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: item.isDarkpool ? 'var(--purple-text)' : 'var(--blue-text)' }}>
                      {item.typeLabel}
                    </td>
                    <td style={{ fontWeight: 700 }}>{(item.volume || 0).toLocaleString()} shares</td>
                    <td>{item.fills || 0}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flexGrow: 1, height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${item.pctVolume || 0}%`, backgroundColor: item.isDarkpool ? '#6b21a8' : '#10b981' }}></div>
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{(item.pctVolume || 0).toFixed(2)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700, marginBottom: '1rem' }}>
            Darkpool Stock Usage Summary
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Darkpool Vol</th>
                  <th>Entry Darkpools</th>
                  <th>Exit Darkpools</th>
                </tr>
              </thead>
              <tbody>
                {safeData.stockDarkpoolSummary.length > 0 ? (
                  safeData.stockDarkpoolSummary.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>{item.symbol}</td>
                      <td style={{ fontWeight: 700, color: 'var(--purple-text)' }}>{(item.darkpoolVolume || 0).toLocaleString()} shs</td>
                      <td>
                        {item.entryDarkpools?.length > 0 ? (
                          item.entryDarkpools.map(dp => <span key={dp} className="badge badge-darkpool" style={{ marginRight: '0.2rem' }}>{dp}</span>)
                        ) : <span style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>ECN Only</span>}
                      </td>
                      <td>
                        {item.exitDarkpools?.length > 0 ? (
                          item.exitDarkpools.map(dp => <span key={dp} className="badge badge-darkpool" style={{ marginRight: '0.2rem' }}>{dp}</span>)
                        ) : <span style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>ECN Only</span>}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem 0', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                      No Darkpool fills recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
