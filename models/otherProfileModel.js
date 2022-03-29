const modelConstructor = require('./modelConstructor');
const model = new modelConstructor.model('./database/profiles/inactiveProfiles');
module.exports = model;