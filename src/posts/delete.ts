import _ = require('lodash');

import db = require('../database');
import topics = require('../topics');
import categories = require('../categories');
import user = require('../user');
import notifications = require('../notifications');
import plugins = require('../plugins');
import flags = require('../flags');
import { PostObject, TopicObject } from '../types';

interface IncrObjectData {
  postCount?: number;
  postcount?: number;
  post_count?: number;
}
interface Posts {
  getPostFields(pid: number, fields: string[]): Promise<PostObject>,
  delete(pid: number, uid: number): Promise<PostObject>,
  restore(pid: number, uid: number): Promise<PostObject>,
  setPostFields(pid: number, fields: Partial<PostObject>): Promise<void>,
  purge(pids: number | number[], uid: number): Promise<void>,
  getPostsData(pids: number | number[]): Promise<PostObject[]>,
  diffs: {
    list: (pid: number) => number[]
  },
  uploads: {
    dissociateAll: (pid: number) => void
  }
}
export = function (Posts: Posts) {
    async function deleteFromTopicUserNotification(postData: PostObject[]) {
        const bulkRemove = [];
        postData.forEach((p) => {
            bulkRemove.push([`tid:${p.tid}:posts`, p.pid]);
            bulkRemove.push([`tid:${p.tid}:posts:votes`, p.pid]);
            bulkRemove.push([`uid:${p.uid}:posts`, p.pid]);
            bulkRemove.push([`cid:${p.cid}:uid:${p.uid}:pids`, p.pid]);
            bulkRemove.push([`cid:${p.cid}:uid:${p.uid}:pids:votes`, p.pid]);
        });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetRemoveBulk(bulkRemove);

        const incrObjectBulk = [['global', { postCount: -postData.length } as IncrObjectData]];

        const postsByCategory = _.groupBy(postData, p => parseInt(p.cid as string, 10));
        for (const [cid, posts] of Object.entries(postsByCategory)) {
            incrObjectBulk.push([`category:${cid}`, { post_count: -posts.length }]);
        }

        const postsByTopic = _.groupBy(postData, p => parseInt(p.tid as string, 10));
        const topicPostCountTasks = [];
        const topicTasks = [] as Promise<void>[];
        const zsetIncrBulk = [];
        for (const [tid, posts] of Object.entries(postsByTopic)) {
            incrObjectBulk.push([`topic:${tid}`, { postcount: -posts.length }]);
            if (posts.length && posts[0]) {
                const topicData = posts[0].topic;
                const newPostCount = topicData.postcount - posts.length;
                topicPostCountTasks.push(['topics:posts', newPostCount, tid]);
                if (!topicData.pinned) {
                    zsetIncrBulk.push([`cid:${topicData.cid}:tids:posts`, -posts.length, tid]);
                }
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            topicTasks.push(topics.updateTeaser(tid) as Promise<void>);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            topicTasks.push(topics.updateLastPostTimeFromLastPid(tid) as Promise<void>);
            const postsByUid = _.groupBy(posts, p => parseInt(p.uid as string, 10));
            for (const [uid, uidPosts] of Object.entries(postsByUid)) {
                zsetIncrBulk.push([`tid:${tid}:posters`, -uidPosts.length, uid]);
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            topicTasks.push(db.sortedSetIncrByBulk(zsetIncrBulk) as Promise<void>);
        }

        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.incrObjectFieldByBulk(incrObjectBulk),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetAddBulk(topicPostCountTasks),
            ...topicTasks,
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.updatePostCount(_.uniq(postData.map(p => p.uid))),
            notifications.rescind(...postData.map(p => `new_post:tid:${p.tid}:pid:${p.pid}:uid:${p.uid}`)),
        ]);
    }

    async function deleteFromCategoryRecentPosts(postData: PostObject[]) {
        const uniqCids = _.uniq(postData.map(p => p.cid));
        const sets = uniqCids.map(cid => `cid:${cid}:pids`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetRemove(sets, postData.map(p => p.pid));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await Promise.all(uniqCids.map(categories.updateRecentTidForCid as (cid: number) => Promise<void>));
    }

    async function deleteFromUsersBookmarks(pids: number[]) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const arrayOfUids = await db.getSetsMembers(pids.map(pid => `pid:${pid}:users_bookmarked`)) as number[][];
        const bulkRemove = [];
        pids.forEach((pid, index) => {
            arrayOfUids[index].forEach((uid) => {
                bulkRemove.push([`uid:${uid}:bookmarks`, pid]);
            });
        });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetRemoveBulk(bulkRemove);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.deleteAll(pids.map(pid => `pid:${pid}:users_bookmarked`));
    }

    async function deleteFromUserEndorsements(pids: number[]) {
        const keys = pids.map(pid => `pid:${pid}:users_endorsed`);
        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            keys.map(key => db.deleteObjectField(key, 'uid') as Promise<void>),
        ]);
    }

    async function deleteFromUsersVotes(pids: number[]) {
        const [upvoters, downvoters] = await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.getSetsMembers(pids.map(pid => `pid:${pid}:upvote`)) as number[][],
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.getSetsMembers(pids.map(pid => `pid:${pid}:downvote`)) as number[][],
        ]);
        const bulkRemove = [] as (string | number)[][];
        pids.forEach((pid, index) => {
            upvoters[index].forEach((upvoterUid) => {
                bulkRemove.push([`uid:${upvoterUid}:upvote`, pid]);
            });
            downvoters[index].forEach((downvoterUid) => {
                bulkRemove.push([`uid:${downvoterUid}:downvote`, pid]);
            });
        });

        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetRemoveBulk(bulkRemove),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.deleteAll([
                ...pids.map(pid => `pid:${pid}:upvote`),
                ...pids.map(pid => `pid:${pid}:downvote`),
            ]),
        ]);
    }

    async function deleteFromReplies(postData: PostObject[]) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const arrayOfReplyPids = await db.getSortedSetsMembers(postData.map(p => `pid:${p.pid}:replies`)) as number[][];
        const allReplyPids = _.flatten(arrayOfReplyPids);
        const promises = [
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.deleteObjectFields(
                allReplyPids.map(pid => `post:${pid}`), ['toPid']
            ) as Promise<void>,
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.deleteAll(postData.map(p => `pid:${p.pid}:replies`)) as Promise<void>,
        ];

        const postsWithParents = postData.filter(p => parseInt(p.toPid as string, 10));
        const bulkRemove = postsWithParents.map(p => [`pid:${p.toPid}:replies`, p.pid]);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        promises.push(db.sortedSetRemoveBulk(bulkRemove) as Promise<void>);
        await Promise.all(promises);

        const parentPids = _.uniq(postsWithParents.map(p => p.toPid));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const counts = await db.sortedSetsCard(parentPids.map(pid => `pid:${pid}:replies`)) as number[];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObjectBulk(parentPids.map((pid, index) => [`post:${pid}`, { replies: counts[index] }]));
    }

    async function deleteFromGroups(pids: number[]) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const groupNames = await db.getSortedSetMembers('groups:visible:createtime') as string[];
        const keys = groupNames.map(groupName => `group:${groupName}:member:pids`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetRemove(keys, pids);
    }

    async function deleteDiffs(pids: number[]) {
        const timestamps = await Promise.all(pids.map(pid => Posts.diffs.list(pid)));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.deleteAll([
            ...pids.map(pid => `post:${pid}:diffs`),
            ..._.flattenDeep(pids.map((pid, index) => timestamps[index].map(t => `diff:${pid}.${t}`))),
        ]);
    }

    async function deleteFromUploads(pids: number[]) {
        await Promise.all(pids.map(Posts.uploads.dissociateAll));
    }

    async function resolveFlags(postData: PostObject[], uid: number) {
        const flaggedPosts = postData.filter(p => parseInt(p.flagId, 10));
        await Promise.all(flaggedPosts.map(p => flags.update(p.flagId, uid, { state: 'resolved' })));
    }

    async function deleteOrRestore(type: string, pid: number, uid: number) {
        const isDeleting = type === 'delete';
        await plugins.hooks.fire(`filter:post.${type}`, { pid: pid, uid: uid });
        await Posts.setPostFields(pid, {
            deleted: isDeleting ? 1 : 0,
            deleterUid: isDeleting ? uid : 0,
        });
        const postData = await Posts.getPostFields(pid, ['pid', 'tid', 'uid', 'content', 'timestamp']);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const topicData = await topics.getTopicFields(postData.tid, ['tid', 'cid', 'pinned']) as Partial<TopicObject>;
        postData.cid = topicData.cid;
        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            topics.updateLastPostTimeFromLastPid(postData.tid) as Promise<void>,
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            topics.updateTeaser(postData.tid) as Promise<void>,
            isDeleting ?
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line max-len
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                db.sortedSetRemove(`cid:${topicData.cid}:pids`, pid) :
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line max-len
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                db.sortedSetAdd(`cid:${topicData.cid}:pids`, postData.timestamp, pid),
        ]);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await categories.updateRecentTidForCid(postData.cid);
        await plugins.hooks.fire(`action:post.${type}`, { post: _.clone(postData), uid: uid });
        if (type === 'delete') {
            await flags.resolveFlag('post', pid, uid);
        }
        return postData;
    }

    Posts.delete = async function (pid, uid) {
        return await deleteOrRestore('delete', pid, uid);
    };

    Posts.restore = async function (pid, uid) {
        return await deleteOrRestore('restore', pid, uid);
    };

    Posts.purge = async function (pids, uid) {
        pids = Array.isArray(pids) ? pids : [pids];
        let postData = await Posts.getPostsData(pids);
        pids = pids.filter((pid, index) => !!postData[index]);
        postData = postData.filter(Boolean);
        if (!postData.length) {
            return;
        }
        const uniqTids = _.uniq(postData.map(p => p.tid));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const topicData = await topics.getTopicsFields(
            uniqTids,
            ['tid', 'cid', 'pinned', 'postcount']
        ) as TopicObject[];
        const tidToTopic = _.zipObject(uniqTids, topicData);

        postData.forEach((p) => {
            p.topic = tidToTopic[p.tid];
            p.cid = tidToTopic[p.tid] && tidToTopic[p.tid].cid;
        });

        // deprecated hook
        await Promise.all(postData.map(
            p => plugins.hooks.fire('filter:post.purge', { post: p, pid: p.pid, uid: uid })
        ));

        // new hook
        await plugins.hooks.fire('filter:posts.purge', {
            posts: postData,
            pids: postData.map(p => p.pid),
            uid: uid,
        });

        await Promise.all([
            deleteFromTopicUserNotification(postData),
            deleteFromCategoryRecentPosts(postData),
            deleteFromUsersBookmarks(pids),
            deleteFromUserEndorsements(pids),
            deleteFromUsersVotes(pids),
            deleteFromReplies(postData),
            deleteFromGroups(pids),
            deleteDiffs(pids),
            deleteFromUploads(pids),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetsRemove(['posts:pid', 'posts:votes', 'posts:flagged'], pids),
        ]);

        await resolveFlags(postData, uid);

        // deprecated hook
        await Promise.all(postData.map(p => plugins.hooks.fire('action:post.purge', { post: p, uid: uid })));

        // new hook
        await plugins.hooks.fire('action:posts.purge', { posts: postData, uid: uid });

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.deleteAll(postData.map(p => `post:${p.pid}`));
    };
};
