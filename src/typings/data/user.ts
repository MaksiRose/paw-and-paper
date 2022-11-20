import { Collection } from 'discord.js';
import { userModel } from '../../models/userModel';
import { ValueOf } from '../../utils/helperFunctions';
import { OmitFirstArgAndChangeReturn } from '../main';
import { Inventory, ProxyLimitedList, ShopRole, SpeciesNames } from './general';

export enum WayOfEarningType {
	Rank = 'rank',
	Levels = 'levels',
	Experience = 'experience'
}

export enum RankType {
	Youngling = 'Youngling',
	Apprentice = 'Apprentice',
	Hunter = 'Hunter',
	Healer = 'Healer',
	Elderly = 'Elderly'
}

export enum StatIncreaseType {
	MaxHealth = 'maxHealth',
	MaxEnergy = 'maxEnergy',
	MaxHunger = 'maxHunger',
	MaxThirst = 'maxThirst'
}

export enum CurrentRegionType {
	SleepingDens = 'sleeping dens',
	FoodDen = 'food den',
	MedicineDen = 'medicine den',
	Prairie = 'prairie',
	Ruins = 'ruins',
	Lake = 'lake'
}

export interface ProfileSchema {
	/** ID of the server that this information is associated with */
	readonly serverId: string;
	/** Rank of the quid */
	rank: RankType;
	/** Levels of the quid */
	levels: number;
	/** Experience Points of the quid */
	experience: number;
	/** Health Points of the quid */
	health: number;
	/** Energy Points of the quid */
	energy: number;
	/** Hunger Points of the quid */
	hunger: number;
	/** Thirst Points of the quid */
	thirst: number;
	/** Maximum Health Points of the quid */
	maxHealth: number;
	/** Maximum Energy Points of the quid */
	maxEnergy: number;
	/** Maximum Hunger Points of the quid */
	maxHunger: number;
	/** Maximum Thirst Points of the quid */
	maxThirst: number;
	/** Object with a timestamp as the key and the kind of stat that is increased as the value */
	temporaryStatIncrease: { [key in string]: StatIncreaseType };
	/** Whether the quid is resting
	 * @deprecated
	 */
	isResting: boolean;
	/** Whether the quid has an open quest */
	hasQuest: boolean;
	/** The current region the quid is in */
	currentRegion: CurrentRegionType;
	/** How many ranks the quid has unlocked */
	unlockedRanks: number;
	/** The tutorials this profile has completed */
	tutorials: {
		/** Whether this profile has completed the play tutorial */
		play: boolean;
		/** Whether this profile has completed the explore tutorial */
		explore: boolean;
	};
	/** The sapling of the quid */
	sapling: {
		/** Whether there is a sapling */
		exists: boolean;
		/** The health of the sapling */
		health: number;
		/** How many times the sapling has been watered */
		waterCycles: number;
		/** Timestamp of the next perfect watering */
		nextWaterTimestamp: number | null;
		/** The ID of the last channel the sapling was watered in */
		lastMessageChannelId: string | null;
		/** Whether a reminder was sent */
		sentReminder: boolean;
		/** Whether a gentle reminder was sent */
		sentGentleReminder: boolean;
	};
	/** Object with injury types as keys and whether the user has them/how many the user has of them as variables */
	injuries: {
		wounds: number,
		infections: number,
		cold: boolean,
		sprains: number,
		poison: boolean;
	};
	/** Object with item kinds as the keys and an object of the item types and their quantity as the variables */
	inventory: Inventory;
	/** Array of role objects */
	roles: Array<ShopRole>;
	/** Object of skills, with global and personal skills as key-value pairs */
	skills: {
		global: { [key in string]: number };
		personal: { [key in string]: number };
	};
	/** A timestamp for when the profile was last used */
	lastActiveTimestamp: number;
}

export interface QuidSchema<Completed extends ''> {
	/** Unique ID of the quid */
	readonly _id: string;
	/** Name of the quid */
	name: string;
	/** Nickname of the quid */
	nickname: {
		global: string,
		servers: { [index: string]: string; };
	};
	/** Species of the quid */
	species: SpeciesNames | Completed;
	/** Displayed species of the quid */
	displayedSpecies: string;
	/** Description of the quid */
	description: string;
	/** Avatar URL of the quid */
	avatarURL: string;
	/** Array of Arrays of pronouns the quid uses */
	pronounSets: string[][];
	/** Proxy this quid uses */
	proxy: {
		startsWith: string,
		endsWith: string;
	};
	/** Embed color used in messages */
	color: `#${string}`;
	/** Object of quid_id as key and an array of timestamps of when the mention has been done as the value */
	mentions: { [key in string]: number[]; };
	/** Object of server IDs this quid has been used on as the key and the information associated with it as the value */
	profiles: { [key in string]: ProfileSchema; };
}

