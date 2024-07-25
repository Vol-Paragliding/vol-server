exports.up = function (knex) {
  return knex.schema.hasTable("users").then(function (exists) {
    if (exists) {
      return knex.schema.table("users", function (table) {
        table.string("new_column");
      });
    }
  });
};

exports.down = function (knex) {
  return knex.schema.hasTable("users").then(function (exists) {
    if (exists) {
      return knex.schema.table("users", function (table) {
        table.dropColumn("new_column");
      });
    }
  });
};
