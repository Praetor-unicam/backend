const mongoose = require('mongoose');

const CountrydataSchema = new mongoose.Schema({
    country: String,
    year: [
        {
            year: Number,
            region: [
                {
                    region: String,
                    province: [
                        {
                            province: String,
                            data: [
                                {
                                    crime: String,
                                    value: Number,
                                    code: Number,
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
});

module.exports = mongoose.model('State', CountrydataSchema);
