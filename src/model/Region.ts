import * as mongoose from 'mongoose';
import { CrimeSchema } from './Crime';
import { ProvinceSchema } from './Province';

const RegionSchema = new mongoose.Schema({
    region: String,
    province: [ProvinceSchema],
    data: [CrimeSchema],
});

export { RegionSchema };
