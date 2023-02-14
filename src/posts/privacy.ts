import db from '../database';

interface Posts {
    getPrivate: (pid: number, uid: number) => Promise<{isPrivate: boolean}>,
}

export = function (Posts: Posts) {
    Posts.getPrivate = async function (pid: number, uid: number): Promise<{isPrivate: boolean}> {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result = await db.isMemberOfSets([`pid:${pid}:isPrivate`], uid) as boolean;
        return { isPrivate: result };
    };
}
