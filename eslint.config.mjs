import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tseslintParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ESLint 설정을 생성하는 함수
 * @param {string} [tsconfigPath] - 사용할 tsconfig.json의 경로 (기본값: root tsconfig)
 * @returns {Array} ESLint 설정 배열
 */
export function createESLintConfig(
  tsconfigPath = path.resolve(__dirname, "./tsconfig.json"),
) {
  return [
    eslint.configs.recommended,
    {
      files: ["**/*.{js,ts,mjs,cjs}"],
      languageOptions: {
        parser: tseslintParser,
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
        },
      },
      plugins: {
        "@typescript-eslint": tseslint,
        import: importPlugin,
      },
      settings: {
        "import/resolver": {
          typescript: {
            alwaysTryTypes: true,
            project: tsconfigPath,
          },
          node: {
            extensions: [".js", ".ts", ".mjs"],
            moduleDirectory: ["node_modules", "src"],
          },
        },
        "import/extensions": [".js", ".ts", ".mjs"],
        "import/parsers": {
          "@typescript-eslint/parser": [".ts"],
        },
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-require-imports": "off",
        "no-fallthrough": "off",
        "no-constant-condition": "off",
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          {
            varsIgnorePattern: "^_",
            argsIgnorePattern: "^_",
            ignoreRestSiblings: true,
            args: "after-used",
            vars: "all",
            caughtErrors: "all",
            destructuredArrayIgnorePattern: "^_",
          },
        ],
        "no-redeclare": "off",
        "import/extensions": "off",
        "import/no-unresolved": "error",
        "@typescript-eslint/consistent-type-imports": [
          "error",
          {
            prefer: "type-imports",
            disallowTypeAnnotations: false,
            fixStyle: "separate-type-imports",
          },
        ],
        "no-undef": "off",
      },
    },
    {
      ignores: [
        "**/dist/**",
        "**/node_modules/**",
        "**/libs/**",
        "**/scripts/**",
        "**/*.config.*",
      ],
    },
  ];
}

export default createESLintConfig();
