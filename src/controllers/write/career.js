"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = void 0;
const child_process_1 = require("child_process");
const helpers_1 = __importDefault(require("../helpers"));
const user_1 = __importDefault(require("../../user"));
const database_1 = __importDefault(require("../../database"));
/* eslint-disable import/prefer-default-export */
async function register(req, res) {
    const userData = req.body;
    try {
        const userCareerData = {
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
        const message = (0, child_process_1.spawnSync)('python', [predictFile, args]);
        console.log(`good_employee?: ${message.stdout.toString()}`);
        console.log(`error: ${message.stderr.toString()}`);
        userCareerData.prediction = parseInt(message.stdout.toString(), 10);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await user_1.default.setCareerData(req.uid, userCareerData);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        database_1.default.sortedSetAdd('users:career', req.uid, req.uid);
        await helpers_1.default.formatApiResponse(200, res);
    }
    catch (err) {
        if (err instanceof Error) {
            console.log(err);
            await helpers_1.default.noScriptErrors(req, res, err.message, 400);
        }
    }
}
exports.register = register;
