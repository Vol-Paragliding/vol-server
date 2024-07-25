exports.up = function (knex) {
  return knex.schema.hasTable("users").then(function (exists) {
    if (!exists) {
      return knex.schema.createTable("users", function (table) {
        table.string("id").primary();
        table.string("userId");
        table.string("username").unique().notNullable();
        table.binary("hashed_password");
        table.binary("salt");
        table.string("email");
        table.string("googleId").unique();
        table.string("name");
        table.text("profile");
      });
    }
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("users");
};
