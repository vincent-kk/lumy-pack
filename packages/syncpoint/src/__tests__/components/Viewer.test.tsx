import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { Viewer } from '../../components/Viewer.js';

describe('Viewer', () => {
  it('renders title', () => {
    const onBack = vi.fn();
    const { lastFrame } = render(
      <Viewer title="Test Viewer" sections={[]} onBack={onBack} />,
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('▸ Test Viewer');
  });

  it('renders sections with labels and values', () => {
    const onBack = vi.fn();
    const sections = [
      { label: 'Name', value: 'Alice' },
      { label: 'Age', value: '30' },
    ];
    const { lastFrame } = render(
      <Viewer title="User Details" sections={sections} onBack={onBack} />,
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Name');
    expect(frame).toContain('Alice');
    expect(frame).toContain('Age');
    expect(frame).toContain('30');
  });

  it("shows 'Press ESC to go back' hint", () => {
    const onBack = vi.fn();
    const { lastFrame } = render(
      <Viewer title="Test" sections={[]} onBack={onBack} />,
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Press');
    expect(frame).toContain('ESC');
    expect(frame).toContain('to go back');
  });

  it('renders table when provided', () => {
    const onBack = vi.fn();
    const table = {
      title: 'Data Table',
      headers: ['Col1', 'Col2'],
      rows: [
        ['A', 'B'],
        ['C', 'D'],
      ],
    };
    const { lastFrame } = render(
      <Viewer title="Test" sections={[]} table={table} onBack={onBack} />,
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Data Table');
    expect(frame).toContain('Col1');
    expect(frame).toContain('Col2');
    expect(frame).toContain('A');
    expect(frame).toContain('B');
  });

  it('renders table with default title when title not provided', () => {
    const onBack = vi.fn();
    const table = {
      headers: ['Col1', 'Col2'],
      rows: [['A', 'B']],
    };
    const { lastFrame } = render(
      <Viewer title="Test" sections={[]} table={table} onBack={onBack} />,
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Details');
  });
});
