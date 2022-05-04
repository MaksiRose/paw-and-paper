// @ts-check
const { schema, model } = require('./constructor');
const config = require('../config.json');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');

const profileSchema = new schema({
	userId: {
		type: 'string',
		locked: true,
	},
	advice: {
		type: 'object',
		default: {
			resting: {
				type: 'boolean',
				default: false,
			},
			drinking: {
				type: 'boolean',
				default: false,
			},
			eating: {
				type: 'boolean',
				default: false,
			},
			passingout: {
				type: 'boolean',
				default: false,
			},
			coloredbuttons: {
				type: 'boolean',
				default: false,
			},
		},
	},
	reminders: {
		type: 'object',
		default: {
			water: {
				type: 'boolean',
				default: true,
			},
			resting: {
				type: 'boolean',
				default: true,
			},
		},
	},
	characters: {
		type: 'nest',
		default: {
			type: 'object',
			default: {
				name: { type: 'string' },
				species: { type: 'string' },
				description: { type: 'string' },
				avatarURL: { type: 'string' },
				pronounSets: {
					type: 'array',
					default: {
						type: 'array',
						default: { type: 'string' },
					},
				},
				proxy: {
					type: 'object',
					default: {
						startsWith: { type: 'string' },
						endsWith: { type: 'string' },
					},
				},
				color: {
					type: 'string',
					default: config.default_color,
				},
				profiles: {
					type: 'nest',
					default: {
						type: 'object',
						default: {
							serverId: {
								type: 'string',
								locked: true,
							},
							rank: {
								type: 'string',
								default: 'Youngling',
							},
							levels: {
								type: 'number',
								default: 1,
							},
							experience: { type: 'number' },
							health: {
								type: 'number',
								default: 100,
							},
							energy: {
								type: 'number',
								default: 100,
							},
							hunger: {
								type: 'number',
								default: 100,
							},
							thirst: {
								type: 'number',
								default: 100,
							},
							maxHealth: {
								type: 'number',
								default: 100,
							},
							maxEnergy: {
								type: 'number',
								default: 100,
							},
							maxHunger: {
								type: 'number',
								default: 100,
							},
							maxThirst: {
								type: 'number',
								default: 100,
							},
							isResting: { type: 'boolean' },
							hasCooldown: { type: 'boolean' },
							hasQuest: { type: 'boolean' },
							currentRegion: {
								type: 'string',
								default: 'sleeping dens',
							},
							unlockedRanks: { type: 'number' },
							sapling: {
								type: 'object',
								default: {
									exists: { type: 'boolean' },
									health: {
										type: 'number',
										default: 50,
									},
									waterCycles: { type: 'number' },
									nextWaterTimestamp: {
										type: 'number',
										default: null,
									},
									lastMessageChannelId: {
										type: 'string',
										default: null,
									},
								},
							},
							injuries: {
								type: 'object',
								default: {
									wounds: { type: 'number' },
									infections: { type: 'number' },
									cold: { type: 'boolean' },
									sprains: { type: 'number' },
									poison: { type: 'boolean' },
								},
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
							roles: {
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
						},
					},
				} },
		},
	},
	currentCharacter: {
		type: 'nest',
		default: 'string',
	},
});

module.exports = new model('./database/profiles', profileSchema);