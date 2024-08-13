const { Pool } = require("pg");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";
const connectionString = isProduction
  ? process.env.PROD_DATABASE_URL
  : process.env.DEV_DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

const createTable = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    userId TEXT,
    username TEXT UNIQUE NOT NULL,
    hashed_password BYTEA NULL,
    salt BYTEA NULL,
    email TEXT,
    googleId TEXT UNIQUE,
    name TEXT,
    profile JSONB
  );
  `;
  try {
    await pool.query(queryText);
    console.log("Users table created or already exists.");
  } catch (err) {
    console.error(`Error creating users table: ${err.message}`);
  }
};

const initializeDatabase = async () => {
  await createTable();
};

initializeDatabase().catch((err) => {
  console.error(`Database initialization failed: ${err.message}`);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
