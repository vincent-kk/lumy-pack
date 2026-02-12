import { describe, expect, it } from 'vitest';

import {
  createExcludeMatcher,
  detectPatternType,
  isValidPattern,
  parseRegexPattern,
} from '../../utils/pattern.js';

describe('detectPatternType', () => {
  describe('regex patterns', () => {
    it('detects simple regex patterns', () => {
      expect(detectPatternType('/test/')).toBe('regex');
      expect(detectPatternType('/\\.conf$/')).toBe('regex');
      expect(detectPatternType('/^~\\/\\.config/')).toBe('regex');
    });

    it('detects regex patterns with escaped slashes', () => {
      expect(detectPatternType('/\\/temp\\//')).toBe('regex');
      expect(detectPatternType('/\\/usr\\/local/')).toBe('regex');
    });

    it('detects complex regex patterns', () => {
      expect(detectPatternType('/\\.(tmp|cache|log)$/')).toBe('regex');
      expect(detectPatternType('/[a-z]+\\.conf$/')).toBe('regex');
    });
  });

  describe('glob patterns', () => {
    it('detects glob patterns with asterisk', () => {
      expect(detectPatternType('*.conf')).toBe('glob');
      expect(detectPatternType('~/.config/*.conf')).toBe('glob');
      expect(detectPatternType('**/*.swp')).toBe('glob');
    });

    it('detects glob patterns with question mark', () => {
      expect(detectPatternType('~/.config/app?.conf')).toBe('glob');
      expect(detectPatternType('file?.txt')).toBe('glob');
    });

    it('detects glob patterns with braces', () => {
      expect(detectPatternType('~/.{zshrc,bashrc}')).toBe('glob');
      expect(detectPatternType('**/{a,b,c}')).toBe('glob');
    });
  });

  describe('literal paths', () => {
    it('detects literal file paths', () => {
      expect(detectPatternType('~/.zshrc')).toBe('literal');
      expect(detectPatternType('~/.config/starship.toml')).toBe('literal');
    });

    it('detects absolute paths (not regex)', () => {
      expect(detectPatternType('/usr/local/bin')).toBe('literal');
      expect(detectPatternType('/home/user/.config')).toBe('literal');
      expect(detectPatternType('/etc/hosts')).toBe('literal');
    });

    it('does not treat single slash as regex', () => {
      expect(detectPatternType('/')).toBe('literal');
    });

    it('does not treat paths with multiple slashes as regex', () => {
      expect(detectPatternType('/usr/local/bin/tool')).toBe('literal');
      expect(detectPatternType('/home/user/Documents/file.txt')).toBe(
        'literal',
      );
    });
  });
});

describe('parseRegexPattern', () => {
  it('parses valid regex patterns', () => {
    const regex1 = parseRegexPattern('/\\.conf$/');
    expect(regex1).toBeInstanceOf(RegExp);
    expect(regex1.test('app.conf')).toBe(true);
    expect(regex1.test('app.txt')).toBe(false);

    const regex2 = parseRegexPattern('/^test/');
    expect(regex2.test('test123')).toBe(true);
    expect(regex2.test('123test')).toBe(false);
  });

  it('parses regex with special characters', () => {
    const regex = parseRegexPattern('/\\.(tmp|cache|log)$/');
    expect(regex.test('file.tmp')).toBe(true);
    expect(regex.test('file.cache')).toBe(true);
    expect(regex.test('file.log')).toBe(true);
    expect(regex.test('file.txt')).toBe(false);
  });

  it('throws on invalid regex syntax', () => {
    expect(() => parseRegexPattern('/[invalid/')).toThrow();
    expect(() => parseRegexPattern('/(unclosed/')).toThrow();
  });

  it('throws on patterns without slashes', () => {
    expect(() => parseRegexPattern('notaregex')).toThrow();
    expect(() => parseRegexPattern('*.conf')).toThrow();
  });
});

