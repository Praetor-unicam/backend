import { Country } from '../loader';
import express, { response } from 'express';
import { ICountry } from '../interfaces/Country';
import { Crime } from '../interfaces/crime.interface';
import { compare } from '../comparator';
const router = express.Router();
const mongoose = require('mongoose');
const loader = require('../loader');
const Country = require('../model/State');
const Maps = require('../model/Maps');
const fs = require('fs');
const ICountry = require('../interfaces/Country');
const read = require('../fileService');

/**
 *  create instance of a state with all data crimes
 *  */
router.post('/create/:country', async (req, res) => {
    try {
        const country = req.params.country;
        const s = JSON.stringify(await loader.getFlattenedData(country));
        const state = new Country(JSON.parse(s));
        await state
            .save()
            .then((result: any) => {
                res.status(201).json(result);
            })
            .catch((err: any) => console.log(err));
        res.status(201).json({
            message: ' Handling HOST request to /luxembourg',
            createdcrime: '',
        });
    } catch (error) {
        console.log(error);
    }
});
/**
 * returns the years in which crime data exist
 */
router.get('/year_available/:country/:ID', async (req, res) => {
    const country = req.params.country;
    const id = req.params.id;

    const query = [
        {
            $match: {
                CountryNUTS: country,
            },
        },
        {
            $unwind: '$year',
        },

        {
            $unwind: '$year.place',
        },
        {
            $match: {
                'year.place.NUTS': id,
            },
        },
        {
            $project: {
                data: '$year.year',
            },
        },
    ];

    await Country.aggregate(query)
        .exec()
        .then((doc: ICountry) => {
            res.status(201).json(doc);
        })
        .catch((err: any) => {
            res.status(500).json(err);
        });
});

/**
 * return list of all year available that nuts_id specified
 */
router.get('/years/:country/:nuts_id', async (req, res) => {
    const id = req.params.nuts_id;
    const country = req.params.country;
    const query = [
        {
            $match: {
                CountryNUTS: country,
            },
        },
        {
            $unwind: '$year',
        },
        {
            $unwind: '$year.place',
        },
        {
            $match: {
                'year.place.NUTS': id,
            },
        },
    ];
    await Country.aggregate(query)
        .exec()
        .then((doc: any[]) => {
            var years: any[] = [];
            doc.forEach(element => {
                //let new_data = { year: element.year.year };
                years.push(element.year.year);
            });
            res.status(201).json(years);
        })
        .catch((err: any) => {
            res.status(500).json(err);
        });
});
/**
 * return array with true or false if there are data available for
 * nuts id specified
 */
router.get('/data_available/:country', async (req, res) => {
    const id = JSON.parse(req.query.nuts_id);
    const country = req.params.country;
    var result: any[] = [];

    for (const element of id) {
        await db_call(country, element, result);
    }
    res.json(result);
});

async function db_call(country: String, nuts: any, array: any[]): Promise<any> {
    const query = [
        {
            $match: {
                CountryNUTS: country,
            },
        },
        {
            $unwind: '$year',
        },
        {
            $unwind: '$year.place',
        },
        {
            $match: {
                'year.place.NUTS': nuts,
            },
        },
        {
            $project: {
                data: '$year.place.data',
            },
        },
    ];

    await Country.aggregate(query)
        .exec()
        .then((doc: any[]) => {
            if (doc.length != 0) {
                let res = { NUTS: nuts, available: true };
                array.push(res);
                return array;
            } else {
                let res = { NUTS: nuts, available: false };
                array.push(res);
                return array;
            }
        })
        .catch((err: any) => {
            console.log(err);
        });
}

/**
 * return all data of a specific country
 */
router.get('/data/:country/:ID', async (req, res) => {
    const country = req.params.country;
    const year = req.query.year;
    const ID = req.params.ID;

    const query = [
        {
            $match: {
                CountryNUTS: country,
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
            $unwind: '$year.place',
        },
        {
            $match: {
                'year.place.NUTS': ID,
            },
        },
        {
            $project: {
                data: '$year.place.data',
            },
        },
    ];
    await Country.aggregate(query)
        .exec()
        .then((doc: any[]) => {
            res.status(200).json(doc[0].data);
        })
        .catch((err: any) => {
            res.status(500).json(err);
        });
});

/**
 * return all possible iccs_crime in each data place
 */

router.get('/data/ICCS_category', async (req, res) => {
    await Country.distinct('year.place.data.ICCS_crime')
        .exec()
        .then((doc: any[]) => {
            res.status(200).json(doc);
        })
        .catch((err: any) => {
            res.status(500).json(err);
        });
});

/**
 * call to compare ICCS data crimes
 */
async function compare_data(countries: string, locations: string, year: string): Promise<Array<Crime>> {
    const crimes: Array<Crime> = [];
    const c = countries;
    const y = year;
    const ID = locations;
    const query = [
        {
            $match: {
                CountryNUTS: c,
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
            $unwind: '$year.place',
        },
        {
            $match: {
                'year.place.NUTS': ID,
            },
        },
        {
            $project: {
                data: '$year.place.data',
            },
        },
    ];
    await Country.aggregate(query)
        .exec()
        .then((doc: any[]) => {
            crimes.push(doc[0].data);
        })
        .catch((err: any) => {
            return err;
        });

    return crimes;
}
/**
 * comparison of multi-state data crimes
 */
router.get('/dat/compare/:year', async (req, res) => {
    const country = JSON.parse(req.query.country);
    const nuts = JSON.parse(req.query.nuts);
    const year = req.params.year;
    const crimes: Array<Array<Crime>> = [];
    const output: any = [];
    let result: any = {};
    let i = 0;
    for (const element of country) {
        crimes.push(await compare_data(element, nuts[i], year));

        i++;
    }
    res.json(await compare(country, nuts, year, crimes));
});
/**
 * check the availability of data for a country
 */
router.get('/available_data/:country/:ID', async (req, res) => {
    const id = req.params.ID;
    const country = req.params.country;
    const query = [
        {
            $match: {
                CountryNUTS: country,
            },
        },
        {
            $unwind: '$year',
        },

        {
            $unwind: '$year.place',
        },
        {
            $match: {
                'year.place.NUTS': id,
            },
        },
        {
            $project: {
                data: '$year.place.data',
            },
        },
    ];
    await Country.aggregate(query)
        .exec()
        .then((doc: any[]) => {
            if (doc.length != 0) {
                res.status(200).json(doc);
                return true;
            }
        })
        .catch((err: any) => {
            res.status(500).json(err);
        });
});
/**
 * insertion map in the database specifying the id that identifies the state
 */
router.post('/maps/:ID', async (req, res) => {
    const id = req.params.ID;
    const maps = read.recFindByExt('maps/' + id, 'geojson');

    for (let i = 0; i < maps.length; i++) {
        let _map: any = [];
        let rawdata = fs.readFileSync(maps[i], 'utf8');
        let json_file = JSON.parse(rawdata);
        console.log(json_file);
        _map = new Maps(json_file);
        _map.save()
            .then((result: any) => {
                console.log(result);
            })
            .catch((err: any) => console.log(err));
    }
    res.json({
        message: ' Handling HOST request to /maps',
        createMap: '',
    });
});

/**
 * return all data of coordinates of a specific id insiert in the request
 */
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
        .then((doc: any) => {
            console.log(doc);
            res.status(200).json(doc);
        })
        .catch((err: any) => {
            res.status(500).json(err);
        });
});

module.exports = router;
