const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
	userId: { type: String, require: true, default: 0 },
	serverId: { type: String, require: true, default: 0 },
	name: { type: String, default: '' },
	description: { type: String, default: '' },
	color: { type: String, default: '#9d9e51' },
	species: { type: String, default: '' },
	rank: { type: String, default: 'Youngling' },
	avatarURL: { type: String, default: '' },
	levels: { type: Number, default: 1 },
	experience: { type: Number, default: 0 },
	health: { type: Number, default: 100 },
	energy: { type: Number, default: 100 },
	hunger: { type: Number, default: 100 },
	thirst: { type: Number, default: 100 },
	maxHealth: { type: Number, default: 100 },
	maxEnergy: { type: Number, default: 100 },
	maxHunger: { type: Number, default: 100 },
	maxThirst: { type: Number, default: 100 },
	isResting: { type: Boolean, default: false },
	hasCooldown: { type: Boolean, default: false },
	hasQuest: { type: Boolean, default: false },
	currentRegion: { type: String, default: 'sleeping dens' },
	unlockedRanks: { type: Number, default: 0 },
	pronounArray: { type: Array },
	injuryArray: [{ type: Number }],
	inventoryArray: [{ type: Array }],
	injuryObject: {
		wounds: { type: Number, default: 0 },
		infections: { type: Number, default: 0 },
		cold: { type: Boolean, default: false },
		sprains: { type: Number, default: 0 },
		poison: { type: Boolean, default: false },
	},
	inventoryObject: {
		commonPlants: { type: Map, of: Number },
		uncommonPlants: { type: Map, of: Number },
		rarePlants: { type: Map, of: Number },
		meat: { type: Map, of: Number },
	},
});

const model1 = mongoose.model('profileModel', profileSchema);

module.exports = model1;