export interface ServiceChecker {
    (): Promise<boolean>;
}

export interface FileDownloader {
    (): Promise<boolean>;
}

export interface DataApi {
    (...varargs: any): any;
}
