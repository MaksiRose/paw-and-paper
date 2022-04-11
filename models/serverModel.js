// @ts-check
const { schema, model } = require('./constructor');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');

const serverSchema = new schema({
	serverId: { type: ['string'], locked: true },
	name: { type: ['string'] },
	inventoryObject: { type: ['object', ['object', ['number']]], default: {
		commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, 0])),
		uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, 0])),
		rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, 0])),
		meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
	} },
	blockedEntranceObject: { type: ['object', ['any']], default: { den: null, blockedKind: null } },
	activeUsersArray: { type: ['array', ['string']] },
	nextPossibleAttack: { type: ['number'], default: Date.now() },
	visitChannelId: { type: ['any'] },
	currentlyVisiting: { type: ['any'] },
	shop: { type: ['array', ['object', ['string', 'number']]] },
});

module.exports = new model('./database/servers', serverSchema);