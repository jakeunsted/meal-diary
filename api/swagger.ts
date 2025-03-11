import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Meal Diary API',
      version: '1.0.0',
      description: 'API documentation for the Meal Diary application',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
  },
  apis: ['./routes/*.routes.ts'],
};

const specs = swaggerJsdoc(options);

export { specs, swaggerUi };
