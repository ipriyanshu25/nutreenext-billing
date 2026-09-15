const fs = require('fs');
const path = require('path');
const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'nutreenext.sqlite');
for (const suffix of ['', '-shm', '-wal']) {
  const p = dbPath + suffix;
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
console.log(`Database reset: ${dbPath}`);
console.log('Start the app again; tables and the NutreeNext menu seed will be recreated automatically.');
