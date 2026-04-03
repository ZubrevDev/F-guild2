import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Security: prevent eval() and similar dynamic code execution
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      // Security: warn on dangerouslySetInnerHTML usage
      "react/no-danger": "warn",
    },
  },
];

export default eslintConfig;
