/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {
  development: {
    client: "sqlite3",
    connection: {
      filename: "./var/db/vol.db",
    },
    useNullAsDefault: true,
    migrations: {
      directory: "./migrations",
    },
  },

  production: {
    client: "sqlite3",
    connection: {
      filename: "./var/db/vol.db",
    },
    useNullAsDefault: true,
    migrations: {
      directory: "./migrations",
    },
  },
};
