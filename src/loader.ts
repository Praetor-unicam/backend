/* eslint-disable @typescript-eslint/camelcase */
import fs = require('fs');
import parse = require('csv-parse/lib/sync');
import { stringify } from 'yamljs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const excelToJson = require('convert-excel-to-json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios');
const glob = require('glob');

////////// INTERFACES ///////////

interface Crime {
    ICCS_code?: string;
    ICCS_crime?: string;
    crime: string;
    value: number;
}

interface County {
    county: string;
    data: Array<Crime>;
}

interface Province {
    province: string;
    county: Array<County>;
    data?: Array<Crime>;
}

interface Region {
    region: string;
    province: Array<Province>;
    data?: Array<Crime>;
}

interface Year {
    year: string;
    region: Array<Region>;
    data?: Array<Crime>;
}

interface Country {
    country: string;
    year: Array<Year>;
}
//////// GENERAL USE FUNCTIONS /////////////
/**
 * merges same fields and removes NaNs
 *
 */
function _NaNtoZero(array: Array<Crime>): void {
    for (let i = 0; i < array.length; i++) {
        if (isNaN(array[i].value)) {
            //convert invalid values to 0
            array[i].value = 0;
        }
    }
}

function NaNtoZero(source: Country): void {
    for (const year of source.year) {
        if (year.data) {
            _NaNtoZero(year.data);
        }
        for (const region of year.region) {
            if (region.data) {
                _NaNtoZero(region.data);
            }
            for (const province of region.province) {
                if (province.data) {
                    _NaNtoZero(province.data);
                }
                for (const county of province.county) {
                    _NaNtoZero(county.data);
                }
            }
        }
    }
}

function _coalesce(array: Array<Crime>): void {
    let index1 = array.length - 1;
    while (index1 >= 1) {
        let index2 = index1 - 1;
        while (index2 >= 0) {
            if (array[index2].ICCS_code == array[index1].ICCS_code) {
                array[index1].value += array[index2].value;
                array[index2].value = NaN; //mark entries to be deleted as NaNs
            }
            index2 -= 1;
        }
        index1 -= 1;
    }
}

function _spliceNaNs(array: Array<Crime>): void {
    let index1 = array.length - 1;
    while (index1 >= 0) {
        if (isNaN(array[index1].value)) {
            array.splice(index1, 1);
        }
        index1 -= 1;
    }
}

function coalesce(source: Country): Country {
    for (const year of source.year) {
        if (year.data) {
            _NaNtoZero(year.data);
            _coalesce(year.data);
        }
        for (const region of year.region) {
            if (region.data) {
                _NaNtoZero(region.data);
                _coalesce(region.data);
            }
            for (const province of region.province) {
                if (province.data) {
                    _NaNtoZero(province.data);
                    _coalesce(province.data);
                }
                for (const county of province.county) {
                    _NaNtoZero(county.data);
                    _coalesce(county.data);
                }
            }
        }
    }

    for (const year of source.year) {
        if (year.data) {
            _spliceNaNs(year.data);
        }
        for (const region of year.region) {
            if (region.data) {
                _spliceNaNs(region.data);
            }
            for (const province of region.province) {
                if (province.data) {
                    _spliceNaNs(province.data);
                }
                for (const county of province.county) {
                    _spliceNaNs(county.data);
                }
            }
        }
    }

    return source;
}

function _disentangleSubcategory(array: Array<Crime>, topCategory: string, subCategory: string): void {
    const topcat = array.find(element => element.crime === topCategory);
    const subcat = array.find(element => element.crime === subCategory);
    if (topcat != undefined && subcat != undefined) {
        topcat.value -= subcat.value;
    }
}

//apply before mapping
function disentangleSubcategory(source: Country, topCategory: string, subCategory: string): Country {
    for (const year of source.year) {
        if (year.data) {
            _disentangleSubcategory(year.data, topCategory, subCategory);
        }
        for (const region of year.region) {
            if (region.data) {
                _disentangleSubcategory(region.data, topCategory, subCategory);
            }
            for (const province of region.province) {
                if (province.data) {
                    _disentangleSubcategory(province.data, topCategory, subCategory);
                }
                for (const county of province.county) {
                    _disentangleSubcategory(county.data, topCategory, subCategory);
                }
            }
        }
    }
    return source;
}

function disentangleSubcategories(source: Country, subcategories: Record<string, string>): Country {
    Object.entries(subcategories).forEach(([key, value]) => {
        source = disentangleSubcategory(source, key, value);
    });
    return source;
}

//levels: region, province, county, region+, province+
function rename(source: Country, level: string, substitutions: Record<string, string>): Country {
    switch (level) {
        case 'region': {
            for (const year of source.year) {
                year.region
                    .filter(element => element.region in substitutions)
                    .map(element => (element.region = substitutions[element.region]));
            }
            break;
        }
        case 'province': {
            for (const year of source.year) {
                for (const region of year.region) {
                    region.province
                        .filter(element => element.province in substitutions)
                        .map(element => (element.province = substitutions[element.province]));
                }
            }
            break;
        }
        case 'county': {
            for (const year of source.year) {
                for (const region of year.region) {
                    for (const province of region.province) {
                        province.county
                            .filter(element => element.county in substitutions)
                            .map(element => (element.county = substitutions[element.county]));
                    }
                }
            }
            break;
        }
        case 'region+': {
            rename(source, 'region', substitutions);
            rename(source, 'province', substitutions);
            rename(source, 'county', substitutions);
            break;
        }
        case 'province+': {
            rename(source, 'province', substitutions);
            rename(source, 'county', substitutions);
            break;
        }
        case 'default': {
            break;
        }
    }
    return source;
}

/**
 * Returns the input JSON with the corresponding ICCS entries
 */
function _mapCategories(array: Array<Crime>, matchingJSON: Record<string, string>, removeUnmatched: boolean): void {
    let index = array.length - 1;
    while (index >= 0) {
        const crime = array[index].crime;
        if (crime in matchingJSON) {
            array[index].ICCS_code = matchingJSON[crime][0];
            array[index].ICCS_crime = matchingJSON[crime][1];
        } else if (removeUnmatched) {
            array.splice(index, 1);
        }

        index -= 1;
    }
}

function mapCategories(source: Country, country: string, removeUnmatched: boolean, matchingPresent: boolean): Country {
    const matching = fs.readFileSync('data/matching/' + country + '/' + country + '-matching.txt', 'utf-8');
    const matchingJSON = JSON.parse(matching);

    for (const year of source.year) {
        if (year.data) {
            _mapCategories(year.data, matchingJSON, removeUnmatched);
        }
        for (const region of year.region) {
            if (region.data) {
                _mapCategories(region.data, matchingJSON, removeUnmatched);
            }
            for (const province of region.province) {
                if (province.data) {
                    _mapCategories(province.data, matchingJSON, removeUnmatched);
                }
                for (const county of province.county) {
                    _mapCategories(county.data, matchingJSON, removeUnmatched);
                }
            }
        }
    }
    return matchingPresent ? coalesce(source) : source;
}

///////////////////////////////////////////////////////////

///////// COUNTRY LOADING FUNCTIONS /////////////////
/**
 * Returns JSON from luxembourg's CSV file
 */

export function parseCSVLuxembourg(filename: string[]): Country {
    let text = fs.readFileSync(filename[0], 'utf-8');
    const output: Country = { country: 'Luxembourg', year: [] };

    text = text.replace('Year', 'Qualification');

    const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        skip_lines_with_error: true,
        cast: function(value) {
            return value.trim();
        },
    });

    let firstPass = true;
    for (const row of records) {
        let i = 0;
        Object.keys(row).forEach(function(key) {
            if (!isNaN(Number(key)) && firstPass) {
                const yearTemp: Year = {
                    year: key,
                    region: [
                        {
                            region: 'Luxembourg',
                            province: [{ province: 'Luxembourg', county: [{ county: 'Luxembourg', data: [] }] }],
                        },
                    ],
                };
                output.year.push(yearTemp);
            } else {
                if (!isNaN(Number(key))) {
                    output.year[i].region[0].province[0].county[0].data.push({
                        crime: row.Qualification,
                        value: Number(row[key]),
                    });
                }
            }
            i = i + 1;
        });
        firstPass = false;
    }

    return disentangleSubcategories(output, {
        'Thefts including acts of violence': 'thereof: thefts of vehicules including acts of violence',
    });
}
//double category
function parseXLSCyprus(filename: string[]): Country {
    const output: Country = { country: 'Cyprus', year: [{ year: '2019', region: [], data: [] }] };
    const seriousCrimes = excelToJson({
        sourceFile: filename[0],
        header: {
            rows: 3,
        },
        columnToKey: {
            A: '{{A2}}',
            B: '{{B2}}',
            E: '{{E2}}',
            H: '{{H2}}',
            K: '{{K2}}',
            N: '{{N2}}',
            Q: '{{Q2}}',
            T: '{{T2}}',
        },
        range: 'A4:T15',
    });
    const minorCrimes = excelToJson({
        sourceFile: filename[1],
        header: {
            rows: 3,
        },
        columnToKey: {
            A: '{{A2}}',
            B: '{{B2}}',
            E: '{{E2}}',
            H: '{{H2}}',
            K: '{{K2}}',
            N: '{{N2}}',
            Q: '{{Q2}}',
            T: '{{T2}}',
        },
        range: 'A4:T12',
    });
    const records = seriousCrimes['Serious crime'].concat(minorCrimes['Minor per off']);
    let firstPass = true;
    for (const row of records) {
        let i = 0;
        let crime = '';
        Object.keys(row).forEach(function(key) {
            if (key == 'Offences') {
                crime = row[key];
            } else if (key == 'TOTAL') {
                output.year[0].data?.push({ crime: crime, value: Number(row[key]) });
            } else if (firstPass) {
                output.year[0].region.push({
                    region: key,
                    province: [
                        { province: key, county: [{ county: key, data: [{ crime: crime, value: Number(row[key]) }] }] },
                    ],
                });
            } else {
                output.year[0].region[i - 1].province[0].county[0].data.push({ crime: crime, value: Number(row[key]) });
            }
            i = i + 1;
        });
        firstPass = false;
    }
    return rename(output, 'region+', { Limasol: 'Limassol', Ammochostos: 'Famagusta', Morfou: 'Kyrenia' });
}

