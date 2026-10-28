import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

// eslint-config-next 16 ships native flat configs (`next lint` was removed in
// Next 16, so `npm run lint` now calls ESLint directly). The jsx-a11y plugin is
// already registered by next/core-web-vitals; layer its full `recommended` rule
// set on top of Next's subset so a11y regressions fail lint.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  {
    // Pre-existing debt surfaced when lint started running again (it was a no-op
    // under the removed `next lint`). Kept visible as warnings so lint gates new
    // a11y/Next errors without a risky refactor of working code in the same change:
    // `any` in the PokéAPI request/sorting helpers, and the React Compiler rules
    // that eslint-plugin-react-hooks 7 added (set-state-in-effect, refs).
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/**", "data/**"]),
]);

export default eslintConfig;
