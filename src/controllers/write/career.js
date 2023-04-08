'use strict';

const { spawnSync } = require('child_process');
const helpers = require('../helpers');
const user = require('../../user');
const db = require('../../database');

const Career = module.exports;

Career.register = async (req, res) => {
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
        const args = [JSON.stringify(userCareerData)];

        const message = spawnSync('python', [predictFile, args]);
        console.log(`good_employee?: ${message.stdout}`);
        userCareerData.prediction = parseInt(message.stdout, 10);

        await user.setCareerData(req.uid, userCareerData);
        db.sortedSetAdd('users:career', req.uid, req.uid);
        helpers.formatApiResponse(200, res);
    } catch (err) {
        console.log(err);
        helpers.noScriptErrors(req, res, err.message, 400);
    }
};
