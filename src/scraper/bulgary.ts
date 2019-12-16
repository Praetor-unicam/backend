import download from 'download';
import * as fs from 'fs';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const removeFile = promisify(fs.unlink);

const country = 'Bulgary';
const filename = country + '.xlsx';
const downloadDir = String(process.env.DATA_DOWNLOAD_DIR);

const destinationFolder = downloadDir + '/' + country;

const downloadUrl = 'https://www.nsi.bg/sites/default/files/files/data/timeseries/JST_1.2_en.xls';

const downloadFile = async (customDestination?: string, removeFiles = false) => {
    const destination = customDestination || destinationFolder;

    await mkdir(destination, { recursive: true });
    await download(downloadUrl, destination, { filename });

    if (removeFiles) {
        await removeFile(destination + '/' + filename);
    }
};

const dummyDownload = async () => await downloadFile('.', true);

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
        await downloadFile();
    } catch (err) {
        return false;
    }

    return true;
};
