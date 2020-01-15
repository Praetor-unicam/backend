const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const loader = require('../loader');
const State = require('../model/State');
const Maps = require('../model/Maps');
const fs = require('fs');

const read = require('../fileService');
// create instance of a luxembourg state
router.post('/create/:country', async (req, res) => {

    // const country = req.params.country;
    // const state = new State(loader.getData(country));
    const country = req.body;
    const state = new State(country);
    //console.log(state);


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

router.post('/maps', async (req, res) => {
    const maps = read.recFindByExt('maps/HU', 'geojson');

    for (let i = 0; i < maps.length; i++) {
        _map = [];
        let rawdata = fs.readFileSync(maps[i], 'utf8');
        let json_file = JSON.parse(rawdata);
        console.log(json_file);
        _map = new Maps(json_file);
        _map.save()
            .then(result => {
                console.log(result);
            })
            .catch(err => console.log(err));
    }
    res.json({
        message: ' Handling HOST request to /maps',
        createMap: _map,
    });
});

router.get('/map/:ID', async (req, res) => {
    const id = req.params.ID;
    const query = [
        {
            $match: {
                ID: id,
            },
        },
    ];
    await Maps.aggregate(query)
        .exec()
        .then(doc => {
            console.log(doc);
            res.status(200).json(doc);
        })
        .catch(err => {
            res.status(500).json(err);
        });
});

router.post('/data/updated', async (req, res) => {
    const name_state = read.readjson('/Users/manuelcretone/Desktop/hungary.json');
    // console.log(a.id);
    // console.log(a.state[0]);
    console.log(name_state['state'].length);
    for (let i = 0; i < name_state['state'].length; i++) {
        console.log('nome letto:');
        console.log(name_state.state[i].translate);

        await State.find({ country: name_state.state[i].translate })
            .update({ Nuts: name_state.state[i].id })
            .exec()
            .then(doc => {
                if (doc == undefined) {
                    State.find({ region: name_state.state[i].translate })
                        .update({ Nuts: name_state.state[i].id })
                        .exec()
                        .then(doc => {
                            if (doc == undefined) {
                                State.find({ province: name_state.state[i].translate })
                                    .update({ Nuts: name_state.state[i].id })
                                    .exec()
                                    .then(doc => {
                                        if (doc == undefined) {
                                            State.find({ county: name_state.state[i].translate })
                                                .update({ Nuts: name_state.state[i].id })
                                                .exec()
                                                .then(doc => {
                                                    console.log('ok');
                                                });
                                        }
                                    });
                            }
                        });
                }
            })
            .catch(err => {
                res.status(500).json(err);
            });
    }
});

//if specified country return all documents
router.get('/data/:country', async (req, res) => {
    const state = req.params.country;
    await State.find({ country: state })
        .exec()
        .then(doc => {
            res.status(200).json(doc);
        })
        .catch(err => {
            res.status(500).json(err);
        });
});
// read all documents that state name is specified in request param
router.get('/data/:country/:year', async (req, res) => {
    const state = req.params.country;
    const year = parseInt(req.params.year);
    console.log(state);
    console.log(year);
    const query = [
        {
            $match: {
                county: state,
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
            $unwind: '$year.region.province.county',
        },
        {
            $unwind: '$year.region.province.county.data',
        },
        {
            $project: {
                crime: '$year.region.province.county.data.crime',
                value: '$year.region.province.county.data.value',
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
                let new_crime = { name: crime.crime, n_crimes: parseInt(crime.value) };
                crimes.push(new_crime);
            });
            res.status(200).json(crimes);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ error: err });
        });
});

router.get('/data/:country/:year/:region', async (req, res) => {
    const state = req.params.country;
    const year = parseInt(req.params.year);
    const region = req.params.region;
    console.log(state);
    console.log(year);
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
            $match: {
                'year.region.region': region,
            },
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

                let new_crime = { name: crime.crime, n_crimes: parseInt(crime.value) };
                crimes.push(new_crime);
            });
            res.status(200).json(crimes);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ error: err });
        });
});

// return all categories of ICCS at level of country
router.get('/categories/:country', async (req, res) => {
    const state = req.params.country;
    await State.find({ country: state })
        .distinct('year.region.province.county.data.crime')
        .exec()
        .then(doc => {
            console.log(doc);
            crimes = [];
            doc.forEach(crime => {
                let new_crime = { name: crime };

               // const new_crime = { name: crime.crime, n_crimes: parseInt(crime.value) };

                crimes.push(new_crime);
            });
            res.status(200).json(crimes);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ error: err });
        });
});

router.get('/categories/countries', async (req, res) => {
    await State.distinct('year.data.crime')
        .exec()
        .then(doc => {
            console.log(doc);
            crimes = [];
            doc.forEach(crime => {
                let new_crime = { name: crime };
                crimes.push(new_crime);
            });
            res.status(200).json(crimes);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ error: err });
        });
});

//return boolean value if country data are presents
router.get('/data_status/:country', async (req, res) => {
    const state = req.params.country;
    await State.where('country', state)
        .countDocuments()
        .exec()
        .then((docs, err) => {
            if (docs > 0) {
                res.status(200).json(true);
                return true;
            } else {
                res.status(200).json(false);
                return false;
            }
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ error: err });
        });
});

//return boolean value if region data are presents
router.get('/data_status/:country/:region', async (req, res) => {
    const state = req.params.country;
    const region = req.params.region;
    await State.aggregate([
        { $match: { country: state } },
        { $unwind: '$year' },
        { $unwind: '$year.region' },
        { $match: { 'year.region.region': region } },
        { $unwind: '$year.region.province' },
    ])
        .exec()
        .then((docs, err) => {
            console.log(docs.length);
            if (docs.length > 0) {
                res.status(200).json(true);
                return true;
            } else {
                res.status(200).json(false);
                return false;
            }
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ error: err });
        });
});

router.get('/data_status/:country/:region/:province', async (req, res) => {
    const state = req.params.country;
    const region = req.params.region;
    console.log(region);
    const province = req.params.province;
    console.log(province);

    await State.aggregate([
        { $match: { country: state } },
        { $unwind: '$year' },
        { $unwind: '$year.region' },
        { $match: { 'year.region.region': region } },
        { $unwind: '$year.region.province' },
        { $match: { 'year.region.province.province': province } },
        { $unwind: '$year.region.province.county' },
        { $unwind: '$year.region.province.county.data' },
    ])
        .exec()
        .then((docs, err) => {
            if (docs.length > 0) {
                res.status(200).json(true);
                return true;
            } else {
                res.status(200).json(false);
                return false;
            }
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ error: err });
        });
});

module.exports = router;
