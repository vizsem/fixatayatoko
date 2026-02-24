import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemberCard from './MemberCard';

describe('MemberCard', () => {
  const defaultProps = {
    name: 'John Doe',
    memberId: 'M123456789',
    points: 1500,
    level: 'Gold' as const,
  };

  it('should render member name correctly', () => {
    render(<MemberCard {...defaultProps} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should render member ID correctly', () => {
    render(<MemberCard {...defaultProps} />);
    expect(screen.getByText('M123456789')).toBeInTheDocument();
  });

  it('should render points correctly', () => {
    render(<MemberCard {...defaultProps} />);
    expect(screen.getByText('1,500')).toBeInTheDocument();
  });

  it('should render membership level correctly', () => {
    render(<MemberCard {...defaultProps} />);
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('should render "ATAYATOKO MEMBER" text', () => {
    render(<MemberCard {...defaultProps} />);
    expect(screen.getByText('ATAYATOKO MEMBER')).toBeInTheDocument();
  });

  it('should render "Poin" text', () => {
    render(<MemberCard {...defaultProps} />);
    expect(screen.getByText((content) => content.includes('Poin'))).toBeInTheDocument();
  });

  it('should render QR code container', () => {
    render(<MemberCard {...defaultProps} />);
    const qrContainer = screen.getByTestId('member-card').querySelector('[class*="bg-white"]');
    expect(qrContainer).toBeInTheDocument();
  });

  describe('Level-based styling', () => {
    it('should apply correct styling for Bronze level', () => {
      render(<MemberCard {...defaultProps} level="Bronze" />);
      const card = screen.getByTestId('member-card');
      expect(card).toHaveClass('bg-gradient-to-r');
      expect(card).toHaveClass('from-orange-400');
      expect(card).toHaveClass('to-orange-200');
    });

    it('should apply correct styling for Silver level', () => {
      render(<MemberCard {...defaultProps} level="Silver" />);
      const card = screen.getByTestId('member-card');
      expect(card).toHaveClass('bg-gradient-to-r');
      expect(card).toHaveClass('from-gray-400');
      expect(card).toHaveClass('to-gray-200');
    });

    it('should apply correct styling for Gold level', () => {
      render(<MemberCard {...defaultProps} level="Gold" />);
      const card = screen.getByTestId('member-card');
      expect(card).toHaveClass('bg-gradient-to-r');
      expect(card).toHaveClass('from-yellow-500');
      expect(card).toHaveClass('to-yellow-300');
    });

    it('should apply correct styling for Platinum level', () => {
      render(<MemberCard {...defaultProps} level="Platinum" />);
      const card = screen.getByTestId('member-card');
      expect(card).toHaveClass('bg-gradient-to-r');
      expect(card).toHaveClass('from-slate-900');
      expect(card).toHaveClass('to-slate-700');
    });
  });

  it('should handle zero points correctly', () => {
    render(<MemberCard {...defaultProps} points={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should handle large point numbers correctly', () => {
    render(<MemberCard {...defaultProps} points={999999} />);
    expect(screen.getByText('999,999')).toBeInTheDocument();
  });
});
