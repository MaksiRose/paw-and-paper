import { Api } from '@top-gg/sdk';
import { AutocompleteInteraction, Client, ClientOptions, MessageContextMenuCommandInteraction, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
const bfd = require('bfd-api-redux/src/main');
import { RESTPostAPIContextMenuApplicationCommandsJSONBody, RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v10';

export interface SlashCommand {
	name: string;
	description: string;
	data: RESTPostAPIApplicationCommandsJSONBody;
	/** Best practice is that only commands that immediately return without any form of interaction (Button, Select Menu, Modal) that changes something in the database are set to false. */
	disablePreviousCommand: boolean;
	sendCommand: (client: CustomClient, interaction: ChatInputCommandInteraction, userData: UserSchema | null, serverData: ServerSchema | null, embedArray: Array<EmbedBuilder>) => Promise<void>;
	sendAutocomplete?: (client: CustomClient, interaction: AutocompleteInteraction, userData: UserSchema | null, serverData: ServerSchema | null) => Promise<void>;
}

export interface ContextMenuCommand {
	name: string;
	data: RESTPostAPIContextMenuApplicationCommandsJSONBody;
	sendCommand: (client: CustomClient, interaction: MessageContextMenuCommandInteraction) => Promise<void>;
}

export interface Votes {
	token: string;
	authorization: string;
	client: typeof bfd | Api | null;
}

export class CustomClient extends Client {

	slashCommands: { [key in string]: SlashCommand };
	contextMenuCommands: { [key in string]: ContextMenuCommand };
	votes: { [key in string]: Votes };

	constructor(options: ClientOptions) {

		super(options);
		this.slashCommands = {};
		this.contextMenuCommands = {};
		this.votes = {};
	}
}

/** This object holds references to guilds and users that cannot make accounts in their respective Arrays. */
export interface BanList {
	users: Array<string>;
	servers: Array<string>;
}

/** This object holds references to user accounts that are friends. */
export type GivenIdList = Array<string>;

/** This object holds references to files that will be deleted, with either a guild ID or a user + guild ID as the key, and an object with the file name and deletion timestamp as variables. */
export type DeleteList = { [key: string]: number; };

/** This object holds references to users and when they voted on which websites, with their user ID as the key, and an object with the last recorded and next redeemable vote for the respective websites as variables. */
export type VoteList = {
	[key: string]: {
		lastRecordedTopVote?: number,
		nextRedeemableTopVote?: number,
		lastRecordedDiscordsVote?: number,
		nextRedeemableDiscordsVote?: number,
		lastRecordedDblVote?: number,
		nextRedeemableDblVote?: number;
	};
};

/** This object holds references to webhook messages and who the original author is, with the webhook message ID as the key, and the orginal user ID as the variable. */
export type WebhookMessages = { [key: string]: string; };


export type Schema<T> = {
	[K in keyof T]: T[K] extends string ? {
		type: 'string',
		default: string,
		locked: boolean;
	} : T[K] extends string | null ? {
		type: 'string?',
		default: string | null,
		locked: boolean;
	} : T[K] extends number ? {
		type: 'number',
		default: number,
		locked: boolean;
	} : T[K] extends number | null ? {
		type: 'number?',
		default: string | null,
		locked: boolean;
	} : T[K] extends string | number ? {
		type: 'string|number',
		default: string | number,
		locked: boolean;
	} : T[K] extends boolean ? {
		type: 'boolean',
		default: boolean,
		locked: boolean;
	} : T[K] extends Array<any> ? {
		type: 'array',
		of: Schema<T[K]>[number],
		locked: boolean;
	} : T[K] extends { [key in string]: any } ? {
		type: 'object',
		default: Schema<T[K]>;
		locked: boolean;
	} | {
		type: 'map',
		of: Schema<T[K]>[any],
		locked: boolean;
	} : never;
};


export type CommonPlantNames = 'raspberry' | 'garlic' | 'herb Robert' | 'field scabious' | 'henna' | 'elderberry' | 'comfrey' | 'marigold' | 'common hollyhock' | 'arnica' | 'clover' | 'passion fruit' | 'bergamot orange' | 'cicely' | 'acorn' | 'rhodiola';

export type UncommonPlantNames = 'solomon\'s seal' | 'gotu kola' | 'great mullein' | 'purple coneflower' | 'field horsetail' | 'bay laurel' | 'chick weed' | 'yerba mate';

export type RarePlantNames = 'ribwort plantain' | 'charcoal-tree leaves' | 'marsh mallow';

export type SpecialPlantNames = 'black-eyed Susan';

export type SpeciesNames = 'wolf' | 'cat' | 'fox' | 'leopard' | 'tiger' | 'shark' | 'caracal' | 'bear' | 'coyote' | 'rabbit' | 'squirrel' | 'lion' | 'seal' | 'salmon' | 'tuna' | 'squid' | 'crab' | 'orca' | 'maned wolf' | 'dog' | 'owl' | 'deer' | 'penguin' | 'gaboon viper' | 'hoatzin' | 'weasel' | 'hawk' | 'eagle' | 'raccoon' | 'horse' | 'elk' | 'cassowary' | 'humpback whale' | 'goat' | 'kinkajou' | 'praying mantis' | 'cricket' | 'beetle' | 'moth' | 'bee' | 'cougar' | 'frog' | 'crow' | 'king cobra' | 'rat' | 'hedgehog' | 'beaver' | 'turtle' | 'anole' | 'porcupine' | 'mongoose' | 'otter' | 'ferret' | 'tropical parrot';

export type MaterialNames = 'stick' | 'pine cone' | 'root' | 'moss' | 'leaf' | 'algae' | 'clay' | 'vine' | 'soil' | 'rock' | 'seashell' | 'bone';

export interface Inventory {
	commonPlants: { [key in CommonPlantNames]: number },
	uncommonPlants: { [key in UncommonPlantNames]: number },
	rarePlants: { [key in RarePlantNames]: number },
	specialPlants: { [key in SpecialPlantNames]: number },
	meat: { [key in SpeciesNames]: number },
	materials: { [key in MaterialNames]: number };
}

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
	maxThirst = 'maxThirst'
}

export enum CurrentRegionType {
	SleepingDens = 'sleeping dens',
	FoodDen = 'food den',
	MedicineDen = 'medicine den',
	Prairie = 'prairie',
	Ruins = 'ruins',
	Lake = 'lake'
}

interface ShopRole {
	/** ID of the role */
	roleId: string;
	/** The kind of requirement to meet to earn the role */
	wayOfEarning: WayOfEarningType;
	/** The requirement to meet to earn the role */
	requirement: RankType | number;
}

export interface Profile {
	/** ID of the server that this information is associated with */
	readonly serverId: string;
	/** Rank of the character */
	rank: RankType;
	/** Levels of the character */
	levels: number;
	/** Experience Points of the character */
	experience: number;
	/** Health Points of the character */
	health: number;
	/** Energy Points of the character */
	energy: number;
	/** Hunger Points of the character */
	hunger: number;
	/** Thirst Points of the character */
	thirst: number;
	/** Maximum Health Points of the characterMaximum Health Points of the character */
	maxHealth: number;
	/** Maximum Energy Points of the character */
	maxEnergy: number;
	/** Maximum Hunger Points of the character */
	maxHunger: number;
	/** Maximum Thirst Points of the character */
	maxThirst: number;
	/** Object with a timestamp as the key and the kind of stat that is increased as the value */
	temporaryStatIncrease: { [key in string]: StatIncreaseType };
	/** Whether the character is resting */
	isResting: boolean;
	/** Whether the character has an open quest */
	hasQuest: boolean;
	/** The current region the character is in */
	currentRegion: CurrentRegionType;
	/** How many ranks the character has unlocked */
	unlockedRanks: number;
	/** The sapling of the character */
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
}

export interface Character {
	/** Unique ID of the character */
	readonly _id: string;
	/** Name of the character */
	name: string;
	/** Species of the character */
	species: SpeciesNames | '';
	/** Displayed species of the character */
	displayedSpecies: string;
	/** Description of the character */
	description: string;
	/** Avatar URL of the character */
	avatarURL: string;
	/** Array of Arrays of pronouns the character uses */
	pronounSets: string[][];
	/** Proxy this character uses */
	proxy: {
		startsWith: string,
		endsWith: string;
	};
	/** Embed color used in messages */
	color: `#${string}`;
	/** Object of character_id as key and an array of timestamps of when the mention has been done as the value */
	mentions: { [key in string]: number[]; };
	/** Object of server IDs this character has been used on as the key and the information associated with it as the value */
	profiles: { [key in string]: Profile; };
}

export enum ProxyListType {
	Whitelist = 1,
	Blacklist = 2
}

/** Object with a whitelist and blacklist and which one it is set to */
interface ProxyLimitedList {
	/** Whether the whitelist or blacklist is enabled */
	setTo: ProxyListType,
	/** Array of IDs that are on the whitelist */
	whitelist: Array<string>,
	/** Array of IDs that are on the blacklist */
	blacklist: Array<string>;
}

export enum ProxyConfigType {
	FollowGlobal = 1,
	Enabled = 2,
	Disabled = 3
}

export interface UserSchema {
	/** Array of IDs of the users associated with this account */
	userId: Array<string>;
	/** Object of advice kinds as the key and whether the advice has been given as the value */
	advice: {
		resting: boolean,
		drinking: boolean,
		eating: boolean,
		passingout: boolean,
		coloredbuttons: boolean;
	};
	/** Object of settings the user has configured */
	settings: {
		/** Object of reminder kinds as the key and whether the user wants to be reminded/pinged for these occasions as the value */
		reminders: {
			water: boolean,
			resting: boolean;
		};
	};
	/** Object of names of characters as the key and the characters this user has created as value */
	characters: { [key in string]: Character };
	/** Object of the server IDs as the key and the id of the character that is currently active as the value */
	currentCharacter: { [key in string]: string };
	/** Object of the server IDs as the key and object of proxy settings as the value */
	serverProxySettings: {
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
	/** Object of proxy settings that are configured globally */
	globalProxySettings: {
		/** Whether autoproxy is enabled globally */
		autoproxy: boolean,
		/** Whether stickymode is enabled globally */
		stickymode: boolean;
	};
	/** Last major version that the user played on */
	lastPlayedVersion: string;
	readonly uuid: string;
}


interface DenSchema {
	/** How strong the structure of the den is */
	structure: number;
	/** How nice the ground of the den is */
	bedding: number;
	/** How thick the walls of the den are */
	thickness: number;
	/** How even the walls of the den arev */
	evenness: number;
}

export interface Dens {
	sleepingDens: DenSchema,
	foodDen: DenSchema,
	medicineDen: DenSchema;
}

export interface ServerSchema {
	/** ID of the server. Cannot be modified */
	readonly serverId: string;
	/** Name of the server */
	name: string;
	/** Object with item kinds as the keys and an object of the item types and their quantity as the variables */
	inventory: Inventory;
	/** Object of the blocked entrance with the name of the den and kind of block as the variables. If no entrance is blocked, they are null */
	dens: Dens;
	/** Timestamp of the time when the next attack is possible */
	nextPossibleAttack: number;
	/** ID of the channel that can be visited. If no channel is seleted, this is null */
	visitChannelId: string | null;
	/** ID of the guild that is currently being visited. If no guild is being visited, this is null */
	currentlyVisiting: string | null;
	/** Array of role objects */
	shop: Array<ShopRole>;
	/** Object with settings for the server */
	proxySettings: {
		/** Object with limits for which channels are allowed */
		channels: ProxyLimitedList,
		/** Object with limits for which roles are allowed */
		roles: ProxyLimitedList,
		/** Array of strings of which one has to be included in the tag */
		requiredInTag: Array<string>,
		/** Whether the tag also has to be in a members display name */
		tagInDisplayname: boolean,
		/** The ID of the channel that messages should be logged to */
		logChannelId: string | null;
	};
	/** Array of global skills for this server */
	skills: Array<string>;
	readonly uuid: string;
}

export interface Event {
	/** Name of the event */
	name: string;
	/** Whether the event should be executed once */
	once: boolean;
	execute: (client: CustomClient, ...args: Array<any>) => Promise<void>;
}


export enum PlantEdibilityType {
	Edible = 1,
	Inedible = 2,
	Toxic = 3
}

interface PlantInfo {
	/** Description of the plant */
	description: string;
	/** Edibabilty of the plant */
	edibility: PlantEdibilityType;
	/** Whether the plant heals wounds */
	healsWounds: boolean;
	/** Whether the plant heals infectionsWhether the plant heals infections */
	healsInfections: boolean;
	/** Whether the plant heals colds */
	healsColds: boolean;
	/** Whether the plant heals sprains */
	healsSprains: boolean;
	/** Whether the plant heals poison */
	healsPoison: boolean;
	/** Whether the plant gives energy */
	givesEnergy: boolean;
	/** Whether the plant increases the maximum of one condition */
	increasesMaxCondition: boolean;
}

export const commonPlantsInfo: { [key in CommonPlantNames]: PlantInfo; } = {
	'raspberry': {
		description: 'A tasty berry! Good for the quick hunger.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'garlic': {
		description: 'A nourishing plant in the onion genus.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'herb Robert': {
		description: 'The herb Robert is a common species of plants useful for healing wounds.',
		edibility: PlantEdibilityType.Inedible,
		healsWounds: true,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'field scabious': {
		description: 'This pretty flower is used to fight colds.',
		edibility: PlantEdibilityType.Inedible,
		healsWounds: false,
		healsInfections: false,
		healsColds: true,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'henna': {
		description: 'A flowering plant often used as dye, but also used against infections and inflammations.',
		edibility: PlantEdibilityType.Inedible,
		healsWounds: false,
		healsInfections: true,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'elderberry': {
		description: 'This berry is poisonous when eaten uncooked, but it helps against colds when used as a medicine.',
		edibility: PlantEdibilityType.Toxic,
		healsWounds: false,
		healsInfections: false,
		healsColds: true,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'comfrey': {
		description: 'Comfrey is a flowering plant that is toxic when eaten, but heals sprains and swellings when applied directly.',
		edibility: PlantEdibilityType.Toxic,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'marigold': {
		description: 'This flowering plant is great when used to heal infection.',
		edibility: PlantEdibilityType.Inedible,
		healsWounds: false,
		healsInfections: true,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'common hollyhock': {
		description: 'A flower frequently used to fight wounds and bruises.',
		edibility: PlantEdibilityType.Inedible,
		healsWounds: true,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'arnica': {
		description: 'This plant of the sunflower family contains a toxin and shouldn\'t be eaten, though it helps reduce pain from sprains.',
		edibility: PlantEdibilityType.Toxic,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'clover': {
		description: 'Several plants of the genus Trifolium. A common source of nourishment.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'passion fruit': {
		description: 'Vine species of the passion flower. Very nutritious.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'bergamot orange': {
		description: 'A citrus fruit the size of an orange. Less sour than lemon, but more bitter than grapefruit.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'cicely': {
		description: 'This plant grows 6ft 6in (2m) high. Both the leaves and the roots are edible.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'acorn': {
		description: 'This nut is highly nutritious and therefore serves as an excellent source of food.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'rhodiola': {
		description: 'The root of a perennial plant, searched after as a food source and for its ability to help fight fatigue and exhaustion.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: true,
		increasesMaxCondition: false,
	},
};

export const uncommonPlantsInfo: { [key in UncommonPlantNames]: PlantInfo } = {
	'solomon\'s seal': {
		description: 'This flowering plant is a great source of food, but also excellent for healing colds as well as wounds!',
		edibility: PlantEdibilityType.Edible,
		healsWounds: true,
		healsInfections: false,
		healsColds: true,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'gotu kola': {
		description: 'A vegetable often used to treat infections, as well as being very energizing!',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: true,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: true,
		increasesMaxCondition: false,
	},
	'great mullein': {
		description: 'The great mullein is a high growing biennal plant not only used for consumption but also for colds and sprains.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: true,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'purple coneflower': {
		description: 'This flower is not only part of the sunflower family, but also a treatment against colds, infections, and hunger!',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: true,
		healsColds: true,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'field horsetail': {
		description: 'A perenniel plant that is useful against wounds and sprains, but toxic if consumed.',
		edibility: PlantEdibilityType.Toxic,
		healsWounds: true,
		healsInfections: false,
		healsColds: false,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'bay laurel': {
		description: 'An aromatic large shrub used to treat wounds and sprains!',
		edibility: PlantEdibilityType.Edible,
		healsWounds: true,
		healsInfections: false,
		healsColds: false,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'chick weed': {
		description: 'The chick weed is not only very tasty, but also able to heal wounds and sprains.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: true,
		healsInfections: false,
		healsColds: false,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'yerba mate': {
		description: 'This plants leaves are useful for healing infections, but also energizing due to it containing caffeine.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: true,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: true,
		increasesMaxCondition: false,
	},
};

export const rarePlantsInfo: { [key in RarePlantNames]: PlantInfo } = {
	'ribwort plantain': {
		description: 'A weed for treating wounds, colds and poison! Highly nutritious.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: true,
		healsInfections: false,
		healsColds: false,
		healsSprains: true,
		healsPoison: true,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'charcoal-tree leaves': {
		description: 'These leaves do wonders against poison, wounds and colds, as well as being very tasty.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: true,
		healsInfections: false,
		healsColds: true,
		healsSprains: false,
		healsPoison: true,
		givesEnergy: false,
		increasesMaxCondition: false,
	},
	'marsh mallow': {
		description: 'This sweet tasting, energizing plant is very effective against infections, sprains!',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: true,
		healsColds: false,
		healsSprains: true,
		healsPoison: false,
		givesEnergy: true,
		increasesMaxCondition: false,
	},
};

export const specialPlantsInfo: { [key in SpecialPlantNames]: PlantInfo } = {
	'black-eyed Susan': {
		description: 'This flower from the sunflower family is thought to give a temporary boost to one\'s maximum health, energy, hunger or thirst.',
		edibility: PlantEdibilityType.Edible,
		healsWounds: false,
		healsInfections: false,
		healsColds: false,
		healsSprains: false,
		healsPoison: false,
		givesEnergy: false,
		increasesMaxCondition: true,
	},
};


export interface MaterialInfo {
	/** Description of the material */
	description: string;
	/** Whether the material reinforces the structure of a den */
	reinforcesStructure: boolean;
	/** Whether the material improves the bedding of the den */
	improvesBedding: boolean;
	/** Whether the material thickens the walls of the den */
	thickensWalls: boolean;
	/** Whether the material removes overhang from the walls of the hang */
	removesOverhang: boolean;
}

export const materialsInfo: { [key in MaterialNames]: MaterialInfo } = {
	'stick': {
		description: 'These are not the sturdiest material out there, but they can help holding together constructions.',
		reinforcesStructure: true,
		improvesBedding: false,
		thickensWalls: false,
		removesOverhang: false,
	},
	'pine cone': {
		description: 'The seed-bearing fruit of the pine tree. The wooden exterior and shape make it great for reinforcing structures.',
		reinforcesStructure: true,
		improvesBedding: false,
		thickensWalls: false,
		removesOverhang: false,
	},
	'root': {
		description: 'Remainders of dead trees. With their toughness as support, they can be like a skeleton or frame of a structure.',
		reinforcesStructure: true,
		improvesBedding: false,
		thickensWalls: false,
		removesOverhang: false,
	},
	'moss': {
		description: 'A soft and easy to maintain plant that makes for a great floor component.',
		reinforcesStructure: false,
		improvesBedding: true,
		thickensWalls: false,
		removesOverhang: false,
	},
	'leaf': {
		description: 'Foilage is not only vital to most plants, but also has a great texture and acts as a dampening effect when walked over.',
		reinforcesStructure: false,
		improvesBedding: true,
		thickensWalls: false,
		removesOverhang: false,
	},
	'algae': {
		description: 'Seaweed is not only pretty, but also spongy and comfortable, making it perfect as ground material.',
		reinforcesStructure: false,
		improvesBedding: true,
		thickensWalls: false,
		removesOverhang: false,
	},
	'clay': {
		description: 'This type of dirt is deformable when wet, but tough and brittle when dry, making it a great thickening material for walls.',
		reinforcesStructure: false,
		improvesBedding: false,
		thickensWalls: true,
		removesOverhang: false,
	},
	'vine': {
		description: 'The long-growing plant will spread and twist around walls. They are not robust, but their leaves will thicken whatever they are growing on.',
		reinforcesStructure: false,
		improvesBedding: false,
		thickensWalls: true,
		removesOverhang: false,
	},
	'soil': {
		description: 'This common material is easy to deform, but still strong when pressed together, making it perfect for thickening walls and ceilings.',
		reinforcesStructure: false,
		improvesBedding: false,
		thickensWalls: true,
		removesOverhang: false,
	},
	'rock': {
		description: 'A small piece formed from minerals, its hardness making it a great tool to remove overhang from and even out walls.',
		reinforcesStructure: false,
		improvesBedding: false,
		thickensWalls: false,
		removesOverhang: true,
	},
	'seashell': {
		description: 'Hard, protective outer layer by an animal that lives in the sea. Can be used to even out irregularities .',
		reinforcesStructure: false,
		improvesBedding: false,
		thickensWalls: false,
		removesOverhang: true,
	},
	'bone': {
		description: 'One of the hard parts of animal\'s skeletons. Good way to get rid of bumps and material sticking out of walls to even them out.',
		reinforcesStructure: false,
		improvesBedding: false,
		thickensWalls: false,
		removesOverhang: true,
	},
};


export enum SpeciesDietType {
	Omnivore = 1,
	Herbivore = 2,
	Carnivore = 3
}

export enum SpeciesHabitatType {
	Cold = 1,
	Warm = 2,
	Water = 3
}

export interface SpeciesInfo {
	/** Diet of the species */
	diet: SpeciesDietType;
	/** Habitat that the species lives in */
	habitat: SpeciesHabitatType;
	/** Opponents that the species meets in biome 1 */
	biome1OpponentArray: Array<SpeciesNames>;
	/** Opponents that the species meets in biome 2 */
	biome2OpponentArray: Array<SpeciesNames>;
	/** Opponents that the species meets in biome 3 */
	biome3OpponentArray: Array<SpeciesNames>;
}

export const speciesInfo: { [key in SpeciesNames]: SpeciesInfo } = {
	// actual diet: moose, red deer, roe deer, wild boar, elk, caribou, white-tailed deer, mule deer, rodents*, hares, insectivores, smaller carnivores, waterfowl, lizards, snakes, frogs, large insecets
	// actual predators: no real ones, but sometimes large cats (eg eurasian lynx, cougars, siberian tigers), coyotes, elks that try to protect themselves, bears, striped hyenas
	'wolf': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'squirrel', 'deer'],
		biome2OpponentArray: ['fox', 'dog', 'goat'],
		biome3OpponentArray: ['bear', 'horse', 'elk'],
	},
	// actual diet in: hamsters, rats, mice, voles, sometimes martens, european polecat, stoat, weasel, sometimes deer, chamols, hates, rodents*, squirrel galliformes, birds, fish
	// actual predators: feral dogs, dingoes, coyotes, caracals, birds of prey
	'cat': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'squirrel', 'owl'],
		biome2OpponentArray: ['fox', 'bear'],
		biome3OpponentArray: ['wolf', 'dog'],
	},
	// actual diet: invertebrates such as insects and small vertebrates such as reptiles and birds, raccoons, oppossums, small rodents* like voles, mice and squirrels
	// actual predators: wolves, coyotes, leopards, caracals, lynxes, hyena, cougars, bobcats, eagles, owls
	'fox': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'squirrel', 'owl'],
		biome2OpponentArray: ['cat', 'dog', 'deer'],
		biome3OpponentArray: ['wolf', 'bear'],
	},
	// actual diet: ungulates such as antelopes and deer, primates such as monkeys, smaller carnivores like black-backed jackal, foxes, genets and cheetah
	// actual predators: tiger, lion, hyena, snake, crocodiles
	'leopard': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['coyote', 'maned wolf', 'mongoose'],
		biome2OpponentArray: ['caracal'],
		biome3OpponentArray: ['tiger', 'lion'],
	},
	// actual diet: large and medium-sizes mammals such as ungulates, deer, wapiti and wild boars, guar, buffalo, smaller prey such as monkeys, peafowl and other ground-based birds, hares, porcupines and fish, other predators such as dogs, leopards, pythons, bears and crocodiles, lifestock such as cattle, horses and donkeys
	// actual predators: leopards, dholes, hyenas, wolves, bears, pythons and crocodiles
	'tiger': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['coyote', 'maned wolf', 'mongoose'],
		biome2OpponentArray: ['leopard', 'caracal'],
		biome3OpponentArray: ['lion'],
	},
	'shark': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['salmon', 'tuna', 'squid'],
		biome2OpponentArray: ['seal', 'crab'],
		biome3OpponentArray: ['orca', 'humpback whale'],
	},
	'caracal': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['coyote', 'maned wolf'],
		biome2OpponentArray: ['leopard', 'tiger'],
		biome3OpponentArray: ['lion'],
	},
	'bear': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'salmon', 'tuna'],
		biome2OpponentArray: ['cat', 'fox', 'dog'],
		biome3OpponentArray: ['wolf', 'horse', 'elk'],
	},
	'coyote': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['caracal', 'maned wolf', 'porcupine'],
		biome2OpponentArray: ['leopard', 'goat'],
		biome3OpponentArray: ['tiger', 'lion'],
	},
	'rabbit': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['squirrel', 'owl'],
		biome2OpponentArray: ['dog', 'deer', 'otter'],
		biome3OpponentArray: ['wolf', 'cat', 'bear'],
	},
	'squirrel': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'owl'],
		biome2OpponentArray: ['dog', 'deer'],
		biome3OpponentArray: ['wolf', 'cat', 'bear'],
	},
	'lion': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['coyote', 'maned wolf'],
		biome2OpponentArray: ['leopard', 'caracal'],
		biome3OpponentArray: ['tiger'],
	},
	'seal': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['salmon', 'tuna', 'squid'],
		biome2OpponentArray: ['bear', 'crab'],
		biome3OpponentArray: ['shark', 'orca'],
	},
	'salmon': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['squid'],
		biome2OpponentArray: ['crab', 'anole'],
		biome3OpponentArray: ['bear', 'seal', 'owl'],
	},
	'tuna': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['salmon', 'squid'],
		biome2OpponentArray: ['crab'],
		biome3OpponentArray: ['bear', 'seal', 'owl'],
	},
	'squid': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['crab'],
		biome2OpponentArray: ['tuna', 'salmon'],
		biome3OpponentArray: ['shark', 'seal', 'owl'],
	},
	'crab': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['squid'],
		biome2OpponentArray: ['tuna', 'salmon', 'mongoose'],
		biome3OpponentArray: ['bear', 'seal', 'owl'],
	},
	'orca': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['salmon', 'tuna', 'squid'],
		biome2OpponentArray: ['seal', 'crab'],
		biome3OpponentArray: ['shark', 'humpback whale'],
	},
	'maned wolf': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['caracal', 'coyote'],
		biome2OpponentArray: ['leopard', 'goat'],
		biome3OpponentArray: ['tiger', 'lion'],
	},
	'dog': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'squirrel', 'deer'],
		biome2OpponentArray: ['wolf', 'fox'],
		biome3OpponentArray: ['cat', 'bear'],
	},
	'owl': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'squirrel', 'moth', 'beetle'],
		biome2OpponentArray: ['cat', 'fox', 'tropical parrot'],
		biome3OpponentArray: ['wolf', 'bear'],
	},
	'deer': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['rabbit', 'squirrel'],
		biome2OpponentArray: ['fox', 'owl'],
		biome3OpponentArray: ['wolf', 'bear', 'dog'],
	},
	'penguin': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['salmon', 'tuna', 'squid', 'crab'],
		biome2OpponentArray: ['dog', 'cat', 'fox'],
		biome3OpponentArray: ['shark', 'seal', 'orca'],
	},
	'gaboon viper': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['cat', 'rabbit', 'owl'],
		biome2OpponentArray: ['leopard', 'caracal'],
		biome3OpponentArray: ['lion', 'tiger'],
	},
	'hoatzin': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
		biome2OpponentArray: ['cat', 'weasel'],
		biome3OpponentArray: ['eagle', 'hawk', 'cassowary'],
	},
	'weasel': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['squirrel', 'rabbit', 'cricket', 'praying mantis'],
		biome2OpponentArray: ['cat', 'fox', 'ferret'],
		biome3OpponentArray: ['owl', 'gaboon viper'],
	},
	'hawk': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
		biome2OpponentArray: ['owl', 'raccoon', 'kinkajou'],
		biome3OpponentArray: ['eagle', 'gaboon viper', 'cassowary'],
	},
	'eagle': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['squirrel', 'rabbit', 'goat'],
		biome2OpponentArray: ['bear', 'raccoon', 'kinkajou'],
		biome3OpponentArray: ['hawk', 'gaboon viper', 'cassowary'],
	},
	'raccoon': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['salmon', 'rabbit', 'praying mantis'],
		biome2OpponentArray: ['owl', 'fox', 'cat'],
		biome3OpponentArray: ['coyote', 'wolf'],
	},
	'horse': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['cat', 'fox'],
		biome2OpponentArray: ['deer', 'dog'],
		biome3OpponentArray: ['bear', 'wolf', 'elk'],
	},
	'elk': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['cat', 'fox'],
		biome2OpponentArray: ['deer', 'dog'],
		biome3OpponentArray: ['bear', 'wolf', 'horse'],
	},
	'cassowary': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['maned wolf', 'dog'],
		biome2OpponentArray: ['hoatzin', 'gaboon viper'],
		biome3OpponentArray: ['hawk', 'eagle'],
	},
	'humpback whale': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['salmon', 'tuna', 'squid'],
		biome2OpponentArray: ['seal', 'crab'],
		biome3OpponentArray: ['orca', 'shark'],
	},
	'goat': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['wolf', 'bear', 'maned wolf'],
		biome2OpponentArray: ['fox', 'eagle'],
		biome3OpponentArray: ['dog', 'coyote'],
	},
	'kinkajou': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['crab', 'hoatzin', 'salmon'],
		biome2OpponentArray: ['hawk', 'eagle'],
		biome3OpponentArray: ['gaboon viper', 'lion'],
	},
	'praying mantis': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['cricket', 'beetle'],
		biome2OpponentArray: ['moth', 'bee'],
		biome3OpponentArray: ['weasel', 'raccoon', 'hedgehog'],
	},
	'cricket': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['moth', 'beetle'],
		biome2OpponentArray: ['praying mantis', 'bee'],
		biome3OpponentArray: ['weasel', 'owl', 'hedgehog'],
	},
	'beetle': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['cricket', 'moth'],
		biome2OpponentArray: ['praying mantis', 'bee'],
		biome3OpponentArray: ['weasel', 'owl', 'hedgehog'],
	},
	'moth': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['moth', 'praying mantis'],
		biome2OpponentArray: ['cricket', 'beetle'],
		biome3OpponentArray: ['bee', 'owl', 'anole'],
	},
	'bee': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['cricket', 'beetle'],
		biome2OpponentArray: ['moth', 'praying mantis'],
		biome3OpponentArray: ['bear', 'owl', 'ferret'],
	},
	'cougar': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['deer', 'goat', 'porcupine'],
		biome2OpponentArray: ['elk', 'coyote'],
		biome3OpponentArray: ['bear', 'wolf'],
	},
	'frog': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['beetle', 'cricket', 'praying mantis'],
		biome2OpponentArray: ['raccoon', 'fox', 'hedgehog'],
		biome3OpponentArray: ['owl', 'crow', 'otter'],
	},
	'crow': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['beetle', 'moth', 'cricket'],
		biome2OpponentArray: ['squirrel', 'rabbit'],
		biome3OpponentArray: ['hawk', 'eagle'],
	},
	'king cobra': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['frog', 'rabbit', 'hedgehog'],
		biome2OpponentArray: ['gaboon viper', 'cassowary', 'hoatzin'],
		biome3OpponentArray: ['hawk', 'eagle'],
	},
	'rat': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['beetle', 'cricket', 'praying mantis'],
		biome2OpponentArray: ['squirrel', 'rabbit', 'raccoon'],
		biome3OpponentArray: ['owl', 'cougar', 'weasel'],
	},
	'hedgehog': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['beetle', 'cricket', 'praying mantis'],
		biome2OpponentArray: ['frog', 'rat', 'squirrel'],
		biome3OpponentArray: ['owl', 'eagle', 'weasel'],
	},
	// actual diet: plants
	// actual predators: felids, canids and bears, hawks, sometimes otters
	'beaver': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['beetle', 'cricket', 'praying mantis'],
		biome2OpponentArray: ['coyote', 'fox', 'weasel'],
		biome3OpponentArray: ['bear', 'hawk', 'wolf'],
	},
	// actual diet: sedentary animals such as mollusks, worms and insect larvae, fish, amphibians, reptiles, birds and mammals
	// actual predators: raccoons, opossums, skunks, sharks, crows, seagulls, kingsnakes, crocodiles, alligators
	'turtle': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['beetle', 'cricket', 'salmon'],
		biome2OpponentArray: ['raccoon', 'crow', 'weasel'],
		biome3OpponentArray: ['shark', 'fox', 'coyote'],
	},
	// actual diet: crickets, beetles, ants, flies, grasshoppers, caterpillars, moths, butterflies, arachnids like spiders, sometimes mice, small birds, lizards, fish, shrimp
	// actual predators: skinks, snakes, birds, large frogs, lizards, monkeys, carnivorous mammals
	'anole': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['beetle', 'cricket', 'moth'],
		biome2OpponentArray: ['salmon', 'frog', 'owl'],
		biome3OpponentArray: ['weasel', 'king cobra', 'raccoon'],
	},
	// actual diet: lizard, grub
	// actual predators: coyote, cougar, bobcat, bear, wolf, owl, fox, lynx
	'porcupine': {
		diet: SpeciesDietType.Herbivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['cricket', 'beetle', 'praying mantis'],
		biome2OpponentArray: ['anole', 'owl', 'fox'],
		biome3OpponentArray: ['bear', 'cougar', 'coyote'],
	},
	// actual diet: small mammals (rodents), birds, reptiles (lizards), eggs, occasionally fruit, insects, crabs, earthworms
	// actual predators: hawks, eagles, jackals, big cats, avian predators
	'mongoose': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['rat', 'rabbit', 'crab'],
		biome2OpponentArray: ['anole', 'cougar', 'leopard'],
		biome3OpponentArray: ['tiger', 'eagle', 'hawk'],
	},
	// actual diet: crayfish, other fishes, crabs, frogs, birds, rabbits, rodents
	// actual predators: bobcats, alligators, coyotes, raptors
	'otter': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Water,
		biome1OpponentArray: ['salmon', 'tuna', 'crab'],
		biome2OpponentArray: ['beaver', 'rabbit', 'frog'],
		biome3OpponentArray: ['bear', 'eagle', 'coyote'],
	},
	// actual diet: mice, rats, voles, quail, chickens, pigeons, grouse, rabbits, frogs, toads, snakes, insects
	// actual predators: owls, eagles, hawks, coyotes, badgers, foxes, wolves, bobcats
	'ferret': {
		diet: SpeciesDietType.Carnivore,
		habitat: SpeciesHabitatType.Cold,
		biome1OpponentArray: ['frog', 'bee', 'rat'],
		biome2OpponentArray: ['owl', 'rabbit', 'weasel'],
		biome3OpponentArray: ['hawk', 'eagle', 'coyote'],
	},
	// actual diet: Leaves, fruits, vegetables, nuts, snails, insects, clay soil
	// actual predators: Larger birds, snakes, monkeys, and sometimes eagles, hawks, and falcons
	'tropical parrot': {
		diet: SpeciesDietType.Omnivore,
		habitat: SpeciesHabitatType.Warm,
		biome1OpponentArray: ['beetle', 'bee', 'cricket'],
		biome2OpponentArray: ['owl', 'mongoose', 'hoatzin'],
		biome3OpponentArray: ['hawk', 'eagle', 'gaboon viper'],
	},
};