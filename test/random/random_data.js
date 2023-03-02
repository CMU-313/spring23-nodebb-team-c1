"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomString = exports.randomInt = void 0;
// [min, max] (inclusive)
function randomInt(min, max) {
    const range = max - min + 1;
    return min + Math.floor(Math.random() * range);
}
exports.randomInt = randomInt;
function randomString(len) {
    if (len < 0)
        return;
    let res = "";
    let i = 0;
    while (i < len) {
        res += String.fromCharCode(this.randomInt(32, 127));
        i += 1;
    }
    return res;
}
exports.randomString = randomString;