export function parseXLSHungary(filename: string[]): Country {
    const output: Country = { country: 'Hungary', year: [] };
    let records = excelToJson({
        sourceFile: filename[0],
        header: {
            rows: 3,
        },
        columnToKey: {
            A: 'Crime_or_location',
            B: 'Level',
            C: '{{C2}}',
            D: '{{D2}}',
            E: '{{E2}}',
            F: '{{F2}}',
            G: '{{G2}}',
            H: '{{H2}}',
            I: '{{I2}}',
            J: '{{J2}}',
            K: '{{K2}}',
            L: '{{L2}}',
            M: '{{M2}}',
            N: '{{N2}}',
            O: '{{O2}}',
            P: '{{P2}}',
            Q: '{{Q2}}',
            R: '{{R2}}',
            S: '{{S2}}',
            T: '{{T2}}',
            U: '{{U2}}',
        },
    });
    let firstPassYears = true;
    let firstPassRegions = true;
    let crimePasses = 0;
    let j = 0;
    let crime = '';
    records = records['6.2.7.2.'];

    for (const row of records) {
        let i = 0;
        if (Object.keys(row).length == 1) {
            crime = row.Crime_or_location.replace('$', '');
            crimePasses++;
            if (crimePasses === 2) {
                firstPassRegions = false;
            }
            j = 0;
        } else if (row.Level.includes('region') && !row.Level.includes('large')) {
            Object.keys(row).forEach(function(key) {
                if (!isNaN(Number(key)) && firstPassYears) {
                    const yearTemp: Year = {
                        year: key,
                        region: [
                            {
                                region: row.Crime_or_location,
                                province: [],
                                data: [{ crime: crime, value: Number(row[key]) }],
                            },
                        ],
                        data: [],
                    };
                    output.year.push(yearTemp);
                } else if (!isNaN(Number(key)) && firstPassRegions) {
                    output.year[i].region.push({
                        region: row.Crime_or_location,
                        province: [],
                        data: [{ crime: crime, value: Number(row[key]) }],
                    });
                } else if (!isNaN(Number(key))) {
                    output.year[i].region[j].data?.push({
                        crime: crime,
                        value: Number(row[key]),
                    });
                }
                i = i + 1;
            });
            firstPassYears = false;
            j = j + 1;
        } else if (row.Level === 'country') {
            Object.keys(row).forEach(function(key) {
                if (!isNaN(Number(key)) && output.year[i].data) {
                    output.year[i].data?.push({ crime: crime, value: Number(row[key]) });
                    i = i + 1;
                }
            });
        }
    }

    j = 0;
    crimePasses = 0;
    let firstPassProvinces = true;
    let k = 0;
    for (const row of records) {
        let i = 0;
        if (Object.keys(row).length == 1) {
            crime = row.Crime_or_location.replace('$', '');
            crimePasses++;
            if (crimePasses === 2) {
                firstPassProvinces = false;
            }
            j = 0;
        } else {
            if (row.Level.includes('county') && !row.Level.includes('region')) {
                Object.keys(row).forEach(function(key) {
                    if (!isNaN(Number(key)) && firstPassProvinces) {
                        output.year[i].region[j].province.push({
                            province: row.Crime_or_location,
                            county: [
                                {
                                    county: row.Crime_or_location,
                                    data: [
                                        {
                                            crime: crime,
                                            value: Number(row[key]),
                                        },
                                    ],
                                },
                            ],
                        });
                    } else if (!isNaN(Number(key))) {
                        output.year[i].region[j].province[k].county[0].data.push({
                            crime: crime,
                            value: Number(row[key]),
                        });
                    }
                    i = i + 1;
                });
                k++;
            } else if (row.Level.includes('region') && !row.Level.includes('large')) {
                j++;
                k = 0;
            }
        }
    }

    return output;
}

//homicide too, crime against youth too and many others, more categories available for total, generally dangerous crimes
export function parseXLSBulgaria(filename: string[]): Country {
    const output: Country = {
        country: 'Bulgaria',
        year: [],
    };
    const records = excelToJson({
        sourceFile: filename[0],
        columnToKey: {
            A: 'Crime_or_location',
            B: 'Value',
        },
        range: 'A7:B516',
    });
    for (let y = 2018; y >= 2016; y--) {
        const current = records[y.toString()];
        output.year.push({ year: y.toString(), region: [], data: [] });
        for (let i = 0; i < current.length; i += 17) {
            const location = current[i].Crime_or_location;
            if (i != 0 && i != 17) {
                output.year[2018 - y].region.push({
                    region: location,
                    province: [{ province: location, county: [{ county: location, data: [] }] }],
                });
            }

            for (let j = i + 1; j < i + 17; j++) {
                if (i === 0) {
                    output.year[2018 - y].data?.push({
                        crime: current[j].Crime_or_location,
                        value: Number(current[j].Value),
                    });
                } else if (i === 17) {
                    continue;
                } else {
                    output.year[2018 - y].region[
                        output.year[2018 - y].region.length - 1
                    ].province[0].county[0].data.push({
                        crime: current[j].Crime_or_location,
                        value: Number(current[j].Value),
                    });
                }
            }
        }
    }
    return output;
}

export function parseXLSPortugal(filename: string[]): Country {
    const output: Country = { country: 'Portugal', year: [{ year: '2018', region: [], data: [] }] };
    let records = excelToJson({
        sourceFile: filename[0],
        header: {
            rows: 11,
        },
        columnToKey: {
            A: 'Place',
            B: 'Level',
            C: '{{C10}}',
            E: '{{E10}}',
            G: '{{G10}}',
            I: '{{I10}}',
            K: '{{K10}}',
            M: '{{M10}}',
            O: '{{O10}}',
            Q: '{{Q10}}',
            S: '{{S10}}',
        },
        range: 'A12:S355',
    });
    records = records['Table'];
    let regions = -1;
    let provinces = -1;
    let counties = -1;
    for (const row of records) {
        if (row.Level === 'PT') {
            Object.keys(row).forEach(function(key) {
                if (key !== 'Place' && key !== 'Level' && key !== 'Total') {
                    output.year[0].data?.push({ crime: key, value: Number(row[key]) });
                }
            });
        } else {
            switch (row.Level.length) {
                case 1:
                    break; //continent
                case 2:
                    output.year[0].region.push({ region: row.Place, province: [], data: [] });
                    regions++;
                    provinces = -1;
                    Object.keys(row).forEach(function(key) {
                        if (key !== 'Place' && key !== 'Level' && key !== 'Total') {
                            output.year[0].region[regions].data?.push({ crime: key, value: Number(row[key]) });
                        }
                    });
                    //regions++;
                    break; //region
                case 3:
                    output.year[0].region[regions].province.push({ province: row.Place, county: [], data: [] });
                    provinces++;
                    counties = -1;
                    //console.log(output.year[0].region[regions].province);
                    //console.log(provinces);
                    Object.keys(row).forEach(function(key) {
                        if (key !== 'Place' && key !== 'Level' && key !== 'Total') {
                            output.year[0].region[regions].province[provinces].data?.push({
                                crime: key,
                                value: Number(row[key]),
                            });
                        }
                    });
                    //provinces++;
                    break; //province
                default:
                    output.year[0].region[regions].province[provinces].county.push({ county: row.Place, data: [] });
                    counties++;
                    Object.keys(row).forEach(function(key) {
                        if (key !== 'Place' && key !== 'Level' && key !== 'Total') {
                            //console.log(output.year[0].region[regions].province[provinces].county);
                            output.year[0].region[regions].province[provinces].county[counties].data.push({
                                crime: key,
                                value: Number(row[key]),
                            });
                        }
                    });
                    //counties++;
                    break; //county
            }
        }
    }
    return output;
}

