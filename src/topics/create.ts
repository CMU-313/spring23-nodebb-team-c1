import _ = require('lodash');
import { Request } from 'express';

import db = require('../database');
import utils = require('../utils');
import slugify = require('../slugify');
import plugins = require('../plugins');
import analytics = require('../analytics');
import user = require('../user');
import meta = require('../meta');
import posts = require('../posts');
import privileges = require('../privileges');
import categories = require('../categories');
import translator = require('../translator');

import { TagObject, UserObjectSlim, SettingsObject } from '../types';

type TopicObject = {
    tid: number;
    uid: number;
    cid: number;
    mainPid: number;
    title: string;
    slug: string;
    timestamp: number;
    lastposttime: number;
    postcount: number;
    viewcount: number;
    isPrivate?: boolean;
    tags?: string;
    scheduled?: boolean;
    deleted?: boolean;
    locked?: boolean;
};

type TopicDataObject = {
    uuid: string;
    title: string;
    content: string;
    thumb: string;
    cid: number;
    tags: TagObject[];
    timestamp: number;
    isPrivate?: boolean;
    uid: number;
    tid?: number;
    req: Request;
    fromQueue: boolean;
    ip?: string;
    handle?: string;
    scheduled?: boolean;
    unreplied?: boolean;
    mainPost?: PostDataObject;
    index?: number;
}

type Uploads = {
    sync: (pid: number) => void;
}

type PostDataObject = {
    pid: number;
    tid: number;
    isMain?: boolean;
    toPid?: number;
    ip?: string;
    handle?: string;
    uploads?: Uploads;
    uuid: string;
    title: string;
    content: string;
    thumb: string;
    cid: number;
    tags: TagObject[];
    timestamp: number;
    isPrivate?: boolean;
    uid: number;
    req: Request;
    fromQueue: boolean;
    index?: number;
    user?: UserObjectSlim;
    topic?: TopicObject;
    votes?: number;
    bookmarked?: boolean;
    display_edit_tools?: boolean;
    display_delete_tools?: boolean;
    display_moderator_tools?: boolean;
    display_move_tools?: boolean;
    selfPost?: boolean;
    timestampISO?: string;
}

type TopicPostObject = {
    topicData: TopicDataObject,
    postData: PostDataObject,
}

type NotifyDataObject = {
    type: string,
    bodyShort: string,
    nid: string,
    mergeId: string,
}

type ScheduledObject = {
    startJobs: () => void;
    handleExpired: () => Promise<void>;
    pin: (tid: number, topicData: TopicObject) => Promise<void>;
    reschedule: (cid: number, tid: number, timestamp: number, uid: number) => Promise<void>;
    unpin: (tid: number, topicData: TopicObject) => Promise<void>;
    sendNotifications: (uids: number[], topicsData: TopicDataObject[]) => Promise<void>;
    updateUserLastposttimes: (uids: number[], topicsData: TopicDataObject[]) => Promise<void>;
    shiftPostTimes: (tid: number, timestamp: number) => Promise<void>;
}


type TopicsObject = {
    create?: (data: TopicDataObject) => Promise<number>;
    post?: (data: TopicDataObject) => Promise<TopicPostObject>;
    reply?: (data: TopicDataObject) => Promise<PostDataObject>;
    checkTitle?: (title: string) => void;
    checkContent?: (content: string) => void;
    createTags?: (tags:TagObject[], tid: number, timestamp: number) => Promise<void>;
    filterTags?: (tags:TagObject[], cid: number) => Promise<TagObject[]>;
    validateTags?: (tags:TagObject[], cid: number, udi: number, tid?: number) => Promise<void>;
    getTopicsByTids?: (tid: number[], options: number) => Promise<TopicDataObject[]>;
    follow?: (tid: number, uid: number) => Promise<void>;
    delete?: (tid: number) => Promise<void>;
    getTopicData?: (tid: number) => Promise<TopicObject>;
    scheduled?: ScheduledObject;
    notifyFollowers?: (postData: PostDataObject, exceptUid: number,
        notifData: NotifyDataObject) => Promise<TopicObject>;
    markAsUnreadForAll?: (tid: number) => Promise<void>;
    markAsRead?: (tid: number[], uid: number) => Promise<boolean>;
    getTopicFields?: (tid: number, fields: string[]) => Promise<TopicObject>;
    addParentPosts?: (postData: PostDataObject[]) => Promise<void>;
    syncBacklinks?: (postData: PostDataObject) => Promise<number>;
}

