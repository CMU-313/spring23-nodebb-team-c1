"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db = require("../database");
const plugins = require("../plugins");
var Action;
(function (Action) {
    Action[Action["ENDORSE"] = 0] = "ENDORSE";
    Action[Action["UNENDORSE"] = 1] = "UNENDORSE";
})(Action || (Action = {}));
function default_1(Posts) {
    async function toggleEndorse(type, pid, uid) {
        if (parseInt(uid, 10) <= 0) {
            throw new Error('[[error:not-logged-in]]');
        }
        const isEndorsing = type === Action.ENDORSE;
        const [postData, hasEndorsed] = await Promise.all([
            Posts.getPostFields(pid, ['pid', 'uid']),
            Posts.hasEndorsed(pid, uid),
        ]);
        if (isEndorsing && hasEndorsed) {
            throw new Error('You have already endorsed this post.');
        }
        if (!isEndorsing && !hasEndorsed) {
            throw new Error('You have already unendorsed this post.');
        }
        if (isEndorsing) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.setAdd(`pid:${pid}:users_endorsed`, uid);
        }
        else {
            // should only have one endorsement
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.setRemoveRandom(`pid:${pid}:users_endorsed`);
        }
        await plugins.hooks.fire(`action:post.${type}`, {
            pid: pid,
            uid: uid,
            owner: postData.uid,
            current: hasEndorsed ? 'endorsed' : 'unendorsed',
        });
        return {
            post: postData,
            isEndorsed: isEndorsing,
        };
    }
    // true if anybody has endorsed the post
    Posts.hasEndorsed = async function (pid, uid) {
        if (parseInt(uid, 10) <= 0) {
            return Array.isArray(pid) ? pid.map(() => false) : false;
        }
        if (Array.isArray(pid)) {
            const sets = pid.map(pid => `pid:${pid}:users_endorsed`);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const numEndorsed = await db.setsCount(sets);
            // get all posts that have at least one endorsement
            return numEndorsed.map(x => x > 0);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const numEndorsed = await db.setCount(`pid:${pid}:users_endorsed`);
        // must have at least one endorsement
        return numEndorsed > 0;
    };
    Posts.endorse = async function (pid, uid) {
        return await toggleEndorse(Action.ENDORSE, pid, uid);
    };
    Posts.unendorse = async function (pid, uid) {
        return await toggleEndorse(Action.UNENDORSE, pid, uid);
    };
}
exports.default = default_1;
