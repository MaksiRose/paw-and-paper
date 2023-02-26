// import { Model } from 'hoatzin';
// import { commonPlantsInfo, materialsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '..';
// import { ServerSchema } from '../typings/data/server';
// import { ProxyListType } from '../typings/data/general';

// const denType = {
// 	type: 'object',
// 	default: {
// 		structure: { type: 'number', default: 100 },
// 		bedding: { type: 'number', default: 100 },
// 		thickness: { type: 'number', default: 100 },
// 		evenness: { type: 'number', default: 100 },
// 	},
// } as const;

// const serverModel = new Model<ServerSchema>('./database/servers', {
// 	serverId: { type: 'string', default: '', locked: true },
// 	name: { type: 'string', default: '' },
// 	inventory: {
// 		type: 'object',
// 		default: {
// 			commonPlants: {
// 				type: 'object',
// 				default: Object.fromEntries(Object.keys(commonPlantsInfo).map(k => [k, { type: 'number', default: 0 }]).sort()),
// 			},
// 			uncommonPlants: {
// 				type: 'object',
// 				default: Object.fromEntries(Object.keys(uncommonPlantsInfo).map(k => [k, { type: 'number', default: 0 }]).sort()),
// 			},
// 			rarePlants: {
// 				type: 'object',
// 				default: Object.fromEntries(Object.keys(rarePlantsInfo).map(k => [k, { type: 'number', default: 0 }]).sort()),
// 			},
// 			specialPlants: {
// 				type: 'object',
// 				default: Object.fromEntries(Object.keys(specialPlantsInfo).map(k => [k, { type: 'number', default: 0 }]).sort()),
// 			},
// 			meat: {
// 				type: 'object',
// 				default: Object.fromEntries(Object.keys(speciesInfo).map(k => [k, { type: 'number', default: 0 }]).sort()),
// 			},
// 			materials: {
// 				type: 'object',
// 				default: Object.fromEntries(Object.keys(materialsInfo).map(k => [k, { type: 'number', default: 0 }]).sort()),
// 			},
// 		},

// 	},
// 	dens: {
// 		type: 'object',
// 		default: {
// 			sleepingDens: denType,
// 			foodDen: denType,
// 			medicineDen: denType,
// 		},
// 	},
// 	nextPossibleAttack: { type: 'number', default: Date.now() },
// 	visitChannelId: { type: 'string?', default: null },
// 	currentlyVisiting: { type: 'string?', default: null },
// 	shop: {
// 		type: 'array',
// 		of: {
// 			type: 'object',
// 			default: {
// 				roleId: { type: 'string', default: '' },
// 				wayOfEarning: { type: 'string', default: '' },
// 				requirement: { type: 'string|number', default: '' },
// 			},
// 		},
// 	},
// 	proxySettings: {
// 		type: 'object',
// 		default: {
// 			channels: {
// 				type: 'object',
// 				default: {
// 					setTo: { type: 'number', default: ProxyListType.Blacklist },
// 					whitelist: {
// 						type: 'array',
// 						of: { type: 'string', default: '' },
// 					},
// 					blacklist: {
// 						type: 'array',
// 						of: { type: 'string', default: '' },
// 					},
// 				},
// 			},
// 			roles: {
// 				type: 'object',
// 				default: {
// 					setTo: { type: 'number', default: ProxyListType.Blacklist },
// 					whitelist: {
// 						type: 'array',
// 						of: { type: 'string', default: '' },
// 					},
// 					blacklist: {
// 						type: 'array',
// 						of: { type: 'string', default: '' },
// 					},
// 				},
// 			},
// 			tagRequired: { type: 'boolean', default: false },
// 			requiredInTag: {
// 				type: 'array',
// 				of: { type: 'string', default: '' },
// 			},
// 			tagInDisplayname: { type: 'boolean', default: false },
// 			logChannelId: { type: 'string?', default: null },
// 		},
// 	},
// 	skills: {
// 		type: 'array',
// 		of: { type: 'string', default: '' },
// 	},
// 	_id: { type: 'string', default: '', locked: true },
// }, true);
// export default serverModel;