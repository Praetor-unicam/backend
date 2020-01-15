import download from 'download';
import * as fs from 'fs';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const removeFile = promisify(fs.unlink);

const downloadDir = String(process.env.DATA_DOWNLOAD_DIR);
const country = 'Cyprus';
const destinationFolder = downloadDir + '/' + country;

const seriousDataFile =
    'http://www.police.gov.cy/police/police.nsf/All/8AB8D4666DFF37CAC22584730032377E/$file/Serious%20first%20half%202019.xls';
const minorDataFile =
    'http://www.police.gov.cy/police/police.nsf/All/D8A3F948C28378AAC225847300326129/$file/minor%20first%20half%202019.xls';

const seriousFileName = 'SeriousCrimes.xlsx';
const minorFileName = 'MinorCrimes.xlsx';

const downloadBothFiles = async (customDestination?: string, removeFiles = false) => {
    const destination = customDestination || destinationFolder;

    await mkdir(destination, { recursive: true });
    await download(seriousDataFile, destination, { filename: seriousFileName });
    await download(minorDataFile, destination, { filename: minorFileName });

    if (removeFiles) {
        await removeFile(destination + '/' + seriousFileName);
        await removeFile(destination + '/' + minorFileName);
    }
};

const dummyDownload = async () => await downloadBothFiles('.', true);

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
        await downloadBothFiles();
    } catch (err) {
        return false;
    }

    return true;
};
