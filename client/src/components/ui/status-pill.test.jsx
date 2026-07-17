import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPill, statusToTint } from './status-pill';

describe('statusToTint', () => {
  it.each([
    ['pending', 'warning'],
    ['approved', 'info'],
    ['active', 'success'],
    ['disbursed', 'success'],
    ['in_arrears', 'warning'],
    ['defaulted', 'danger'],
    ['rejected', 'danger'],
    ['completed', 'neutral'],
    ['waived', 'neutral'],
    ['closed', 'neutral'],
    ['open', 'info'],
    ['in_progress', 'warning'],
    ['resolved', 'success'],
  ])('maps %s to %s', (status, tint) => {
    expect(statusToTint(status)).toBe(tint);
  });

  it('falls back to neutral for an unknown status', () => {
    expect(statusToTint('made_up_status')).toBe('neutral');
  });
});

describe('StatusPill', () => {
  it('always renders the status text alongside the tint', () => {
    render(<StatusPill status="in_arrears" />);
    expect(screen.getByText('in arrears')).toBeInTheDocument();
  });

  it('renders gray neutral classes for an unknown status', () => {
    render(<StatusPill status="mystery" />);
    expect(screen.getByText('mystery').className).toContain('bg-[#F0F0EE]');
  });
});
