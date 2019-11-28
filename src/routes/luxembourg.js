const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const State = require('../model/State');

// create instance of a luxembourg state
router.post('/create', async (req, res) => {
    const state = new State(req.body);
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
router.get('/state', async (req, res) => {
    const state = req.query.state;
    const year = parseInt(req.query.year);
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
            //return doc;
            res.status(200).json(doc);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ error: err });
        });
});

module.exports = router;
