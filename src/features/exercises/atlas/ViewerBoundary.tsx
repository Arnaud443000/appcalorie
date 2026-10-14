import { Component, type ReactNode } from 'react';

interface ViewerBoundaryProps {
  /** Affiché si le code de la vue 3D n'a pas pu être chargé (hors ligne avant mise en cache…). */
  fallback: (retry: () => void) => ReactNode;
  onRetry: () => void;
  children: ReactNode;
}

/** Attrape l'échec du chargement paresseux de la vue 3D. */
export class ViewerBoundary extends Component<ViewerBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  private readonly retry = () => {
    this.setState({ failed: false });
    this.props.onRetry();
  };

  render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}
