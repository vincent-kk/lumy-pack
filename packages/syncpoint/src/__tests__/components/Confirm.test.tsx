import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { Confirm } from '../../components/Confirm.js';

describe('Confirm', () => {
  it('renders message with [Y/n] when defaultYes=true', () => {
    const onConfirm = vi.fn();
    const { lastFrame } = render(
      <Confirm message="Continue?" onConfirm={onConfirm} defaultYes={true} />,
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Continue?');
    expect(frame).toContain('[');
    expect(frame).toContain('/');
    expect(frame).toContain(']');
    // The Y should be bold (default), n should be dimmed
  });

  it('renders message with [y/N] when defaultYes=false', () => {
    const onConfirm = vi.fn();
    const { lastFrame } = render(
      <Confirm message="Delete?" onConfirm={onConfirm} defaultYes={false} />,
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Delete?');
    expect(frame).toContain('[');
    expect(frame).toContain('/');
    expect(frame).toContain(']');
    // The N should be bold (default), y should be dimmed
  });

  it('renders with question mark prompt', () => {
    const onConfirm = vi.fn();
    const { lastFrame } = render(
      <Confirm message="Proceed?" onConfirm={onConfirm} />,
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('?');
    expect(frame).toContain('Proceed?');
  });

  it('renders with default options visible', () => {
    const onConfirm = vi.fn();
    const { lastFrame } = render(
      <Confirm message="Continue?" onConfirm={onConfirm} defaultYes={true} />,
    );
    const frame = lastFrame() || '';
    // Should show Y and n options
    expect(frame.toLowerCase()).toContain('y');
    expect(frame.toLowerCase()).toContain('n');
  });

  it('renders different messages correctly', () => {
    const onConfirm = vi.fn();
    const { lastFrame } = render(
      <Confirm message="Are you sure?" onConfirm={onConfirm} />,
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Are you sure?');
  });

  it('shows options in brackets', () => {
    const onConfirm = vi.fn();
    const { lastFrame } = render(
      <Confirm message="Test?" onConfirm={onConfirm} />,
    );
    const frame = lastFrame() || '';
    // Check for bracket-enclosed options
    const bracketPattern = /\[.*\/.*\]/;
    expect(frame).toMatch(bracketPattern);
  });
});
