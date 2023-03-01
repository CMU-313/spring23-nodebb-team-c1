"use strict";
const _ = require("lodash");
const db = require("../database");
const utils = require("../utils");
const slugify = require("../slugify");
const plugins = require("../plugins");
const analytics = require("../analytics");
const user = require("../user");
const meta = require("../meta");
const posts = require("../posts");
const privileges = require("../privileges");
const categories = require("../categories");
const translator = require("../translator");
module.exports = function (Topics) {
    async function guestHandleValid(data) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (meta.config.allowGuestHandles && data.uid === 0 && data.handle) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (data.handle.length > meta.config.maximumUsernameLength) {
                throw new Error('[[error:guest-handle-invalid]]');
            }
            const exists = await user.existsBySlug(slugify(data.handle));
            if (exists) {
                throw new Error('[[error:username-taken]]');
            }
        }
    }
    async function onNewPost(postData, data) {
        const { tid } = postData;
        const { uid } = postData;
        await Topics.markAsUnreadForAll(tid);
        await Topics.markAsRead([tid], uid);
        const [userInfo, topicInfo,] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            posts.getUserInfoForPosts([postData.uid], uid),
            Topics.getTopicFields(tid, ['tid', 'uid', 'title', 'slug', 'cid', 'postcount', 'mainPid', 'scheduled']),
            Topics.addParentPosts([postData]),
            Topics.syncBacklinks(postData),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            posts.parsePost(postData),
        ]);
        postData.user = userInfo[0];
        postData.topic = topicInfo;
        postData.index = topicInfo.postcount - 1;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        posts.overrideGuestHandle(postData, data.handle);
        postData.votes = 0;
        postData.bookmarked = false;
        postData.display_edit_tools = true;
        postData.display_delete_tools = true;
        postData.display_moderator_tools = true;
        postData.display_move_tools = true;
        postData.selfPost = false;
        postData.timestampISO = utils.toISOString(postData.timestamp);
        postData.topic.title = String(postData.topic.title);
        return postData;
    }
    async function canReply(data, topicData) {
        if (!topicData) {
            throw new Error('[[error:no-topic]]');
        }
        const { tid, uid } = data;
        const { cid, deleted, locked, scheduled } = topicData;
        const [canReply, canSchedule, isAdminOrMod] = await Promise.all([
            privileges.topics.can('topics:reply', tid, uid),
            privileges.topics.can('topics:schedule', tid, uid),
            privileges.categories.isAdminOrMod(cid, uid),
        ]);
        if (locked && !isAdminOrMod) {
            throw new Error('[[error:topic-locked]]');
        }
        if (!scheduled && deleted && !isAdminOrMod) {
            throw new Error('[[error:topic-deleted]]');
        }
        if (scheduled && !canSchedule) {
            throw new Error('[[error:no-privileges]]');
        }
        if (!canReply) {
            throw new Error('[[error:no-privileges]]');
        }
    }
    function check(item, min, max, minError, maxError) {
        // Trim and remove HTML (latter for composers that send in HTML, like redactor)
        if (typeof item === 'string') {
            item = utils.stripHTMLTags(item).trim();
        }
        if (item === null || item === undefined || item.length < parseInt(min, 10)) {
            throw new Error(`[[error:${minError}, ${min}]]`);
        }
        else if (item.length > parseInt(max, 10)) {
            throw new Error(`[[error:${maxError}, ${max}]]`);
        }
    }
    Topics.create = async function (data) {
        // This is an internal method, consider using Topics.post instead
        const timestamp = data.timestamp || Date.now();
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const tid = await db.incrObjectField('global', 'nextTid');
        const slug = `${tid}/${slugify(data.title) || 'topic'}`;
        let topicData = {
            tid: tid,
            uid: data.uid,
            cid: data.cid,
            mainPid: 0,
            title: data.title,
            slug: slug,
            timestamp: timestamp,
            lastposttime: 0,
            postcount: 0,
            viewcount: 0,
            isPrivate: data.isPrivate,
        };
        if (Array.isArray(data.tags) && data.tags.length) {
            topicData.tags = data.tags.join(',');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result = await plugins.hooks.fire('filter:topic.create', { topic: topicData, data: data });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        topicData = result.topic;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`topic:${topicData.tid}`, topicData);
        const timestampedSortedSetKeys = [
            'topics:tid',
            `cid:${topicData.cid}:tids`,
            `cid:${topicData.cid}:uid:${topicData.uid}:tids`,
        ];
        const scheduled = timestamp > Date.now();
        if (scheduled) {
            timestampedSortedSetKeys.push('topics:scheduled');
        }
        await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetsAdd(timestampedSortedSetKeys, timestamp, topicData.tid),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetsAdd([
                'topics:views', 'topics:posts', 'topics:votes',
                `cid:${topicData.cid}:tids:votes`,
                `cid:${topicData.cid}:tids:posts`,
                `cid:${topicData.cid}:tids:views`,
            ], 0, topicData.tid),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.addTopicIdToUser(topicData.uid, topicData.tid, timestamp),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.incrObjectField(`category:${topicData.cid}`, 'topic_count'),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.incrObjectField('global', 'topicCount'),
            Topics.createTags(data.tags, topicData.tid, timestamp),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            scheduled ? Promise.resolve() : categories.updateRecentTid(topicData.cid, topicData.tid),
        ]);
        if (scheduled) {
            await Topics.scheduled.pin(tid, topicData);
        }
        await plugins.hooks.fire('action:topic.save', { topic: _.clone(topicData), data: data });
        return topicData.tid;
    };
    Topics.post = async function (data) {
        data = await plugins.hooks.fire('filter:topic.post', data);
        const { uid } = data;
        data.title = String(data.title).trim();
        data.tags = data.tags || [];
        if (data.content) {
            data.content = utils.rtrim(data.content);
        }
        Topics.checkTitle(data.title);
        await Topics.validateTags(data.tags, data.cid, uid);
        data.tags = await Topics.filterTags(data.tags, data.cid);
        if (!data.fromQueue) {
            Topics.checkContent(data.content);
        }
        const [categoryExists, canCreate, canTag] = await Promise.all([
            categories.exists(data.cid),
            privileges.categories.can('topics:create', data.cid, uid),
            privileges.categories.can('topics:tag', data.cid, uid),
        ]);
        if (!categoryExists) {
            throw new Error('[[error:no-category]]');
        }
        if (!canCreate || (!canTag && data.tags.length)) {
            throw new Error('[[error:no-privileges]]');
        }
        await guestHandleValid(data);
        if (!data.fromQueue) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await user.isReadyToPost(uid, data.cid);
        }
        const tid = await Topics.create(data);
        let postData = data;
        postData.tid = tid;
        postData.ip = data.req ? data.req.ip : null;
        postData.isMain = true;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        postData = await posts.create(postData);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        postData = await onNewPost(postData, data);
        const [settings, topics] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.getSettings(uid),
            Topics.getTopicsByTids([postData.tid], uid),
        ]);
        if (!Array.isArray(topics) || !topics.length) {
            throw new Error('[[error:no-topic]]');
        }
        if (uid > 0 && settings.followTopicsOnCreate) {
            await Topics.follow(postData.tid, uid);
        }
        const topicData = topics[0];
        topicData.unreplied = true;
        topicData.mainPost = postData;
        topicData.index = 0;
        postData.index = 0;
        if (topicData.scheduled) {
            await Topics.delete(tid);
        }
        analytics.increment(['topics', `topics:byCid:${topicData.cid}`]);
        await plugins.hooks.fire('action:topic.post', { topic: topicData, post: postData, data: data });
        if (uid && !topicData.scheduled) {
            await user.notifications.sendTopicNotificationToFollowers(uid, topicData, postData);
        }
        return {
            topicData: topicData,
            postData: postData,
        };
    };
    Topics.reply = async function (data) {
        data = await plugins.hooks.fire('filter:topic.reply', data);
        const { tid } = data;
        const { uid } = data;
        const topicData = await Topics.getTopicData(tid);
        await canReply(data, topicData);
        data.cid = topicData.cid;
        await guestHandleValid(data);
        if (data.content) {
            data.content = utils.rtrim(data.content);
        }
        if (!data.fromQueue) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await user.isReadyToPost(uid, data.cid);
            Topics.checkContent(data.content);
        }
        // For replies to scheduled topics, don't have a timestamp older than topic's itself
        if (topicData.scheduled) {
            data.timestamp = topicData.lastposttime + 1;
        }
        data.ip = data.req ? data.req.ip : null;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let postData = await posts.create(data);
        postData = await onNewPost(postData, data);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const settings = await user.getSettings(uid);
        if (uid > 0 && settings.followTopicsOnReply) {
            await Topics.follow(postData.tid, uid);
        }
        if (uid) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.setUserField(uid, 'lastonline', Date.now());
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (uid || meta.config.allowGuestReplyNotifications) {
            const { displayname } = postData.user;
            await Topics.notifyFollowers(postData, uid, {
                type: 'new-reply',
                bodyShort: translator.compile('notifications:user_posted_to', displayname, postData.topic.title),
                nid: `new_post:tid:${postData.topic.tid}:pid:${postData.pid}:uid:${uid}`,
                mergeId: `notifications:user_posted_to|${postData.topic.tid}`,
            });
        }
        analytics.increment(['posts', `posts:byCid:${data.cid}`]);
        await plugins.hooks.fire('action:topic.reply', { post: _.clone(postData), data: data });
        return postData;
    };
    Topics.checkTitle = function (title) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        check(title, meta.config.minimumTitleLength, meta.config.maximumTitleLength, 'title-too-short', 'title-too-long');
    };
    Topics.checkContent = function (content) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        check(content, meta.config.minimumPostLength, meta.config.maximumPostLength, 'content-too-short', 'content-too-long');
    };
};
