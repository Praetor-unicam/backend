import download from 'download';
import * as fs from 'fs';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const removeFile = promisify(fs.unlink);

const country = 'Germany';
const downloadDir = String(process.env.DATA_DOWNLOAD_DIR);

const destinationFolder = downloadDir + '/' + country;

const downloadUrls: any = {
    germany_1:
        'https://www.bka.de/SharedDocs/Downloads/DE/Publikationen/PolizeilicheKriminalstatistik/2018/BKATabellen/FaelleLaenderKreiseStaedte/BKA-LKS-F-01-T01-Laender_excel.xlsx?__blob=publicationFile&v=3',
    germany_2:
        'https://www.bka.de/SharedDocs/Downloads/DE/Publikationen/PolizeilicheKriminalstatistik/2018/BKATabellen/FaelleLaenderKreiseStaedte/BKA-LKS-F-03-T01-Kreise_excel.xlsx?__blob=publicationFile&v=3',
    germany_3:
        'https://www.bka.de/SharedDocs/Downloads/DE/Publikationen/PolizeilicheKriminalstatistik/2017/BKATabellen/FaelleLaenderKreiseStaedte/BKA-LKS-F-01-T01-Laender_excel.xlsx?__blob=publicationFile&v=3',
    germany_4:
        'https://www.bka.de/SharedDocs/Downloads/DE/Publikationen/PolizeilicheKriminalstatistik/2017/BKATabellen/FaelleLaenderKreiseStaedte/BKA-LKS-F-03-T01-Kreise_excel.xlsx?__blob=publicationFile&v=3',
    germany_5:
        'https://www.bka.de/SharedDocs/Downloads/DE/Publikationen/PolizeilicheKriminalstatistik/2016/BKATabellen/FaelleLaenderKreiseStaedte/BKA-LKS-F-01-T01-Laender_excel.xlsx?__blob=publicationFile&v=4',
    germany_6:
        'https://www.bka.de/SharedDocs/Downloads/DE/Publikationen/PolizeilicheKriminalstatistik/2016/BKATabellen/FaelleLaenderKreiseStaedte/BKA-LKS-F-03-T01-Kreise_excel.xlsx?__blob=publicationFile&v=5',
};

const downloadFiles = async (customDestination?: string, removeFiles = false) => {
    const destination = customDestination || destinationFolder;
    await mkdir(destination, { recursive: true });

    for (const file in downloadUrls) {
        const filename = file + '.xlsx';
        await download(downloadUrls[file], destination, { filename });
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
