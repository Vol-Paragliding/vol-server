require("dotenv").config();

module.exports = {
  development: {
    client: "sqlite3",
    connection: {
      filename: process.env.DEV_DATABASE_URL,
    },
    useNullAsDefault: true,
    migrations: {
      directory: "./migrations",
    },
  },

  production: {
    client: "sqlite3",
    connection: {
      filename: process.env.PROD_DATABASE_URL,
    },
    useNullAsDefault: true,
    migrations: {
      directory: "./migrations",
    },
  },
};
