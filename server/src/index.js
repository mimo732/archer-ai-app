/**
 * ARCHER AI — server core (Node.js backend package)
 */
module.exports = {
  ...require("./protocol"),
  executors: {
    windows: require("./executors/windows"),
  },
};
