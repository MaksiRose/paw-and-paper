// // @ts-check
// import { Collection } from 'discord.js';
// import { Model } from 'hoatzin';
// import { commonPlantsInfo, materialsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '..';
// import { AutoproxyConfigType, Quid, QuidSchema, RankType, StickymodeConfigType, UserData, UserSchema } from '../typings/data/user';
// import { getArrayElement } from '../utils/helperFunctions';
// import { getRandomNumber } from '../utils/randomizers';
// const config = require('../../config.json');
// const pkg = require('../../package.json');

// export const userModel = new Model<UserSchema>('./database/profiles', {
// 	userId: {
// 		type: 'array',
// 		of: {
// 			type: 'string',
// 			default: '',
// 			locked: true,
// 		},
// 	},
// 	userIds: {
// 		type: 'map',
// 		of: {
// 			type: 'map',
// 			of: {
// 				type: 'object',
// 				default: {
// 					isMember: { type: 'boolean', default: false },
// 					lastUpdatedTimestamp: { type: 'number', default: 0 },
// 				},
// 			},
// 		},
// 	},
// 	tag: {
// 		type: 'object',
// 		default: {
// 			global: { type: 'string', default: '', locked: true },
// 			servers: {
// 				type: 'map',
// 				of: { type: 'string', default: '' },
// 			},
// 		},
// 	},
// 	advice: {
// 		type: 'object',
// 		default: {
// 			resting: { type: 'boolean', default: false },
// 			drinking: { type: 'boolean', default: false },
// 			eating: { type: 'boolean', default: false },
// 			passingout: { type: 'boolean', default: false },
// 			coloredbuttons: { type: 'boolean', default: false },
// 			ginkgosapling: { type: 'boolean', default: false },
// 		},
// 	},
// 	settings: {
// 		type: 'object',
// 		default: {
// 			reminders: {
// 				type: 'object',
// 				default: {
// 					water: { type: 'boolean', default: true },
// 					resting: { type: 'boolean', default: true },
// 				},
// 			},
// 			proxy: {
// 				type: 'object',
// 				default: {
// 					global: {
// 						type: 'object',
// 						default: {
// 							autoproxy: { type: 'boolean', default: false },
// 							stickymode: { type: 'boolean', default: false },
// 						},
// 					},
// 					servers: {
// 						type: 'map',
// 						of: {
// 							type: 'object',
// 							default: {
// 								autoproxy: {
// 									type: 'object',
// 									default: {
// 										setTo: { type: 'number', default: AutoproxyConfigType.FollowGlobal },
// 										channels: {
// 											type: 'object',
// 											default: {
// 												whitelist: {
// 													type: 'array',
// 													of: { type: 'string', default: '' },
// 												},
// 												blacklist: {
// 													type: 'array',
// 													of: { type: 'string', default: '' },
// 												},
// 											},
// 										},
// 									},
// 								},
// 								stickymode: { type: 'number', default: StickymodeConfigType.FollowGlobal },
// 							},
// 						},
// 					},
// 				},
// 			},
// 			accessibility: {
// 				type: 'object',
// 				default: {
// 					replaceEmojis: { type: 'boolean', default: false },
// 				},
// 			},
// 		},
// 	},
// 	quids: {
// 		type: 'map',
// 		of: {
// 			type: 'object',
// 			default: {
// 				_id: { type: 'string', default: '', locked: true },
// 				name: { type: 'string', default: '' },
// 				nickname: {
// 					type: 'object',
// 					default: {
// 						global: { type: 'string', default: '', locked: true },
// 						servers: {
// 							type: 'map',
// 							of: { type: 'string', default: '' },
// 						},
// 					},
// 				},
// 				species: { type: 'string', default: '' },
// 				displayedSpecies: { type: 'string', default: '' },
// 				description: { type: 'string', default: '' },
// 				avatarURL: { type: 'string', default: '' },
// 				pronounSets: {
// 					type: 'array',
// 					of: {
// 						type: 'array',
// 						of: { type: 'string', default: '' },
// 					},
// 				},
// 				proxy: {
// 					type: 'object',
// 					default: {
// 						startsWith: { type: 'string', default: '' },
// 						endsWith: { type: 'string', default: '' },
// 					},
// 				},
// 				color: { type: 'string', default: config.default_color },
// 				mentions: {
// 					type: 'map',
// 					of: {
// 						type: 'array',
// 						of: { type: 'number', default: 0 },
// 					},
// 				},
// 				profiles: {
// 					type: 'map',
// 					of: {
// 						type: 'object',
// 						default: {
// 							serverId: { type: 'string', default: '', locked: true },
// 							rank: { type: 'string', default: RankType.Youngling },
// 							levels: { type: 'number', default: 1 },
// 							experience: { type: 'number', default: 0 },
// 							health: { type: 'number', default: 100 },
// 							energy: { type: 'number', default: 100 },
// 							hunger: { type: 'number', default: 100 },
// 							thirst: { type: 'number', default: 100 },
// 							maxHealth: { type: 'number', default: 100 },
// 							maxEnergy: { type: 'number', default: 100 },
// 							maxHunger: { type: 'number', default: 100 },
// 							maxThirst: { type: 'number', default: 100 },
// 							temporaryStatIncrease: {
// 								type: 'map',
// 								of: { type: 'string', default: '' },
// 							},
// 							isResting: { type: 'boolean', default: false },
// 							hasQuest: { type: 'boolean', default: false },
// 							currentRegion: { type: 'string', default: 'sleeping dens' },
// 							unlockedRanks: { type: 'number', default: 0 },
// 							tutorials: {
// 								type: 'object',
// 								default: {
// 									play: { type: 'boolean', default: false },
// 									explore: { type: 'boolean', default: false },
// 								},
// 							},
// 							sapling: {
// 								type: 'object',
// 								default: {
// 									exists: { type: 'boolean', default: false },
// 									health: { type: 'number', default: 50 },
// 									waterCycles: { type: 'number', default: 0 },
// 									nextWaterTimestamp: { type: 'number?', default: null },
// 									lastMessageChannelId: { type: 'string?', default: null },
// 									sentReminder: { type: 'boolean', default: false },
// 									sentGentleReminder: { type: 'boolean', default: false },
// 								},
// 							},
// 							injuries: {
// 								type: 'object',
// 								default: {
// 									wounds: { type: 'number', default: 0 },
// 									infections: { type: 'number', default: 0 },
// 									cold: { type: 'boolean', default: false },
// 									sprains: { type: 'number', default: 0 },
// 									poison: { type: 'boolean', default: false },
// 								},
// 							},
// 							inventory: {
// 								type: 'object',
// 								default: {
// 									commonPlants: {
// 										type: 'object',
// 										default: Object.fromEntries(Object.keys(commonPlantsInfo).map(k => [k, { type: 'number', default: 0 }]).sort()),
// 									},
// 									uncommonPlants: {
// 										type: 'object',
// 										default: Object.fromEntries(Object.keys(uncommonPlantsInfo).map(k => [k, { type: 'number', default: 0 }]).sort()),
// 									},
// 									rarePlants: {
// 										type: 'object',
// 										default: Object.fromEntries(Object.keys(rarePlantsInfo).map(k => [k, { type: 'number', default: 0 }]).sort()),
// 									},
// 									specialPlants: {
// 										type: 'object',
// 										default: Object.fromEntries(Object.keys(specialPlantsInfo).map(k => [k, { type: 'number', default: 0 }]).sort()),
// 									},
// 									meat: {
// 										type: 'object',
// 										default: Object.fromEntries(Object.keys(speciesInfo).map(k => [k, { type: 'number', default: 0 }]).sort()),
// 									},
// 									materials: {
// 										type: 'object',
// 										default: Object.fromEntries(Object.keys(materialsInfo).map(k => [k, { type: 'number', default: 0 }]).sort()),
// 									},
// 								},
// 							},
// 							roles: {
// 								type: 'array',
// 								of: {
// 									type: 'object',
// 									default: {
// 										roleId: { type: 'string', default: '' },
// 										wayOfEarning: { type: 'string', default: '' },
// 										requirement: { type: 'string|number', default: '' },
// 									},
// 								},
// 							},
// 							skills: {
// 								type: 'object',
// 								default: {
// 									global: {
// 										type: 'map',
// 										of: { type: 'number', default: 0 },
// 									},
// 									personal: {
// 										type: 'map',
// 										of: { type: 'number', default: 0 },
// 									},
// 								},
// 							},
// 							lastActiveTimestamp: { type: 'number', default: 0 },
// 							passedOutTimestamp: { type: 'number', default: 0 },
// 						},
// 					},
// 				},
// 				mainGroup: { type: 'string?', default: null },
// 			},
// 		},
// 	},
// 	currentQuid: {
// 		type: 'map',
// 		of: { type: 'string', default: '' },
// 	},
// 	servers: {
// 		type: 'map',
// 		of: {
// 			type: 'object',
// 			default: {
// 				currentQuid: { type: 'string?', default: null },
// 				lastInteractionTimestamp: { type: 'number?', default: null },
// 				lastInteractionToken: { type: 'string?', default: null },
// 				lastInteractionChannelId: { type: 'string?', default: null },
// 				restingMessageId: { type: 'string?', default: null },
// 				restingChannelId: { type: 'string?', default: null },
// 				componentDisablingChannelId: { type: 'string?', default: null },
// 				componentDisablingMessageId: { type: 'string?', default: null },
// 				componentDisablingToken: { type: 'string?', default: null },
// 				hasCooldown: { type: 'boolean', default: false },
// 				lastProxied: { type: 'string?', default: null },
// 			},
// 		},
// 	},
// 	lastPlayedVersion: { type: 'string', default: pkg.version },
// 	antiproxy: {
// 		type: 'object',
// 		default: {
// 			startsWith: { type: 'string', default: '' },
// 			endsWith: { type: 'string', default: '' },
// 		},
// 	},
// 	groups: {
// 		type: 'map',
// 		of: {
// 			type: 'object',
// 			default: {
// 				_id: { type: 'string', default: '' },
// 				name: { type: 'string', default: '' },
// 				tag: {
// 					type: 'object',
// 					default: {
// 						global: { type: 'string', default: '' },
// 						servers: {
// 							type: 'map',
// 							of: { type: 'string', default: '' },
// 						},
// 					},
// 				},
// 			},
// 		},
// 	},
// 	group_quid: {
// 		type: 'array',
// 		of: {
// 			type: 'object',
// 			default: {
// 				groupId: { type: 'string', default: '' },
// 				quidId: { type: 'string', default: '' },
// 			},
// 		},
// 	},
// 	_id: { type: 'string', default: '', locked: true },
// }, true);


