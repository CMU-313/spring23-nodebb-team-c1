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
            throw new Error('[[error:already-endorsed]]');
        }
        if (!isEndorsing && !hasEndorsed) {
            throw new Error('[[error:already-unendorsed]]');
        }
        if (isEndorsing) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetAdd(`uid:${uid}:endorsed`, Date.now(), pid);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetRemove(`uid:${uid}:endorsed`, pid);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db[isEndorsing ? 'setAdd' : 'setRemove'](`pid:${pid}:users_endorsed`, uid);
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
    Posts.hasEndorsed = async function (pid, uid) {
        if (parseInt(uid, 10) <= 0) {
            return Array.isArray(pid) ? pid.map(() => false) : false;
        }
        if (Array.isArray(pid)) {
            const sets = pid.map(pid => `pid:${pid}:users_endorsed`);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return await db.isMemberOfSets(sets, uid);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.isSetMember(`pid:${pid}:users_endorsed`, uid);
    };
    Posts.endorse = async function (pid, uid) {
        return await toggleEndorse(Action.ENDORSE, pid, uid);
    };
    Posts.unendorse = async function (pid, uid) {
        return await toggleEndorse(Action.UNENDORSE, pid, uid);
    };
}
exports.default = default_1;
