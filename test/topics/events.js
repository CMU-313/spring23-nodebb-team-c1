'use strict';

const assert = require('assert');

const db = require('../mocks/databasemock');

const plugins = require('../../src/plugins');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const user = require('../../src/user');

describe('Topic Events', () => {
    let fooUid;
    let topic;
    let isAnonymous;
    before(async () => {
        fooUid = await user.create({ username: 'foo', password: '123456' });

        const categoryObj = await categories.create({
            name: 'Test Category',
            description: 'Test category created by testing script',
        });
        topic = await topics.post({
            title: 'topic events testing',
            content: 'foobar one two three',
            uid: fooUid,
            cid: 1,
            isAnonymous: false,
        });
    });

    describe('.init()', () => {
        before(() => {
            topics.events._ready = false;
        });

        it('should allow a plugin to expose new event types', async () => {
            await plugins.hooks.register('core', {
                hook: 'filter:topicEvents.init',
                method: async ({ types }) => {
                    types.foo = {
                        icon: 'bar',
                        text: 'baz',
                        quux: 'quux',
                    };

                    return { types };
                },
            });

            await topics.events.init();

            assert(topics.events._types.foo);
            assert.deepStrictEqual(topics.events._types.foo, {
                icon: 'bar',
                text: 'baz',
                quux: 'quux',
            });
        });
    });

    describe('.log()', () => {
        it('should log and return a set of new events in the topic', async () => {
            const events = await topics.events.log(topic.topicData.tid, {
                type: 'foo',
            });

            assert(events);
            assert(Array.isArray(events));
            events.forEach((event) => {
                assert(['id', 'icon', 'text', 'timestamp', 'timestampISO', 'type', 'quux'].every(key => event.hasOwnProperty(key)));
            });
        });
    });

    describe('.get()', () => {
        it('should get a topic\'s events', async () => {
            const events = await topics.events.get(topic.topicData.tid);

            assert(events);
            assert(Array.isArray(events));
            assert.strictEqual(events.length, 1);
            events.forEach((event) => {
                assert(['id', 'icon', 'text', 'timestamp', 'timestampISO', 'type', 'quux'].every(key => event.hasOwnProperty(key)));
            });
        });
    });

    describe('isAnonymous_false', () => {
        it('should set isAnonymous field to false by default', async () => {
            const composerData = {
                handle: 'testuser123456789',
                title: 'Test Topic123456789',
                content: 'This is a test topic to test that isAnonymous returns false.',
                cid: 1,
                tags: [],
                timestamp: Date.now(),
                uid: 1,
                slug: 'topic',
                isAnonymous: false,
                isPrivate: false,
            };
            assert.strictEqual(composerData.isAnonymous, false);
        });
    });

    describe('isAnonymous_true', () => {
        it('should set isAnonymous field to true', async () => {
            const composerData = {
                handle: 'testuser123456789',
                title: 'Test Topic123456789',
                content: 'This is a test topic to test that isAnonymous returns false.',
                cid: 1,
                tags: [],
                timestamp: Date.now(),
                uid: 1,
                slug: 'topic',
                isAnonymous: false,
                isPrivate: false,
            };
            //  contrived way of simulating the checkbox being clicked
            //  (i.e. = true) I wanted to call .checked and .val (the functions
            //  toggleBox calls) in reality, but there is no checkbox for the
            //  test to refer to since composer.tpl is not in scope. Thus, I am
            //  simulating this behavior to make sure that isAnonymous actually
            //  returns true when toggleBox is set to true.
            let toggleBox = true;
            composerData.isAnonymous = toggleBox;
            console.log(composerData.isAnonymous);
            assert.strictEqual(composerData.isAnonymous, true);
        });
    });

    describe('.purge()', () => {
        let eventIds;

        before(async () => {
            const events = await topics.events.get(topic.topicData.tid);
            eventIds = events.map(event => event.id);
        });

        it('should purge topic\'s events from the database', async () => {
            await topics.events.purge(topic.topicData.tid);

            const keys = [`topic:${topic.topicData.tid}:events`];
            keys.push(...eventIds.map(id => `topicEvent:${id}`));

            const exists = await Promise.all(keys.map(key => db.exists(key)));
            assert(exists.every(exists => !exists));
        });
    });
});
