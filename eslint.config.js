import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
  globalIgnores(["dist", "dev-dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "react-hooks/set-state-in-effect": "off", // 暂时关闭该检查以通过 Lint
      "react-refresh/only-export-components": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-async-promise-executor": "error",
    },
  },
  eslintConfigPrettier,
]);
