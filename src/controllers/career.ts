import { Request, Response } from 'express';
import user from '../user';
import helpers from './helpers';
import { UserObject, Breadcrumb } from '../types';

type CareerDataObject = {
    student_id: string;
    age: string;
    gender: string;
    major:string;
    gpa:string;
    extra_curriular: string;
    num_programming_languages: string;
    num_past_internships: string;
};

type CareerObject = {
    accountType: string;
    allData: CareerDataObject;
    newAccount: boolean;
    breadcrumbs: Breadcrumb;
}

export async function get(req: Request & { uid: number }, res : Response):Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const userData = await user.getUserFields(req.uid, ['accounttype']) as UserObject;

    const accountType = userData.accounttype;
    let careerData = {} as CareerObject;

    if (accountType === 'recruiter') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        careerData.allData = await user.getAllCareerData() as CareerDataObject;
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userCareerData = await user.getCareerData(req.uid) as CareerObject;
        if (userCareerData) {
            careerData = userCareerData;
        } else {
            careerData.newAccount = true;
        }
    }

    careerData.accountType = accountType;
    careerData.breadcrumbs = helpers.buildBreadcrumbs([{ text: 'Career', url: '/career' }]);
    res.render('career', careerData);
}
