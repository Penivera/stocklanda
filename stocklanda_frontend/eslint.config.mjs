import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Program accounts and transaction builders are IDL-driven and dynamic,
      // so `any` is used deliberately at those boundaries.
      "@typescript-eslint/no-explicit-any": "off",
      // Data hooks poll RPC and set state in effects; React 19's new rule is
      // stricter than this polling pattern allows.
      "react-hooks/set-state-in-effect": "warn",
      // Expiry/derived display values intentionally read the clock during render.
      "react-hooks/purity": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
