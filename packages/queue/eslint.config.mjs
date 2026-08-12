import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["tests/**", "examples/**"],
  },
  {
    files: ["**/*.ts"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
