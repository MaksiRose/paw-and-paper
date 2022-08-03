import Model from './constructor';
import { commonPlantsInfo, Dens, materialsInfo, ProxyListType, rarePlantsInfo, Schema, ServerSchema, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '../typedef';

const denType: Schema<Dens>[keyof Dens] = {
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
				default: Object.fromEntries(Object.keys(commonPlantsInfo).map(k => [k, { type: 'number', default: 0, locked: false }]).sort()) as Record<keyof typeof commonPlantsInfo, Schema<Record<keyof typeof commonPlantsInfo, number>>[keyof typeof commonPlantsInfo]>,
				locked: false,
			},
			uncommonPlants: {
				type: 'object',
				default: Object.fromEntries(Object.keys(uncommonPlantsInfo).map(k => [k, { type: 'number', default: 0, locked: false }]).sort()) as Record<keyof typeof uncommonPlantsInfo, Schema<Record<keyof typeof uncommonPlantsInfo, number>>[keyof typeof uncommonPlantsInfo]>,
				locked: false,
			},
			rarePlants: {
				type: 'object',
				default: Object.fromEntries(Object.keys(rarePlantsInfo).map(k => [k, { type: 'number', default: 0, locked: false }]).sort()) as Record<keyof typeof rarePlantsInfo, Schema<Record<keyof typeof rarePlantsInfo, number>>[keyof typeof rarePlantsInfo]>,
				locked: false,
			},
			specialPlants: {
				type: 'object',
				default: Object.fromEntries(Object.keys(specialPlantsInfo).map(k => [k, { type: 'number', default: 0, locked: false }]).sort()) as Record<keyof typeof specialPlantsInfo, Schema<Record<keyof typeof specialPlantsInfo, number>>[keyof typeof specialPlantsInfo]>,
				locked: false,
			},
			meat: {
				type: 'object',
				default: Object.fromEntries(Object.keys(speciesInfo).map(k => [k, { type: 'number', default: 0, locked: false }]).sort()) as Record<keyof typeof speciesInfo, Schema<Record<keyof typeof speciesInfo, number>>[keyof typeof speciesInfo]>,
				locked: false,
			},
			materials: {
				type: 'object',
				default: Object.fromEntries(Object.keys(materialsInfo).map(k => [k, { type: 'number', default: 0, locked: false }]).sort()) as Record<keyof typeof materialsInfo, Schema<Record<keyof typeof materialsInfo, number>>[keyof typeof materialsInfo]>,
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
	uuid: { type: 'string', default: '', locked: true },
});
export default serverModel;