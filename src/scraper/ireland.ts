import download from 'download';
import * as fs from 'fs';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const removeFile = promisify(fs.unlink);

const country = 'Ireland';
const downloadDir = String(process.env.DATA_DOWNLOAD_DIR);

const destinationFolder = downloadDir + '/' + country;

const downloadUrls: any = {
    2019: 'https://www.psni.police.uk/globalassets/inside-the-psni/our-statistics/police-recorded-crime-statistics/2019/march/crime-tables-mar-_19.xls',
    other:
        'https://www.psni.police.uk/globalassets/inside-the-psni/our-statistics/police-recorded-crime-statistics/documents/police_recorded_crime_in_northern_ireland_1998-99_to_2018-19.xls',
};

const downloadFiles = async (customDestination?: string, removeFiles = false) => {
    const destination = customDestination || destinationFolder;
    await mkdir(destination, { recursive: true });

    for (const year in downloadUrls) {
        const filename = country + year + '.xlsx';
        await download(downloadUrls[year], destination, { filename });
        if (removeFiles) {
            await removeFile(destination + '/' + filename);
        }
    }
};

const downloadFile = async () => {
    for (const year in downloadUrls) {
        console.log(year);
    }
};

const dummyDownload = async () => await downloadFiles('.', true);

export const isServiceAvailable = async (): Promise<boolean> => {
    try {
        await dummyDownload();
    } catch (err) {
        return false;
    }

    return true;
};

export const downloadData = async (): Promise<boolean> => {
    try {
        await downloadFiles();
    } catch (err) {
        return false;
    }

    return true;
};
