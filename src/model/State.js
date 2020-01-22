const mongoose = require('mongoose');

const StateSchema = new mongoose.Schema({
    CountryNUTS: String,
    year: [
        {
            year: String,
            place: [
                {
                    name: String,
                    data: [
                        {
                            ICCS_code: String,
                            ICCS_crime: String,
                            crime: String,
                            value: Number,
                        },
                    ],
                    NUTS: String,
                },
            ],
        },
    ],
});

module.exports = mongoose.model('State', StateSchema);
