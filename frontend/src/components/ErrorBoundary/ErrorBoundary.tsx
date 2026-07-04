import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

interface ErrorBoundaryProps {
  children: ReactNode
  fallbackTitle: string
  fallbackAction: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Render error caught by ErrorBoundary:', error, info.componentStack)
  }

  private handleReset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className={styles.wrap} role="alert">
          <p className={styles.title}>{this.props.fallbackTitle}</p>
          <p className={styles.message}>{this.state.error.message}</p>
          <button type="button" className={styles.action} onClick={this.handleReset}>
            {this.props.fallbackAction}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
