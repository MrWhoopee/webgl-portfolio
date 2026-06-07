'use client'
import { Component, type ReactNode } from 'react'

/* Renders `fallback` if its subtree throws — e.g. the city GLB is missing, so
   we drop back to the procedural skyline until the model is dropped in. */
export default class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}
