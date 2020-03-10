import { DataCategory } from './DataCategory.interface';

export interface LocalizedData {
    country: string;
    location: string;
    year: string;
    data: Array<DataCategory>;
}
