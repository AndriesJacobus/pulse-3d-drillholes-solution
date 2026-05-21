import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpPopup } from './HelpPopup';

const STORAGE_KEY = 'pulse-help-dismissed';

beforeEach(() => {
  localStorage.clear();
});

describe('HelpPopup', () => {
  test('shows popup on first visit when localStorage is empty', () => {
    render(<HelpPopup />);
    expect(screen.getByText('Controls')).toBeInTheDocument();
    expect(screen.getByText('Got it')).toBeInTheDocument();
  });

  test('does not show popup when previously dismissed', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    render(<HelpPopup />);
    expect(screen.queryByText('Controls')).not.toBeInTheDocument();
  });

  test('dismiss button closes popup and persists to localStorage', () => {
    render(<HelpPopup />);
    expect(screen.getByText('Controls')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Got it'));

    expect(screen.queryByText('Controls')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  test('Escape key closes popup', () => {
    render(<HelpPopup />);
    expect(screen.getByText('Controls')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Controls')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  test('toggle button opens popup after dismissal', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    render(<HelpPopup />);

    expect(screen.queryByText('Controls')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Help'));
    expect(screen.getByText('Controls')).toBeInTheDocument();
  });

  test('displays all control and interaction entries', () => {
    render(<HelpPopup />);
    expect(screen.getByText('Orbit')).toBeInTheDocument();
    expect(screen.getByText('Left-click + drag')).toBeInTheDocument();
    expect(screen.getByText('Zoom')).toBeInTheDocument();
    expect(screen.getByText('Pan')).toBeInTheDocument();
    expect(screen.getByText('Select hole')).toBeInTheDocument();
    expect(screen.getByText('Deselect')).toBeInTheDocument();
    expect(screen.getByText('Zoom to cluster')).toBeInTheDocument();
  });
});
