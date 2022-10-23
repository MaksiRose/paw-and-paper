// @ts-check
import { Collection } from 'discord.js';
import { Model } from 'hoatzin';
import { commonPlantsInfo, materialsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '..';
import { ProxyConfigType, ProxyListType, Quid, QuidSchema, RankType, UserData, UserSchema } from '../typings/data/user';
import { getArrayElement } from '../utils/helperFunctions';
import { getRandomNumber } from '../utils/randomizers';
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
	userIds: {
		type: 'map',
		of: {
			type: 'map',
			of: {
				type: 'object',
				default: {
					isMember: { type: 'boolean', default: false, locked: false },
					lastUpdatedTimestamp: { type: 'number', default: 0, locked: false },
				},
				locked: false,
			},
			locked: false,
		},
		locked: false,
	},
	tag: {
		type: 'object',
		default: {
			global: { type: 'string', default: '', locked: true },
			servers: {
				type: 'map',
				of: { type: 'string', default: '', locked: false },
				locked: false,
			},
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
			ginkgosapling: { type: 'boolean', default: false, locked: false },
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
			proxy: {
				type: 'object',
				default: {
					global: {
						type: 'object',
						default: {
							autoproxy: { type: 'boolean', default: false, locked: false },
							stickymode: { type: 'boolean', default: false, locked: false },
						},
						locked: false,
					},
					servers: {
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
				nickname: {
					type: 'object',
					default: {
						global: { type: 'string', default: '', locked: true },
						servers: {
							type: 'map',
							of: { type: 'string', default: '', locked: false },
							locked: false,
						},
					},
					locked: false,
				},
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
							tutorials: {
								type: 'object',
								default: {
									play: { type: 'boolean', default: false, locked: false },
									explore: { type: 'boolean', default: false, locked: false },
								},
								locked: false,
							},
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
							lastActiveTimestamp: { type: 'number', default: 0, locked: false },
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
	lastPlayedVersion: { type: 'string', default: pkg.version, locked: false },
	_id: { type: 'string', default: '', locked: true },
}, true);
export default userModel;


export function getUserData<T extends '' | never, U extends QuidSchema<T> | undefined>(
	userData: UserSchema,
	server_id: string,
	quidData: U,
): UserData<U extends QuidSchema<T> ? never : undefined, T> {

	const user: UserData<U extends QuidSchema<T> ? never : undefined, T> = {
		_id: userData._id,
		userId: userData.userId,
		userIds: userData.userIds,
		tag: {
			global: userData.tag.global,
			server: userData.tag.servers[server_id ?? ''],
		},
		advice: userData.advice,
		settings: {
			reminders: userData.settings.reminders,
			proxy: {
				global: userData.settings.proxy.global,
				server: userData.settings.proxy.servers[server_id ?? ''],
			},
		},
		quid: (quidData === undefined ? undefined : {
			_id: quidData._id,
			name: quidData.name,
			nickname: {
				global: quidData.nickname.global,
				server: quidData.nickname.servers[server_id ?? ''],
			},
			species: quidData.species,
			displayedSpecies: quidData.displayedSpecies,
			description: quidData.description,
			avatarURL: quidData.avatarURL,
			pronounSets: quidData.pronounSets,
			proxy: quidData.proxy,
			color: quidData.color,
			mentions: quidData.mentions,
			profile: quidData.profiles[server_id],
			getDisplayname: function(): string {

				const tag = user.tag.server || user.tag.global || '';
				return (this.nickname.server || this.nickname.global || this.name) + (tag ? ` ${tag}` : '');
			},
			getDisplayspecies: function(): string { return this.displayedSpecies || this.species; },
			pronoun: function(
				pronounNumber: 0 | 1 | 2 | 3 | 4 | 5,
			): string { return getArrayElement(getArrayElement(this.pronounSets, getRandomNumber(this.pronounSets.length)), pronounNumber); },
			pronounAndPlural: function(
				pronounNumber: 0 | 1 | 2 | 3 | 4 | 5,
				string1: string,
				string2?: string,
			): string {

				const pronounSet = getArrayElement(this.pronounSets, getRandomNumber(this.pronounSets.length));

				const pronoun = getArrayElement(pronounSet, pronounNumber);
				const isPlural = pronounSet[5] === 'plural';

				if (string2 === undefined) { return `${pronoun} ${string1}${isPlural === false ? 's' : ''}`; }
				return `${pronoun} ${isPlural === false ? string1 : string2}`;
			},
		}) as (U extends QuidSchema<T> ? never : undefined) | Quid<T>,
		quids: new Collection(Object.entries(userData.quids)),
		serverIdToQuidId: new Collection(Object.entries(userData.currentQuid)),
		lastPlayedVersion: userData.lastPlayedVersion,
		update: async function(
			updateFunction: (value: UserSchema) => void,
		): Promise<void> {

			userData = await userModel.findOneAndUpdate(
				u => u._id === userData._id,
				updateFunction,
			);
			const player = getUserData(userData, server_id, userData.quids[quidData?._id ?? '']);
			Object.assign(this, player);
		},
	};
	return user;
}