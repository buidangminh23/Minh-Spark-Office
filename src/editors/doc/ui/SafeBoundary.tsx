import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; name: string; fallback?: ReactNode };

export default class SafeBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[Minh Docs] ${this.props.name} failed`, error);
  }

  render() {
    return this.state.failed ? this.props.fallback ?? null : this.props.children;
  }
}