export function parseCSVDenmark(filename: string[]): Country {
    const text = fs.readFileSync(filename[0], 'utf-8');
    const output: Country = { country: 'Denmark', year: [{ year: '2019', region: [], data: [] }] };

    const records = parse(text, {
        from_line: 4,
        to_line: 9633,
        relax_column_count: true,
    });
    //return records;
    let firstPass = true;
    for (let i = 0; i < records.length - 11; i += 107) {
        //["Nature of the offence, total"]
        console.log(i);
        const crime = records[i][0];
        let regions = -1;
        let provinces = -1;
        for (let j = i + 1; j < i + 107; j++) {
            // [" ","All Denmark","119055"]
            if (records[j][1].includes('All')) {
                output.year[0].data?.push({ crime: crime, value: Number(records[j][2]) });
            } else if (records[j][1].includes('Region')) {
                provinces = -1;
                regions++;
                if (firstPass) {
                    output.year[0].region.push({
                        region: records[j][1].replace('Region', ''),
                        data: [{ crime: crime, value: Number(records[j][2]) }],
                        province: [],
                    });
                } else {
                    output.year[0].region[regions].data?.push({ crime: crime, value: Number(records[j][2]) });
                }
            } else {
                provinces++;
                if (firstPass) {
                    output.year[0].region[regions].province.push({
                        province: records[j][1],
                        county: [{ county: records[j][1], data: [{ crime: crime, value: Number(records[j][2]) }] }],
                    });
                } else {
                    output.year[0].region[regions].province[provinces].county[0].data.push({
                        crime: crime,
                        value: Number(records[j][2]),
                    });
                }
            }
        }
        firstPass = false;
    }
    return output;
}

function parseXLSXAustria(filename: string[]): Country {
    const output: Country = { country: 'Austria', year: [{ year: '2018', region: [] }] };
    let records = excelToJson({
        sourceFile: filename[0],
        header: {
            rows: 13,
        },
        columnToKey: {
            C: 'Place',
            '*': '{{columnHeader}}',
        },
        range: 'C15:NH31',
    });
    records = records['Data Sheet 0'];
    let i = -1;
    for (const row of records) {
        output.year[0].region.push({
            region: row.Place,
            province: [{ province: row.Place, county: [{ county: row.Place, data: [] }] }],
        });
        i++;
        Object.keys(row).forEach(function(key) {
            if (key !== 'Place') {
                output.year[0].region[i].province[0].county[0].data.push({ crime: key, value: Number(row[key]) });
            }
        });
    }
    return output;
}

async function getCzechData(filename: string[]): Promise<Country> {
    const timefrom = '1-2019';
    const groupby = 'crimetype';
    const crimetypes = await axios.get('https://mapakriminality.cz/api/crimetypes');

    const areas = await axios.get('https://mapakriminality.cz/api/areas');

    const crimeCodes = [];
    const crimeData: {
        [key: string]: string;
    } = {};

    for (const crime of crimetypes.data.crimes) {
        //console.log(crime);
        crimeCodes.push(crime.Code);
        crimeData[crime.Code] = crime.Name_en;
    }

    const areaCodes = [];
    const areaData = [];
    for (const area of areas.data.areas) {
        areaCodes.push(area.Code);
        areaData.push({ code: area.Code, name: area.Name, level: Number(area.AreaLevel) });
    }

    const output: Country = { country: 'Czech Republic', year: [{ year: '2019', region: [], data: [] }] };
    const regions: {
        [key: string]: number;
    } = {};
    let regIndex = 0;
    for (const area of areaData) {
        if (area.level > 1) {
            continue;
        }
        const data = await axios.get(
            'https://mapakriminality.cz/api/crimes?areacode=' +
                area.code +
                '&crimetypes=' +
                crimeCodes +
                '&timefrom=1-2019&groupby=crimetype',
        );
        switch (area.level) {
            case 0:
                for (const crime of data.data.crimes) {
                    output.year[0].data?.push({ crime: crimeData[crime.CrimeType], value: Number(crime.Found) });
                }
                break;
            case 1:
                regions[area.code] = regIndex;
                output.year[0].region.push({ region: area.name, province: [], data: [] });
                for (const crime of data.data.crimes) {
                    output.year[0].region[regIndex].data?.push({
                        crime: crimeData[crime.CrimeType],
                        value: Number(crime.Found),
                    });
                }
                regIndex++;
                break;
            default:
                break;
        }
        console.log(area.name);
    }

    console.log('regions done');

    const provinces: {
        [key: string]: number;
    } = {};
    let provIndex = 0;
    for (const area of areaData) {
        if (area.level != 2) {
            continue;
        }
        const data = await axios.get(
            'https://mapakriminality.cz/api/crimes?areacode=' +
                area.code +
                '&crimetypes=' +
                crimeCodes +
                '&timefrom=1-2019&groupby=crimetype',
        );

        const region = area.code.substring(0, area.code.length - 2) + '00';
        regIndex = regions[region];

        output.year[0].region[regIndex].province.push({ province: area.name, county: [], data: [] });
        provIndex = output.year[0].region[regIndex].province.length - 1;
        provinces[area.code] = provIndex;
        for (const crime of data.data.crimes) {
            output.year[0].region[regIndex].province[provIndex].data?.push({
                crime: crimeData[crime.CrimeType],
                value: Number(crime.Found),
            });
        }

        console.log(area.name);
    }

    console.log('provinces done');

    let countIndex = 0;
    for (const area of areaData) {
        if (area.level != 3) {
            continue;
        }
        const data = await axios.get(
            'https://mapakriminality.cz/api/crimes?areacode=' +
                area.code +
                '&crimetypes=' +
                crimeCodes +
                '&timefrom=1-2019&groupby=crimetype',
        );

        const region = area.code.substring(0, area.code.length - 4) + '00';
        regIndex = regions[region];

        const province = area.code.substring(0, area.code.length - 2);
        provIndex = provinces[province];

        output.year[0].region[regIndex].province[provIndex].county.push({ county: area.name, data: [] });
        countIndex = output.year[0].region[regIndex].province[provIndex].county.length - 1;
        for (const crime of data.data.crimes) {
            output.year[0].region[regIndex].province[provIndex].county[countIndex].data.push({
                crime: crimeData[crime.CrimeType],
                value: Number(crime.Found),
            });
        }
        console.log(area.name);
    }

    console.log('counties done');

    /*fs.writeFile("data/source_files/test.txt", JSON.stringify(output), function(err) {
        if (err) {
            console.log(err);
        }
    });*/

    //console.log(output.data);
    //console.log(typeof output.data);

    return output;
}

