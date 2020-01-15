import * as mongoose from 'mongoose';
import { CrimeSchema } from './Crime';
import { CountrySchema } from './Country';

const ProvinceSchema = new mongoose.Schema({
    province: String,
    country: [CountrySchema],
    data: [CrimeSchema],
});

export { ProvinceSchema };
