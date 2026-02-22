import { Box, Text, useInput } from 'ink';
import React from 'react';

import { Table } from './Table.js';

export interface ViewerSection {
  label: string;
  value: string;
}

export interface ViewerProps {
  title: string;
  sections: ViewerSection[];
  table?: {
    title?: string;
    headers: string[];
    rows: string[][];
  };
  onBack: () => void;
}

export const Viewer: React.FC<ViewerProps> = ({
  title,
  sections,
  table,
  onBack,
}) => {
  useInput((_input, key) => {
    if (key.escape) {
      onBack();
    }
  });

  // Calculate label width for alignment
  const labelWidth = Math.max(...sections.map((s) => s.label.length)) + 1;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Text bold>▸ {title}</Text>

      {/* Sections */}
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        {sections.map((section, idx) => (
          <Box key={idx}>
            <Text dimColor>{section.label.padEnd(labelWidth)}</Text>
            <Text> </Text>
            <Text>{section.value}</Text>
          </Box>
        ))}
      </Box>

      {/* Optional Table */}
      {table && table.rows.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor> {table.title ?? 'Details'}</Text>
          <Box marginLeft={2}>
            <Table headers={table.headers} rows={table.rows} />
          </Box>
        </Box>
      )}

      {/* Hint */}
      <Box marginTop={1}>
        <Text dimColor>
          Press <Text bold>ESC</Text> to go back
        </Text>
      </Box>
    </Box>
  );
};