function parseCSVSpain(filename: string[]): Country {
    let text = fs.readFileSync(filename[0], 'utf-8');
    const output: Country = { country: 'Spain', year: [{ year: '2018', region: [], data: [] }] };

    let records = parse(text, {
        from_line: 8,
        relax_column_count: true,
    });

    for (let i = 0; i < records.length - 45; i += 45) {
        //console.log(records[i][0]);
        if (i !== 0) {
            output.year[0].region.push({ region: records[i][0], province: [], data: [] });
        }
        for (let j = i + 1; j < i + 45; j++) {
            const lastRegion = output.year[0].region.length - 1;
            if (i === 0) {
                output.year[0].data?.push({ crime: records[j][0], value: Number(records[j][1]) });
            } else {
                output.year[0].region[lastRegion].data?.push({ crime: records[j][0], value: Number(records[j][1]) });
            }
        }
    }

    const provMap: {
        [key: string]: string;
    } = {
        'Araba/Álava': 'PAÍS VASCO',
        Albacete: 'CASTILLA - LA MANCHA',
        'Alicante/Alacant': 'COMUNITAT VALENCIANA',
        Almería: 'ANDALUCÍA',
        Ávila: 'CASTILLA Y LEÓN',
        Badajoz: 'EXTREMADURA',
        'Balears (Illes)': 'BALEARS (ILLES)',
        Barcelona: 'CATALUÑA',
        Burgos: 'CASTILLA Y LEÓN',
        Cáceres: 'EXTREMADURA',
        Cádiz: 'ANDALUCÍA',
        'Castellón/Castelló': 'COMUNITAT VALENCIANA',
        'Ciudad Real': 'CASTILLA - LA MANCHA',
        Córdoba: 'ANDALUCÍA',
        'Coruña (A)': 'GALICIA',
        Cuenca: 'CASTILLA - LA MANCHA',
        Girona: 'CATALUÑA',
        Granada: 'ANDALUCÍA',
        Guadalajara: 'CASTILLA - LA MANCHA',
        Gipuzkoa: 'PAÍS VASCO',
        Huelva: 'ANDALUCÍA',
        Huesca: 'ARAGÓN',
        Jaén: 'ANDALUCÍA',
        León: 'CASTILLA Y LEÓN',
        Lleida: 'CATALUÑA',
        'Rioja (La)': 'RIOJA (LA)',
        Lugo: 'GALICIA',
        Madrid: 'MADRID (COMUNIDAD DE)',
        Málaga: 'ANDALUCÍA',
        Murcia: 'MURCIA (REGIÓN DE)',
        Navarra: 'NAVARRA (COMUNIDAD FORAL DE)',
        Ourense: 'GALICIA',
        Asturias: 'ASTURIAS (PRINCIPADO DE)',
        Palencia: 'CASTILLA Y LEÓN',
        'Palmas (Las)': 'CANARIAS',
        Pontevedra: 'GALICIA',
        Salamanca: 'CASTILLA Y LEÓN',
        'Santa Cruz de Tenerife': 'CANARIAS',
        Cantabria: 'CANTABRIA',
        Segovia: 'CASTILLA Y LEÓN',
        Sevilla: 'ANDALUCÍA',
        Soria: 'CASTILLA Y LEÓN',
        Tarragona: 'CATALUÑA',
        Teruel: 'ARAGÓN',
        Toledo: 'CASTILLA - LA MANCHA',
        'Valencia/València': 'COMUNITAT VALENCIANA',
        Valladolid: 'CASTILLA Y LEÓN',
        Bizkaia: 'PAÍS VASCO',
        Zamora: 'CASTILLA Y LEÓN',
        Zaragoza: 'ARAGÓN',
        Ceuta: 'CIUDAD AUTÓNOMA DE CEUTA',
        Melilla: 'CIUDAD AUTÓNOMA DE MELILLA',
        'En el extranjero': 'EN EL EXTRANJERO',
        Desconocida: 'DESCONOCIDA',
    };

    text = fs.readFileSync(filename[1], 'utf-8');
    records = parse(text, {
        from_line: 8,
        relax_column_count: true,
    });

    for (let i = 0; i < records.length - 45; i += 45) {
        //console.log(records[i][0]);
        const regIndex = output.year[0].region.findIndex(item => item.region === provMap[records[i][0]]);
        output.year[0].region[regIndex].province.push({
            province: records[i][0],
            county: [{ county: records[i][0], data: [] }],
        });
        for (let j = i + 1; j < i + 45; j++) {
            const lastProvince = output.year[0].region[regIndex].province.length - 1;
            output.year[0].region[regIndex].province[lastProvince].county[0].data.push({
                crime: records[j][0],
                value: Number(records[j][1]),
            });
        }
    }

    return output;
}

function parseXLSItaly(filename: string[]): Country {
    const output: Country = { country: 'Italy', year: [{ year: '2018', region: [], data: [] }] };
    let records = excelToJson({
        sourceFile: filename[0],
        header: {
            rows: 7,
        },
        columnToKey: {
            A: 'Place',
            C: '{{C6}}',
            D: '{{D6}}',
            E: '{{E6}}',
            F: '{{F6}}',
            G: '{{G6}}',
            H: '{{H6}}',
            I: '{{I6}}',
            J: '{{J6}}',
            K: '{{K6}}',
            L: '{{L6}}',
            M: '{{M6}}',
            N: '{{N6}}',
            O: '{{O6}}',
            P: '{{P6}}',
            Q: '{{Q6}}',
            R: '{{R6}}',
            S: '{{S6}}',
            T: '{{T6}}',
            U: '{{U6}}',
            V: '{{V6}}',
            W: '{{W6}}',
            X: '{{X6}}',
            Y: '{{Y6}}',
            Z: '{{Z6}}',
            AA: '{{AA6}}',
            AB: '{{AB6}}',
            AC: '{{AC6}}',
            AD: '{{AD6}}',
            AE: '{{AE6}}',
            AF: '{{AF6}}',
            AG: '{{AG6}}',
            AH: '{{AH6}}',
            AI: '{{AI6}}',
            AJ: '{{AJ6}}',
            AK: '{{AK6}}',
            AL: '{{AL6}}',
            AM: '{{AM6}}',
            AN: '{{AN6}}',
            AO: '{{AO6}}',
            AP: '{{AP6}}',
            AQ: '{{AQ6}}',
            AR: '{{AR6}}',
            AS: '{{AS6}}',
            AT: '{{AT6}}',
            AU: '{{AU6}}',
            AV: '{{AV6}}',
            AW: '{{AW6}}',
            AX: '{{AX6}}',
            AY: '{{AY6}}',
            AZ: '{{AZ6}}',
            BA: '{{BA6}}',
            BB: '{{BB6}}',
            BC: '{{BC6}}',
            BD: '{{BD6}}',
            BE: '{{BE6}}',
        },
    });
    records = records['I.Stat export'];
    const macroRegions = ['Nord-ovest', 'Nord-est', 'Centro (I)', 'Sud', 'Isole'];
    const regions = [
        'Piemonte',
        "Valle d'Aosta / Vallée d'Aoste",
        'Lombardia',
        'Trentino Alto Adige / Südtirol',
        'Veneto',
        'Friuli-Venezia Giulia',
        'Liguria',
        'Emilia-Romagna',
        'Toscana',
        'Umbria',
        'Marche',
        'Lazio',
        'Abruzzo',
        'Molise',
        'Campania',
        'Puglia',
        'Basilicata',
        'Calabria',
        'Sicilia',
        'Sardegna',
    ];

    let regIndex = -1;
    let provIndex = -1;
    let isProvince = true;
    for (const row of records) {
        console.log(row.Place);
        if (row.Place === 'Data extracted on 16 Dec 2019 10:37 UTC (GMT) fromI.Stat') {
            continue;
        } else if (row.Place === 'Italy') {
            Object.keys(row).forEach(function(key) {
                if (key != 'Place') {
                    output.year[0].data?.push({ crime: key, value: Number(row[key]) });
                }
            });
        } else if (macroRegions.includes(row.Place)) {
            continue;
        } else if (regions.includes(row.Place)) {
            if (
                row.Place === "Valle d'Aosta / Vallée d'Aoste" &&
                output.year[0].region[regIndex].region === "Valle d'Aosta / Vallée d'Aoste"
            ) {
                continue;
            }
            output.year[0].region.push({ region: row.Place, province: [], data: [] });
            regIndex = output.year[0].region.length - 1;
            Object.keys(row).forEach(function(key) {
                if (key != 'Place') {
                    output.year[0].region[regIndex].data?.push({ crime: key, value: Number(row[key]) });
                }
            });
            provIndex = -1;
        } else if (isProvince) {
            output.year[0].region[regIndex].province.push({ province: row.Place, county: [], data: [] });
            provIndex = output.year[0].region[regIndex].province.length - 1;
            Object.keys(row).forEach(function(key) {
                if (key != 'Place') {
                    output.year[0].region[regIndex].province[provIndex].data?.push({
                        crime: key,
                        value: Number(row[key]),
                    });
                }
            });
            if (row.Place == 'Aosta') {
                isProvince = true;
            } else {
                isProvince = false;
            }
        } else {
            output.year[0].region[regIndex].province[provIndex].county.push({ county: row.Place, data: [] });
            Object.keys(row).forEach(function(key) {
                if (key != 'Place') {
                    output.year[0].region[regIndex].province[provIndex].county[0].data.push({
                        crime: key,
                        value: Number(row[key]),
                    });
                }
            });
            isProvince = true;
        }
    }

    return output;
}

