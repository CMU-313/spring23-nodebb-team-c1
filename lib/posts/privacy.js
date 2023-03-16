"use strict";

var __importDefault = this && this.__importDefault || function (mod) {
  return mod && mod.__esModule ? mod : {
    "default": mod
  };
};
const database_1 = __importDefault(require("../database"));
module.exports = function (Posts) {
  Posts.getPrivate = async function (pid, uid) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const result = await database_1.default.isMemberOfSets([`pid:${pid}:isPrivate`], uid);
    return {
      isPrivate: result
    };
  };
};