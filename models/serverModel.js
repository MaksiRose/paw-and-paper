const modelConstructor = require('./modelConstructor');
const model = new modelConstructor.model('./database/servers');
module.exports = model;