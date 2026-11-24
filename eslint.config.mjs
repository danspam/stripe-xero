import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
    { ignores: ["dist/"] },
    js.configs.recommended,
    eslintConfigPrettier,
    {
        rules: {
            "curly": 1,
            "eqeqeq": 2,
            "no-console": 1,
            "no-debugger": 1,
            "no-irregular-whitespace": 1,
            "no-undef": 2,
            "no-unused-vars": 2,
            "no-var": 1
        },
        languageOptions : {
            "ecmaVersion": "latest",
            "sourceType": "module",
            "globals": {
                ...globals.node
            }
        }
    }
];