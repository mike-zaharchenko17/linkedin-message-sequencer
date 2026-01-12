import "dotenv/config"

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
}

export const DATABASE_URL = process.env.DATABASE_URL

// Verification key used to protect sensitive endpoints. Prefer setting
// VERIFICATION_KEY in your environment for production. Falls back to the
// interview/test key provided for convenience.
export const VERIFICATION_KEY = process.env.VERIFICATION_KEY