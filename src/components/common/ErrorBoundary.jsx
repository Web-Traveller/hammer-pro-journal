import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2.5rem',
          margin: '2rem',
          backgroundColor: '#fff',
          borderRadius: '1rem',
          border: '1px solid #fee2e2',
          boxShadow: '0 10px 25px rgba(239, 68, 68, 0.08)',
          textAlign: 'center',
          maxWidth: '650px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto'
          }}>
            <AlertTriangle size={28} />
          </div>
          <h3 style={{ color: '#111827', fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            View Rendering Protected
          </h3>
          <p style={{ color: '#6b7280', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            An unexpected error occurred in this view. Your saved logs and journals are completely safe.
          </p>
          <div style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            padding: '0.85rem',
            fontSize: '0.78rem',
            fontFamily: 'monospace',
            color: '#b91c1c',
            textAlign: 'left',
            marginBottom: '1.5rem',
            overflowX: 'auto'
          }}>
            {this.state.error?.toString() || 'Unknown Error'}
          </div>
          <button
            className="btn"
            onClick={this.handleReset}
            style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} /> Recover & Reload View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
