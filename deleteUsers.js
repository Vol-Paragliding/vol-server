const db = require("./db");

db.serialize(() => {
  db.run("DELETE FROM users", (err) => {
    if (err) {
      console.error("Error deleting users:", err.message);
    } else {
      console.log("All users deleted successfully.");
    }
  });
});

db.close();
