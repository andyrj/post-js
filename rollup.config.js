export default {
  input: "./src/index.js",
  name: "postJs",
  output: {
    file: "./dist/post.js",
    format: "umd"
  },
  sourcemap: true,
  plugins: [],
  globals: {
    "s-js": "S",
    "fast-json-patch": "jsonpatch"
  },
  external: ["s-js", "fast-json-patch"]
};
