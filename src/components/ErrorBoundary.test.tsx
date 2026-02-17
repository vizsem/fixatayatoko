import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from './ErrorBoundary';

// Mock console.error to avoid noise in test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  it('should render children when there is no error', () => {
    const { container } = render(
      <ErrorBoundary>
        <div>Normal Content</div>
      </ErrorBoundary>
    );

    expect(container.textContent).toContain('Normal Content');
    expect(screen.queryByText('Terjadi Kesalahan')).not.toBeInTheDocument();
  });

  it('should render fallback UI when error occurs', () => {
    const ErrorComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Terjadi Kesalahan')).toBeInTheDocument();
    expect(screen.getByText('Maaf, terjadi kesalahan yang tidak terduga. Silakan refresh halaman atau coba lagi nanti.')).toBeInTheDocument();
    expect(screen.getByText('Refresh Halaman')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom Error Message</div>;
    const ErrorComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary fallback={customFallback}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Error Message')).toBeInTheDocument();
    expect(screen.queryByText('Terjadi Kesalahan')).not.toBeInTheDocument();
  });

  it('should call console.error when error is caught', () => {
    const error = new Error('Test error');
    const ErrorComponent = () => {
      throw error;
    };

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      'ErrorBoundary caught an error:',
      error,
      expect.any(Object)
    );
  });
});