import download from 'download';
import * as fs from 'fs';

const country = 'Bulgary';
const filename = country + '.xlsx';

const expectedFilename = 'JST_1.2_en.xls';

const startUrl = 'https://www.nsi.bg/sites/default/files/files/data/timeseries/' + expectedFilename;
const downloadDir = String(process.env.DATA_DOWNLOAD_DIR);

export const isServiceAvailable = async (): Promise<boolean> => {
    try {
        await download(startUrl);
    } catch (err) {
        return false;
    }

    return true;
};

export const downloadData = async (): Promise<boolean> => {
    try {
        await download(startUrl, downloadDir);
        fs.writeFileSync(downloadDir + '/' + filename, await download(startUrl));
        fs.unlinkSync(downloadDir + '/' + expectedFilename);
    } catch (err) {
        return false;
    }

    return true;
};
