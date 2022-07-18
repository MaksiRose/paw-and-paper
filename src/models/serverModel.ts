import Model from './constructor';
import { Dens, Schema, ServerSchema } from '../typedef';
import { commonPlantsMap, materialsMap, rarePlantsMap, specialPlantsMap, speciesMap, uncommonPlantsMap } from '../utils/itemsInfo';

const denType: Schema<Dens>['foodDen' | 'sleepingDens' | 'medicineDen'] = {
	type: 'object',
	default: {
		structure: { type: 'number', default: 100, locked: false },
		bedding: { type: 'number', default: 100, locked: false },
		thickness: { type: 'number', default: 100, locked: false },
		evenness: { type: 'number', default: 100, locked: false },
	},
	locked: false,
};

const serverModel = new Model<ServerSchema>('./database/servers', {
	serverId: { type: 'string', default: '', locked: true },
	name: { type: 'string', default: '', locked: false },
	inventory: {
		type: 'object',
		default: {
			commonPlants: {
				type: 'object',
				default: Object.fromEntries(
					[...commonPlantsMap.keys()].sort().map(key => {
						return [key, { type: 'number', default: 0, locked: false }];
					}),
				),
				locked: false,
			},
			uncommonPlants: {
				type: 'object',
				default: Object.fromEntries(
					[...uncommonPlantsMap.keys()].sort().map(key => {
						return [key, { type: 'number', default: 0, locked: false }];
					}),
				),
				locked: false,
			},
			rarePlants: {
				type: 'object',
				default: Object.fromEntries(
					[...rarePlantsMap.keys()].sort().map(key => {
						return [key, { type: 'number', default: 0, locked: false }];
					}),
				),
				locked: false,
			},
			specialPlants: {
				type: 'object',
				default: Object.fromEntries(
					[...specialPlantsMap.keys()].sort().map(key => {
						return [key, { type: 'number', default: 0, locked: false }];
					}),
				),
				locked: false,
			},
			meat: {
				type: 'object',
				default: Object.fromEntries(
					[...speciesMap.keys()].sort().map(key => {
						return [key, { type: 'number', default: 0, locked: false }];
					}),
				),
				locked: false,
			},
			materials: {
				type: 'object',
				default: Object.fromEntries(
					[...materialsMap.keys()].sort().map(key => {
						return [key, { type: 'number', default: 0, locked: false }];
					}),
				),
				locked: false,
			},
		},
		locked: false,
	},
	dens: {
		type: 'object',
		default: {
			sleepingDens: denType,
			foodDen: denType,
			medicineDen: denType,
		},
		locked: false,
	},
	nextPossibleAttack: { type: 'number', default: Date.now(), locked: false },
	visitChannelId: { type: 'string?', default: null, locked: false },
	currentlyVisiting: { type: 'string?', default: null, locked: false },
	shop: {
		type: 'array',
		of: {
			type: 'object',
			default: {
				roleId: { type: 'string', default: '', locked: false },
				wayOfEarning: { type: 'string', default: '', locked: false },
				requirement: { type: 'string|number', default: '', locked: false },
			},
			locked: false,
		},
		locked: false,
	},
	proxysetting: {
		type: 'object',
		default: {
			all: {
				type: 'array',
				of: { type: 'string', default: '', locked: false },
				locked: false,
			},
			auto: {
				type: 'array',
				of: { type: 'string', default: '', locked: false },
				locked: false,
			},
		},
		locked: false,
	},
	skills: {
		type: 'array',
		of: { type: 'string', default: '', locked: false },
		locked: false,
	},
	uuid: { type: 'string', default: '', locked: true },
});
export default serverModel;