// export function getUserData<T extends '' | never, U extends QuidSchema<T> | undefined>(
// 	userData: UserSchema,
// 	server_id: string,
// 	quidData: U,
// ): UserData<U extends QuidSchema<T> ? never : undefined, T> {

// 	const user: UserData<U extends QuidSchema<T> ? never : undefined, T> = {
// 		_id: userData._id,
// 		userIds: userData.userIds,
// 		tag: {
// 			global: userData.tag.global,
// 			server: userData.tag.servers[server_id],
// 		},
// 		advice: userData.advice,
// 		settings: {
// 			reminders: userData.settings.reminders,
// 			proxy: {
// 				global: userData.settings.proxy.global,
// 				server: userData.settings.proxy.servers[server_id],
// 			},
// 			accessibility: userData.settings.accessibility,
// 		},
// 		quid: (quidData === undefined ? undefined : {
// 			_id: quidData._id,
// 			name: quidData.name,
// 			nickname: {
// 				global: quidData.nickname.global,
// 				server: quidData.nickname.servers[server_id],
// 			},
// 			species: quidData.species,
// 			displayedSpecies: quidData.displayedSpecies,
// 			description: quidData.description,
// 			avatarURL: quidData.avatarURL,
// 			pronounSets: quidData.pronounSets,
// 			proxy: quidData.proxy,
// 			color: quidData.color,
// 			mentions: quidData.mentions,
// 			profile: quidData.profiles[server_id],
// 			mainGroup: quidData.mainGroup,
// 			getDisplayname: function(): string {

