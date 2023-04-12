import db from '../database';
import plugins from '../plugins';

type CareerDataObject = {
    student_id: string;
    age: string;
    gender: string;
    major:string;
    gpa:string;
    extra_curricular: string;
    num_programming_languages: string;
    num_past_internships: string;
};

type UserFunctions = {
    getCareerData: (uid: string) => Promise<CareerDataObject>;
    getAllCareerData: (uid: string) => Promise<CareerDataObject>;
    setCareerData: (uid: string, data:CareerDataObject) => Promise<void>;
};

export = function (User: UserFunctions) {
    User.getCareerData = async function (uid):Promise<CareerDataObject> {
        const uid_num = parseInt(uid, 10);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const careerData = await db.getObject(`user:${uid_num}:career`) as CareerDataObject;
        return careerData;
    };

    User.getAllCareerData = async function ():Promise<CareerDataObject> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const uids = await db.getSortedSetRange('users:career', 0, -1) as number[];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const allData = await db.getObjects(uids.map(uid => `user:${uid}:career`)) as CareerDataObject;
        return allData;
    };

    User.setCareerData = async function (uid, data):Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`user:${uid}:career`, data);
        for await (const [field, value] of Object.entries(data)) {
            await plugins.hooks.fire('action:user.set', { uid, field, value, type: 'set' });
        }
    };
}
