const modelConstructor = require('./modelConstructor');
const model = new modelConstructor.model('./database/profiles');
module.exports = model;