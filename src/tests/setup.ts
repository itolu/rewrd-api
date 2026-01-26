// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3000'; // Use a different port for testing if needed, though supertest usually doesn't need a port
process.env.LOG_LEVEL = 'error'; // Reduce noise during tests
