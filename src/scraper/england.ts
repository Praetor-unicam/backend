import download from 'download';
import * as fs from 'fs';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const removeFile = promisify(fs.unlink);

const country = 'England';
const downloadDir = String(process.env.DATA_DOWNLOAD_DIR);

const destinationFolder = downloadDir + '/' + country;

const downloadUrls: any = {
    2019: 'https://www.ons.gov.uk/file?uri=%2fpeoplepopulationandcommunity%2fcrimeandjustice%2fdatasets%2fpoliceforceareadatatables%2fyearendingjune2019/policeforceareatablesyearendingjune2019.xlsx',
    2018: 'https://www.ons.gov.uk/file?uri=%2fpeoplepopulationandcommunity%2fcrimeandjustice%2fdatasets%2fpoliceforceareadatatables%2fyearendingjune2018/policeforceareadatatablesyearendingjune2018corrected.xlsx',
    2017: 'https://www.ons.gov.uk/file?uri=%2fpeoplepopulationandcommunity%2fcrimeandjustice%2fdatasets%2fpoliceforceareadatatables%2fyearendingjune2017/policeforceareatablesyearendingjune2017correction.xls',
    2016: 'https://www.ons.gov.uk/file?uri=%2fpeoplepopulationandcommunity%2fcrimeandjustice%2fdatasets%2fpoliceforceareadatatables%2fyearendingjune2016/policeforceareatablesyearendingjun16.xls',
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
