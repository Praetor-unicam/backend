/* eslint-disable @typescript-eslint/camelcase */
import fs = require('fs');
import parse = require('csv-parse/lib/sync');
import { getPolandData } from './scraper/poland';
import * as dicts from '../data/dictionaries';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const translate = require('translate');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const excelToJson = require('convert-excel-to-json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios');

const sourcePath = 'data/source_files/';

enum NUTS {
    NUTS1 = 3,
    NUTS2 = 4,
    NUTS3 = 5,
    LAU = 6,
}

//////////DB INTERFACE //////////////////
interface Place {
    name: string;
    data: Array<Crime>;
    NUTS: string;
}

interface YearDB {
    year: string;
    place: Array<Place>;
    //data: Array<Crime>;
}

interface CountryDB {
    CountryNUTS: string;
    year: Array<YearDB>;
}

////////// INTERFACES ///////////

export interface Crime {
    ICCS_code?: string;
    ICCS_crime?: string;
    crime: string;
    value: number;
}

interface County {
    county: string;
    data: Array<Crime>;
    NUTS?: string;
}

interface Province {
    province: string;
    county: Array<County>;
    data: Array<Crime>;
    NUTS?: string;
}

interface Region {
    region: string;
    province: Array<Province>;
    data: Array<Crime>;
    NUTS?: string;
}

interface Year {
    year: string;
    region: Array<Region>;
    data: Array<Crime>;
}

export interface Country {
    country: string;
    NUTS: Array<NUTS>;
    year: Array<Year>;
}

//////// GENERAL USE FUNCTIONS /////////////

function flatten(source: Country, code: string): CountryDB {
    const output: CountryDB = { CountryNUTS: code, year: [] };
    for (const year of source.year) {
        output.year.push({ year: year.year, place: [{ name: source.country, NUTS: code, data: year.data }] });
        for (const region of year.region) {
            const yrindex = output.year.length - 1;
            if (region.NUTS) {
                output.year[yrindex].place.push({ name: region.region, NUTS: region.NUTS, data: region.data });
            }
            for (const province of region.province) {
                if (province.NUTS) {
                    output.year[yrindex].place.push({
                        name: province.province,
                        NUTS: province.NUTS,
                        data: province.data,
                    });
                }
                for (const county of province.county) {
                    if (county.NUTS) {
                        output.year[yrindex].place.push({ name: county.county, NUTS: county.NUTS, data: county.data });
                    }
                }
            }
        }
    }
    return output;
}

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

function addNUTSCodes(source: Country, countryCode: string): void {
    const data = JSON.parse(fs.readFileSync('data/NUTS_lists/' + countryCode + '.json', 'utf8'));

    for (let i = 0; i < source.NUTS.length; i++) {
        const nuts = source.NUTS[i];
        switch (i) {
            case 0:
                console.log('region');
                for (const year of source.year) {
                    for (const region of year.region) {
                        let dataByNUTS;
                        if (nuts == NUTS.LAU) {
                            dataByNUTS = data.filter((x: Record<string, string>) => x.id.length > NUTS.NUTS3);
                        } else {
                            dataByNUTS = data.filter((x: Record<string, string>) => x.id.length === nuts);
                        }
                        const index = dataByNUTS
                            .map((x: Record<string, string>) => x.original_name.toLowerCase())
                            .indexOf(region.region.toLowerCase());
                        if (index !== -1) {
                            region.NUTS = dataByNUTS[index].id;
                        } else {
                            console.log("'" + region.region + "': '',");
                        }
                    }
                    console.log('----------------------');
                }
                break;
            case 1:
                console.log('province');
                for (const year of source.year) {
                    for (const region of year.region) {
                        for (const province of region.province) {
                            let dataByNUTS;
                            if (nuts == NUTS.LAU) {
                                dataByNUTS = data.filter((x: Record<string, string>) => x.id.length > NUTS.NUTS3);
                            } else {
                                dataByNUTS = data.filter((x: Record<string, string>) => x.id.length === nuts);
                            }
                            const index = dataByNUTS
                                .map((x: Record<string, string>) => x.original_name.toLowerCase())
                                .indexOf(province.province.toLowerCase());
                            if (index !== -1) {
                                province.NUTS = dataByNUTS[index].id;
                            } else {
                                console.log("'" + province.province + "': '',");
                            }
                        }
                    }
                    console.log('----------------------');
                }
                break;
            case 2:
                console.log('county');
                for (const year of source.year) {
                    for (const region of year.region) {
                        for (const province of region.province) {
                            for (const county of province.county) {
                                let dataByNUTS;
                                if (nuts == NUTS.LAU) {
                                    dataByNUTS = data.filter((x: Record<string, string>) => x.id.length > NUTS.NUTS3);
                                } else {
                                    dataByNUTS = data.filter((x: Record<string, string>) => x.id.length === nuts);
                                }
                                let index;
                                if (countryCode === 'BE' || countryCode === 'FI') {
                                    index = dataByNUTS
                                        .map((x: Record<string, string>) =>
                                            x.original_name
                                                .toLowerCase()
                                                .split('/')[0]
                                                .trim(),
                                        )
                                        .indexOf(county.county.toLowerCase());
                                    if (index === -1) {
                                        index = dataByNUTS
                                            .map((x: Record<string, string>) =>
                                                x.original_name.includes('/')
                                                    ? x.original_name
                                                          .toLowerCase()
                                                          .split('/')[1]
                                                          .trim()
                                                    : x.original_name.toLowerCase(),
                                            )
                                            .indexOf(county.county.toLowerCase());
                                    }
                                } else {
                                    index = dataByNUTS
                                        .map((x: Record<string, string>) => x.original_name.toLowerCase())
                                        .indexOf(county.county.toLowerCase());
                                }
                                if (index !== -1) {
                                    county.NUTS = dataByNUTS[index].id;
                                } else {
                                    console.log("'" + county.county + "': '',");
                                }
                            }
                        }
                    }
                    console.log('----------------------');
                }
                break;
        }
    }
    ////////////////////////
    /*
    fs.writeFile('data/NUTS_lists/' + countryCode + '.json', JSON.stringify(data), function(err) {
        if (err) {
            console.log(err);
        }
    });
    */
    ///////////////////////
}

function mergeLocations(source: Country, locations: string[], level: string, newLocation: string): void {
    NaNtoZero(source);
    switch (level) {
        case 'region':
            for (let i = 0; i < source.year.length; i++) {
                const locationArray: Region[] = [];
                for (let j = 0; j < source.year[i].region.length; j++) {
                    if (locations.includes(source.year[i].region[j].region)) {
                        locationArray.push(source.year[i].region[j]);
                    }
                }
                source.year[i].region = source.year[i].region.filter(
                    x => locationArray.map(y => y.region).includes(x.region) === false,
                );
                const tmpRegion: Region = { region: newLocation, province: [], data: [] };

                if (locationArray[0].data) {
                    for (let k = 0; k < locationArray[0].data.length; k++) {
                        let sum = 0;
                        for (let r = 0; r < locationArray.length; r++) {
                            if (locationArray[r].data !== undefined) {
                                sum = sum + locationArray[r].data[k].value;
                            }
                        }
                        tmpRegion.data.push({ crime: locationArray[0].data[k].crime, value: sum });
                    }
                }
                source.year[i].region.push(tmpRegion);
            }
            break;
        case 'province':
            for (let i = 0; i < source.year.length; i++) {
                const locationArray: Province[] = [];
                let regIndex = 0;
                for (let j = 0; j < source.year[i].region.length; j++) {
                    for (const province of source.year[i].region[j].province) {
                        if (locations.includes(province.province)) {
                            locationArray.push(province);
                            regIndex = j;
                        }
                    }
                }
                source.year[i].region[regIndex].province = source.year[i].region[regIndex].province.filter(
                    x => locationArray.map(y => y.province).includes(x.province) === false,
                );
                const tmpProvince: Province = { province: newLocation, county: [], data: [] };

                if (locationArray[0].data) {
                    for (let k = 0; k < locationArray[0].data.length; k++) {
                        let sum = 0;
                        for (let r = 0; r < locationArray.length; r++) {
                            if (locationArray[r].data !== undefined) {
                                sum = sum + locationArray[r].data[k].value;
                            }
                        }
                        tmpProvince.data.push({ crime: locationArray[0].data[k].crime, value: sum });
                    }
                }
                source.year[i].region[regIndex].province.push(tmpProvince);
            }
            break;
        case 'county':
            break;
    }
}

