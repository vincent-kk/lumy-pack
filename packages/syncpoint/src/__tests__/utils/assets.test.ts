import { getAssetPath, readAsset } from '../../utils/assets.js';

describe('utils/assets', () => {
  describe('getAssetPath', () => {
    it('returns path containing assets/config.default.yml', () => {
      const path = getAssetPath('config.default.yml');
      expect(path).toContain('assets/config.default.yml');
    });
  });

  describe('readAsset', () => {
    it('returns non-empty string containing "backup:" for config.default.yml', () => {
      const content = readAsset('config.default.yml');
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('backup:');
    });

    it('returns non-empty string for template.example.yml', () => {
      const content = readAsset('template.example.yml');
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
    });

    it('throws error for nonexistent file', () => {
      expect(() => readAsset('nonexistent.yml')).toThrow();
    });
  });
});
