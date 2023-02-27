import db = require('../database');
import plugins = require('../plugins');
import { Action, DBEndorseData, PostData, ToggleData, UserData } from './types';

interface PostsType {
  getPostFields(pid: string, fields: string[]): Promise<PostData>,
  hasEndorsed(pid: string | string[], uid: string): Promise<boolean | boolean[]>
  endorse(pid: string, uid: string): Promise<ToggleData>,
  unendorse(pid: string, uid: string): Promise<ToggleData>,
  endorsedBy(pid: string | string[]): Promise<string | string[]>
}

export default function (Posts: PostsType) {
    function endorseDBKey(pid: string) {
        return `pid:${pid}:users_endorsed`;
    }

    function userDBKey(uid: string) {
        return `user:${uid}`;
    }

    Posts.endorsedBy = async function (pid: string | string[]) {
        if (Array.isArray(pid)) {
            const sets = pid.map(endorseDBKey);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const usersEndorsed = await db.getObjects(sets) as DBEndorseData[];
            const uids = usersEndorsed.map(user => user?.uid);
            const usernames = uids.map(async (uid) => {
                if (uid === undefined) {
                    return '';
                }
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line max-len
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                return await db.getObjectField(userDBKey(uid), 'username') as string;
            });
            // get all posts that have at least one endorsement
            return await Promise.all(usernames);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userEndorsed = await db.getObject(endorseDBKey(pid)) as DBEndorseData;
        if (userEndorsed === null) {
            return '';
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.getObjectField(userDBKey(userEndorsed.uid), 'username') as string;
    };

    async function toggleEndorse(type: Action, pid: string, uid: string) {
        if (parseInt(uid, 10) <= 0) {
            throw new Error('[[error:not-logged-in]]');
        }

        const isEndorsing = type === Action.ENDORSE;

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
        } else {
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
    Posts.hasEndorsed = async function (pid: string | string[]) {
        if (Array.isArray(pid)) {
            const sets = pid.map(endorseDBKey);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const usersEndorsed = await db.getObjects(sets) as DBEndorseData[];
            // get all posts that have an endorsement
            return usersEndorsed.map(x => x !== null);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userEndorsed = await db.getObject(endorseDBKey(pid)) as DBEndorseData;
        // must have at least one endorsement
        return userEndorsed !== null;
    };

    async function checkInstructor(uid: string) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userData = await db.getObject(userDBKey(uid), ['accounttype']) as UserData;
        const isInstructor = userData.accounttype === 'instructor';
        if (!isInstructor) {
            throw new Error('Only instructors can endorse/unendorse posts');
        }
    }

    Posts.endorse = async function (pid: string, uid: string) {
        await checkInstructor(uid);
        return await toggleEndorse(Action.ENDORSE, pid, uid);
    };

    Posts.unendorse = async function (pid: string, uid: string) {
        await checkInstructor(uid);
        return await toggleEndorse(Action.UNENDORSE, pid, uid);
    };
}
