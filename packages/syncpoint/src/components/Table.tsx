import { Box, Text } from 'ink';
import React from 'react';

interface TableProps {
  headers: string[];
  rows: string[][];
  columnWidths?: number[];
}

export const Table: React.FC<TableProps> = ({
  headers,
  rows,
  columnWidths,
}) => {
  const widths =
    columnWidths ??
    headers.map((header, colIdx) => {
      const dataMax = rows.reduce(
        (max, row) => Math.max(max, (row[colIdx] ?? '').length),
        0,
      );
      return Math.max(header.length, dataMax) + 2;
    });

  const padCell = (text: string, width: number): string => {
    return text.padEnd(width);
  };

  const separator = widths.map((w) => '─'.repeat(w)).join('  ');

  return (
    <Box flexDirection="column">
      <Text>
        {headers.map((h, i) => (
          <Text key={i} bold>
            {padCell(h, widths[i])}
            {i < headers.length - 1 ? '  ' : ''}
          </Text>
        ))}
      </Text>
      <Text color="gray">{separator}</Text>
      {rows.map((row, rowIdx) => (
        <Text key={rowIdx}>
          {row.map((cell, colIdx) => (
            <Text key={colIdx}>
              {padCell(cell, widths[colIdx])}
              {colIdx < row.length - 1 ? '  ' : ''}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  );
};
