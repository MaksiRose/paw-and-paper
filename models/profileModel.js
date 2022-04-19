// @ts-check
const { schema, model } = require('./constructor');
const config = require('../config.json');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');

const profileSchema = new schema({
	userId: { type: ['string'], locked: true },
	serverId: { type: ['string'], locked: true },
	name: { type: ['string'] },
	description: { type: ['string'] },
	color: { type: ['string'], default: config.default_color },
	species: { type: ['string'] },
	rank: { type: ['string'], default: 'Youngling' },
	avatarURL: { type: ['string'] },
	levels: { type: ['number'], default: 1 },
	experience: { type: ['number'] },
	health: { type: ['number'], default: 100 },
	energy: { type: ['number'], default: 100 },
	hunger: { type: ['number'], default: 100 },
	thirst: { type: ['number'], default: 100 },
	maxHealth: { type: ['number'], default: 100 },
	maxEnergy: { type: ['number'], default: 100 },
	maxHunger: { type: ['number'], default: 100 },
	maxThirst: { type: ['number'], default: 100 },
	isResting: { type: ['boolean'] },
	hasCooldown: { type: ['boolean'] },
	hasQuest: { type: ['boolean'] },
	currentRegion: { type: ['string'], default: 'sleeping dens' },
	unlockedRanks: { type: ['number'] },
	saplingObject: { type: ['object', ['any']], default: { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null, reminder: false, lastMessageChannelId: '0' } },
	pronounSets: { type: ['array', ['array', ['string']]], default: [['they', 'them', 'their', 'theirs', 'themselves', 'plural']] },
	injuryObject: { type: ['object', ['any']], default: { wounds: 0, infections: 0, cold: false, sprains: 0, poison: false } },
	inventoryObject: { type: ['object', ['object', ['number']]], default: {
		commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, 0])),
		uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, 0])),
		rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, 0])),
		meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
	} },
	advice: { type: ['object', ['boolean']], default: { resting: false, drinking: false, eating: false, passingout: false, coloredbuttons: false } },
	roles: { type: ['array', ['object', ['string', 'number']]] },
});

module.exports.profileModel = new model('./database/profiles', profileSchema);
module.exports.otherProfileModel = new model('./database/profiles/inactiveProfiles', profileSchema);