// Loads .env so integration tests get DATABASE_URL (and other secrets) the
// same way prisma.config.ts does. Unit tests deliberately don't load this.
import "dotenv/config";
