import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('Screen crashed', err, info); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="screen no-nav" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
        <div style={{ fontSize: 36 }}>🫠</div>
        <h1 className="h2">Something went wrong on this screen</h1>
        <div className="small muted" style={{ wordBreak: 'break-word' }}>{String(this.state.err?.message || this.state.err)}</div>
        <button className="btn primary" onClick={() => { this.setState({ err: null }); this.props.onBack && this.props.onBack(); }}>Go back</button>
      </div>
    );
  }
}
