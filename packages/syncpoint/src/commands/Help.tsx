import { Command } from 'commander';
import { Box, Text } from 'ink';
import { render } from 'ink';
import React from 'react';

import { COMMANDS, type CommandInfo } from '../utils/command-registry.js';

interface GeneralHelpViewProps {}

const GeneralHelpView: React.FC<GeneralHelpViewProps> = () => {
  return (
    <Box flexDirection="column">
      <Text bold>SYNCPOINT - Personal Environment Manager</Text>
      <Text>{''}</Text>

      <Text bold>USAGE</Text>
      <Box marginLeft={2}>
        <Text>npx @lumy-pack/syncpoint &lt;command&gt; [options]</Text>
      </Box>
      <Text>{''}</Text>

      <Text bold>AVAILABLE COMMANDS</Text>
      <Text>{''}</Text>
      <Box marginLeft={2} flexDirection="column">
        <Text>
          <Text color="cyan">init</Text>
          {'                    '}
          Initialize syncpoint directory structure
        </Text>
        <Text>
          <Text color="cyan">wizard</Text>
          {'                  '}
          Generate config.yml with AI assistance
        </Text>
        <Text>
          <Text color="cyan">backup</Text>
          {'                  '}
          Create compressed backup archive
        </Text>
        <Text>
          <Text color="cyan">restore [filename]</Text>
          {'      '}
          Restore configuration files
        </Text>
        <Text>
          <Text color="cyan">provision [template]</Text>
          {'    '}
          Run machine provisioning template
        </Text>
        <Text>
          <Text color="cyan">create-template [name]</Text>
          {'  '}
          Create provisioning template with AI
        </Text>
        <Text>
          <Text color="cyan">list [type]</Text>
          {'             '}
          Browse backups and templates
        </Text>
        <Text>
          <Text color="cyan">status</Text>
          {'                  '}
          Show status and manage cleanup
        </Text>
        <Text>
          <Text color="cyan">help [command]</Text>
          {'          '}
          Show help for specific command
        </Text>
      </Box>
      <Text>{''}</Text>

      <Text bold>GLOBAL OPTIONS</Text>
      <Box marginLeft={2} flexDirection="column">
        <Text>
          <Text color="yellow">-V, --version</Text>
          {'          '}
          Output the version number
        </Text>
        <Text>
          <Text color="yellow">-h, --help</Text>
          {'            '}
          Display help for command
        </Text>
      </Box>
      <Text>{''}</Text>

      <Text dimColor>
        Run 'syncpoint help &lt;command&gt;' for detailed information about a
        specific command.
      </Text>
    </Box>
  );
};

interface CommandDetailViewProps {
  command: CommandInfo;
}

const CommandDetailView: React.FC<CommandDetailViewProps> = ({ command }) => {
  return (
    <Box flexDirection="column">
      <Text>
        <Text bold>COMMAND: </Text>
        <Text color="cyan">{command.name}</Text>
      </Text>
      <Text>{''}</Text>

      <Text bold>DESCRIPTION</Text>
      <Box marginLeft={2}>
        <Text>{command.description}</Text>
      </Box>
      <Text>{''}</Text>

      <Text bold>USAGE</Text>
      <Box marginLeft={2}>
        <Text>{command.usage}</Text>
      </Box>
      <Text>{''}</Text>

      {command.arguments && command.arguments.length > 0 && (
        <>
          <Text bold>ARGUMENTS</Text>
          <Box marginLeft={2} flexDirection="column">
            {command.arguments.map((arg, idx) => (
              <Text key={idx}>
                <Text color="cyan">
                  {arg.required ? `<${arg.name}>` : `[${arg.name}]`}
                </Text>
                {'  '}
                {arg.description}
              </Text>
            ))}
          </Box>
          <Text>{''}</Text>
        </>
      )}

      {command.options && command.options.length > 0 && (
        <>
          <Text bold>OPTIONS</Text>
          <Box marginLeft={2} flexDirection="column">
            {command.options.map((opt, idx) => (
              <Text key={idx}>
                <Text color="yellow">{opt.flag}</Text>
                {opt.flag.length < 20 && ' '.repeat(20 - opt.flag.length)}
                {opt.description}
                {opt.default && <Text dimColor> (default: {opt.default})</Text>}
              </Text>
            ))}
          </Box>
          <Text>{''}</Text>
        </>
      )}

      {command.examples && command.examples.length > 0 && (
        <>
          <Text bold>EXAMPLES</Text>
          <Box marginLeft={2} flexDirection="column">
            {command.examples.map((example, idx) => (
              <Text key={idx} dimColor>
                {example}
              </Text>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

interface HelpViewProps {
  commandName?: string;
}

const HelpView: React.FC<HelpViewProps> = ({ commandName }) => {
  if (commandName) {
    const commandInfo = COMMANDS[commandName];
    if (!commandInfo) {
      return (
        <Box flexDirection="column">
          <Text color="red">✗ Unknown command: {commandName}</Text>
          <Text>{''}</Text>
          <Text>Run 'syncpoint help' to see all available commands.</Text>
        </Box>
      );
    }
    return <CommandDetailView command={commandInfo} />;
  }

  return <GeneralHelpView />;
};

export function registerHelpCommand(program: Command): void {
  program
    .command('help [command]')
    .description('Display help information')
    .action(async (commandName?: string) => {
      const { waitUntilExit } = render(<HelpView commandName={commandName} />);
      await waitUntilExit();
    });
}
