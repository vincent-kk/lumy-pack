import { describe, it, expect } from "vitest";
import { extractYAML, parseYAML, extractAndParseYAML } from "../../utils/yaml-parser.js";

describe("utils/yaml-parser", () => {
  describe("extractYAML", () => {
    it("extracts YAML from yaml code block", () => {
      const response = `Here's your config:
\`\`\`yaml
name: test
value: 123
\`\`\`
`;

      const yaml = extractYAML(response);

      expect(yaml).toBe("name: test\nvalue: 123");
    });

    it("extracts YAML from yml code block", () => {
      const response = `\`\`\`yml
name: test
\`\`\``;

      const yaml = extractYAML(response);

      expect(yaml).toBe("name: test");
    });

    it("extracts YAML from generic code block if valid", () => {
      const response = `\`\`\`
name: test
value: 123
\`\`\``;

      const yaml = extractYAML(response);

      expect(yaml).toBe("name: test\nvalue: 123");
    });

    it("returns null for generic code block with invalid YAML", () => {
      const response = `\`\`\`
this is not valid yaml: {{{
\`\`\``;

      const yaml = extractYAML(response);

      expect(yaml).toBeNull();
    });

    it("accepts pure YAML without code blocks", () => {
      const response = `name: test
value: 123
list:
  - item1
  - item2`;

      const yaml = extractYAML(response);

      expect(yaml).toBe(response.trim());
    });

    it("accepts plain text as valid YAML string", () => {
      // Plain text is technically valid YAML (as a string)
      const response = "This is not YAML at all";

      const yaml = extractYAML(response);

      expect(yaml).toBe(response.trim());
    });

    it("handles multiline YAML in code blocks", () => {
      const response = `\`\`\`yaml
backup:
  targets:
    - ~/.zshrc
    - ~/.gitconfig
  exclude:
    - "**/*.swp"
\`\`\``;

      const yaml = extractYAML(response);

      expect(yaml).toContain("backup:");
      expect(yaml).toContain("targets:");
      expect(yaml).toContain("~/.zshrc");
    });
  });

  describe("parseYAML", () => {
    it("parses valid YAML string", () => {
      const yamlString = `name: test
value: 123
list:
  - item1
  - item2`;

      const parsed = parseYAML(yamlString);

      expect(parsed).toEqual({
        name: "test",
        value: 123,
        list: ["item1", "item2"],
      });
    });

    it("throws on invalid YAML", () => {
      const yamlString = "invalid: yaml: content: {{{";

      expect(() => parseYAML(yamlString)).toThrow();
    });
  });

  describe("extractAndParseYAML", () => {
    it("extracts and parses YAML from code block", () => {
      const response = `\`\`\`yaml
name: test
value: 123
\`\`\``;

      const parsed = extractAndParseYAML<{ name: string; value: number }>(
        response,
      );

      expect(parsed).toEqual({ name: "test", value: 123 });
    });

    it("parses plain text as YAML string", () => {
      // Plain text is valid YAML (as a string value)
      const response = "No YAML here";

      const parsed = extractAndParseYAML(response);

      expect(parsed).toBe("No YAML here");
    });

    it("parses text from code block as YAML string", () => {
      // Even invalid-looking text can be valid YAML (as a string)
      const response = `\`\`\`yaml
invalid yaml content {{{
\`\`\``;

      const parsed = extractAndParseYAML(response);

      expect(parsed).toBe("invalid yaml content {{{");
    });

    it("handles complex nested structures", () => {
      const response = `\`\`\`yaml
backup:
  targets:
    - ~/.zshrc
    - ~/.gitconfig
  exclude:
    - "**/*.swp"
  filename: "{hostname}_{datetime}"
scripts:
  includeInBackup: true
\`\`\``;

      const parsed = extractAndParseYAML(response);

      expect(parsed).toHaveProperty("backup");
      expect(parsed).toHaveProperty("scripts");
      // @ts-expect-error - parsed is unknown type
      expect(parsed.backup.targets).toHaveLength(2);
    });
  });
});
