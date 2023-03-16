"use strict";

// Referenced @ziyanwang’s TypeScript translation from P1: https://github.com/CMU-313/NodeBB/pull/91
const _ = require("lodash");
const meta = require("../meta");
const db = require("../database");
const plugins = require("../plugins");
const user = require("../user");
const topics = require("../topics");
const categories = require("../categories");
const groups = require("../groups");
const utils = require("../utils");
module.exports = function (Posts) {
  Posts.create = async function (data) {
    // This is an internal method, consider using Topics.reply instead
    const {
      uid
    } = data;
    const {
      tid
    } = data;
    const content = data.content.toString();
    const timestamp = data.timestamp || Date.now();
    const isMain = data.isMain || false;
    const isPrivate = data.isPrivate || false;
    if (!uid && parseInt(uid, 10) !== 0) {
      throw new Error('[[error:invalid-uid]]');
    }
    if (data.toPid && !utils.isNumber(data.toPid)) {
      throw new Error('[[error:invalid-pid]]');
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const pid = await db.incrObjectField('global', 'nextPid');
    let postData = {
      pid: pid,
      uid: uid,
      tid: tid,
      content: content,
      timestamp: timestamp
    };
    if (data.toPid) {
      postData.toPid = data.toPid;
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (data.ip && meta.config.trackIpPerPost) {
      postData.ip = data.ip;
    }
    if (data.handle && !parseInt(uid, 10)) {
      postData.handle = data.handle;
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    let result = await plugins.hooks.fire('filter:post.create', {
      post: postData,
      data: data
    });
    postData = result.post;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.setObject(`post:${postData.pid}`, postData);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const topicData = await topics.getTopicFields(tid, ['cid', 'pinned']);
    postData.cid = topicData.cid;
    async function addReplyTo(postData, timestamp) {
      if (!postData.toPid) {
        return;
      }
      await Promise.all([
      // The next line calls a function in a module that has not been updated to TS yet
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
      db.sortedSetAdd(`pid:${postData.toPid}:replies`, timestamp, postData.pid),
      // The next line calls a function in a module that has not been updated to TS yet
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
      db.incrObjectField(`post:${postData.toPid}`, 'replies')]);
    }
    await Promise.all([
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.sortedSetAdd('posts:pid', timestamp, postData.pid),
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.incrObjectField('global', 'postCount'),
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    user.onNewPostMade(postData),
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    topics.onNewPostMade(postData),
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    categories.onNewPostMade(topicData.cid, topicData.pinned, postData),
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    groups.onNewPostMade(postData), addReplyTo(postData, timestamp),
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Posts.uploads.sync(postData.pid)]);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    result = await plugins.hooks.fire('filter:post.get', {
      post: postData,
      uid: data.uid
    });
    result.post.isMain = isMain;
    result.post.isPrivate = isPrivate;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    plugins.hooks.fire('action:post.save', {
      post: _.clone(result.post)
    });
    return result.post;
  };
};