type ResultType = {
    topic: TopicObject;
}


export = function (Topics: TopicsObject) {
    async function guestHandleValid(data: TopicDataObject) {
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
    async function onNewPost(postData: PostDataObject, data: TopicDataObject) {
        const { tid } = postData;
        const { uid } = postData;
        await Topics.markAsUnreadForAll(tid);
        await Topics.markAsRead([tid], uid);
        const [
            userInfo,
            topicInfo,
        ] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            posts.getUserInfoForPosts([postData.uid], uid) as UserObjectSlim[],
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
        postData.timestampISO = utils.toISOString(postData.timestamp) as string;
        postData.topic.title = String(postData.topic.title);

        return postData;
    }

    async function canReply(data: TopicDataObject, topicData: TopicObject) {
        if (!topicData) {
            throw new Error('[[error:no-topic]]');
        }
        const { tid, uid } = data;
        const { cid, deleted, locked, scheduled } = topicData;

        const [canReply, canSchedule, isAdminOrMod] = await Promise.all([
            privileges.topics.can('topics:reply', tid, uid) as boolean,
            privileges.topics.can('topics:schedule', tid, uid) as boolean,
            privileges.categories.isAdminOrMod(cid, uid) as boolean,
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

    function check(item: string, min: string, max: string, minError: string, maxError: string) {
        // Trim and remove HTML (latter for composers that send in HTML, like redactor)
        if (typeof item === 'string') {
            item = utils.stripHTMLTags(item).trim();
        }

        if (item === null || item === undefined || item.length < parseInt(min, 10)) {
            throw new Error(`[[error:${minError}, ${min}]]`);
        } else if (item.length > parseInt(max, 10)) {
            throw new Error(`[[error:${maxError}, ${max}]]`);
        }
    }

    Topics.create = async function (data: TopicDataObject) {
        // This is an internal method, consider using Topics.post instead
        const timestamp = data.timestamp || Date.now();

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const tid = await db.incrObjectField('global', 'nextTid') as number;
        const slug = `${tid}/${slugify(data.title) as string || 'topic'}`;
        let topicData: TopicObject = {
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
        const result : ResultType = await plugins.hooks.fire('filter:topic.create', { topic: topicData, data: data }) as ResultType;
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

    Topics.post = async function (data: TopicDataObject) {
        data = await plugins.hooks.fire('filter:topic.post', data) as TopicDataObject;
        const { uid } = data;

        data.title = String(data.title).trim();
        data.tags = data.tags || [];
        if (data.content) {
            data.content = utils.rtrim(data.content) as string;
        }
        Topics.checkTitle(data.title);
        await Topics.validateTags(data.tags, data.cid, uid);
        data.tags = await Topics.filterTags(data.tags, data.cid);
        if (!data.fromQueue) {
            Topics.checkContent(data.content);
        }

        const [categoryExists, canCreate, canTag] = await Promise.all([
            categories.exists(data.cid) as boolean,
            privileges.categories.can('topics:create', data.cid, uid) as boolean,
            privileges.categories.can('topics:tag', data.cid, uid) as boolean,
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
        let postData = data as PostDataObject;
        postData.tid = tid;
        postData.ip = data.req ? data.req.ip : null;
        postData.isMain = true;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        postData = await posts.create(postData) as PostDataObject;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        postData = await onNewPost(postData, data);

        const [settings, topics] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.getSettings(uid) as SettingsObject,
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

    Topics.reply = async function (data: TopicDataObject) {
        data = await plugins.hooks.fire('filter:topic.reply', data) as TopicDataObject;
        const { tid } = data;
        const { uid } = data;

        const topicData = await Topics.getTopicData(tid);

        await canReply(data, topicData);

        data.cid = topicData.cid;

        await guestHandleValid(data);
        if (data.content) {
            data.content = utils.rtrim(data.content) as string;
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
        let postData = await posts.create(data) as PostDataObject;
        postData = await onNewPost(postData, data);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const settings = await user.getSettings(uid) as SettingsObject;
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

    Topics.checkTitle = function (title: string) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        check(title, meta.config.minimumTitleLength as string, meta.config.maximumTitleLength as string, 'title-too-short', 'title-too-long');
    };

    Topics.checkContent = function (content: string) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        check(content, meta.config.minimumPostLength as string, meta.config.maximumPostLength as string, 'content-too-short', 'content-too-long');
    };
}
