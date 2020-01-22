import * as mongoose from 'mongoose';
import { CrimeSchema } from './Crime';
import { CountrySchema } from '../interfaces/Country';

const ProvinceSchema = new mongoose.Schema({
    province: String,
    country: [CountrySchema],
    data: [CrimeSchema],
});

export { ProvinceSchema };
