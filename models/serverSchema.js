const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
	serverId: { type: String, require: true, unique: true },
	name: { type: String },
	commonPlantsArray: [{ type: Number, default: 0 }],
	uncommonPlantsArray: [{ type: Number, default: 0 }],
	rarePlantsArray: [{ type: Number, default: 0 }],
	meatArray: [{ type: Number, default: 0 }],
	accountsToDelete: {
		type: Map,
		of: Number,
	},
});

const model2 = mongoose.model('serverModel', serverSchema);

module.exports = model2;