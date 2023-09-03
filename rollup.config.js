const path = require("path");
const json = require("@rollup/plugin-json");
const resolvePlugin = require("@rollup/plugin-node-resolve").default; // make sure to call .default
const commonjs = require("@rollup/plugin-commonjs"); // Add this line
const ts = require("rollup-plugin-typescript2");
const cleanup = require("rollup-plugin-cleanup");
const terser = require("rollup-plugin-terser");
const resolve = path.resolve;

const name = "FigToJSON";

const outputConfig = {
  "esm-bundler": {
    file: resolve(`dist/${name}.esm-bundler.js`),
    format: "es",
  },
  cjs: {
    file: resolve(`dist/${name}.cjs.js`),
    format: "cjs",
  },
  global: {
    file: resolve(`dist/${name}.global.js`),
    format: "iife",
    globals: {
      'uzip': 'uzip' // Define the global variable name for 'uzip'
    }
  },
};

const createConfig = (format, output) => {
  output.name = name;
  output.sourcemap = true;

  return {
    input: resolve(`src/index.ts`),
    output,
    plugins: [
      json(),
      ts({
        tsconfig: resolve(__dirname, "tsconfig.json"),
      }),
      resolvePlugin(),
      commonjs(),
      cleanup(),
      terser.terser(),
    ],
  };
};

const formats = Object.keys(outputConfig);

export default formats.map((format) => {
  return createConfig(format, outputConfig[format]);
});
