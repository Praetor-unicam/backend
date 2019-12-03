import download from 'download';

const country = 'Bulgary';

const startUrl = 'https://www.nsi.bg/sites/default/files/files/data/timeseries/JST_1.2_en.xls';
const downloadDir = String(process.env.DATA_DOWNLOAD_DIR);

export const isServiceAvailable = async (): Promise<boolean> => {
    return true;
};

export const downloadData = async (): Promise<void> => {
    await download(startUrl, downloadDir);
};

downloadData();
