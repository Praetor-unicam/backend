const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const loader = require('../loader');
const State = require('../model/State');

// create instance of a luxembourg state
router.post('/create/:country', async (req, res) => {
    const coutry = req.params.country;
    const state = new State(loader.getData(country));
    await state
        .save()
        .then(result => {
            console.log(result);
        })
        .catch(err => console.log(err));
    res.status(201).json({
        message: ' Handling HOST request to /luxembourg',
        createdcrime: state,
    });
});

// read all documents that state name is specified in request param
router.get('/data/:country/:year', async (req, res) => {
    const state = req.params.coutry;
    const year = parseInt(req.params.year);
    console.log();
    const query = [
        {
            $match: {
                country: state,
            },
        },
        {
            $unwind: '$year',
        },
        {
            $match: {
                'year.year': year,
            },
        },
        {
            $unwind: '$year.region',
        },
        {
            $unwind: '$year.region.province',
        },

        {
            $unwind: '$year.region.province.data',
        },
        {
            $project: {
                crime: '$year.region.province.data.crime',
                value: '$year.region.province.data.value',
                code: '$year.region.province.data.code',
            },
        },
    ];

    await State.aggregate(query)
        .exec()
        .then(doc => {
            console.log(doc);
            crimes = [];
            //return doc;
            doc.forEach(crime => {
                const new_crime = { name: crime.crime, n_crimes: parseInt(crime.value) };
                crimes.push(new_crime);
            });
            res.status(200).json(crimes);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ error: err });
        });
});

module.exports = router;
