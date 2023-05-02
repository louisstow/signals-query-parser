const path = require("path");

module.exports = {
  entry: {
    index: "./index.ts",
  },
  target: "node",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  // externals: ["securia-lib"],
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
  },
  optimization: {
    minimize: false,
  },
  devtool: "source-map",
};
