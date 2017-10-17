import minify from "rollup-plugin-babel-minify";
import babel from "rollup-plugin-babel";

export default {
  input: "./src/index.js",
  name: "postJs",
  output: {
    file: "./dist/post.js",
    format: "umd"
  },
  sourcemap: true,
  plugins: [
    babel({
      babelrc: false,
      presets: [["env", { modules: false }]],
      plugins: []
    }),
    minify({ comments: false })
  ],
  globals: {},
  external: []
};
