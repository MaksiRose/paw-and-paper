import { Api } from '@top-gg/sdk';
import { AutocompleteInteraction, Client, ClientOptions, MessageContextMenuCommandInteraction, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import bfd from 'bfd-api-redux/src/main';
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
	client: bfd | Api | null;
}

export class CustomClient extends Client {

	slashCommands: Record<string, SlashCommand | undefined>;
	contextMenuCommands: Record<string, ContextMenuCommand | undefined>;
	votes: Record<string, Votes | undefined>;

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
export type DeleteList = Record<string, number>;

/** This object holds references to users and when they voted on which websites, with their user ID as the key, and an object with the last recorded and next redeemable vote for the respective websites as variables. */
export type VoteList = Record<string, {
	lastRecordedTopVote?: number,
	nextRedeemableTopVote?: number,
	lastRecordedDiscordsVote?: number,
	nextRedeemableDiscordsVote?: number,
	lastRecordedDblVote?: number,
	nextRedeemableDblVote?: number;
}>;

/** This object holds references to webhook messages and who the original author is, with the webhook message ID as the key, and the orginal user ID as the variable. */
export type WebhookMessages = Record<string, string>;


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
	} : T[K] extends Record<string, any> ? {
		type: 'object',
		default: Schema<T[K]>;
		locked: boolean;
	} | {
		type: 'map',
		of: Schema<T[K]>[string],
		locked: boolean;
	} : never;
};


interface Inventory {
	commonPlants: Record<string, number>,
	uncommonPlants: Record<string, number>,
	rarePlants: Record<string, number>,
	specialPlants: Record<string, number>,
	meat: Record<string, number>,
	materials: Record<string, number>;
}

interface Sapling {
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
}

interface Injuries {
	wounds: number,
	infections: number,
	cold: boolean,
	sprains: number,
	poison: boolean;
}

interface Role {
	/** ID of the role */
	roleId: string;
	/** The kind of requirement to meet to earn the role */
	wayOfEarning: 'rank' | 'levels' | 'experience';
	/** The requirement to meet to earn the role */
	requirement: ('Youngling' | 'Apprentice' | 'Hunter' | 'Healer' | 'Elderly') | number;
}

interface Skills {
	global: Record<string, number>,
	personal: Record<string, number>;
}

interface Profile {
	/** ID of the server that this information is associated with */
	readonly serverId: string;
	/** Rank of the character */
	rank: 'Youngling' | 'Apprentice' | 'Hunter' | 'Healer' | 'Elderly';
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
	temporaryStatIncrease: Record<string, 'maxHealth' | 'maxEnergy' | 'maxHunger' | 'maxThirst'>;
	/** Whether the character is resting */
	isResting: boolean;
	/** Whether the character has an open quest */
	hasQuest: boolean;
	/** The current region the character is in */
	currentRegion: 'sleeping dens' | 'food den' | 'medicine den' | 'prairie' | 'ruins' | 'lake';
	/** How many ranks the character has unlocked */
	unlockedRanks: number;
	/** The sapling of the character */
	sapling: Sapling;
	/** Object with injury types as keys and whether the user has them/how many the user has of them as variables */
	injuries: Injuries;
	/** Object with item kinds as the keys and an object of the item types and their quantity as the variables */
	inventory: Inventory;
	/** Array of role objects */
	roles: Array<Role>;
	/** Object of skills, with global and personal skills as key-value pairs */
	skills: Skills;
}

interface Proxy {
	startsWith: string,
	endsWith: string;
}

export interface Character {
	/** Unique ID of the character */
	readonly _id: string;
	/** Name of the character */
	name: string;
	/** Species of the character */
	species: string;
	/** Displayed species of the character */
	displayedSpecies: string;
	/** Description of the character */
	description: string;
	/** Avatar URL of the character */
	avatarURL: string;
	/** Array of Arrays of pronouns the character uses */
	pronounSets: Array<Array<string>>;
	/** Proxy this character uses */
	proxy: Proxy;
	/** Embed color used in messages */
	color: `#${string}`;
	/** Object of character_id as key and an array of timestamps of when the mention has been done as the value */
	mentions: Record<string, Array<number>>;
	/** Object of server IDs this character has been used on as the key and the information associated with it as the value */
	profiles: Record<string, Profile>;
}

interface Advice {
	resting: boolean,
	drinking: boolean,
	eating: boolean,
	passingout: boolean,
	coloredbuttons: boolean;
}

interface Reminders {
	water: boolean,
	resting: boolean;
}

export interface UserSchema {
	/** ID of the user that created the account. Cannot be modified */
	readonly userId: string;
	/** Object of advice kinds as the key and whether the advice has been given as the value */
	advice: Advice;
	/** Object of reminder kinds as the key and whether the user wants to be reminded/pinged for these occasions as the valuev */
	reminders: Reminders;
	/** Object of names of characters as the key and the characters this user has created as value */
	characters: Record<string, Character>;
	/** Object of the server IDs as the key and the id of the character that is currently active as the value */
	currentCharacter: Record<string, string>;
	/** Object of the server IDs as the key and an array of channel IDs as the value */
	autoproxy: Record<string, Array<string>>;
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

interface ProxySetting {
	auto: Array<string>,
	all: Array<string>;
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
	shop: Array<Role>;
	/** Object with the keys "all" and "auto", which hold an array each with channels where proxying isn't allowedv */
	proxysetting: ProxySetting;
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


export interface PlantMapObject {
	/** Name of the plant */
	name: string;
	/** Description of the plant */
	description: string;
	/** Edibabilty of the plant: `e` for edible, `i` for inedible and `t` for toxic */
	edibility: 'e' | 'i' | 't';
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


export interface MaterialsMapObject {
	/** Name of the material */
	name: string;
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


export interface SpeciesMapObject {
	/** Name of the species */
	name: string;
	/** Diet of the species */
	diet: 'omnivore' | 'herbivore' | 'carnivore';
	/** Habitat that the species lives in */
	habitat: 'cold' | 'warm' | 'water';
	/** Opponents that the species meets in biome 1 */
	biome1OpponentArray: Array<string>;
	/** Opponents that the species meets in biome 2 */
	biome2OpponentArray: Array<string>;
	/** Opponents that the species meets in biome 3 */
	biome3OpponentArray: Array<string>;
}