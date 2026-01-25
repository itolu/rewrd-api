import swaggerJsdoc from "swagger-jsdoc";
import { env } from "../config/env";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Rewrd API",
            version: "1.0.0",
            description: "API Documentation for Rewrd Loyalty Platform",
            contact: {
                name: "Rewrd Engineering",
                url: "https://rewrd.co",
            },
        },
        servers: [
            {
                url: `http://localhost:${env.PORT}/v1`,
                description: "Development Server",
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT", // or just opaque token
                    description: "Enter your API Key (e.g. sk_test_...)",
                },
            },
        },
        security: [
            {
                BearerAuth: [],
            },
        ],
    },
    apis: ["./src/routes/*.ts"], // Path to the API docs
};

export const specs = swaggerJsdoc(options);
