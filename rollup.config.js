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
    "fast-json-patch": "fastJsonPatch"
  },
  external: ["s-js", "fast-json-patch"]
};
