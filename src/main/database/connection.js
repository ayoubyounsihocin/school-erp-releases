import { Sequelize } from 'sequelize';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let dbPath;
try {
  const { app } = require('electron');
  dbPath = path.join(app.getPath('userData'), 'school_erp_database.sqlite');
} catch (e) {
  dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'school-erp', 'school_erp_database.sqlite');
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false, // Set to console.log if you want to see SQL queries in the console
});

export default sequelize;