import fs = require('fs');
import parse = require('csv-parse/lib/sync');
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
}

interface Country {
    country: string;
    year: Array<Year>;
}

///////// COUNTRY LOADING FUNCTIONS /////////////////
/**
 * Returns JSON from luxembourg's CSV file
 */
export function parseCSVLuxembourg(filename: string[]): Country {
    console.log(filename[0])
    let text = fs.readFileSync(filename[0], 'utf-8');
    const output: Country = { country: 'Luxembourg', year: [] };

    text = text.replace('Year', 'Qualification');

    const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        skip_lines_with_error: true,
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
                            province: [
                                { province: 'Luxembourg', data: [{ crime: row.Qualification, value: row[key] }] },
                            ],
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

    return output;
}

export function parseXLSCyprus(filename: string[]): Country {
    console.log(filename[0])
    const output: Country = {country: 'Cyprus', year: [{year: 2019, region: []}]}
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
    const records = seriousCrimes["Serious crime"].concat(minorCrimes["Minor per off"]);
    let firstPass = true;
    for(const row of records){
        let i = 0;
        let crime: string = "";
        Object.keys(row).forEach(function(key) {           
            if(key == 'Offences'){
                crime = row[key];
                //console.log(crime);
            }else if(key=='TOTAL'){
                
            }else if(firstPass){
                output.year[0].region.push({region: key, province: [{province: key, data: [{crime: crime, value: row[key]}]}]});
            }else{
                output.year[0].region[i-1].province[0].data.push({crime: crime, value: row[key]});
            }
            i = i + 1;
        });
        firstPass = false;
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
};

const countrySources: Record<string, Array<string>> = {
    luxembourg: ['data/source_files/luxembourg/luxembourg.csv'],
    cyprus: ['data/source_files/cyprus/cyprus_1.xls', 'data/source_files/cyprus/cyprus_2.xls'],
}
////////////////////////////////////////////

//////// GENERAL USE FUNCTIONS /////////////
/**
 * Returns the input JSON with the corresponding ICCS entries
 */
export function mapCategories(source: Country, country: string): Country {
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
    }

    return source;
}

/**
 * Returns the JSON with ICCS categories of the specified country with source of the specified extension (eg. .csv, .xls, .xlsx)
 */
export function getData(country: string): Country {
    const data = countryFunctions[country](countrySources[country]);
    const JSONData = mapCategories(data, country);
    return JSONData;
}
///////////////////////////////////////////////////////////
