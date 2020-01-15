import * as fs from 'fs';
import * as path from 'path';
import { json } from 'body-parser';
import { Translate } from './model/translate';

export function recFindByExt(base: any, ext: any, files: any, result: any) {
    files = files || fs.readdirSync(base);
    result = result || [];

    files.forEach(function(file: any) {
        var newbase = path.join(base, file);
        if (fs.statSync(newbase).isDirectory()) {
            result = recFindByExt(newbase, ext, fs.readdirSync(newbase), result);
        } else {
            if (file.substr(-1 * (ext.length + 1)) == '.' + ext) {
                result.push(newbase);
            }
        }
    });

    return result;
}

export function readjson(file: any): Translate {
    let json_file: any;
    let data = fs.readFileSync(file, 'utf8');
    json_file = JSON.parse(data);

    return json_file;
}
