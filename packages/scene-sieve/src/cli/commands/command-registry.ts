/**
 * Central command registry for scene-sieve CLI.
 * Single source of truth for command metadata, used by --describe and --help.
 */

export interface CommandOption {
  flag: string;
  description: string;
  type?: 'boolean' | 'string' | 'number';
  default?: string;
}

export interface CommandArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface CommandInfo {
  name: string;
  description: string;
  usage: string;
  arguments?: CommandArgument[];
  options?: CommandOption[];
  examples?: string[];
}

export const SIEVE_COMMAND: CommandInfo = {
  name: 'scene-sieve',
  description: 'Extract key frames from video and GIF files',
  usage: 'scene-sieve <input> [options]',
  arguments: [
    {
      name: 'input',
      description: 'Input video or GIF file path',
      required: true,
    },
  ],
  options: [
    {
      flag: '-n, --count <number>',
      description: 'Max number of frames to keep (default: 20)',
      type: 'number',
    },
    {
      flag: '-t, --threshold <number>',
      description:
        'Normalized threshold 0~1 (default: 0.5; keeps frames above ratio of max change)',
      type: 'number',
    },
    {
      flag: '-o, --output <path>',
      description: 'Output directory path',
      type: 'string',
    },
    {
      flag: '--fps <number>',
      description: 'Max FPS for frame extraction',
      type: 'number',
      default: '5',
    },
    {
      flag: '-mf, --max-frames <number>',
      description: 'Max frames to extract (auto-reduces FPS for long videos)',
      type: 'number',
      default: '300',
    },
    {
      flag: '-s, --scale <number>',
      description: 'Scale size for vision analysis',
      type: 'number',
      default: '720',
    },
    {
      flag: '-q, --quality <number>',
      description: 'JPEG output quality 1-100',
      type: 'number',
      default: '80',
    },
    {
      flag: '-it, --iou-threshold <number>',
      description: 'IoU threshold for animation tracking (0-1) (default: 0.9)',
      type: 'number',
    },
    {
      flag: '-at, --anim-threshold <number>',
      description: 'Min consecutive frames for animation (default: 5)',
      type: 'number',
    },
    {
      flag: '--max-segment-duration <number>',
      description:
        'Max segment duration in seconds for long video splitting (default: 300)',
      type: 'number',
    },
    {
      flag: '--concurrency <number>',
      description: 'Number of segments to process in parallel (default: 2)',
      type: 'number',
    },
    {
      flag: '--debug',
      description: 'Enable debug mode (preserve temp workspace)',
      type: 'boolean',
    },
    {
      flag: '--json',
      description: 'Output structured JSON to stdout',
      type: 'boolean',
    },
    {
      flag: '--describe',
      description: 'Output JSON schema of available options',
      type: 'boolean',
    },
  ],
  examples: [
    'scene-sieve video.mp4',
    'scene-sieve video.mp4 -n 10',
    'scene-sieve video.mp4 -t 0.3 -o ./output',
    'scene-sieve video.mp4 --json',
    'scene-sieve --describe',
  ],
};
