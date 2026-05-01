import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error.message }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', marginLeft: '250px' }}>
          <h2>页面出错</h2>
          <p style={{ color: 'red' }}>{this.state.error}</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: '16px', padding: '8px 16px', background: '#6b1d1d', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}