import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**", ".github/**"]
  },

  js.configs.recommended,

  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser }
    },
    rules: {
     "no-unused-vars": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-undef": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "prefer-const": "warn",
      "eqeqeq": ["warn", "smart"]
    }
  },
  {
    files: ["vite.config.js", "vitest.config.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node }
    }
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node }
    }
  },

  prettier
];