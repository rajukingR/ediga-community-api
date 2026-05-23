'use strict';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Sequelize from 'sequelize';
import config from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  dialect: dbConfig.dialect,
  logging: env === 'development' ? console.log : false
});

const db = {};

// Load models dynamically using an async function
const loadModels = async () => {
  const files = fs.readdirSync(__dirname).filter(file => file !== basename && file.endsWith('.js'));

  for (const file of files) {
    const modelModule = await import(`file://${path.join(__dirname, file)}`);
    const model = modelModule.default(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  }

  // Set up associations
  Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });
};

// Initialize models
await loadModels();

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;



























// 'use strict';

// import fs from 'fs';
// import path from 'path';
// import Sequelize from 'sequelize';
// import config from '../config/config.js';

// const basename = path.basename(__filename);
// const env = process.env.NODE_ENV || 'development';
// const dbConfig = config[env];

// const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
//   host: dbConfig.host,
//   dialect: dbConfig.dialect,
//   logging: env === 'development'
// });

// const db = {};

// // Load models synchronously
// const files = fs.readdirSync(__dirname).filter(file => file !== basename && file.endsWith('.js'));

// for (const file of files) {
//   const modelModule = await import(`./${file}`);
//   const model = modelModule.default(sequelize, Sequelize.DataTypes);
//   db[model.name] = model;
// }

// // Set up associations
// Object.keys(db).forEach(modelName => {
//   if (db[modelName].associate) {
//     db[modelName].associate(db);
//   }
// });

// db.sequelize = sequelize;
// db.Sequelize = Sequelize;

// export default db;