function parseCSVNetherlands(filename: string[]): Country {
    const folder = 'data/source_files/netherlands/';
    const regionsAndTotal = folder + filename[0];
    const provinces = folder + filename[1];
    const output: Country = { country: 'Netherlands', year: [] };
    let text = fs.readFileSync(regionsAndTotal, 'utf-8');

    let crimes = parse(text, {
        from: 3,
        to: 3,
        delimiter: ';',
        skip_lines_with_error: true,
        relax_column_count: true,
    })[0];
    crimes.shift();
    crimes = Array.from(new Set(crimes));

    let years = parse(text, {
        from: 4,
        to: 4,
        delimiter: ';',
        skip_lines_with_error: true,
        relax_column_count: true,
    })[0];
    years.shift();
    years = Array.from(new Set(years));

    for (const year of years) {
        output.year.push({ year: year, region: [], data: [] });
    }

    let records = parse(text, {
        from: 6,
        delimiter: ';',
        skip_lines_with_error: true,
        relax_column_count: true,
    });

    //total (regions ignored)
    //i = 0 -> place, each group of k years is the j-th crime
    for (let i = 0; i < records.length; i++) {
        if (i === 0) {
            for (let j = 0; j < crimes.length; j++) {
                for (let k = 0; k < years.length; k++) {
                    output.year[k].data?.push({
                        crime: crimes[j],
                        value: Number(records[i][j * years.length + k + 1]),
                    });
                }
            }
        }
    }

    text = fs.readFileSync(provinces, 'utf-8');
    records = parse(text, {
        from: 6,
        delimiter: ';',
        skip_lines_with_error: true,
        relax_column_count: true,
    });

    //provinces
    //i = 0 -> place, each group of k years is the j-th crime
    for (let i = 0; i < records.length - 1; i++) {
        for (let k = 0; k < years.length; k++) {
            output.year[k].region.push({ region: records[i][0], province: [], data: [] });
        }
        const regIndex = output.year[0].region.length - 1;
        for (let j = 0; j < crimes.length; j++) {
            for (let k = 0; k < years.length; k++) {
                output.year[k].region[regIndex].data?.push({
                    crime: crimes[j],
                    value: Number(records[i][j * years.length + k + 1]),
                });
            }
        }
    }

    const provMap: {
        [key: string]: Array<string>;
    } = {
        'Groningen (PV)': [folder + filename[2]],
        'Friesland (PV)': [folder + filename[3]],
        'Drenthe (PV)': [folder + filename[4]],
        'Overijssel (PV)': [folder + filename[5]],
        'Flevoland (PV)': [folder + filename[6]],
        'Gelderland (PV)': [folder + filename[7], folder + filename[8]],
        'Utrecht (PV)': [folder + filename[9]],
        'Noord-Holland (PV)': [folder + filename[10], folder + filename[11]],
        'Zuid-Holland (PV)': [folder + filename[12], folder + filename[13]],
        'Zeeland (PV)': [folder + filename[14]],
        'Noord-Brabant (PV)': [folder + filename[15], folder + filename[16]],
        'Limburg (PV)': [folder + filename[17]],
        'Niet in te delen (PV)': [folder + filename[18]],
    };

    Object.keys(provMap).forEach(function(key) {
        for (const file of provMap[key]) {
            text = fs.readFileSync(file, 'utf-8');
            records = parse(text, {
                from: 6,
                delimiter: ';',
                skip_lines_with_error: true,
                relax_column_count: true,
            });

            const regIndex = output.year[0].region.map(x => x.region).indexOf(key);

            for (let i = 0; i < records.length - 1; i++) {
                console.log(records[i][0]);

                for (let k = 0; k < years.length; k++) {
                    output.year[k].region[regIndex].province.push({
                        province: records[i][0],
                        county: [
                            {
                                county: records[i][0],
                                data: [],
                            },
                        ],
                    });
                }
                const provIndex = output.year[0].region[regIndex].province.length - 1;
                for (let j = 0; j < crimes.length; j++) {
                    for (let k = 0; k < years.length; k++) {
                        output.year[k].region[regIndex].province[provIndex].county[0].data.push({
                            crime: crimes[j],
                            value: Number(records[i][j * years.length + k + 1]),
                        });
                    }
                }
            }
        }
    });

    return output;
}

function parseXLSNorthernIreland(filename: string[]): Country {
    const output: Country = { country: 'Northern Ireland', year: [] };
    let records = excelToJson({
        sourceFile: filename[0],
        header: {
            rows: 3,
        },
        columnToKey: {
            '*': '{{columnHeader}}',
        },
        range: 'A5:V192',
    });

    records = records['Table 2.2'];
    let firstPass = true;
    for (const row of records) {
        const crime = row.Offence;
        if (firstPass) {
            Object.keys(row).forEach(function(key) {
                if (key !== 'Offence') {
                    const index = key.indexOf('/');
                    key = key.substring(0, index + 3);
                    output.year.push({ year: key, region: [], data: [{ crime: crime, value: Number(row[key]) }] });
                }
            });
            firstPass = false;
        } else {
            let i = 0;
            Object.keys(row).forEach(function(key) {
                if (key !== 'Offence') {
                    output.year[i].data?.push({ crime: crime, value: Number(row[key]) });
                    i++;
                }
            });
        }
    }

    records = excelToJson({
        sourceFile: filename[1],
        header: {
            rows: 5,
        },
        columnToKey: {
            A: 'Place',
            B: '2017/18',
            C: '2018/19',
        },
        range: 'A6:C20',
    });

    records = records['Table 2 & Figure 6'];
    const subregions = ['North1', 'South1', 'West1', 'East1'];
    for (const row of records) {
        Object.keys(row).forEach(function(key) {
            if (key !== 'Place') {
                const index = output.year.map(x => x.year).indexOf(key);
                if (row.Place === 'Belfast City') {
                    output.year[index].region.push({
                        region: row.Place,
                        province: [],
                        data: [{ crime: 'Total', value: Number(row[key]) }],
                    });
                } else if (subregions.includes(row.Place)) {
                    const index = output.year.map(x => x.year).indexOf(key);
                    const regIndex = output.year[index].region.map(x => x.region).indexOf('Belfast City');
                    output.year[index].region[regIndex].province.push({
                        province: row.Place.slice(0, -1),
                        county: [
                            { county: row.Place.slice(0, -1), data: [{ crime: 'Total', value: Number(row[key]) }] },
                        ],
                    });
                } else {
                    const index = output.year.map(x => x.year).indexOf(key);
                    output.year[index].region.push({
                        region: row.Place,
                        province: [
                            {
                                province: row.Place,
                                county: [{ county: row.Place, data: [{ crime: 'Total', value: Number(row[key]) }] }],
                            },
                        ],
                    });
                }
            }
        });
    }

    return output;
}

