import { Model } from 'hoatzin';
import { commonPlantsInfo, materialsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '..';
import { ServerSchema } from '../typings/data/server';
import { ProxyListType } from '../typings/data/user';

const denType = {
	type: 'object',
	default: {
		structure: { type: 'number', default: 100, locked: false },
		bedding: { type: 'number', default: 100, locked: false },
		thickness: { type: 'number', default: 100, locked: false },
		evenness: { type: 'number', default: 100, locked: false },
	},
	locked: false,
} as const;

const serverModel = new Model<ServerSchema>('./database/servers', {
	serverId: { type: 'string', default: '', locked: true },
	name: { type: 'string', default: '', locked: false },
	inventory: {
		type: 'object',
		default: {
			commonPlants: {
				type: 'object',
				default: Object.fromEntries(Object.keys(commonPlantsInfo).map(k => [k, { type: 'number', default: 0, locked: false }]).sort()),
				locked: false,
			},
			uncommonPlants: {
				type: 'object',
				default: Object.fromEntries(Object.keys(uncommonPlantsInfo).map(k => [k, { type: 'number', default: 0, locked: false }]).sort()),
				locked: false,
			},
			rarePlants: {
				type: 'object',
				default: Object.fromEntries(Object.keys(rarePlantsInfo).map(k => [k, { type: 'number', default: 0, locked: false }]).sort()),
				locked: false,
			},
			specialPlants: {
				type: 'object',
				default: Object.fromEntries(Object.keys(specialPlantsInfo).map(k => [k, { type: 'number', default: 0, locked: false }]).sort()),
				locked: false,
			},
			meat: {
				type: 'object',
				default: Object.fromEntries(Object.keys(speciesInfo).map(k => [k, { type: 'number', default: 0, locked: false }]).sort()),
				locked: false,
			},
			materials: {
				type: 'object',
				default: Object.fromEntries(Object.keys(materialsInfo).map(k => [k, { type: 'number', default: 0, locked: false }]).sort()),
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
	proxySettings: {
		type: 'object',
		default: {
			channels: {
				type: 'object',
				default: {
					setTo: { type: 'number', default: ProxyListType.Blacklist, locked: false },
					whitelist: {
						type: 'array',
						of: { type: 'string', default: '', locked: false },
						locked: false,
					},
					blacklist: {
						type: 'array',
						of: { type: 'string', default: '', locked: false },
						locked: false,
					},
				},
				locked: false,
			},
			roles: {
				type: 'object',
				default: {
					setTo: { type: 'number', default: ProxyListType.Blacklist, locked: false },
					whitelist: {
						type: 'array',
						of: { type: 'string', default: '', locked: false },
						locked: false,
					},
					blacklist: {
						type: 'array',
						of: { type: 'string', default: '', locked: false },
						locked: false,
					},
				},
				locked: false,
			},
			tagRequired: { type: 'boolean', default: false, locked: false },
			requiredInTag: {
				type: 'array',
				of: { type: 'string', default: '', locked: false },
				locked: false,
			},
			tagInDisplayname: { type: 'boolean', default: false, locked: false },
			logChannelId: { type: 'string?', default: null, locked: false },
		},
		locked: false,
	},
	skills: {
		type: 'array',
		of: { type: 'string', default: '', locked: false },
		locked: false,
	},
	_id: { type: 'string', default: '', locked: true },
}, true);
export default serverModel;