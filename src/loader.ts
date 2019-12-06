import fs = require('fs');
import parse = require('csv-parse/lib/sync');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const excelToJson = require('convert-excel-to-json');

////////// INTERFACES ///////////

interface Crime {
    code?: string;
    crime: string;
    value: number;
}

interface Province {
    province: string;
    data: Array<Crime>;
}

interface Region {
    region: string;
    province: Array<Province>;
}

interface Year {
    year: number;
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
function coalesce(source: Country): Country {
    for (const year of source.year) {
        for (const region of year.region) {
            for (const province of region.province) {
                let index1 = province.data.length - 1;
                while (index1 >= 1) {
                    let index2 = index1 - 1;
                    if (isNaN(province.data[index1].value)) {
                        //convert invalid values to 0
                        province.data[index1].value = 0;
                    }
                    while (index2 >= 0) {
                        if (province.data[index2].code == province.data[index1].code) {
                            //console.log(province.province + province.data[index2].code);
                            province.data[index1].value += province.data[index2].value;
                            province.data[index2].value = NaN;
                            //console.log(province.data[index1].value);
                            //province.data.splice(index2, 1);
                        }
                        index2 -= 1;
                    }
                    index1 -= 1;
                }
            }
        }
        if (year.data) {
            let index1 = year.data.length - 1;
            while (index1 >= 1) {
                let index2 = index1 - 1;
                if (isNaN(year.data[index1].value)) {
                    //convert invalid values to 0
                    year.data[index1].value = 0;
                }
                while (index2 >= 0) {
                    if (year.data[index2].code == year.data[index1].code) {
                        //console.log(province.province + province.data[index2].code);
                        year.data[index1].value += year.data[index2].value;
                        year.data[index2].value = NaN;
                        //console.log(province.data[index1].value);
                        //province.data.splice(index2, 1);
                    }
                    index2 -= 1;
                }
                index1 -= 1;
            }
        }
    }

    for (const year of source.year) {
        for (const region of year.region) {
            for (const province of region.province) {
                let index1 = province.data.length - 1;
                while (index1 >= 0) {
                    if (isNaN(province.data[index1].value)) {
                        province.data.splice(index1, 1);
                    }
                    index1 -= 1;
                }
            }
        }
        if (year.data) {
            let index1 = year.data.length - 1;
            while (index1 >= 0) {
                if (isNaN(year.data[index1].value)) {
                    year.data.splice(index1, 1);
                }
                index1 -= 1;
            }
        }
    }

    return source;
}

//apply before mapping
function _manageSubcategory(source: Country, topCategory: string, subCategory: string): Country {
    for (const year of source.year) {
        for (const region of year.region) {
            for (const province of region.province) {
                const topcat = province.data.find(element => element.crime === topCategory);
                const subcat = province.data.find(element => element.crime === subCategory);
                if (topcat != undefined && subcat != undefined) {
                    topcat.value -= subcat.value;
                }
            }
        }
    }
    return source;
}

function manageSubcategories(source: Country, subcategories: Record<string, string>): Country {
    Object.entries(subcategories).forEach(([key, value]) => {
        source = _manageSubcategory(source, key, value);
    });
    return source;
}

//levels: region, province, all
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
        case 'all': {
            rename(source, 'region', substitutions);
            rename(source, 'province', substitutions);
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
function mapCategories(source: Country, country: string): Country {
    const matching = fs.readFileSync('data/matching/' + country + '/' + country + '-matching.txt', 'utf-8');
    const matchingJSON = JSON.parse(matching);

    for (const year of source.year) {
        for (const region of year.region) {
            for (const province of region.province) {
                let index = province.data.length - 1;
                while (index >= 0) {
                    const crime = province.data[index].crime;
                    if (crime in matchingJSON) {
                        province.data[index].code = matchingJSON[crime][0];
                        province.data[index].crime = matchingJSON[crime][1];
                    } else {
                        province.data.splice(index, 1);
                    }

                    index -= 1;
                }
            }
        }
        if (year.data) {
            let index = year.data.length - 1;
            while (index >= 0) {
                const crime = year.data[index].crime;
                if (crime in matchingJSON) {
                    year.data[index].code = matchingJSON[crime][0];
                    year.data[index].crime = matchingJSON[crime][1];
                } else {
                    year.data.splice(index, 1);
                }

                index -= 1;
            }
        }
    }

    return coalesce(source);
}

///////////////////////////////////////////////////////////

///////// COUNTRY LOADING FUNCTIONS /////////////////
/**
 * Returns JSON from luxembourg's CSV file
 */
function parseCSVLuxembourg(filename: string[]): Country {
    let text = fs.readFileSync(filename[0], 'utf-8');
    const output: Country = { country: 'Luxembourg', year: [] };

    text = text.replace('Year', 'Qualification');

    const records = parse(text, {
        columns: true,
        // eslint-disable-next-line @typescript-eslint/camelcase
        skip_empty_lines: true,
        // eslint-disable-next-line @typescript-eslint/camelcase
        skip_lines_with_error: true,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        cast: function(value, context) {
            return value.trim();
        },
    });

    let firstPass = true;
    for (const row of records) {
        //console.log(row);
        let i = 0;
        Object.keys(row).forEach(function(key) {
            if (!isNaN(Number(key)) && firstPass) {
                const yearTemp: Year = {
                    year: Number(key),
                    region: [
                        {
                            region: 'Luxembourg',
                            province: [{ province: 'Luxembourg', data: [] }],
                        },
                    ],
                };
                output.year.push(yearTemp);
            } else {
                if (!isNaN(Number(key))) {
                    //console.log(Number(key));
                    output.year[i].region[0].province[0].data.push({
                        crime: row.Qualification,
                        value: row[key],
                    });
                }
            }

            //console.table('Key : ' + key + ', Value : ' + row[key]);
            i = i + 1;
        });
        firstPass = false;
    }

    return manageSubcategories(output, {
        'Thefts including acts of violence': 'thereof: thefts of vehicules including acts of violence',
    });
}
//double category
function parseXLSCyprus(filename: string[]): Country {
    const output: Country = { country: 'Cyprus', year: [{ year: 2019, region: [], data: [] }] };
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
                //console.log(crime);
            } else if (key == 'TOTAL' && output.year[0].data) {
                output.year[0].data.push({ crime: crime, value: row[key] });
            } else if (firstPass) {
                output.year[0].region.push({
                    region: key,
                    province: [{ province: key, data: [{ crime: crime, value: row[key] }] }],
                });
            } else {
                output.year[0].region[i - 1].province[0].data.push({ crime: crime, value: row[key] });
            }
            i = i + 1;
        });
        firstPass = false;
    }
    return rename(output, 'all', { Limasol: 'Limassol', Ammochostos: 'Famagusta', Morfou: 'Kyrenia' });
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
        } else {
            if (row.Level.includes('capital') || row.Level.includes('county')) {
                Object.keys(row).forEach(function(key) {
                    if (!isNaN(Number(key)) && firstPassYears) {
                        const yearTemp: Year = {
                            year: Number(key),
                            region: [
                                {
                                    region: row.Crime_or_location,
                                    province: [
                                        {
                                            province: row.Crime_or_location,
                                            data: [{ crime: crime, value: row[key] }],
                                        },
                                    ],
                                },
                            ],
                            data: [],
                        };
                        output.year.push(yearTemp);
                    } else {
                        if (!isNaN(Number(key)) && firstPassRegions) {
                            output.year[i].region.push({
                                region: row.Crime_or_location,
                                province: [
                                    {
                                        province: row.Crime_or_location,
                                        data: [{ crime: crime, value: row[key] }],
                                    },
                                ],
                            });
                        } else if (!isNaN(Number(key))) {
                            output.year[i].region[j].province[0].data.push({ crime: crime, value: row[key] });
                        }
                    }
                    i = i + 1;
                });
                firstPassYears = false;
            } else {
                if (row.Level === 'country') {
                    Object.keys(row).forEach(function(key) {
                        if (!isNaN(Number(key)) && output.year[i].data) {
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            output.year[i].data!.push({ crime: crime, value: row[key] });
                            i = i + 1;
                        }
                    });
                }
                j--;
            }
            j = j + 1;
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
        output.year.push({ year: y, region: [], data: [] });
        for (let i = 0; i < current.length; i += 17) {
            const location = current[i].Crime_or_location;
            if (i != 0 && i != 17) {
                output.year[2018 - y].region.push({ region: location, province: [{ province: location, data: [] }] });
            }

            for (let j = i + 1; j < i + 17; j++) {
                if (i === 0) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    output.year[2018 - y].data!.push({ crime: current[j].Crime_or_location, value: current[j].Value });
                } else if (i === 17) {
                    continue;
                } else {
                    output.year[2018 - y].region[output.year[2018 - y].region.length - 1].province[0].data.push({
                        crime: current[j].Crime_or_location,
                        value: current[j].Value,
                    });
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
};

const countrySources: Record<string, Array<string>> = {
    luxembourg: ['data/source_files/luxembourg/luxembourg.csv'],
    cyprus: ['data/source_files/cyprus/cyprus_1.xls', 'data/source_files/cyprus/cyprus_2.xls'],
    hungary: ['data/source_files/hungary/hungary.xls'],
    bulgaria: ['data/source_files/bulgaria/bulgaria.xls'],
};
////////////////////////////////////////////
///////////PUBLIC FUNCTIONS////////////////
/**
 * Returns the JSON with ICCS categories of the specified country with source of the specified extension (eg. .csv, .xls, .xlsx)
 */
export function getData(country: string): Country {
    const data = countryFunctions[country](countrySources[country]);
    const JSONData = mapCategories(data, country);
    return JSONData;
}
