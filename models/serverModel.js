// @ts-check
const { schema, model } = require('./constructor');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');

const serverSchema = new schema({
	serverId: {
		type: 'string',
		locked: true,
	},
	name: {
		type: 'string',
	},
	inventory: {
		type: 'object',
		default: {
			commonPlants: {
				type: 'object',
				default: Object.fromEntries(
					[...commonPlantsMap.keys()].sort().map(key => {
						return [key, { type: 'number', default: 0 }];
					}),
				),
			},
			uncommonPlants: {
				type: 'object',
				default: Object.fromEntries(
					[...uncommonPlantsMap.keys()].sort().map(key => {
						return [key, { type: 'number', default: 0 }];
					}),
				),
			},
			rarePlants: {
				type: 'object',
				default: Object.fromEntries(
					[...rarePlantsMap.keys()].sort().map(key => {
						return [key, { type: 'number', default: 0 }];
					}),
				),
			},
			meat: {
				type: 'object',
				default: Object.fromEntries(
					[...speciesMap.keys()].sort().map(key => {
						return [key, { type: 'number', default: 0 }];
					}),
				),
			},
		} },
	blockedEntrance: {
		type: 'object',
		default: {
			den: {
				type: 'string',
				default: null,
			},
			blockedKind: {
				type: 'string',
				default: null,
			},
		},
	},
	nextPossibleAttack: {
		type: 'number',
		default: Date.now(),
	},
	visitChannelId: {
		type: 'string',
		default: null,
	},
	currentlyVisiting: {
		type: 'string',
		default: null,
	},
	shop: {
		type: 'array',
		default: {
			type: 'object',
			default: {
				roleId: { type: 'string' },
				wayOfEarning: { type: 'string' },
				requirement: { type: 'any' },
			},
		},
	},
	proxysetting: {
		type: 'object',
		default: {
			all: {
				type: 'array',
				default: { type: 'string' },
			},
			auto: {
				type: 'array',
				default: { type: 'string' },
			},
		},
	},
});

module.exports = new model('./database/servers', serverSchema);