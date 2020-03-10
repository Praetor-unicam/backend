import { Country } from '../loader';
//import { loader } from './../loader';
import express, { response } from 'express';
import { ICountry } from '../interfaces/Country';
import { Comparation } from '../interfaces/Comparation.interface';
import { Crime } from '../interfaces/crime.interface';
import { LocalizedData } from '../interfaces/LocalizedData.interface';
import { compare } from '../comparator';
const router = express.Router();
const mongoose = require('mongoose');
const loader = require('../loader');
const Country = require('../model/State');
const Maps = require('../model/Maps');
const fs = require('fs');
const ICountry = require('../interfaces/Country');

const read = require('../fileService');

// create instance of a luxembourg state
router.post('/create/:country', async (req, res) => {
    try {
        const country = req.params.country;
        const s = JSON.stringify(await loader.getFlattenedData(country));
        const state = new Country(JSON.parse(s));
        await state
            .save()
            .then((result: any) => {
                res.status(201).json(result);
                console.log(result);
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
            console.log(doc);
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
            console.log(doc.length);
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
    console.log(array);
}

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

//return all possible iccs_crime in each data place
router.get('/data/ICCS_category', async (req, res) => {
    await Country.distinct('year.place.data.ICCS_crime')
        .exec()
        .then((doc: any[]) => {
            //array.push(doc[0].data)
            res.status(200).json(doc);
        })
        .catch((err: any) => {
            res.status(500).json(err);
        });
});

// call to compare iccs data
async function compare_data(countries: string, locations: string, year: string): Promise<Array<Crime>> {
    // const output: Comparation = { countries: [] };
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
            //return doc;
        })
        .catch((err: any) => {
            return err;
        });
    console.log(crimes);
    return crimes;
}

router.get('/dat/compare/:year', async (req, res) => {
    const country = JSON.parse(req.query.country);
    const nuts = JSON.parse(req.query.nuts);
    console.log(country);

    const year = req.params.year;

    const crimes: Array<Array<Crime>> = [];
    const output: any = [];

    let result: any = {};
    let i = 0;
    for (const element of country) {
        console.log(element);
        crimes.push(await compare_data(element, nuts[i], year));

        i++;
    }
    //res.json(crimes[1][0]);
    res.json(await compare(country, nuts, year, crimes));
});

// compare iccs data, return all data crimes
// router.get('/data/compare/:country/:year/:ID', async (req, res) => {
//     const country = req.params.country;
//     const year = req.params.year;
//     const ID = req.params.ID;
//     const array = ['LU', 'IT'];
//     const paese = ['LU', 'ITI1'];

//     const query = [
//         {
//             $match: {
//                 CountryNUTS: country,
//             },
//         },
//         {
//             $unwind: '$year',
//         },
//         {
//             $match: {
//                 'year.year': year,
//             },
//         },
//         {
//             $unwind: '$year.place',
//         },
//         {
//             $match: {
//                 'year.place.NUTS': ID,
//             },
//         },
//         {
//             $project: {
//                 countries: [
//                     {
//                         country: country,
//                         location: ID,
//                         year: year,
//                         data: '$year.place.data',
//                     },
//                 ],
//             },
//         },
//     ];

//     await Country.aggregate(query)
//         .exec()
//         .then((doc: any[]) => {
//             res.status(200).json(doc[0]);
//         })
//         .catch((err: any) => {
//             res.status(500).json(err);
//         });
// });

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
                console.log(doc);
                return true;
            }
        })
        .catch((err: any) => {
            res.status(500).json(err);
        });
});

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

// router.get('/data/:country_nuts', async (req, res) => {
//     const nuts_state = req.params.country_nuts;

//     await Country.find({ NUTS_ID: nuts_state })
//         .exec()
//         .then((doc: any) => {
//             res.status(200).json(doc);
//         })
//         .catch((err: any) => {
//             res.status(500).json(err);
//         });
// });

// router.get('/data/:year/:country_nuts/:region_nuts', async (req, res) => {
//     const nuts_state = req.params.country_nuts;
//     const nuts_region = req.params.region_nuts;
//     const year = req.params.year;
//     const query = [
//         {
//             $match: {
//                 NUTS_ID: nuts_state,
//             },
//         },
//         {
//             $unwind: '$year',
//         },
//         {
//             $match: {
//                 'year.year': year,
//             },
//         },
//         {
//             $unwind: '$year.region',
//         },
//         {
//             $match: {
//                 'year.region.NUTS': nuts_region,
//             },
//         },
//         {
//             $project: {
//                 crime: '$year.region.data.crime',
//                 value: '$year.region.data.value',
//             },
//         },
//     ];

//     await Country.aggregate(query)
//         .exec()
//         .then((doc: any) => {
//             res.status(200).json(doc);
//         })
//         .catch((err: any) => {
//             res.status(500).json(err);
//         });
// });

// //if specified country return all documents
// router.get('/data/:country', async (req, res) => {
//     const state = req.params.country;
//     console.log(state);
//     await Country.find({ country: state })
//         .exec()
//         .then((doc: any) => {
//             res.status(200).json(doc);
//         })
//         .catch((err: any) => {
//             res.status(500).json(err);
//         });
// });

// // read all documents that state name is specified in request param
// router.get('/data/:country/:year', async (req, res) => {
//     const state = req.params.country;
//     const year = parseInt(req.params.year);
//     console.log(state);
//     console.log(year);
//     const query = [
//         {
//             $match: {
//                 county: state,
//             },
//         },
//         {
//             $unwind: '$year',
//         },
//         {
//             $match: {
//                 'year.year': year,
//             },
//         },
//         {
//             $unwind: '$year.region',
//         },
//         {
//             $unwind: '$year.region.province',
//         },