describe('createExcludeMatcher', () => {
  describe('glob pattern matching', () => {
    it('matches glob patterns', () => {
      const matcher = createExcludeMatcher(['**/*.bak']);
      expect(matcher('/home/user/.zshrc.bak')).toBe(true);
      expect(matcher('/home/user/file.bak')).toBe(true);
      expect(matcher('/home/user/.zshrc')).toBe(false);
    });

    it('matches multiple glob patterns', () => {
      const matcher = createExcludeMatcher(['**/*.swp', '**/.DS_Store']);
      expect(matcher('/home/user/file.swp')).toBe(true);
      expect(matcher('/home/user/.DS_Store')).toBe(true);
      expect(matcher('/home/user/file.txt')).toBe(false);
    });

    it('matches nested glob patterns', () => {
      const matcher = createExcludeMatcher(['**/node_modules/**']);
      expect(matcher('/project/node_modules/package/index.js')).toBe(true);
      expect(matcher('/project/src/index.js')).toBe(false);
    });
  });

  describe('regex pattern matching', () => {
    it('matches regex patterns', () => {
      const matcher = createExcludeMatcher(['/\\.tmp$/']);
      expect(matcher('/home/user/file.tmp')).toBe(true);
      expect(matcher('/home/user/test.tmp')).toBe(true);
      expect(matcher('/home/user/file.txt')).toBe(false);
    });

    it('matches multiple regex patterns', () => {
      const matcher = createExcludeMatcher(['/\\.bak$/', '/\\.tmp$/']);
      expect(matcher('/home/user/file.bak')).toBe(true);
      expect(matcher('/home/user/file.tmp')).toBe(true);
      expect(matcher('/home/user/file.txt')).toBe(false);
    });

    it('matches complex regex patterns', () => {
      const matcher = createExcludeMatcher(['/\\.(tmp|cache|log)$/']);
      expect(matcher('/home/user/file.tmp')).toBe(true);
      expect(matcher('/home/user/file.cache')).toBe(true);
      expect(matcher('/home/user/file.log')).toBe(true);
      expect(matcher('/home/user/file.txt')).toBe(false);
    });
  });

  describe('literal pattern matching', () => {
    it('matches literal paths exactly', () => {
      const matcher = createExcludeMatcher(['/home/user/exclude.txt']);
      expect(matcher('/home/user/exclude.txt')).toBe(true);
      expect(matcher('/home/user/include.txt')).toBe(false);
    });

    it('matches multiple literal patterns', () => {
      const matcher = createExcludeMatcher([
        '/home/user/file1.txt',
        '/home/user/file2.txt',
      ]);
      expect(matcher('/home/user/file1.txt')).toBe(true);
      expect(matcher('/home/user/file2.txt')).toBe(true);
      expect(matcher('/home/user/file3.txt')).toBe(false);
    });
  });

  describe('mixed pattern types', () => {
    it('handles glob, regex, and literal patterns together', () => {
      const matcher = createExcludeMatcher([
        '**/*.log', // glob
        '/\\.bak$/', // regex
        '/exact/path.txt', // literal
      ]);

      expect(matcher('/app/debug.log')).toBe(true);
      expect(matcher('/home/.zshrc.bak')).toBe(true);
      expect(matcher('/exact/path.txt')).toBe(true);
      expect(matcher('/home/file.txt')).toBe(false);
    });

    it('returns false when no patterns match', () => {
      const matcher = createExcludeMatcher([
        '**/*.swp',
        '/\\.tmp$/',
        '/exact.txt',
      ]);
      expect(matcher('/home/user/file.txt')).toBe(false);
    });
  });

  describe('empty patterns', () => {
    it('returns false for empty pattern list', () => {
      const matcher = createExcludeMatcher([]);
      expect(matcher('/any/path')).toBe(false);
    });
  });

  describe('invalid patterns', () => {
    it('skips invalid regex patterns with warning', () => {
      // Invalid regex should be skipped, not crash
      const matcher = createExcludeMatcher(['/[invalid/', '**/*.txt']);
      expect(matcher('/home/file.txt')).toBe(true); // glob still works
    });
  });
});

describe('isValidPattern', () => {
  describe('valid patterns', () => {
    it('accepts valid regex patterns', () => {
      expect(isValidPattern('/\\.conf$/')).toBe(true);
      expect(isValidPattern('/test/')).toBe(true);
      expect(isValidPattern('/\\.(tmp|cache)$/')).toBe(true);
    });

    it('accepts valid glob patterns', () => {
      expect(isValidPattern('*.conf')).toBe(true);
      expect(isValidPattern('**/*.swp')).toBe(true);
      expect(isValidPattern('~/.config/{a,b}')).toBe(true);
    });

    it('accepts literal paths', () => {
      expect(isValidPattern('~/.zshrc')).toBe(true);
      expect(isValidPattern('/usr/local/bin')).toBe(true);
    });
  });

  describe('invalid patterns', () => {
    it('rejects invalid regex patterns', () => {
      expect(isValidPattern('/[invalid/')).toBe(false);
      expect(isValidPattern('/(unclosed/')).toBe(false);
    });

    it('rejects empty strings', () => {
      expect(isValidPattern('')).toBe(false);
    });

    it('rejects non-string values', () => {
      expect(isValidPattern(null as any)).toBe(false);
      expect(isValidPattern(undefined as any)).toBe(false);
      expect(isValidPattern(123 as any)).toBe(false);
    });
  });
});
