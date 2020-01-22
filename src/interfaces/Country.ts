const mongoose = require('mongoose');
import { Document, Types } from 'mongoose';

export interface ICountry extends Document {
    CountryNUTS: String;
    year: [
        {
            year: String;
            place: [
                {
                    name: String;
                    data: [
                        {
                            ICCS_code: String;
                            ICCS_crime: String;
                            crime: String;
                            value: Number;
                        },
                    ];
                    NUTS: String;
                },
            ];
        },
    ];
}