function parseCSVBelgium(filename: string[]): Country {
    const crimes = [
        'Autodiefstal',
        'Motodiefstal',
        'Carjacking',
        'Garagiediefstal',
        'Bromfietsdiefstal',
        'Fietsdiefstal',
        'Diefstal uit of aan voertuig',
        'Woninginbraak',
        'Inbraak in bedrijf of handelszaak',
        'Inbraak in openb. of overheidsinst.',
        'Diefstal gewapenderhand',
        'Diefstal met geweld zonder wapen',
        'Sacjacking uit Autodiefstal',
        'Handtasroof',
        'Grijpdiefstal',
        'Zakkenrollerij',
        'Winkeldiefstal',
        'Graffiti',
        'Beschadiging van Autodiefstal',
        'IFG: fysiek (totaal)',
        'IFG: psychisch (totaal)',
        'IFG: seksueel (totaal)',
    ];
    const folder = 'data/source_files/belgium/';
    const output: Country = { country: 'Belgium', year: [] };
    const extPoliceZones = [
        'Geen PZ toegekend - Noordzee',
        'Geen PZ toegekend - Brussels Airport',
        'Geen PZ toegekend - Eurostar',
    ];
    const regions = ['Vlaams Gewest', 'Brussels Hoofdstedelijk Gewest', 'Waals Gewest'];
    const provinces = [
        'Brussel-Hoofdstad',
        'Antwerpen',
        'Limburg',
        'Oost-Vlaanderen',
        'Vlaams Brabant',
        'West-Vlaanderen',
        'Brabant wallon',
        'Hainaut',
        'Liège',
        'Luxembourg',
        'Namur',
    ];
    const special = ['Leuven', 'Hainaut (Mons)'];

    let text = fs.readFileSync(folder + filename[0], 'utf-8');

    const columns = parse(text)[0];
    columns[0] = 'Place';

    for (let i = 1; i < columns.length; i++) {
        output.year.push({ year: columns[i], region: [], data: [] });
    }

    /*let records = parse(text, {
        from_line: 2,
        columns: columns,
    });*/

    let firstPass = true;
    let crimIndex = -1;
    for (const file of filename) {
        text = fs.readFileSync(folder + file, 'utf-8');
        const records = parse(text, {
            from_line: 2,
            columns: columns,
        });
        const i = 0;
        crimIndex++;
        let skipNext = false;
        let firstLiege = true;
        const usedNames: Array<string> = [];
        let regIndex = 0,
            provIndex = 0;
        for (const row of records) {
            if (row.Place === 'Nationaal') {
                Object.keys(row).forEach(function(key) {
                    if (key != 'Place') {
                        const yearIndex = output.year.map(x => x.year).indexOf(key);
                        output.year[yearIndex].data?.push({ crime: crimes[crimIndex], value: Number(row[key]) });
                    }
                });
            } else if (row.Place === 'Onbekend') {
                if (firstPass) {
                    Object.keys(row).forEach(function(key) {
                        if (key != 'Place') {
                            const yearIndex = output.year.map(x => x.year).indexOf(key);
                            output.year[yearIndex].region.push({
                                region: row.Place,
                                province: [
                                    {
                                        province: row.Place,
                                        county: [
                                            {
                                                county: row.Place,
                                                data: [{ crime: crimes[crimIndex], value: Number(row[key]) }],
                                            },
                                        ],
                                    },
                                ],
                            });
                        }
                    });
                    break;
                } else {
                    Object.keys(row).forEach(function(key) {
                        if (key != 'Place') {
                            const yearIndex = output.year.map(x => x.year).indexOf(key);
                            const regIndex = output.year[0].region.map(x => x.region).indexOf(row.Place);
                            //console.log(regIndex);
                            output.year[yearIndex].region[regIndex].province[0].county[0].data.push({
                                crime: crimes[crimIndex],
                                value: Number(row[key]),
                            });
                        }
                    });
                    break;
                }
            } else {
                //let regIndex = 0, provIndex = 0;
                if (
                    (row.Place === row.Place.toUpperCase() && row.Place !== row.Place.toLowerCase()) ||
                    extPoliceZones.includes(row.Place)
                ) {
                    if (row.Place === 'Geen PZ toegekend - Eurostar') {
                        if (firstPass) {
                            regIndex = output.year[0].region.length - 1;
                            provIndex = output.year[0].region[regIndex].province.length - 1;
                            Object.keys(row).forEach(function(key) {
                                if (key != 'Place') {
                                    const yearIndex = output.year.map(x => x.year).indexOf(key);
                                    output.year[yearIndex].region[regIndex].province[provIndex].county.push({
                                        county: row.Place,
                                        data: [{ crime: crimes[crimIndex], value: Number(row[key]) }],
                                    });
                                }
                            });
                        } else {
                            const countIndex = output.year[0].region[regIndex].province[provIndex].county
                                .map(x => x.county)
                                .indexOf(row.Place);
                            Object.keys(row).forEach(function(key) {
                                if (key != 'Place') {
                                    const yearIndex = output.year.map(x => x.year).indexOf(key);
                                    output.year[yearIndex].region[regIndex].province[provIndex].county[
                                        countIndex
                                    ].data.push({
                                        crime: crimes[crimIndex],
                                        value: Number(row[key]),
                                    });
                                }
                            });
                        }
                    }
                    //i = 4;
                } else {
                    if (special.includes(row.Place) || (row.Place === 'Liège' && !firstLiege)) {
                        if (row.Place === 'Liège') {
                            firstLiege = true;
                            //console.log('subregional liege');
                        }
                    } else if (regions.includes(row.Place)) {
                        if (firstPass) {
                            Object.keys(row).forEach(function(key) {
                                if (key != 'Place') {
                                    const yearIndex = output.year.map(x => x.year).indexOf(key);
                                    output.year[yearIndex].region.push({
                                        region: row.Place,
                                        province: [],
                                        data: [{ crime: crimes[crimIndex], value: Number(row[key]) }],
                                    });
                                }
                            });
                        } else {
                            regIndex = output.year[0].region.map(x => x.region).indexOf(row.Place);
                            Object.keys(row).forEach(function(key) {
                                if (key != 'Place') {
                                    const yearIndex = output.year.map(x => x.year).indexOf(key);
                                    output.year[yearIndex].region[regIndex].data?.push({
                                        crime: crimes[crimIndex],
                                        value: Number(row[key]),
                                    });
                                }
                            });
                        }
                    } else if (
                        provinces.includes(row.Place) &&
                        !usedNames.includes(row.Place) /*|| (row.Place === 'Liège' && firstLiege)*/
                    ) {
                        //console.log(row.Place);
                        //console.log(firstLiege);
                        if (firstPass) {
                            regIndex = output.year[0].region.length - 1;
                            Object.keys(row).forEach(function(key) {
                                if (key != 'Place') {
                                    const yearIndex = output.year.map(x => x.year).indexOf(key);
                                    output.year[yearIndex].region[regIndex].province.push({
                                        province: row.Place,
                                        county: [],
                                        data: [{ crime: crimes[crimIndex], value: Number(row[key]) }],
                                    });
                                }
                            });
                        } else {
                            //regIndex = output.year[0].region.map(x => x.region).indexOf;
                            provIndex = output.year[0].region[regIndex].province
                                .map(x => x.province)
                                .indexOf(row.Place);
                            Object.keys(row).forEach(function(key) {
                                if (key != 'Place') {
                                    const yearIndex = output.year.map(x => x.year).indexOf(key);
                                    output.year[yearIndex].region[regIndex].province[provIndex].data?.push({
                                        crime: crimes[crimIndex],
                                        value: Number(row[key]),
                                    });
                                }
                            });
                        }
                        skipNext = true;
                        if (row.Place === 'Liège') {
                            //console.log('province liege');
                            firstLiege = false;
                        }
                        usedNames.push(row.Place);
                    } else if (!skipNext) {
                        if (firstPass) {
                            regIndex = output.year[0].region.length - 1;
                            provIndex = output.year[0].region[regIndex].province.length - 1;
                            Object.keys(row).forEach(function(key) {
                                if (key != 'Place') {
                                    const yearIndex = output.year.map(x => x.year).indexOf(key);
                                    output.year[yearIndex].region[regIndex].province[provIndex].county.push({
                                        county: row.Place,
                                        data: [{ crime: crimes[crimIndex], value: Number(row[key]) }],
                                    });
                                }
                            });
                        } else {
                            //regIndex = output.year[0].region.map(x => x.region).indexOf;
                            //provIndex = output.year[0].region[regIndex].province.map(x => x.province).indexOf;
                            const countIndex = output.year[0].region[regIndex].province[provIndex].county
                                .map(x => x.county)
                                .indexOf(row.Place);
                            Object.keys(row).forEach(function(key) {
                                if (key != 'Place') {
                                    const yearIndex = output.year.map(x => x.year).indexOf(key);
                                    output.year[yearIndex].region[regIndex].province[provIndex].county[
                                        countIndex
                                    ].data.push({
                                        crime: crimes[crimIndex],
                                        value: Number(row[key]),
                                    });
                                }
                            });
                        }
                    } else {
                        skipNext = false;
                    }
                }
            }
        }
        //console.log('iteration ended');
        firstPass = false;
    }

    return output;
}

//ordine anticronologico
function parseXLSEngland(filename: string[]): Country {
    const output: Country = { country: 'England', year: [] };
    let i = 0;
    for (const file of filename) {
        let records = excelToJson({
            sourceFile: file,
            header: {
                rows: 5,
            },
            columnToKey: {
                C: 'Total',
                '*': '{{columnHeader}}',
            },
            range: 'A8:Z56',
        });

        records = records['Table P1'];

        let regIndex = 0,
            provIndex = 0;
        output.year.push({ year: String(2019 - (i + 1)) + '/' + String(2019 - i), region: [], data: [] });
        for (const row of records) {
            if (row['Area Name'] === 'ENGLAND') {
                Object.keys(row).forEach(function(key) {
                    if (key !== 'Area Name' && key !== 'Area Code') {
                        output.year[i].data?.push({
                            crime: key.replace(/\s*[0-9],*[0-9]*/g, ''),
                            value: Number(row[key]),
                        });
                    }
                });
            } else if (row['Area Code'].startsWith('E12')) {
                output.year[i].region.push({
                    region: row['Area Name'].replace(/\s[0-9],[0-9]/g, ''),
                    province: [],
                    data: [],
                });
                regIndex = output.year[i].region.length - 1;
                Object.keys(row).forEach(function(key) {
                    if (key !== 'Area Name' && key !== 'Area Code') {
                        output.year[i].region[regIndex].data?.push({
                            crime: key.replace(/\s*[0-9],*[0-9]*/g, ''),
                            value: Number(row[key]),
                        });
                    }
                });
            } else {
                output.year[i].region[regIndex].province.push({
                    province: row['Area Name'].replace(/\s*[0-9]/g, ''),
                    county: [{ county: row['Area Name'].replace(/\s*[0-9]/g, ''), data: [] }],
                });
                provIndex = output.year[i].region[regIndex].province.length - 1;
                Object.keys(row).forEach(function(key) {
                    if (key !== 'Area Name' && key !== 'Area Code') {
                        output.year[i].region[regIndex].province[provIndex].county[0].data.push({
                            crime: key.replace(/\s*[0-9],*[0-9]*/g, ''),
                            value: Number(row[key]),
                        });
                    }
                });
            }
        }
        i++;
    }
    return output;
}

