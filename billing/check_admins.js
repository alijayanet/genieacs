const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
const admins = db.prepare('SELECT * FROM admins').all();
console.log(JSON.stringify(admins, null, 2));
db.close();
