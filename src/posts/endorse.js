"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db = require("../database");
const plugins = require("../plugins");
const types_1 = require("./types");
function default_1(Posts) {
    function endorseDBKey(pid) {
        return `pid:${pid}:users_endorsed`;
    }
    function userDBKey(uid) {
        return `user:${uid}`;
    }
    Posts.endorsedBy = async function (pid) {
        if (Array.isArray(pid)) {
            const sets = pid.map(endorseDBKey);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const usersEndorsed = await db.getObjects(sets);
            const uids = usersEndorsed.map(user => user === null || user === void 0 ? void 0 : user.uid);
            const usernames = uids.map(async (uid) => {
                if (uid === undefined) {
                    return '';
                }
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line max-len
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                return await db.getObjectField(userDBKey(uid), 'username');
            });
            // get all posts that have at least one endorsement
            return await Promise.all(usernames);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userEndorsed = await db.getObject(endorseDBKey(pid));
        if (userEndorsed === null) {
            return '';
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.getObjectField(userDBKey(userEndorsed.uid), 'username');
    };
    async function toggleEndorse(type, pid, uid) {
        if (parseInt(uid, 10) <= 0) {
            throw new Error('[[error:not-logged-in]]');
        }
        const isEndorsing = type === types_1.Action.ENDORSE;
        const [postData, hasEndorsed] = await Promise.all([
            Posts.getPostFields(pid, ['pid', 'uid']),
            Posts.hasEndorsed(pid, uid),
        ]);
        if (isEndorsing && hasEndorsed) {
            throw new Error('This post is already unendorsed.');
        }
        if (!isEndorsing && !hasEndorsed) {
            throw new Error('This post is already unendorsed');
        }
        if (isEndorsing) {
            // add/update endorsement
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.setObject(endorseDBKey(pid), {
                uid: uid,
            });
        }
        else {
            // remove endorsement
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.deleteObjectField(endorseDBKey(pid), 'uid');
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
            endorsedBy: await Posts.endorsedBy(pid),
        };
    }
    // true if anybody has endorsed the post
    Posts.hasEndorsed = async function (pid) {
        if (Array.isArray(pid)) {
            const sets = pid.map(endorseDBKey);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const usersEndorsed = await db.getObjects(sets);
            // get all posts that have an endorsement
            return usersEndorsed.map(x => x !== null);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userEndorsed = await db.getObject(endorseDBKey(pid));
        // must have at least one endorsement
        return userEndorsed !== null;
    };
    async function checkInstructor(uid) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userData = await db.getObject(userDBKey(uid), ['accounttype']);
        const isInstructor = userData.accounttype === 'instructor';
        if (!isInstructor) {
            throw new Error('Only instructors can endorse/unendorse posts');
        }
    }
    Posts.endorse = async function (pid, uid) {
        await checkInstructor(uid);
        return await toggleEndorse(types_1.Action.ENDORSE, pid, uid);
    };
    Posts.unendorse = async function (pid, uid) {
        await checkInstructor(uid);
        return await toggleEndorse(types_1.Action.UNENDORSE, pid, uid);
    };
}
exports.default = default_1;