function parseXLSWales(filename: string[]): Country {
    const output: Country = { country: 'Wales', year: [] };
    let i = 0;
    for (const file of filename) {
        let records = excelToJson({
            sourceFile: file,
            header: {
                rows: 5,
            },
            columnToKey: {
                C: 'Total',
                '*': '{{columnHeader}}',
            },
            range: 'A57:Z61',
        });

        records = records['Table P1'];

        let regIndex = 0;
        output.year.push({ year: String(2019 - (i + 1)) + '/' + String(2019 - i), region: [], data: [] });
        for (const row of records) {
            if (row['Area Name'] === 'WALES') {
                Object.keys(row).forEach(function(key) {
                    if (key !== 'Area Name' && key !== 'Area Code') {
                        output.year[i].data?.push({
                            crime: key.replace(/\s*[0-9],*[0-9]*/g, ''),
                            value: Number(row[key]),
                        });
                    }
                });
            } else {
                output.year[i].region.push({
                    region: row['Area Name'],
                    province: [{ province: row['Area Name'], county: [{ county: row['Area Name'], data: [] }] }],
                });
                regIndex = output.year[i].region.length - 1;
                Object.keys(row).forEach(function(key) {
                    if (key !== 'Area Name' && key !== 'Area Code') {
                        output.year[i].region[regIndex].province[0].county[0].data.push({
                            crime: key.replace(/\s*[0-9],*[0-9]*/g, ''),
                            value: Number(row[key]),
                        });
                    }
                });
            }
        }
        i++;
    }
    return output;
}

function parseXLSFrance(filename: string[]): Country {
    const output: Country = { country: 'France', year: [] };
    const text = fs.readFileSync('data/source_files/france/helper.csv', 'utf-8');
    const helper = parse(text, {
        columns: true,
    });
    for (let y = 0; y < 7; y++) {
        output.year.push({ year: String(2018 - y), region: [] });
        let records = excelToJson({
            sourceFile: filename[0],
            range: 'C1:NL2',
        });

        records = records['Services GN ' + String(2018 - y)];

        let regions = [];
        for (const row of helper) {
            regions.push(row.Region);
        }
        regions = Array.from(new Set(regions));
        for (const region of regions) {
            output.year[y].region.push({ region: region, province: [] });
        }

        const usedProvinces: Array<string> = [];
        Object.keys(records[0]).forEach(function(key) {
            const provinceCode = records[0][key];
            if (!usedProvinces.includes(provinceCode)) {
                let index = helper.map((x: Record<string, string>) => x['INSEE code']).indexOf(provinceCode);
                if (index != -1) {
                    const assocRegion = helper[index].Region;
                    const provinceName = helper[index].Department;
                    index = output.year[y].region.map(x => x.region).indexOf(assocRegion);
                    output.year[y].region[index].province.push({ province: provinceName, county: [] });
                    usedProvinces.push(provinceCode);
                }
            }
        });

        Object.keys(records[1]).forEach(function(key) {
            const county = records[1][key].replace('CGD ', '');
            const provinceCode = records[0][key];
            const index = helper.map((x: Record<string, string>) => x['INSEE code']).indexOf(provinceCode);
            if (index != -1) {
                const regionName = helper[index].Region;
                const provinceName = helper[index].Department;
                const regIndex = output.year[y].region.map(x => x.region).indexOf(regionName);
                const provIndex = output.year[y].region[regIndex].province.map(x => x.province).indexOf(provinceName);
                output.year[y].region[regIndex].province[provIndex].county.push({ county: county, data: [] });
            }
        });

        let crimeRecords = excelToJson({
            sourceFile: filename[0],
            range: 'B2:NL109',
        });

        crimeRecords = crimeRecords['Services GN ' + String(2018 - y)];
        console.log(y);
        const counties = crimeRecords[0];
        crimeRecords.shift();

        for (const row of crimeRecords) {
            let crime = '';
            Object.keys(row).forEach(function(key) {
                if (key === 'B') {
                    crime = row[key];
                } else {
                    const countyName = counties[key].replace('CGD ', '');
                    const provinceCode = records[0][key];
                    const index = helper.map((x: Record<string, string>) => x['INSEE code']).indexOf(provinceCode);
                    if (index != -1) {
                        const regionName = helper[index].Region;
                        const provinceName = helper[index].Department;
                        const regIndex = output.year[y].region.map(x => x.region).indexOf(regionName);
                        const provIndex = output.year[y].region[regIndex].province
                            .map(x => x.province)
                            .indexOf(provinceName);
                        const countIndex = output.year[y].region[regIndex].province[provIndex].county
                            .map(x => x.county)
                            .indexOf(countyName);
                        output.year[y].region[regIndex].province[provIndex].county[countIndex].data.push({
                            crime: crime,
                            value: Number(row[key]),
                        });
                    }
                }
            });
        }
    }
    return output;
}

//might have duplicates kreis / landkreis, ordine anticronologico
function parseXLSGermany(filename: string[]): Country {
    const output: Country = { country: 'Germany', year: [] };
    const text = fs.readFileSync('data/source_files/germany/helper.csv', 'utf-8');
    const helper = parse(text, {
        columns: true,
    });

    const regions: {
        [key: string]: string;
    } = {
        'Baden-Württemberg': 'Baden-Württemberg',
        Bavaria: 'Bayern',
        Berlin: 'Berlin',
        Brandenburg: 'Brandenburg',
        'Bremen (state)': 'Bremen',
        Hamburg: 'Hamburg',
        Hesse: 'Hessen',
        'Mecklenburg-Vorpommern': 'Mecklenburg-Vorpommern',
        'Lower Saxony': 'Niedersachsen',
        'North Rhine-Westphalia': 'Nordrhein-Westfalen',
        'Rhineland-Palatinate': 'Rheinland-Pfalz',
        Saarland: 'Saarland',
        Saxony: 'Sachsen',
        'Saxony-Anhalt': 'Sachsen-Anhalt',
        'Schleswig-Holstein': 'Schleswig-Holstein',
        Thuringia: 'Thüringen',
    };

    for (let y = 0; y < 3; y++) {
        output.year.push({ year: String(2018 - y), region: [], data: [] });
        Object.keys(regions).forEach(function(key) {
            output.year[y].region.push({ region: regions[key], province: [], data: [] });
        });
        let records: any;
        if (y === 2) {
            records = excelToJson({
                sourceFile: filename[y * 2],
                columnToKey: {
                    B: 'Crime',
                    D: 'Place',
                    E: 'Value',
                },
                from_line: 8,
            });
            records = records['BKA-LKS-F-01-T01 Länder'];
        } else {
            records = excelToJson({
                sourceFile: filename[y * 2],
                columnToKey: {
                    B: 'Crime',
                    C: 'Place',
                    D: 'Value',
                },
                from_line: 8,
            });
            records = records['T01_LÜ'];
        }

        records.shift();
        records.shift();

        for (const row of records) {
            if (row.Place !== 'Bundesrepublik Deutschland' && row.Place !== 'Bund echte Zählung der Tatverdächtigen') {
                const regIndex = output.year[y].region.map(x => x.region).indexOf(row.Place);
                output.year[y].region[regIndex].data?.push({ crime: row.Crime, value: Number(row.Value) });
            } else {
                output.year[y].data?.push({ crime: row.Crime, value: Number(row.Value) });
            }
        }

        records = excelToJson({
            sourceFile: filename[y * 2 + 1],
            columnToKey: {
                B: 'Crime',
                D: 'Place',
                F: 'Value',
            },
            from_line: 13,
        });
        records = records['T01_Kreise'];
        records.concat(records.splice(0, 5));
        let firstPass = true;
        for (const row of records) {
            const index = helper.map((x: Record<string, string>) => x.District).indexOf(row.Place);
            if (index === -1) {
                continue;
            }
            const state = regions[helper[index].State];
            const regIndex = output.year[y].region.map(x => x.region).indexOf(state);
            if (firstPass) {
                output.year[y].region[regIndex].province.push({
                    province: row.Place,
                    county: [{ county: row.Place, data: [{ crime: row.Crime, value: Number(row.Value) }] }],
                });
            } else {
                let provIndex = output.year[y].region[regIndex].province.map(x => x.province).indexOf(row.Place);
                provIndex = output.year[y].region[regIndex].province
                    .map(x => x.province)
                    .indexOf(row.Place, provIndex + 1);
                output.year[y].region[regIndex].province[provIndex].county[0].data.push({
                    crime: row.Crime,
                    value: Number(row.Value),
                });
            }

            if (row.Crime !== 'Straftaten insgesamt') {
                firstPass = false;
            }
        }
    }
    return output;
}