// 				const group = user.groups.get(this.mainGroup ?? '');
// 				const groupTag = group?.tag.servers[server_id] || group?.tag.global || '';
// 				const userTag = user.tag.server || user.tag.global || '';
// 				const tag = userTag || groupTag;
// 				return (this.nickname.server || this.nickname.global || this.name) + (tag ? ` ${tag}` : '');
// 			},
// 			getDisplayspecies: function(): string { return this.displayedSpecies || this.species; },
// 			pronoun: function(
// 				pronounNumber: 0 | 1 | 2 | 3 | 4 | 5,
// 			): string {

// 				const pronounSet = getRandomPronounSet(this.pronounSets, this.name);
// 				return getArrayElement(pronounSet, pronounNumber);
// 			},
// 			pronounAndPlural: function(
// 				pronounNumber: 0 | 1 | 2 | 3 | 4 | 5,
// 				string1: string,
// 				string2?: string,
// 			): string {

// 				const pronounSet = getRandomPronounSet(this.pronounSets, this.name);

// 				const pronoun = getArrayElement(pronounSet, pronounNumber);
// 				const isPlural = pronounSet[5] === 'plural';

// 				if (string2 === undefined) { return `${pronoun} ${string1}${isPlural === false ? 's' : ''}`; }
// 				return `${pronoun} ${isPlural === false ? string1 : string2}`;
// 			},
// 		}) as (U extends QuidSchema<T> ? never : undefined) | Quid<T>,
// 		serverInfo: userData.servers[server_id],
// 		quids: new Collection(Object.entries(userData.quids)),
// 		servers: new Collection(Object.entries(userData.servers)),
// 		lastPlayedVersion: userData.lastPlayedVersion,
// 		antiproxy: userData.antiproxy,
// 		groups: new Collection(Object.entries(userData.groups)),
// 		group_quid: userData.group_quid,
// 		update: function(
// 			updateFunction: (value: UserSchema) => void,
// 			options: { log?: boolean } = {},
// 		): void {

// 			userData = userModel.findOneAndUpdate(
// 				u => u._id === userData._id,
// 				updateFunction,
// 				options,
// 			);
// 			const player = getUserData(userData, server_id, userData.quids[quidData?._id ?? '']);
// 			Object.assign(this, player);
// 		},
// 	};
// 	return user;
// }

// function getRandomPronounSet(
// 	pronounSets: string[][],
// 	name: string,
// ): string[] {

// 	let pronounSet = getArrayElement(pronounSets, getRandomNumber(pronounSets.length));
// 	if (pronounSet.length === 1 && pronounSet[0] === 'none') { pronounSet = [name, name, `${name}s`, `${name}s`, `${name}self`, 'singular']; }

// 	return pronounSet;
// }