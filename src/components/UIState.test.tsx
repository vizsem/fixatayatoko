import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SkeletonList, EmptyState } from './UIState';

describe('UIState Components', () => {
  describe('SkeletonList', () => {
    it('should render default number of skeleton lines (3)', () => {
      render(<SkeletonList />);
      const skeletonLines = screen.getAllByRole('generic');
      expect(skeletonLines.filter(el => el.className.includes('animate-pulse-soft'))).toHaveLength(3);
    });

    it('should render custom number of skeleton lines', () => {
      render(<SkeletonList lines={5} />);
      const skeletonLines = screen.getAllByRole('generic');
      expect(skeletonLines.filter(el => el.className.includes('animate-pulse-soft'))).toHaveLength(5);
    });

    it('should have correct styling for skeleton lines', () => {
      render(<SkeletonList lines={1} />);
      const skeletonLines = screen.getAllByTestId('skeleton-line');
      expect(skeletonLines[0]).toHaveClass('h-16');
      expect(skeletonLines[0]).toHaveClass('rounded-2xl');
      expect(skeletonLines[0]).toHaveClass('bg-slate-100');
      expect(skeletonLines[0]).toHaveClass('animate-pulse-soft');
    });

    it('should have space between skeleton lines', () => {
      render(<SkeletonList lines={2} />);
      const container = screen.getByTestId('skeleton-container');
      expect(container).toHaveClass('space-y-3');
    });
  });

  describe('EmptyState', () => {
    const defaultProps = {
      title: 'No Data Available',
      description: 'There is no data to display at the moment.',
    };

    it('should render title correctly', () => {
      render(<EmptyState title="Test Title" />);
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('should render description when provided', () => {
      render(<EmptyState {...defaultProps} />);
      expect(screen.getByText(defaultProps.description!)).toBeInTheDocument();
    });

    it('should not render description when not provided', () => {
      render(<EmptyState title="Test Title" />);
      expect(screen.queryByText(defaultProps.description!)).not.toBeInTheDocument();
    });

    it('should render custom icon when provided', () => {
      const CustomIcon = () => <div data-testid="custom-icon">Icon</div>;
      render(<EmptyState {...defaultProps} icon={<CustomIcon />} />);
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('should render default icon when not provided', () => {
      render(<EmptyState {...defaultProps} />);
      const defaultIcon = screen.getByText(defaultProps.title).previousSibling?.firstChild;
      expect(defaultIcon).toHaveClass('w-14');
      expect(defaultIcon).toHaveClass('h-14');
      expect(defaultIcon).toHaveClass('rounded-2xl');
      expect(defaultIcon).toHaveClass('bg-slate-100');
    });

    it('should render action when provided', () => {
      const ActionButton = () => <button data-testid="action-button">Action</button>;
      render(<EmptyState {...defaultProps} action={<ActionButton />} />);
      expect(screen.getByTestId('action-button')).toBeInTheDocument();
    });

    it('should have correct container styling', () => {
      render(<EmptyState {...defaultProps} />);
      const container = screen.getByText(defaultProps.title).closest('div');
      expect(container).toHaveClass('text-center');
      expect(container).toHaveClass('py-16');
      expect(container).toHaveClass('bg-white');
      expect(container).toHaveClass('rounded-[2.5rem]');
      expect(container).toHaveClass('border-2');
      expect(container).toHaveClass('border-dashed');
      expect(container).toHaveClass('border-slate-200');
    });

    it('should have correct title styling', () => {
      render(<EmptyState {...defaultProps} />);
      const title = screen.getByText(defaultProps.title);
      expect(title).toHaveClass('text-sm');
      expect(title).toHaveClass('font-black');
      expect(title).toHaveClass('text-slate-500');
      expect(title).toHaveClass('uppercase');
      expect(title).toHaveClass('tracking-widest');
    });

    it('should have correct description styling', () => {
      render(<EmptyState {...defaultProps} />);
      const description = screen.getByText(defaultProps.description!);
      expect(description).toHaveClass('text-[11px]');
      expect(description).toHaveClass('font-bold');
      expect(description).toHaveClass('text-slate-400');
      expect(description).toHaveClass('max-w-xs');
      expect(description).toHaveClass('mx-auto');
    });
  });
});