function parseXLSFinland(filename: string[]): Country {
    const output: Country = { country: 'Finland', year: [] };
    const provMap: {
        [key: string]: string;
    } = {
        Uusimaa: 'Helsinki-Uusimaa',
        'Southwest Finland': 'Varsinais-Suomi',
        Satakunta: 'Satakunta',
        'Kanta-Häme': 'Kanta-Häme',
        Pirkanmaa: 'Pirkanmaa',
        'Päijät-Häme': 'Päijät-Häme',
        Kymenlaakso: 'Kymenlaakso',
        'South Karelia': 'Etelä-Karjala',
        'South Savo': 'Etelä-Savo',
        'North Savo': 'Pohjois-Savo',
        'North Karelia': 'Pohjois-Karjala',
        'Central Finland': 'Keski-Suomi',
        'South Ostrobothnia': 'Etelä-Pohjanmaa',
        Ostrobothnia: 'Pohjanmaa',
        'Central Ostrobothnia': 'Keski-Pohjanmaa',
        'North Ostrobothnia': 'Pohjois-Pohjanmaa',
        Kainuu: 'Kainuu',
        Lapland: 'Lappi',
        Åland: 'Åland',
    };

    for (let y = 0; y < 9; y++) {
        output.year.push({ year: '2019M' + String(9 - y), region: [], data: [] });
        let records = excelToJson({
            sourceFile: filename[y * 2],
            columnToKey: {
                A: 'Crime',
                B: 'Place',
                D: 'Value',
            },
            range: 'A5:D5431',
        });
        records = records['001_117t_2019m09'];
        let firstPass = true;
        let crime = '';
        let regIndex = 0;
        for (const row of records) {
            if (row.hasOwnProperty('Crime')) {
                crime = row.Crime;
                output.year[y].data?.push({ crime: crime, value: Number(row.Value) });
            } else if (row.Place === 'FI1 MANNER-SUOMI' || row.Place === 'FI2 ÅLAND' || row.Place === 'FI200 Åland') {
                continue;
            } else {
                if (firstPass) {
                    if (row.Place === 'FI20 Åland') {
                        output.year[y].region.push({
                            region: row.Place.split(' ')[1],
                            province: [
                                {
                                    province: row.Place.split(' ')[1],
                                    county: [],
                                    data: [{ crime: crime, value: Number(row.Value) }],
                                },
                            ],
                        });
                        firstPass = false;
                    } else if (row.Place.split(' ')[0].length === 4) {
                        output.year[y].region.push({
                            region: row.Place.split(' ')[1],
                            province: [],
                            data: [{ crime: crime, value: Number(row.Value) }],
                        });
                    } else if (row.Place.split(' ')[0].length === 5) {
                        regIndex = output.year[y].region.length - 1;
                        output.year[y].region[regIndex].province.push({
                            province: row.Place.split(' ')[1],
                            county: [],
                            data: [{ crime: crime, value: Number(row.Value) }],
                        });
                    }
                } else {
                    if (row.Place === 'FI20 Åland') {
                        regIndex = output.year[y].region.map(x => x.region).indexOf(row.Place.split(' ')[1]);
                        output.year[y].region[regIndex].province[0].data?.push({
                            crime: crime,
                            value: Number(row.Value),
                        });
                    } else if (row.Place.split(' ')[0].length === 4) {
                        regIndex = output.year[y].region.map(x => x.region).indexOf(row.Place.split(' ')[1]);
                        output.year[y].region[regIndex].data?.push({ crime: crime, value: Number(row.Value) });
                    } else if (row.Place.split(' ')[0].length === 5) {
                        const provIndex = output.year[y].region[regIndex].province
                            .map(x => x.province)
                            .indexOf(row.Place.split(' ')[1]);
                        output.year[y].region[regIndex].province[provIndex].data?.push({
                            crime: crime,
                            value: Number(row.Value),
                        });
                    }
                }
            }
        }

        records = excelToJson({
            sourceFile: filename[y * 2 + 1],
            columnToKey: {
                A: 'Crime',
                B: 'Place',
                D: 'Value',
            },
            range: 'A5:D66937',
        });
        records = records['001_117t_2019m09'];
        firstPass = true;
        crime = '';
        regIndex = 0;
        let provIndex = 0;
        for (const row of records) {
            if (row.hasOwnProperty('Crime')) {
                crime = row.Crime;
                if (row.Crime === '2) OFFENCES AGAINST THE CRIMINAL CODE') {
                    firstPass = false;
                }
            } else if (row.Place === 'MAINLAND FINLAND' || row.Place === 'ÅLAND') {
                continue;
            } else {
                if (firstPass) {
                    if (Object.keys(provMap).includes(row.Place)) {
                        const province = provMap[row.Place];
                        for (regIndex = 0; regIndex < output.year[y].region.length; regIndex++) {
                            provIndex = output.year[y].region[regIndex].province.map(x => x.province).indexOf(province);
                            if (provIndex !== -1) {
                                break;
                            }
                        }
                    } else {
                        output.year[y].region[regIndex].province[provIndex].county.push({
                            county: row.Place.replace('..', ''),
                            data: [{ crime: crime, value: Number(row.Value) }],
                        });
                    }
                } else {
                    if (Object.keys(provMap).includes(row.Place)) {
                        const province = provMap[row.Place];
                        for (regIndex = 0; regIndex < output.year[y].region.length; regIndex++) {
                            provIndex = output.year[y].region[regIndex].province.map(x => x.province).indexOf(province);
                            if (provIndex !== -1) {
                                break;
                            }
                        }
                    } else {
                        const countIndex = output.year[y].region[regIndex].province[provIndex].county
                            .map(x => x.county)
                            .indexOf(row.Place.replace('..', ''));
                        output.year[y].region[regIndex].province[provIndex].county[countIndex].data.push({
                            crime: crime,
                            value: Number(row.Value),
                        });
                    }
                }
            }
        }
    }

    return output;
}
///////////////////////////////////////////////////////

//////// DICTIONARY OF FUNCTIONS ////////////
/**
 * Contains all the country specific parsers
 */
const countryFunctions: Record<string, Function> = {
    luxembourg: parseCSVLuxembourg,
    cyprus: parseXLSCyprus,
    hungary: parseXLSHungary,
    bulgaria: parseXLSBulgaria,
    portugal: parseXLSPortugal,
    denmark: parseCSVDenmark,
    austria: parseXLSXAustria,
    czech_republic: getCzechData,
    spain: parseCSVSpain,
    italy: parseXLSItaly,
    netherlands: parseCSVNetherlands,
    northern_ireland: parseXLSNorthernIreland,
    belgium: parseCSVBelgium,
    england: parseXLSEngland,
    wales: parseXLSWales,
    france: parseXLSFrance,
    germany: parseXLSGermany,
    finland: parseXLSFinland,
};

const countrySources: Record<string, Array<string>> = {
    luxembourg: ['data/source_files/luxembourg/luxembourg.csv'],
    cyprus: ['data/source_files/cyprus/cyprus_1.xls', 'data/source_files/cyprus/cyprus_2.xls'],
    hungary: ['data/source_files/hungary/hungary.xls'],
    bulgaria: ['data/source_files/bulgaria/bulgaria.xls'],
    denmark: ['data/source_files/denmark/denmark.csv'],
    portugal: ['data/source_files/portugal/portugal.xls'],
    austria: ['data/source_files/austria/austria.xlsx'],
    czech_republic: [''],
    spain: ['data/source_files/spain/spain_1.csv', 'data/source_files/spain/spain_2.csv'],
    italy: ['data/source_files/italy/italy.xls'],
    netherlands: fs
        .readdirSync('data/source_files/netherlands/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    northern_ireland: [
        'data/source_files/northern-ireland/northern-ireland_1.xls',
        'data/source_files/northern-ireland/northern-ireland_2.xls',
    ],
    belgium: fs
        .readdirSync('data/source_files/belgium/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    england: [
        'data/source_files/england/england_1.xlsx',
        'data/source_files/england/england_2.xlsx',
        'data/source_files/england/england_3.xls',
        'data/source_files/england/england_4.xls',
    ],
    wales: [
        'data/source_files/england/england_1.xlsx',
        'data/source_files/england/england_2.xlsx',
        'data/source_files/england/england_3.xls',
        'data/source_files/england/england_4.xls',
    ],
    france: ['data/source_files/france/france.xlsx'],
    germany: [
        'data/source_files/germany/germany_1.xlsx',
        'data/source_files/germany/germany_2.xlsx',
        'data/source_files/germany/germany_3.xlsx',
        'data/source_files/germany/germany_4.xlsx',
        'data/source_files/germany/germany_5.xlsx',
        'data/source_files/germany/germany_6.xlsx',
    ],
    finland: ['data/source_files/finland/finland_1.xlsx', 'data/source_files/finland/finland_2.xlsx'],
};
////////////////////////////////////////////
///////////PUBLIC FUNCTIONS////////////////
/**
 * Returns the JSON with ICCS categories of the specified country with source of the specified extension (eg. .csv, .xls, .xlsx)
 */
export async function getData(country: string): Promise<Country> {
    const data = countryFunctions[country](countrySources[country]);
    //NaNtoZero(data);
    //const JSONData = mapCategories(data, country, false, false);
    //console.log(data);
    return data;
}
