import { Request, Response } from 'express';
import { spawnSync } from 'child_process';
import helpers from '../helpers';
import user from '../../user';
import db from '../../database';

type CareerDataObject = {
    student_id: string;
    age: string;
    gender: string;
    major:string;
    gpa:string;
    extra_curricular: string;
    num_programming_languages: string;
    num_past_internships: string;
    prediction?: number;
};

export async function register(req: Request & { uid: number }, res : Response):Promise<void> {
    const userData = req.body as CareerDataObject;
    try {
        const userCareerData : CareerDataObject = {
            student_id: userData.student_id,
            major: userData.major,
            age: userData.age,
            gender: userData.gender,
            gpa: userData.gpa,
            extra_curricular: userData.extra_curricular,
            num_programming_languages: userData.num_programming_languages,
            num_past_internships: userData.num_past_internships,
        };

        const predictFile = 'career-model/predict.py';
        const args = JSON.stringify(userCareerData);

        const message = spawnSync('python', [predictFile, args]);
        console.log(`good_employee?: ${message.stdout.toString()}`);
        console.log(`error: ${message.stderr.toString()}`);
        userCareerData.prediction = parseInt(message.stdout.toString(), 10);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await user.setCareerData(req.uid, userCareerData);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.sortedSetAdd('users:career', req.uid, req.uid);
        await helpers.formatApiResponse(200, res);
    } catch (err: unknown) {
        if (err instanceof Error) {
            console.log(err);
            await helpers.noScriptErrors(req, res, err.message, 400);
        }
    }
}
