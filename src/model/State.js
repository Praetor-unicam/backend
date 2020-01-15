const mongoose = require('mongoose');

const StateSchema = new mongoose.Schema({



    country: String,
    NUTS: [],
    year: [
        {
            year: Number,
            data: [],
            region: [
                {
                    region: String,
                    NUTS: String,
                    data: [
                        {
                            crime: String,
                            value: Number,
                        },
                    ],
                    province: [
                        {
                            province: String,
                            Nuts: String,
                            data: [
                                {
                                    crime: String,
                                    value: Number,
                                    // ICCS_code: String,
                                    // ICCS_crime: String,
                                },
                            ],
                            county: [
                                {
                                    county: String,
                                    Nuts: String,
                                    data: [
                                        {
                                            crime: String,
                                            value: Number,
                                            // ICCS_code: String,
                                            // ICCS_crime: String,
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
            data: [
                {
                    crime: String,
                    value: Number,
                },
            ],
        },
    ],
});

module.exports = mongoose.model('State', StateSchema);
