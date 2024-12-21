const { Pool } = require("pg");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";
const connectionString = isProduction
  ? process.env.DATABASE_URL
  : process.env.DEV_DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

const createTables = async () => {
  const queries = [
    `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      userId TEXT,
      username TEXT UNIQUE NOT NULL,
      hashed_password TEXT NULL,
      salt TEXT NULL,
      email TEXT,
      googleId TEXT UNIQUE,
      name TEXT,
      profile JSONB
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    );
    `,
  ];

  for (const queryText of queries) {
    try {
      await pool.query(queryText);
      console.log("Table created or already exists.");
    } catch (err) {
      console.error(`Error creating table: ${err.message}`);
    }
  }
};

const initializeDatabase = async () => {
  await createTables();
};

initializeDatabase().catch((err) => {
  console.error(`Database initialization failed: ${err.message}`);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
