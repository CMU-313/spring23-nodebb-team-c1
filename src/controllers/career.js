"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.get = void 0;
const user_1 = __importDefault(require("../user"));
const helpers_1 = __importDefault(require("./helpers"));
/* eslint-disable import/prefer-default-export */
async function get(req, res) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const userData = await user_1.default.getUserFields(req.uid, ['accounttype']);
    const accountType = userData.accounttype;
    let careerData = {};
    if (accountType === 'recruiter') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        careerData.allData = await user_1.default.getAllCareerData();
    }
    else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userCareerData = await user_1.default.getCareerData(req.uid);
        if (userCareerData) {
            careerData = userCareerData;
        }
        else {
            careerData.newAccount = true;
        }
    }
    careerData.accountType = accountType;
    careerData.breadcrumbs = helpers_1.default.buildBreadcrumbs([{ text: 'Career', url: '/career' }]);
    res.render('career', careerData);
}
exports.get = get;
