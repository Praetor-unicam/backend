import fs = require('fs');
import parse = require('csv-parse/lib/sync');

///////// COUNTRY LOADING FUNCTIONS /////////////////
/**
 * Returns JSON from luxembourg's CSV file
 */
function parseCSVLuxembourg(filename: string): Array<any> {
    let text = fs.readFileSync(filename, 'utf-8');

    text = text.replace('Year', 'Qualification');

    const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        skip_lines_with_error: true,
        cast: function(value, context) {
            return value.trim();
        },
    });

    return records;
}

function parseXLSCyprus(filename: string): Array<any> {
    return []
}
///////////////////////////////////////////////////////

//////// DICTIONARY OF FUNCTIONS ////////////
/**
 * Contains all the country specific parsers
 */
const countryFunctions: Record<string, Function> = {
    luxembourg: parseCSVLuxembourg,
    cyprus: parseXLSCyprus
};
////////////////////////////////////////////

//////// GENERAL USE FUNCTIONS /////////////
/**
 * Returns the input JSON with the corresponding ICCS entries
 */
function mapCategories(source: Array<any>, country: string): Array<any> {
    const matching = fs.readFileSync('data/matching/' + country + '/' + country + '-matching.txt', 'utf-8');
    const matchingJSON = JSON.parse(matching);
    let index = source.length - 1;
    while (index >= 0) {
        const category = source[index].Qualification;

        if (category in matchingJSON) {
            source[index].Qualification = matchingJSON[category];
        } else {
            source.splice(index, 1);
        }

        index -= 1;
    }

    return source;
}

/**
 * Returns the JSON with ICCS categories of the specified country with source of the specified extension (eg. .csv, .xls, .xlsx)
 */
export function getData(country: string, extension: string): Array<any> {
    const data = countryFunctions[country]('data/source_files/' + country + '/' + country + extension);
    const JSONData = mapCategories(data, country);
    return JSONData;
}
///////////////////////////////////////////////////////////