export enum ProxyListType {
	Whitelist = 1,
	Blacklist = 2
}

export enum ProxyConfigType {
	FollowGlobal = 1,
	Enabled = 2,
	Disabled = 3
}

export interface UserSchema {
	/** Array of IDs of the users associated with this account
	 * @deprecated use userIds instead
	 */
	userId: Array<string>;
	/** Object with discord user IDs as keys and values that are objects with discord server IDs as keys and values that are objects of whether the user is a member and when this was last updated */
	userIds: Record<string, Record<string, { isMember: boolean; lastUpdatedTimestamp: number; }>>;
	/** Tag of the account */
	tag: {
		global: string,
		servers: { [index: string]: string; };
	};
	/** Object of advice kinds as the key and whether the advice has been given as the value */
	advice: {
		resting: boolean,
		drinking: boolean,
		eating: boolean,
		passingout: boolean,
		coloredbuttons: boolean,
		ginkgosapling: boolean,
	};
	/** Object of settings the user has configured */
	settings: {
		/** Object of reminder kinds as the key and whether the user wants to be reminded/pinged for these occasions as the value */
		reminders: {
			water: boolean,
			resting: boolean;
		};
		/** Object of proxy settings */
		proxy: {
			/** Object of proxy settings that are configured globally */
			global: {
				/** Whether autoproxy is enabled globally */
				autoproxy: boolean,
				/** Whether stickymode is enabled globally */
				stickymode: boolean;
			};
			/** Object of the server IDs as the key and object of proxy settings as the value */
			servers: {
				[index: string]: {
					/** Object of autoproxy settings to follow */
					autoproxy: {
						/** The config for this setting */
						setTo: ProxyConfigType;
						channels: ProxyLimitedList;
					};
					/** The config for this setting */
					stickymode: ProxyConfigType;
				};
			};
		};
	};
	/** Object of names of quids as the key and the quids this user has created as value */
	quids: { [key in string]: QuidSchema<''> };
	/** Object of the server IDs as the key and the id of the quid that is currently active as the value
	 * @deprecated use servers instead
	 */
	currentQuid: { [key in string]: string };
	servers: {
		[key in string]: {
			currentQuid: string | null,
			lastInteractionTimestamp: number | null,
			lastInteractionToken: string | null,
			lastInteractionChannelId: string | null,
			restingMessageId: string | null,
			restingChannelId: string | null,
			componentDisablingChannelId: string | null,
			componentDisablingMessageId: string | null,
			componentDisablingToken: string | null,
			hasCooldown: boolean
		}
	};
	/** Last major version that the user played on */
	lastPlayedVersion: string;
	readonly _id: string;
}


export interface Quid<Completed extends ''> extends Omit<QuidSchema<Completed>, 'nickname' | 'profiles'> {
	nickname: Omit<QuidSchema<Completed>['nickname'], 'servers'> & {
		server: QuidSchema<Completed>['nickname']['servers'][string] | undefined;
	},
	profile: ProfileSchema | (Completed extends '' ? undefined : never);
	getDisplayname: () => string;
	getDisplayspecies: () => string;
	pronoun: (pronounNumber: 0 | 1 | 2 | 3 | 4 | 5) => string;
	pronounAndPlural: (pronounNumber: 0 | 1 | 2 | 3 | 4 | 5, string1: string, string2?: string) => string;
}

export interface UserData<QuidExists extends undefined, QuidCompleted extends ''> extends Omit<UserSchema, 'quids' | 'currentQuid' | 'servers' | 'tag' | 'settings'> {
	tag: Omit<UserSchema['tag'], 'servers'> & {
		server: UserSchema['tag']['servers'][string] | undefined;
	},
	quid: Quid<QuidCompleted> | QuidExists,
	serverInfo: ValueOf<UserSchema['servers']> | undefined,
	quids: Collection<keyof UserSchema['quids'], ValueOf<UserSchema['quids']>>,
	servers: Collection<keyof UserSchema['servers'], ValueOf<UserSchema['servers']>>,
	settings: Omit<UserSchema['settings'], 'proxy'> & {
		proxy: Omit<UserSchema['settings']['proxy'], 'servers'> & {
			server: UserSchema['settings']['proxy']['servers'][string] | undefined;
		};
	};
	update: OmitFirstArgAndChangeReturn<typeof userModel['findOneAndUpdate'], void>;
}