function mergeYears(source: Country, years: string[], newYear: string): void {
    const yearArray: Year[] = [];
    //get years from source
    for (let i = 0; i < source.year.length; i++) {
        if (years.includes(source.year[i].year)) {
            yearArray.push(source.year[i]);
        }
    }

    //return if no years found
    if (yearArray.length === 0) {
        return;
    }
    //remove years from source
    source.year = source.year.filter(x => yearArray.map(y => y.year).includes(x.year) === false);
    /*for (const year of yearArray) {
        const index = source.year.map(x => x.year).indexOf(year.year);
        source.year.splice(index, 1);
    }*/

    //create new merged year
    const tmpYear: Year = { year: newYear, region: [], data: [] };

    if (yearArray[0].data) {
        for (let i = 0; i < yearArray[0].data.length; i++) {
            let sum = 0;
            for (let j = 0; j < yearArray.length; j++) {
                if (yearArray[j].data !== undefined) {
                    sum = sum + yearArray[j].data[i].value;
                }
            }
            tmpYear.data?.push({ crime: yearArray[0].data[i].crime, value: sum });
        }
    }
    // REGION LEVEL
    for (let r = 0; r < yearArray[0].region.length; r++) {
        if (yearArray[0].region[r].data) {
            tmpYear.region.push({
                region: yearArray[0].region[r].region,
                province: [],
                data: [],
            });
        }

        if (yearArray[0].region[r].data) {
            for (let i = 0; i < yearArray[0].region[r].data.length; i++) {
                let sum = 0;
                for (let j = 0; j < yearArray.length; j++) {
                    if (yearArray[j].data !== undefined) {
                        sum = sum + yearArray[j].region[r].data[i].value;
                    }
                }

                tmpYear.region[r].data?.push({ crime: yearArray[0].region[r].data[i].crime, value: sum });
            }
        }
        // PROVINCE LEVEL
        for (let p = 0; p < yearArray[0].region[r].province.length; p++) {
            if (yearArray[0].region[r].province[p].data) {
                tmpYear.region[r].province.push({
                    province: yearArray[0].region[r].province[p].province,
                    county: [],
                    data: [],
                });
            }

            if (yearArray[0].region[r].province[p].data) {
                for (let i = 0; i < yearArray[0].region[r].province[p].data.length; i++) {
                    let sum = 0;
                    for (let j = 0; j < yearArray.length; j++) {
                        if (yearArray[j].data !== undefined) {
                            sum = sum + yearArray[j].region[r].province[p].data[i].value;
                        }
                    }

                    tmpYear.region[r].province[p].data?.push({
                        crime: yearArray[0].region[r].province[p].data[i].crime,
                        value: sum,
                    });
                }
            }
            // COUNTY LEVEL
            for (let c = 0; c < yearArray[0].region[r].province[p].county.length; c++) {
                tmpYear.region[r].province[p].county.push({
                    county: yearArray[0].region[r].province[p].county[c].county,
                    data: [],
                });

                if (yearArray[0].region[r].province[p].county[c].data) {
                    for (let i = 0; i < yearArray[0].region[r].province[p].county[c].data.length; i++) {
                        let sum = 0;
                        for (let j = 0; j < yearArray.length; j++) {
                            if (yearArray[j].data !== undefined) {
                                sum = sum + yearArray[j].region[r].province[p].county[c].data[i].value;
                            }
                        }

                        tmpYear.region[r].province[p].county[c].data.push({
                            crime: yearArray[0].region[r].province[p].county[c].data[i].crime,
                            value: sum,
                        });
                    }
                }
            }
        }
    }
    source.year.push(tmpYear);
}

async function translateCrimes(array: Array<Crime>, from: string, to: string): Promise<void> {
    for (let i = 0; i < array.length; i++) {
        array[i].crime = await translate(array[i].crime, { from: from, to: to });
    }
}

async function translateCountryCrimes(source: Country, from: string, to: string): Promise<void> {
    translate.engine = 'yandex';
    translate.key = 'trnsl.1.1.20191223T153114Z.c4d104d7d895ac65.a60e9046d8cdfec3b8637481a22fd27111e8b516';
    for (const year of source.year) {
        if (year.data) {
            await translateCrimes(year.data, from, to);
        }
        for (const region of year.region) {
            if (region.data) {
                await translateCrimes(region.data, from, to);
            }
            for (const province of region.province) {
                if (province.data) {
                    await translateCrimes(province.data, from, to);
                }
                for (const county of province.county) {
                    await translateCrimes(county.data, from, to);
                }
            }
        }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
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

function coalesce(source: Country): void {
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
}

function _disentangleSubcategory(array: Array<Crime>, topCategory: string, subCategory: string): void {
    const topcat = array.find(element => element.crime === topCategory);
    const subcat = array.find(element => element.crime === subCategory);
    if (topcat != undefined && subcat != undefined) {
        topcat.value -= subcat.value;
    }
}

//apply before mapping
function disentangleSubcategory(source: Country, topCategory: string, subCategory: string): void {
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
}

function disentangleSubcategories(source: Country, subcategories: Record<string, string>): void {
    Object.entries(subcategories).forEach(([key, value]) => {
        disentangleSubcategory(source, key, value);
    });
}

//levels: region, province, county, region+, province+
function rename(source: Country, level: string, substitutions: Record<string, string>): void {
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

function mapCategories(source: Country, country: string, removeUnmatched: boolean): void {
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
    //coalesce(source);
}

///////////////////////////////////////////////////////////

///////// COUNTRY LOADING FUNCTIONS /////////////////
/**
 * Returns JSON from luxembourg's CSV file
 */

function parseCSVLuxembourg(filename: string[]): Country {
    let text = fs.readFileSync(sourcePath + 'luxembourg/' + filename[0], 'utf-8');
    const output: Country = { country: 'Luxembourg', year: [], NUTS: [] };

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
                    data: [],
                    region: [
                        /*{
                            region: 'Luxembourg',
                            province: [{ province: 'Luxembourg', county: [{ county: 'Luxembourg', data: [] }] }],
                        },*/
                    ],
                };
                output.year.push(yearTemp);
            } else {
                if (!isNaN(Number(key))) {
                    /*output.year[i].region[0].province[0].county[0].data.push({
                        crime: row.Qualification,
                        value: Number(row[key]),
                    });*/
                    output.year[i].data?.push({
                        crime: row.Qualification,
                        value: Number(row[key]),
                    });
                }
            }
            i = i + 1;
        });
        firstPass = false;
    }

    disentangleSubcategories(output, {
        'Thefts including acts of violence': 'thereof: thefts of vehicules including acts of violence',
    });
    return output;
}
//double category
function parseXLSCyprus(filename: string[]): Country {
    const output: Country = { country: 'Cyprus', year: [], NUTS: [NUTS.LAU] };
    for (let y = 0; y < filename.length / 2; y++) {
        const year = y + 2016 >= 2018 ? y + 1 + 2016 : y + 2016;
        output.year.push({ year: String(year), region: [], data: [] });
        const seriousCrimes = excelToJson({
            sourceFile: sourcePath + 'cyprus/' + filename[y * 2],
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
            sourceFile: sourcePath + 'cyprus/' + filename[y * 2 + 1],
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
                    if (row[key] === 'ΟΛΙΚΟ' || row[key] == 'TOTAL') {
                        crime = 'Total';
                    } else {
                        crime = row[key];
                    }
                } else if (key == 'TOTAL') {
                    if (crime !== 'Total') {
                        output.year[y].data?.push({ crime: crime, value: Number(row[key]) });
                    }
                } else if (firstPass) {
                    if (crime !== 'Total') {
                        output.year[y].region.push({
                            region: key,
                            province: [],
                            data: [{ crime: crime, value: Number(row[key]) }],
                        });
                    }
                } else {
                    if (crime !== 'Total') {
                        output.year[y].region[i - 1].data?.push({
                            crime: crime,
                            value: Number(row[key]),
                        });
                    }
                }
                i = i + 1;
            });
            firstPass = false;
        }
    }
    rename(output, 'region', dicts.cyprusRenamingRegions);
    addNUTSCodes(output, 'CY');
    return output;
}