//         {
//             $unwind: '$year.region.province.county',
//         },
//         {
//             $unwind: '$year.region.province.county.data',
//         },
//         {
//             $project: {
//                 crime: '$year.region.province.county.data.crime',
//                 value: '$year.region.province.county.data.value',
//             },
//         },
//     ];

//     await State.aggregate(query)
//         .exec()
//         .then(doc => {
//             console.log(doc);
//             crimes = [];
//             //return doc;
//             doc.forEach(crime => {
//                 let new_crime = { name: crime.crime, n_crimes: parseInt(crime.value) };
//                 crimes.push(new_crime);
//             });
//             res.status(200).json(crimes);
//         })
//         .catch(err => {
//             console.log(err);
//             res.status(500).json({ error: err });
//         });
// });

// router.get('/data/:country/:year/:region', async (req, res) => {
//     const state = req.params.country;
//     const year = parseInt(req.params.year);
//     const region = req.params.region;
//     console.log(state);
//     console.log(year);
//     const query = [
//         {
//             $match: {
//                 country: state,
//             },
//         },
//         {
//             $unwind: '$year',
//         },
//         {
//             $match: {
//                 'year.year': year,
//             },
//         },
//         {
//             $unwind: '$year.region',
//         },
//         {
//             $match: {
//                 'year.region.region': region,
//             },
//         },
//         {
//             $unwind: '$year.region.province',
//         },

//         {
//             $unwind: '$year.region.province.data',
//         },
//         {
//             $project: {
//                 crime: '$year.region.province.data.crime',
//                 value: '$year.region.province.data.value',
//                 code: '$year.region.province.data.code',
//             },
//         },
//     ];

//     await Country.aggregate(query)
//         .exec()
//         .then((doc: any) => {
//             console.log(doc);
//             const crimes: any = [];
//             //return doc;
//             doc.forEach((crime: any) => {
//                 let new_crime = { name: crime.crime, n_crimes: parseInt(crime.value) };
//                 crimes.push(new_crime);
//             });
//             res.status(200).json(crimes);
//         })
//         .catch((err: any) => {
//             console.log(err);
//             res.status(500).json({ error: err });
//         });
// });

// // return all categories of ICCS at level of country
// router.get('/categories/:country', async (req, res) => {
//     const state = req.params.country;
//     await State.find({ country: state })
//         .distinct('year.region.province.county.data.crime')
//         .exec()
//         .then(doc => {
//             console.log(doc);
//             crimes = [];
//             doc.forEach(crime => {
//                 let new_crime = { name: crime };

//                 // const new_crime = { name: crime.crime, n_crimes: parseInt(crime.value) };

//                 crimes.push(new_crime);
//             });
//             res.status(200).json(crimes);
//         })
//         .catch(err => {
//             console.log(err);
//             res.status(500).json({ error: err });
//         });
// });

// router.get('/categories/countries', async (req, res) => {
//     await State.distinct('year.data.crime')
//         .exec()
//         .then(doc => {
//             console.log(doc);
//             crimes = [];
//             doc.forEach(crime => {
//                 let new_crime = { name: crime };
//                 crimes.push(new_crime);
//             });
//             res.status(200).json(crimes);
//         })
//         .catch(err => {
//             console.log(err);
//             res.status(500).json({ error: err });
//         });
// });

// //return boolean value if country data are presents
// router.get('/data_status/:country', async (req, res) => {
//     const state = req.params.country;
//     await State.where('country', state)
//         .countDocuments()
//         .exec()
//         .then((docs, err) => {
//             if (docs > 0) {
//                 res.status(200).json(true);
//                 return true;
//             } else {
//                 res.status(200).json(false);
//                 return false;
//             }
//         })
//         .catch(err => {
//             console.log(err);
//             res.status(500).json({ error: err });
//         });
// });

// //return boolean value if region data are presents
// router.get('/data_status/:country/:region', async (req, res) => {
//     const state = req.params.country;
//     const region = req.params.region;
//     await State.aggregate([
//         { $match: { country: state } },
//         { $unwind: '$year' },
//         { $unwind: '$year.region' },
//         { $match: { 'year.region.region': region } },
//         { $unwind: '$year.region.province' },
//     ])
//         .exec()
//         .then((docs, err) => {
//             console.log(docs.length);
//             if (docs.length > 0) {
//                 res.status(200).json(true);
//                 return true;
//             } else {
//                 res.status(200).json(false);
//                 return false;
//             }
//         })
//         .catch(err => {
//             console.log(err);
//             res.status(500).json({ error: err });
//         });
// });

// router.get('/data_status/:country/:region/:province', async (req, res) => {
//     const state = req.params.country;
//     const region = req.params.region;
//     console.log(region);
//     const province = req.params.province;
//     console.log(province);

//     await State.aggregate([
//         { $match: { country: state } },
//         { $unwind: '$year' },
//         { $unwind: '$year.region' },
//         { $match: { 'year.region.region': region } },
//         { $unwind: '$year.region.province' },
//         { $match: { 'year.region.province.province': province } },
//         { $unwind: '$year.region.province.county' },
//         { $unwind: '$year.region.province.county.data' },
//     ])
//         .exec()
//         .then((docs, err) => {
//             if (docs.length > 0) {
//                 res.status(200).json(true);
//                 return true;
//             } else {
//                 res.status(200).json(false);
//                 return false;
//             }
//         })
//         .catch(err => {
//             console.log(err);
//             res.status(500).json({ error: err });
//         });
// });

module.exports = router;
