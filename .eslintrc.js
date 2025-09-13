/** ESLint relajado para permitir compilar ya mismo */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  extends: [
    "next",
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ],
  plugins: ["@typescript-eslint", "react-hooks"],
  rules: {
    // Permitir any temporalmente
    "@typescript-eslint/no-explicit-any": "off",
    // Variables no usadas a warning (útil mientras refactorizamos)
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    // Desactivar por ahora dependencias estrictas en hooks
    "react-hooks/exhaustive-deps": "off",

    // Next.js: permitir <img> y <a> mientras migramos a <Image> y <Link>
    "@next/next/no-img-element": "off",
    "next/no-html-link-for-pages": "off",

    // Estilo flexible
    "prefer-const": "off",
    "no-console": "off"
  },
  ignorePatterns: [
    "node_modules/",
    ".next/",
    "out/"
  ],
  "extends": ["next/core-web-vitals", "eslint:recommended"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "warn",
    "react-hooks/exhaustive-deps": "warn"
  }

};
