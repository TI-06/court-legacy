import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "playwright-report", "test-results"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message:
                "The simulation domain must remain independent of React.",
            },
            {
              name: "react-dom",
              message:
                "The simulation domain must remain independent of React DOM.",
            },
            {
              name: "pixi.js",
              message:
                "The simulation domain must remain independent of PixiJS.",
            },
            {
              name: "dexie",
              message:
                "The simulation domain must remain independent of persistence.",
            },
            {
              name: "zustand",
              message:
                "The simulation domain must remain independent of application state stores.",
            },
          ],
          patterns: [
            {
              group: [
                "**/app/**",
                "**/features/**",
                "**/persistence/**",
                "**/renderer/**",
                "**/store/**",
              ],
              message:
                "The simulation domain may only depend on domain modules and validated data contracts.",
            },
          ],
        },
      ],
    },
  },
);
