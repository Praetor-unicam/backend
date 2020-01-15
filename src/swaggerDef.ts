import swaggerJSDoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.2',
        info: {
            title: 'PRAETOR API',
            version: '0.0.1',
        },
    },
    // Path to the API docs
    apis: ['./src/**/*.ts'],
};

// Initialize swagger-jsdoc -> returns validated swagger spec in json format
export const swaggerSpec = swaggerJSDoc(options);