function parseXLSHungary(filename: string[]): Country {
    const output: Country = { country: 'Hungary', year: [], NUTS: [NUTS.NUTS2, NUTS.NUTS3] };
    let records = excelToJson({
        sourceFile: sourcePath + 'hungary/' + filename[0],
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
                    if (row.Crime_or_location === 'Pest' || row.Crime_or_location === 'Budapest') {
                        output.year[i].region.push({
                            region: row.Crime_or_location,
                            province: [],
                            data: [{ crime: crime, value: Number(row[key]) }],
                        });
                    } else {
                        output.year[i].region.push({
                            region: row.Crime_or_location,
                            province: [],
                            data: [{ crime: crime, value: Number(row[key]) }],
                        });
                    }
                } else if (!isNaN(Number(key))) {
                    if (row.Crime_or_location === 'Pest' || row.Crime_or_location === 'Budapest') {
                        output.year[i].region[j].data?.push({
                            crime: crime,
                            value: Number(row[key]),
                        });
                    } else {
                        output.year[i].region[j].data?.push({
                            crime: crime,
                            value: Number(row[key]),
                        });
                    }
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
                            county: [],
                            data: [
                                {
                                    crime: crime,
                                    value: Number(row[key]),
                                },
                            ],
                        });
                    } else if (!isNaN(Number(key))) {
                        output.year[i].region[j].province[k].data?.push({
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
    rename(output, 'region', dicts.hungaryRenamingRegions);
    addNUTSCodes(output, 'HU');
    return output;
}

//homicide too, crime against youth too and many others, more categories available for total, generally dangerous crimes
function parseXLSBulgaria(filename: string[]): Country {
    const output: Country = {
        country: 'Bulgaria',
        year: [],
        NUTS: [NUTS.NUTS3],
    };
    const records = excelToJson({
        sourceFile: sourcePath + 'bulgaria/' + filename[0],
        columnToKey: {
            A: 'Crime_or_location',
            B: 'Value',
        },
        range: 'A7:B516',
    });
    for (let y = 2016; y <= new Date().getFullYear(); y++) {
        const current = records[y.toString()];
        if (current === undefined) {
            continue;
        }
        output.year.push({ year: y.toString(), region: [], data: [] });
        for (let i = 0; i < current.length; i += 17) {
            const location = current[i].Crime_or_location;
            if (i != 0 && i != 17) {
                output.year[y - 2016].region.push({
                    region: location,
                    province: [],
                    data: [],
                });
            }

            for (let j = i + 1; j < i + 17; j++) {
                if (i === 0) {
                    output.year[y - 2016].data?.push({
                        crime: current[j].Crime_or_location,
                        value: Number(current[j].Value),
                    });
                } else if (i === 17) {
                    continue;
                } else {
                    output.year[y - 2016].region[output.year[y - 2016].region.length - 1].data?.push({
                        crime: current[j].Crime_or_location,
                        value: Number(current[j].Value),
                    });
                }
            }
        }
    }
    rename(output, 'region', dicts.bulgariaRenamingRegions);
    addNUTSCodes(output, 'BG');
    return output;
}

function parseXLSPortugal(filename: string[]): Country {
    const output: Country = { country: 'Portugal', year: [], NUTS: [NUTS.NUTS2, NUTS.NUTS3] };
    for (let y = 0; y < filename.length; y++) {
        output.year.push({ year: String(y + 2011), region: [], data: [] });
        let records = excelToJson({
            sourceFile: sourcePath + 'portugal/' + filename[y],
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
                        output.year[y].data?.push({ crime: key, value: Number(row[key]) });
                    }
                });
            } else {
                switch (row.Level.length) {
                    case 1:
                        break; //continent
                    case 2:
                        output.year[y].region.push({ region: row.Place, province: [], data: [] });
                        regions++;
                        provinces = -1;
                        Object.keys(row).forEach(function(key) {
                            if (key !== 'Place' && key !== 'Level' && key !== 'Total') {
                                output.year[y].region[regions].data?.push({ crime: key, value: Number(row[key]) });
                            }
                        });
                        //regions++;
                        break; //region
                    case 3:
                        output.year[y].region[regions].province.push({ province: row.Place, county: [], data: [] });
                        provinces++;
                        counties = -1;
                        //console.log(output.year[0].region[regions].province);
                        //console.log(provinces);
                        Object.keys(row).forEach(function(key) {
                            if (key !== 'Place' && key !== 'Level' && key !== 'Total') {
                                output.year[y].region[regions].province[provinces].data?.push({
                                    crime: key,
                                    value: Number(row[key]),
                                });
                            }
                        });
                        //provinces++;
                        break; //province
                    default:
                        output.year[y].region[regions].province[provinces].county.push({ county: row.Place, data: [] });
                        counties++;
                        Object.keys(row).forEach(function(key) {
                            if (key !== 'Place' && key !== 'Level' && key !== 'Total') {
                                //console.log(output.year[0].region[regions].province[provinces].county);
                                output.year[y].region[regions].province[provinces].county[counties].data.push({
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
    }
    rename(output, 'region', dicts.portugalRenamingRegions);
    addNUTSCodes(output, 'PT');
    return output;
}

function parseCSVDenmark(filename: string[]): Country {
    const output: Country = { country: 'Denmark', year: [], NUTS: [NUTS.NUTS2, NUTS.LAU] };
    for (let y = 0; y < filename.length; y++) {
        const text = fs.readFileSync(sourcePath + 'denmark/' + filename[y], 'utf-8');
        const records = parse(text, {
            from_line: 3,
            to_line: 9633,
            relax_column_count: true,
        });
        output.year.push({ year: records[0][2], region: [], data: [] });
        records.shift();
        let firstPass = true;
        for (let i = 0; i < records.length - 11; i += 107) {
            //["Nature of the offence, total"]
            let crime = records[i][0];
            if (crime.includes('Repealed')) {
                continue;
            } else if (crime.includes('New')) {
                crime = crime.replace(/\(.*\)/g, '').trim();
            }
            let regions = -1;
            let provinces = -1;
            for (let j = i + 1; j < i + 107; j++) {
                // [" ","All Denmark","119055"]
                if (records[j][1].includes('All')) {
                    output.year[y].data?.push({ crime: crime, value: Number(records[j][2]) });
                } else if (records[j][1].includes('Region')) {
                    provinces = -1;
                    regions++;
                    if (firstPass) {
                        output.year[y].region.push({
                            region: records[j][1].replace('Region ', ''),
                            data: [{ crime: crime, value: Number(records[j][2]) }],
                            province: [],
                        });
                    } else {
                        output.year[y].region[regions].data?.push({ crime: crime, value: Number(records[j][2]) });
                    }
                } else {
                    provinces++;
                    if (firstPass) {
                        output.year[y].region[regions].province.push({
                            province: records[j][1],
                            county: [],
                            data: [{ crime: crime, value: Number(records[j][2]) }],
                        });
                    } else {
                        output.year[y].region[regions].province[provinces].data?.push({
                            crime: crime,
                            value: Number(records[j][2]),
                        });
                    }
                }
            }
            firstPass = false;
        }
    }
    for (let y = 2011; y < new Date().getFullYear(); y++) {
        const years = Array.from({ length: 4 }, (_, id) => y + 'Q' + (id + 1));
        mergeYears(output, years, String(y));
    }
    rename(output, 'province', dicts.denmarkRenamingProvinces);
    addNUTSCodes(output, 'DK');
    return output;
}

async function parseXLSXAustria(filename: string[]): Promise<Country> {
    const output: Country = { country: 'Austria', year: [], NUTS: [NUTS.NUTS2] };
    for (let y = 0; y < filename.length; y++) {
        output.year.push({ year: String(2011 + y), region: [], data: [] });
        let records = excelToJson({
            sourceFile: sourcePath + 'austria/' + filename[y],
            header: {
                rows: 11,
            },
            columnToKey: {
                C: 'Place',
                '*': '{{columnHeader}}',
            },
            range: 'C13:NH31',
        });
        records = records['Data Sheet 0'];
        let i = -1;
        for (const row of records) {
            output.year[y].region.push({
                region: row.Place.replace('Regional court district of ', ''),
                province: [],
                data: [],
            });
            i++;
            Object.keys(row).forEach(function(key) {
                if (key !== 'Place') {
                    output.year[y].region[i].data?.push({
                        crime: key.replace(/\<.*\>/g, '').trim(),
                        value: Number(row[key]),
                    });
                }
            });
        }
    }
    await translateCountryCrimes(output, 'de', 'en');
    mergeLocations(output, ['Wr. Neustadt', 'Korneuburg', 'Krems/Donau', 'St. Pölten'], 'region', 'Niederösterreich');
    mergeLocations(output, ['Linz', 'Ried/Innkreis', 'Steyr', 'Wels'], 'region', 'Oberösterreich');
    mergeLocations(output, ['Graz', 'Leoben'], 'region', 'Steiermark');
    rename(output, 'region', dicts.austriaRenamingRegions);
    addNUTSCodes(output, 'AT');
    return output;
}

async function getCzechData(filename: string[]): Promise<Country> {
    const groupby = 'crimetype';
    const crimetypes = await axios.get('https://mapakriminality.cz/api/crimetypes');

    const areas = await axios.get('https://mapakriminality.cz/api/areas');

    const crimeCodes = [];
    const crimeData: {
        [key: string]: string;
    } = {};

    for (const crime of crimetypes.data.crimes) {
        crimeCodes.push(crime.Code);
        crimeData[crime.Code] = crime.Name_en;
    }

    const areaCodes = [];
    const areaData = [];
    for (const area of areas.data.areas) {
        areaCodes.push(area.Code);
        areaData.push({ code: area.Code, name: area.Name, level: Number(area.AreaLevel) });
    }

    const output: Country = { country: 'Czech Republic', year: [], NUTS: [NUTS.NUTS3, NUTS.LAU, NUTS.LAU] };
    for (let y = 0; y <= new Date().getFullYear() - 2013; y++) {
        let noData = false;
        output.year.push({ year: String(y + 2013), region: [], data: [] });
        const timefrom = '1-' + String(y + 2013);
        const timeto = '12-' + String(y + 2013);
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
                    '&timefrom=' +
                    timefrom +
                    '&timeto=' +
                    timeto +
                    '&groupby=' +
                    groupby,
            );
            if (data.data.crimes.length == 0) {
                noData = true;
                break;
            }
            switch (area.level) {
                case 0:
                    for (const crime of data.data.crimes) {
                        output.year[y].data?.push({ crime: crimeData[crime.CrimeType], value: Number(crime.Found) });
                    }
                    break;
                case 1:
                    regions[area.code] = regIndex;
                    output.year[y].region.push({
                        region: area.name.substr(area.name.indexOf(' ') + 1),
                        province: [],
                        data: [],
                    });
                    for (const crime of data.data.crimes) {
                        output.year[y].region[regIndex].data?.push({
                            crime: crimeData[crime.CrimeType],
                            value: Number(crime.Found),
                        });
                    }
                    regIndex++;
                    break;
                default:
                    break;
            }
        }
        if (noData) {
            continue;
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
                    '&timefrom=' +
                    timefrom +
                    '&timeto=' +
                    timeto +
                    '&groupby=' +
                    groupby,
            );
            const region = area.code.substring(0, area.code.length - 2) + '00';
            regIndex = regions[region];

            output.year[y].region[regIndex].province.push({
                province: area.name.substr(area.name.indexOf(' ') + 1),
                county: [],
                data: [],
            });
            provIndex = output.year[y].region[regIndex].province.length - 1;
            provinces[area.code] = provIndex;
            for (const crime of data.data.crimes) {
                output.year[y].region[regIndex].province[provIndex].data?.push({
                    crime: crimeData[crime.CrimeType],
                    value: Number(crime.Found),
                });
            }
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
                    '&timefrom=' +
                    timefrom +
                    '&timeto=' +
                    timeto +
                    '&groupby=' +
                    groupby,
            );

            const region = area.code.substring(0, area.code.length - 4) + '00';
            regIndex = regions[region];

            const province = area.code.substring(0, area.code.length - 2);
            provIndex = provinces[province];

            output.year[y].region[regIndex].province[provIndex].county.push({
                county: area.name.substr(area.name.indexOf(' ') + 1),
                data: [],
            });
            countIndex = output.year[y].region[regIndex].province[provIndex].county.length - 1;
            for (const crime of data.data.crimes) {
                output.year[y].region[regIndex].province[provIndex].county[countIndex].data.push({
                    crime: crimeData[crime.CrimeType],
                    value: Number(crime.Found),
                });
            }
        }

        console.log('counties done');
        await sleep(30000);
    }

    for (const year of output.year) {
        for (const region of year.region) {
            region.province = region.province.filter((x: Province) => x.county.length > 0);
        }
    }
    rename(output, 'region', dicts.czechRenamingRegions);
    addNUTSCodes(output, 'CZ');
    /*fs.writeFile('data/source_files/test3n.txt', JSON.stringify(output), function(err) {
        if (err) {
            console.log(err);
        }
    });*/
    return output;
}

async function parseCSVSpain(filename: string[]): Promise<Country> {
    const output: Country = { country: 'Spain', year: [], NUTS: [NUTS.NUTS2, NUTS.NUTS3] };
    for (let y = 0; y < filename.length / 2; y++) {
        output.year.push({ year: String(2011 + y), region: [], data: [] });
        let text = fs.readFileSync(sourcePath + 'spain/' + filename[y * 2], 'utf-8');
        let records = parse(text, {
            from_line: 8,
            relax_column_count: true,
        });

        for (let i = 0; i < records.length - 45; i += 45) {
            //console.log(records[i][0]);
            if (i !== 0) {
                output.year[y].region.push({ region: records[i][0], province: [], data: [] });
            }
            for (let j = i + 1; j < i + 45; j++) {
                const lastRegion = output.year[y].region.length - 1;
                if (i === 0) {
                    output.year[y].data?.push({
                        crime: records[j][0].replace(/[0-9]*(\.[0-9])*\.-*/g, '').trim(),
                        value: Number(records[j][1]),
                    });
                } else {
                    output.year[y].region[lastRegion].data?.push({
                        crime: records[j][0].replace(/[0-9]*(\.[0-9])*\.-*/g, '').trim(),
                        value: Number(records[j][1]),
                    });
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

        text = fs.readFileSync(sourcePath + 'spain/' + filename[y * 2 + 1], 'utf-8');
        records = parse(text, {
            from_line: 8,
            relax_column_count: true,
        });

        for (let i = 0; i < records.length - 45; i += 45) {
            if (records[i][0] === 'Total Nacional') {
                continue;
            }
            const regIndex = output.year[y].region.findIndex(item => item.region === provMap[records[i][0]]);
            output.year[y].region[regIndex].province.push({
                province: records[i][0],
                county: [],
                data: [],
            });
            for (let j = i + 1; j < i + 45; j++) {
                const lastProvince = output.year[y].region[regIndex].province.length - 1;
                output.year[y].region[regIndex].province[lastProvince].data?.push({
                    crime: records[j][0].replace(/[0-9]*(\.[0-9])*\.-*/g, '').trim(),
                    value: Number(records[j][1]),
                });
            }
        }
    }
    await translateCountryCrimes(output, 'es', 'en');
    rename(output, 'region', dicts.spainRenamingRegions);
    rename(output, 'province', dicts.spainRenamingProvinces);
    addNUTSCodes(output, 'ES');
    return output;
}

function parseXLSItaly(filename: string[]): Country {
    const output: Country = { country: 'Italy', year: [], NUTS: [NUTS.NUTS2, NUTS.NUTS3, NUTS.LAU] };
    for (let y = 0; y < filename.length; y++) {
        output.year.push({ year: String(2017 + y), region: [], data: [] });
        let records = excelToJson({
            sourceFile: sourcePath + 'italy/' + filename[y],
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
        let trent = true;
        let aosta = true;
        for (const row of records) {
            if (row.Place.includes('Data extracted on')) {
                continue;
            } else if (row.Place === 'Italy') {
                Object.keys(row).forEach(function(key) {
                    if (key != 'Place') {
                        output.year[y].data?.push({ crime: key, value: Number(row[key]) });
                    }
                });
            } else if (macroRegions.includes(row.Place)) {
                continue;
            } else if (regions.includes(row.Place) || (row.Place === "Valle d'Aosta / Vallée d'Aoste" && aosta)) {
                /*if (
                    row.Place === "Valle d'Aosta / Vallée d'Aoste" &&
                    output.year[y].region[regIndex].region === "Valle d'Aosta / Vallée d'Aoste"
                ) {
                    continue;
                }*/
                if (row.Place === "Valle d'Aosta / Vallée d'Aoste" && aosta) {
                    aosta = false;
                }
                output.year[y].region.push({ region: row.Place, province: [], data: [] });
                regIndex = output.year[y].region.length - 1;
                Object.keys(row).forEach(function(key) {
                    if (key != 'Place') {
                        output.year[y].region[regIndex].data?.push({ crime: key, value: Number(row[key]) });
                    }
                });
                provIndex = -1;
            } else if (isProvince) {
                output.year[y].region[regIndex].province.push({ province: row.Place, county: [], data: [] });
                provIndex = output.year[y].region[regIndex].province.length - 1;
                Object.keys(row).forEach(function(key) {
                    if (key != 'Place') {
                        output.year[y].region[regIndex].province[provIndex].data?.push({
                            crime: key,
                            value: Number(row[key]),
                        });
                    }
                });
                isProvince = false;
                /*if (row.Place == 'Aosta') {
                    isProvince = true;
                } else {
                    isProvince = false;
                }*/
            } else {
                if (row.Place === 'Bolzano / Bozen' || (row.Place === 'Trento' && trent)) {
                    if (row.Place === 'Trento' && trent) {
                        trent = false;
                    }
                    continue;
                }
                output.year[y].region[regIndex].province[provIndex].county.push({ county: row.Place, data: [] });
                Object.keys(row).forEach(function(key) {
                    if (key != 'Place') {
                        output.year[y].region[regIndex].province[provIndex].county[0].data.push({
                            crime: key,
                            value: Number(row[key]),
                        });
                    }
                });
                isProvince = true;
            }
        }
    }
    rename(output, 'region', dicts.italyRenamingRegions);
    rename(output, 'province', dicts.italyRenamingProvinces);
    addNUTSCodes(output, 'IT');
    return output;
}

async function parseCSVNetherlands(filename: string[]): Promise<Country> {
    const folder = 'data/source_files/netherlands/';
    const regionsAndTotal = folder + filename[0];
    const provinces = folder + filename[1];
    const output: Country = { country: 'Netherlands', year: [], NUTS: [NUTS.NUTS2, NUTS.LAU] };
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
        output.year.push({ year: year.replace('*', ''), region: [], data: [] });
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
                        crime: crimes[j].replace(/[0-9]*(\.[0-9])*(\.-)*/g, '').trim(),
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

    //regions
    //i = 0 -> place, each group of k years is the j-th crime
    for (let i = 0; i < records.length - 1; i++) {
        for (let k = 0; k < years.length; k++) {
            output.year[k].region.push({ region: records[i][0].replace('(PV)', '').trim(), province: [], data: [] });
        }
        const regIndex = output.year[0].region.length - 1;
        for (let j = 0; j < crimes.length; j++) {
            for (let k = 0; k < years.length; k++) {
                output.year[k].region[regIndex].data?.push({
                    crime: crimes[j].replace(/[0-9]*(\.[0-9])*(\.-)*/g, '').trim(),
                    value: Number(records[i][j * years.length + k + 1]),
                });
            }
        }
    }

    const provMap: {
        [key: string]: Array<string>;
    } = {
        Groningen: [folder + filename[2]],
        Friesland: [folder + filename[3]],
        Drenthe: [folder + filename[4]],
        Overijssel: [folder + filename[5]],
        Flevoland: [folder + filename[6]],
        Gelderland: [folder + filename[7], folder + filename[8]],
        Utrecht: [folder + filename[9]],
        'Noord-Holland': [folder + filename[10], folder + filename[11]],
        'Zuid-Holland': [folder + filename[12], folder + filename[13]],
        Zeeland: [folder + filename[14]],
        'Noord-Brabant': [folder + filename[15], folder + filename[16]],
        Limburg: [folder + filename[17]],
        'Niet in te delen': [folder + filename[18]],
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
                //console.log(records[i][0]);

                for (let k = 0; k < years.length; k++) {
                    output.year[k].region[regIndex].province.push({
                        province: records[i][0],
                        county: [],
                        data: [],
                    });
                }
                const provIndex = output.year[0].region[regIndex].province.length - 1;
                for (let j = 0; j < crimes.length; j++) {
                    for (let k = 0; k < years.length; k++) {
                        output.year[k].region[regIndex].province[provIndex].data?.push({
                            crime: crimes[j].replace(/[0-9]*(\.[0-9])*(\.-)*/g, '').trim(),
                            value: Number(records[i][j * years.length + k + 1]),
                        });
                    }
                }
            }
        }
    });

    await translateCountryCrimes(output, 'nl', 'en');
    rename(output, 'region', dicts.netherlandRenamingRegions);
    rename(output, 'province', dicts.netherlandsRenamingProvinces);
    addNUTSCodes(output, 'NL');
    return output;
}

function parseXLSNorthernIreland(filename: string[]): Country {
    const output: Country = { country: 'Northern Ireland', year: [], NUTS: [NUTS.LAU] };
    let records = excelToJson({
        sourceFile: sourcePath + 'northern-ireland/' + filename[0],
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
        const crime = row.Offence.replace(
            /[0-9]$|[0-9][0-9]$|[0-9]\,([0-9]*\,*)*$|[0-9][0-9]\,([0-9]*\,*)*$|^[0-9]+[A-Z]*(\.[0-9]+)*/g,
            '',
        ).trim();
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
        sourceFile: sourcePath + 'northern-ireland/' + filename[1],
        header: {
            rows: 5,
        },
        columnToKey: {
            A: 'Place',
            B: '{{B5}}',
            C: '{{C5}}',
        },
        range: 'A6:C20',
    });

    records = records['Table 2 & Figure 6'];
    const subregions = ['North1', 'South1', 'West1', 'East1'];
    for (const row of records) {
        Object.keys(row).forEach(function(key) {
            if (key !== 'Place') {
                const year = '20' + key.substring(4, 6) + '/' + key.substring(11, 13);
                const index = output.year.map(x => x.year).indexOf(year);
                if (row.Place === 'Belfast City') {
                    output.year[index].region.push({
                        region: row.Place,
                        province: [],
                        data: [{ crime: 'Total', value: Number(row[key]) }],
                    });
                } else if (subregions.includes(row.Place)) {
                    const year = '20' + key.substring(4, 6) + '/' + key.substring(11, 13);
                    const index = output.year.map(x => x.year).indexOf(year);
                    const regIndex = output.year[index].region.map(x => x.region).indexOf('Belfast City');
                    output.year[index].region[regIndex].province.push({
                        province: row.Place.slice(0, -1),
                        county: [],
                        data: [{ crime: 'Total', value: Number(row[key]) }],
                    });
                } else {
                    const year = '20' + key.substring(4, 6) + '/' + key.substring(11, 13);
                    const index = output.year.map(x => x.year).indexOf(year);
                    output.year[index].region.push({
                        region: row.Place,
                        province: [],
                        data: [{ crime: 'Total', value: Number(row[key]) }],
                    });
                }
            }
        });
    }
    rename(output, 'region', dicts.nirelandRenamingRegions);
    addNUTSCodes(output, 'UK');
    return output;
}

async function parseCSVBelgium(filename: string[]): Promise<Country> {
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
    const output: Country = { country: 'Belgium', year: [], NUTS: [NUTS.NUTS1, NUTS.NUTS2, NUTS.LAU] };
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
                                province: [],
                                data: [{ crime: crimes[crimIndex], value: Number(row[key]) }],
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
                            output.year[yearIndex].region[regIndex].data?.push({
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
    await translateCountryCrimes(output, 'nl', 'en');
    rename(output, 'region', dicts.belgiumRenamingRegions);
    rename(output, 'province', dicts.belgiumRenamingProvinces);
    addNUTSCodes(output, 'BE');
    return output;
}

//ordine cronologico
function parseXLSEngland(filename: string[]): Country {
    const output: Country = { country: 'England', year: [], NUTS: [NUTS.NUTS1, NUTS.NUTS2] };
    let i = 0;
    for (const file of filename) {
        let records = excelToJson({
            sourceFile: sourcePath + 'england/' + file,
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
        output.year.push({ year: String(2015 + i) + '/' + String(2016 + i), region: [], data: [] });
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
                    region: row['Area Name'].replace(/\s*[0-9](,[0-9])*/g, ''),
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
                    county: [],
                    data: [],
                });
                provIndex = output.year[i].region[regIndex].province.length - 1;
                Object.keys(row).forEach(function(key) {
                    if (key !== 'Area Name' && key !== 'Area Code') {
                        output.year[i].region[regIndex].province[provIndex].data?.push({
                            crime: key.replace(/\s*[0-9],*[0-9]*/g, ''),
                            value: Number(row[key]),
                        });
                    }
                });
            }
        }
        i++;
    }
    mergeLocations(output, ['Cleveland', 'Durham'], 'province', 'Northumberland and Tyne and Wear');
    mergeLocations(output, ['Derbyshire', 'Nottinghamshire'], 'province', 'Derbyshire and Nottinghamshire');
    mergeLocations(
        output,
        ['Leicestershire', 'Northamptonshire'],
        'province',
        'Leicestershire, Rutland and Northamptonshire',
    );
    mergeLocations(output, ['Bedfordshire', 'Hertfordshire'], 'province', 'Bedfordshire and Hertfordshire');
    mergeLocations(output, ['Cambridgeshire', 'Suffolk', 'Norfolk'], 'province', 'East Anglia');
    mergeLocations(output, ['Surrey', 'Sussex'], 'province', 'Surrey, East and West Sussex');
    mergeLocations(output, ['Avon and Somerset', 'Dorset'], 'province', 'Dorset and Somerset');
    mergeLocations(
        output,
        ['Gloucestershire', 'Wiltshire'],
        'province',
        'Gloucestershire, Wiltshire and Bristol/Bath area',
    );
    rename(output, 'region', dicts.englandRenamingRegions);
    rename(output, 'province', dicts.englandRenamingProvinces);
    addNUTSCodes(output, 'UK');
    return output;
}

//come sopra
function parseXLSWales(filename: string[]): Country {
    const output: Country = { country: 'Wales', year: [], NUTS: [] };
    let i = 0;
    for (const file of filename) {
        let records = excelToJson({
            sourceFile: sourcePath + 'england/' + file,
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
        output.year.push({ year: String(2015 + i) + '/' + String(2016 + i), region: [], data: [] });
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
            }
        }
        i++;
    }
    return output;
}

async function parseXLSFrance(filename: string[]): Promise<Country> {
    const output: Country = { country: 'France', year: [], NUTS: [NUTS.LAU] };
    const records = excelToJson({
        sourceFile: sourcePath + 'france/' + filename[0],
        range: 'B2:NL109',
    });

    for (let y = 0; y <= new Date().getFullYear() - 2012; y++) {
        const _records = records['Services GN ' + String(2012 + y)];
        console.log(y);
        if (_records === undefined) {
            continue;
        }
        //console.log(_records[1]);
        output.year.push({ year: String(2012 + y), region: [], data: [] });
        Object.keys(_records[0]).forEach(function(key) {
            if (key !== 'B') {
                const county = _records[0][key].replace('CGD ', '').replace(/\(...\)/, '');
                output.year[y].region.push({ region: county, province: [], data: [] });
            }
        });

        const counties = _records[0];
        _records.shift();

        for (const row of _records) {
            let crime = '';
            Object.keys(row).forEach(function(key) {
                if (key === 'B') {
                    crime = row[key];
                } else {
                    const countyName = counties[key].replace('CGD ', '').replace(/\(...\)/, '');
                    const countIndex = output.year[y].region.map(x => x.region).indexOf(countyName);
                    output.year[y].region[countIndex].data.push({
                        crime: crime,
                        value: Number(row[key]),
                    });
                }
            });
        }
    }
    await translateCountryCrimes(output, 'fr', 'en');
    mergeLocations(output, ['TOULOUSE MIRAIL', 'TOULOUSE ST MICHEL'], 'region', 'Toulouse');
    rename(output, 'region', dicts.franceRenamingRegions);
    addNUTSCodes(output, 'FR');
    return output;
}

// ordine cronologico
async function parseXLSGermany(filename: string[]): Promise<Country> {
    const output: Country = { country: 'Germany', year: [], NUTS: [NUTS.NUTS1, NUTS.NUTS3] };
    const text = fs.readFileSync('data/helper_files/germany/helper.csv', 'utf-8');
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

    for (let y = 0; y < filename.length / 2; y++) {
        console.log(y);
        output.year.push({ year: String(2016 + y), region: [], data: [] });
        Object.keys(regions).forEach(function(key) {
            output.year[y].region.push({ region: regions[key], province: [], data: [] });
        });

        let records: any;
        if (y === 0) {
            records = excelToJson({
                sourceFile: sourcePath + 'germany/' + filename[y * 2],
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
                sourceFile: sourcePath + 'germany/' + filename[y * 2],
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
                output.year[y].region[regIndex].data?.push({
                    crime: row.Crime.replace(/§.*/, '').trim(),
                    value: Number(row.Value),
                });
            } else {
                output.year[y].data?.push({ crime: row.Crime.replace(/§.*/, '').trim(), value: Number(row.Value) });
            }
        }

        records = excelToJson({
            sourceFile: sourcePath + 'germany/' + filename[y * 2 + 1],
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
        let usedNames: string[] = [];
        for (const row of records) {
            const index = helper.map((x: Record<string, string>) => x.District).indexOf(row.Place);
            if (index === -1) {
                continue;
            }
            const state = regions[helper[index].State];
            const regIndex = output.year[y].region.map(x => x.region).indexOf(state);
            if (firstPass) {
                let place: string = row.Place;
                if (usedNames.includes(place)) {
                    place = place + 2;
                } else {
                    usedNames.push(place);
                }
                output.year[y].region[regIndex].province.push({
                    province: place,
                    county: [],
                    data: [{ crime: row.Crime.replace(/§.*/, '').trim(), value: Number(row.Value) }],
                });
            } else {
                let place: string = row.Place;
                if (usedNames.includes(place)) {
                    place = place + 2;
                } else {
                    usedNames.push(place);
                }
                const provIndex = output.year[y].region[regIndex].province.map(x => x.province).indexOf(place);
                output.year[y].region[regIndex].province[provIndex].data?.push({
                    crime: row.Crime.replace(/§.*/, '').trim(),
                    value: Number(row.Value),
                });
            }

            if (row.Crime !== 'Straftaten insgesamt') {
                firstPass = false;
            }

            if (row.Place === 'Altenburger Land') {
                usedNames = [];
            }
        }
    }
    await translateCountryCrimes(output, 'de', 'en');
    rename(output, 'province', dicts.germanyRenamingProvinces);
    addNUTSCodes(output, 'DE');
    return output;
}

function parseXLSFinland(filename: string[]): Country {
    const folder = 'data/source_files/finland/';
    const output: Country = { country: 'Finland', year: [], NUTS: [NUTS.NUTS2, NUTS.NUTS3, NUTS.LAU] };
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

    for (let y = 0; y < filename.length / 2; y++) {
        console.log(y);
        let records = excelToJson({
            sourceFile: folder + filename[y * 2],
            columnToKey: {
                A: 'Crime',
                B: 'Place',
                C: 'Year',
                D: 'Value',
            },
            range: 'A5:D5431',
        });
        records = records['001_117t_2019m09'];
        output.year.push({ year: records[0].Year.replace('*', ''), region: [], data: [] });
        let firstPass = true;
        let crime = '';
        let regIndex = 0;
        for (const row of records) {
            if (row.hasOwnProperty('Crime')) {
                crime = row.Crime.replace(/[0-9]\S*|^[A-Z]\s|\(/g, '').trim();
                output.year[y].data?.push({ crime: crime, value: Number(row.Value) });
            } else if (row.Place === 'FI1 MANNER-SUOMI' || row.Place === 'FI2 ÅLAND' || row.Place === 'FI200 Åland') {
                continue;
            } else {
                if (firstPass) {
                    if (row.Place === 'FI20 Åland') {
                        output.year[y].region.push({
                            region: row.Place.substring(row.Place.indexOf(' ') + 1, row.Place.length),
                            province: [
                                {
                                    province: row.Place.substring(row.Place.indexOf(' ') + 1, row.Place.length),
                                    county: [],
                                    data: [{ crime: crime, value: Number(row.Value) }],
                                },
                            ],
                            data: [{ crime: crime, value: Number(row.Value) }],
                        });
                        firstPass = false;
                    } else if (row.Place.split(' ')[0].length === 4) {
                        output.year[y].region.push({
                            region: row.Place.substring(row.Place.indexOf(' ') + 1, row.Place.length),
                            province: [],
                            data: [{ crime: crime, value: Number(row.Value) }],
                        });
                    } else if (row.Place.split(' ')[0].length === 5) {
                        regIndex = output.year[y].region.length - 1;
                        output.year[y].region[regIndex].province.push({
                            province: row.Place.substring(row.Place.indexOf(' ') + 1, row.Place.length),
                            county: [],
                            data: [{ crime: crime, value: Number(row.Value) }],
                        });
                    }
                } else {
                    if (row.Place === 'FI20 Åland') {
                        regIndex = output.year[y].region
                            .map(x => x.region)
                            .indexOf(row.Place.substring(row.Place.indexOf(' ') + 1, row.Place.length));
                        output.year[y].region[regIndex].province[0].data?.push({
                            crime: crime,
                            value: Number(row.Value),
                        });
                        output.year[y].region[regIndex].data?.push({
                            crime: crime,
                            value: Number(row.Value),
                        });
                    } else if (row.Place.split(' ')[0].length === 4) {
                        regIndex = output.year[y].region
                            .map(x => x.region)
                            .indexOf(row.Place.substring(row.Place.indexOf(' ') + 1, row.Place.length));
                        output.year[y].region[regIndex].data?.push({ crime: crime, value: Number(row.Value) });
                    } else if (row.Place.split(' ')[0].length === 5) {
                        const provIndex = output.year[y].region[regIndex].province
                            .map(x => x.province)
                            .indexOf(row.Place.substring(row.Place.indexOf(' ') + 1, row.Place.length));
                        output.year[y].region[regIndex].province[provIndex].data?.push({
                            crime: crime,
                            value: Number(row.Value),
                        });
                    }
                }
            }
        }

        records = excelToJson({
            sourceFile: folder + filename[y * 2 + 1],
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
                crime = row.Crime.replace(/[0-9]\S*|^[A-Z]\s|\(/g, '').trim();
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

    for (let y = 2011; y < new Date().getFullYear(); y++) {
        const years = Array.from({ length: 12 }, (_, id) => y + 'M0' + (id + 1));
        mergeYears(output, years, String(y));
    }
    rename(output, 'county', dicts.finlandRenamingCounties);
    addNUTSCodes(output, 'FI');
    return output;
}

async function _getPolishData(year: number): Promise<Country> {
    const output: Country = { country: 'Poland', year: [], NUTS: [NUTS.NUTS2, NUTS.NUTS3] };
    const initial = year;
    for (let y = initial; y >= initial; y--) {
        let national = await getPolandData(y, 0);
        if (national['POLAND'] === undefined) {
            continue;
        }
        national = national['POLAND']['values'];
        output.year.push({ year: String(y), region: [], data: [] });
        Object.keys(national).forEach(function(key) {
            output.year[initial - y].data?.push({ crime: key, value: Number(national[key]) });
        });

        const regional = await getPolandData(y, 3);
        const regMap: {
            [key: string]: string;
        } = {};
        Object.keys(regional).forEach(function(key) {
            output.year[initial - y].region.push({ region: key.substr(key.indexOf(' ') + 1), province: [], data: [] });
            regMap[regional[key]['id']] = key.substr(key.indexOf(' ') + 1);
            Object.keys(regional[key]['values']).forEach(function(key2) {
                const regIndex = output.year[initial - y].region.length - 1;
                output.year[initial - y].region[regIndex].data?.push({
                    crime: key2,
                    value: Number(regional[key]['values'][key2]),
                });
            });
        });

        const provincial = await getPolandData(y, 4);
        const provMap: {
            [key: string]: string;
        } = {};
        Object.keys(provincial).forEach(function(key) {
            const region = regMap[provincial[key]['parentId']];
            const regIndex = output.year[initial - y].region.map(x => x.region).indexOf(region);
            output.year[initial - y].region[regIndex].province.push({
                province: key.substr(key.indexOf(' ') + 1),
                county: [],
                data: [],
            });
            provMap[provincial[key]['id']] = key.substr(key.indexOf(' ') + 1);
            Object.keys(provincial[key]['values']).forEach(function(key2) {
                const provIndex = output.year[initial - y].region[regIndex].province.length - 1;
                output.year[initial - y].region[regIndex].province[provIndex].data?.push({
                    crime: key2,
                    value: Number(provincial[key]['values'][key2]),
                });
            });
        });
    }

    //up to 4
    /**
     * 0 - Polish level -> total
1 - Macro-regions level
2 - Voivedships level -> region?
3 - Regions level ->region?
4 - Subregions level -> provinces
5 - Counties level -> counties
6 - Municipalities level
7 - Statistical towns level*/
    console.log('done');

    return output;
}

async function getPolishData(filename: string[]): Promise<Country> {
    console.log('starting');
    const output: Country = { country: 'Poland', year: [], NUTS: [NUTS.NUTS2, NUTS.NUTS3] };
    for (let y = 2018; y <= new Date().getFullYear(); y++) {
        console.log(y);
        const tmp = await _getPolishData(y);
        if (tmp.year.length !== 0) {
            output.year.push(tmp.year[0]);
        }
        await sleep(30000);
    }

    /*fs.writeFile('data/source_files/test2.txt', JSON.stringify(output), function(err) {
        if (err) {
            console.log(err);
        }
    });*/
    console.log('ended');
    rename(output, 'province', dicts.polandRenamingProvinces);
    addNUTSCodes(output, 'PL');
    //console.log(output);
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
    'czech-republic': getCzechData,
    spain: parseCSVSpain,
    italy: parseXLSItaly,
    netherlands: parseCSVNetherlands,
    'northern-ireland': parseXLSNorthernIreland,
    belgium: parseCSVBelgium,
    england: parseXLSEngland,
    wales: parseXLSWales,
    france: parseXLSFrance,
    germany: parseXLSGermany,
    finland: parseXLSFinland,
    poland: getPolishData,
};

const countryNUTS: Record<string, string> = {
    luxembourg: 'LU',
    cyprus: 'CY',
    hungary: 'HU',
    bulgaria: 'BG',
    portugal: 'PT',
    denmark: 'DK',
    austria: 'AT',
    'czech-republic': 'CZ',
    spain: 'ES',
    italy: 'IT',
    netherlands: 'NL',
    'northern-ireland': 'UKN',
    belgium: 'BE',
    england: 'UK',
    wales: 'UKL',
    france: 'FR',
    germany: 'DE',
    finland: 'FI',
    poland: 'PL',
};

const countrySources: Record<string, Array<string>> = {
    luxembourg: fs
        .readdirSync('data/source_files/luxembourg/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    cyprus: fs
        .readdirSync('data/source_files/cyprus/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    hungary: fs
        .readdirSync('data/source_files/hungary/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    bulgaria: fs
        .readdirSync('data/source_files/bulgaria/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    denmark: fs
        .readdirSync('data/source_files/denmark/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    portugal: fs
        .readdirSync('data/source_files/portugal/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    austria: fs
        .readdirSync('data/source_files/austria/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    'czech-republic': [''],
    spain: fs
        .readdirSync('data/source_files/spain/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    italy: fs
        .readdirSync('data/source_files/italy/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    netherlands: fs
        .readdirSync('data/source_files/netherlands/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    'northern-ireland': fs
        .readdirSync('data/source_files/northern-ireland/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    belgium: fs
        .readdirSync('data/source_files/belgium/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    england: fs
        .readdirSync('data/source_files/england/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    wales: fs
        .readdirSync('data/source_files/england/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    france: fs
        .readdirSync('data/source_files/france/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    germany: fs
        .readdirSync('data/source_files/germany/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    finland: fs
        .readdirSync('data/source_files/finland/')
        .sort((x, y) => Number(x.match(/\d/g)!.join('')) - Number(y.match(/\d/g)!.join(''))),
    poland: [''],
};

////////////////////////////////////////////
///////////PUBLIC FUNCTIONS////////////////
/**
 * Returns the JSON with ICCS categories of the specified country with source of the specified extension (eg. .csv, .xls, .xlsx)
 */
export async function getData(country: string): Promise<Country> {
    const data = await countryFunctions[country](countrySources[country]);
    NaNtoZero(data);
    if (fs.existsSync('data/matching/' + country + '/' + country + '-matching.txt')) {
        mapCategories(data, country, false);
    }
    return data;
}

export async function getFlattenedData(source: Country): Promise<CountryDB>{
    return flatten(source, countryNUTS[source.country.toLowerCase()]);
}

export async function getCrimeCategories(country: string): Promise<string> {
    const source = await getData(country); ////CHANGE THIS TO USE DB
    const crimes = [];
    if (source.year[0].data.length !== 0) {
        for (const crime of source.year[0].data) {
            crimes.push(crime.crime);
        }
    } else if (source.year[0].region.length !== 0 && source.year[0].region[0].data.length !== 0) {
        for (const crime of source.year[0].region[0].data) {
            crimes.push(crime.crime);
        }
    } else if (
        source.year[0].region[0].province.length !== 0 &&
        source.year[0].region[0].province[0].data.length !== 0
    ) {
        for (const crime of source.year[0].region[0].province[0].data) {
            crimes.push(crime.crime);
        }
    } else if (
        source.year[0].region[0].province[0].county.length !== 0 &&
        source.year[0].region[0].province[0].county[0].data.length !== 0
    ) {
        for (const crime of source.year[0].region[0].province[0].county[0].data) {
            crimes.push(crime.crime);
        }
    }

    return JSON.stringify(crimes);
}
