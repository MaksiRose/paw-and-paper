// @ts-check
import Model from './constructor';
import { commonPlantsInfo, materialsInfo, ProxyConfigType, ProxyListType, RankType, rarePlantsInfo, Schema, specialPlantsInfo, speciesInfo, uncommonPlantsInfo, UserSchema } from '../typedef';
const config = require('../../config.json');
const pkg = require('../../package.json');

const userModel = new Model<UserSchema>('./database/profiles', {
	userId: {
		type: 'array',
		of: {
			type: 'string',
			default: '',
			locked: true,
		},
		locked: false,
	},
	advice: {
		type: 'object',
		default: {
			resting: { type: 'boolean', default: false, locked: false },
			drinking: { type: 'boolean', default: false, locked: false },
			eating: { type: 'boolean', default: false, locked: false },
			passingout: { type: 'boolean', default: false, locked: false },
			coloredbuttons: { type: 'boolean', default: false, locked: false },
		},
		locked: false,
	},
	settings: {
		type: 'object',
		default: {
			reminders: {
				type: 'object',
				default: {
					water: { type: 'boolean', default: true, locked: false },
					resting: { type: 'boolean', default: true, locked: false },
				},
				locked: false,
			},
		},
		locked: false,
	},
	quids: {
		type: 'map',
		of: {
			type: 'object',
			default: {
				_id: { type: 'string', default: '', locked: true },
				name: { type: 'string', default: '', locked: false },
				species: { type: 'string', default: '', locked: false },
				displayedSpecies: { type: 'string', default: '', locked: false },
				description: { type: 'string', default: '', locked: false },
				avatarURL: { type: 'string', default: '', locked: false },
				pronounSets: {
					type: 'array',
					of: {
						type: 'array',
						of: { type: 'string', default: '', locked: false },
						locked: false,
					},
					locked: false,
				},
				proxy: {
					type: 'object',
					default: {
						startsWith: { type: 'string', default: '', locked: false },
						endsWith: { type: 'string', default: '', locked: false },
					},
					locked: false,
				},
				color: { type: 'string', default: config.default_color, locked: false },
				mentions: {
					type: 'map',
					of: {
						type: 'array',
						of: { type: 'number', default: 0, locked: false },
						locked: false,
					},
					locked: false,
				},
				profiles: {
					type: 'map',
					of: {
						type: 'object',
						default: {
							serverId: { type: 'string', default: '', locked: true },
							rank: { type: 'string', default: RankType.Youngling, locked: false },
							levels: { type: 'number', default: 1, locked: false },
							experience: { type: 'number', default: 0, locked: false },
							health: { type: 'number', default: 100, locked: false },
							energy: { type: 'number', default: 100, locked: false },
							hunger: { type: 'number', default: 100, locked: false },
							thirst: { type: 'number', default: 100, locked: false },
							maxHealth: { type: 'number', default: 100, locked: false },
							maxEnergy: { type: 'number', default: 100, locked: false },
							maxHunger: { type: 'number', default: 100, locked: false },
							maxThirst: { type: 'number', default: 100, locked: false },
							temporaryStatIncrease: {
								type: 'map',
								of: { type: 'string', default: '', locked: false },
								locked: false,
							},
							isResting: { type: 'boolean', default: false, locked: false },
							hasQuest: { type: 'boolean', default: false, locked: false },
							currentRegion: { type: 'string', default: 'sleeping dens', locked: false },
							unlockedRanks: { type: 'number', default: 0, locked: false },
							sapling: {
								type: 'object',
								default: {
									exists: { type: 'boolean', default: false, locked: false },
									health: { type: 'number', default: 50, locked: false },
									waterCycles: { type: 'number', default: 0, locked: false },
									nextWaterTimestamp: { type: 'number?', default: null, locked: false },
									lastMessageChannelId: { type: 'string?', default: null, locked: false },
									sentReminder: { type: 'boolean', default: false, locked: false },
									sentGentleReminder: { type: 'boolean', default: false, locked: false },
								},
								locked: false,
							},
							injuries: {
								type: 'object',
								default: {
									wounds: { type: 'number', default: 0, locked: false },
									infections: { type: 'number', default: 0, locked: false },
									cold: { type: 'boolean', default: false, locked: false },
									sprains: { type: 'number', default: 0, locked: false },
									poison: { type: 'boolean', default: false, locked: false },
								},
								locked: false,
							},
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
							roles: {
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
							skills: {
								type: 'object',
								default: {
									global: {
										type: 'map',
										of: { type: 'number', default: 0, locked: false },
										locked: false,
									},
									personal: {
										type: 'map',
										of: { type: 'number', default: 0, locked: false },
										locked: false,
									},
								},
								locked: false,
							},
						},
						locked: false,
					},
					locked: false,
				},
			},
			locked: false,
		},
		locked: false,
	},
	currentQuid: {
		type: 'map',
		of: { type: 'string', default: '', locked: false },
		locked: false,
	},
	serverProxySettings: {
		type: 'map',
		of: {
			type: 'object',
			default: {
				autoproxy: {
					type: 'object',
					default: {
						setTo: { type: 'number', default: ProxyConfigType.FollowGlobal, locked: false },
						channels: {
							type: 'object',
							default: {
								setTo: { type: 'number', default: ProxyListType.Whitelist, locked: false },
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
					},
					locked: false,
				},
				stickymode: { type: 'number', default: ProxyConfigType.FollowGlobal, locked: false },
			},
			locked: false,
		},
		locked: false,
	},
	globalProxySettings: {
		type: 'object',
		default: {
			autoproxy: { type: 'boolean', default: false, locked: false },
			stickymode: { type: 'boolean', default: false, locked: false },
		},
		locked: false,
	},
	lastPlayedVersion: { type: 'string', default: pkg.version, locked: false },
	uuid: { type: 'string', default: '', locked: true },
});
export default userModel;

