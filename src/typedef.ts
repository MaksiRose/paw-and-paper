import { SlashCommandBuilder } from '@discordjs/builders';
import { Api } from '@top-gg/sdk';
import { Client, ClientOptions, CommandInteraction, MessageContextMenuInteraction, MessageEmbed } from 'discord.js';
import bfd from 'bfd-api-redux/src/main';

export interface Command {
	name: string;
	data?: SlashCommandBuilder | { name: string, type: number; };
	sendCommand: (client?: CustomClient, interaction?: MessageContextMenuInteraction | CommandInteraction, argumentsArray?: Array<string>, userData?: UserSchema, serverData?: ServerSchema, embedArray?: Array<MessageEmbed>) => Promise<void>;
}

export interface Votes {
	token: string;
	authorization: string;
	client: bfd | Api | null;
}

export class CustomClient extends Client {

	commands: Record<string, Command>;
	votes: Record<string, Votes>;

	constructor(options: ClientOptions) {

		super(options);
		this.commands = {};
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
	exists: boolean; // Whether there is a sapling
	health: number; // The health of the sapling
	waterCycles: number; // How many times the sapling has been watered
	nextWaterTimestamp: number | null; // Timestamp of the next perfect watering
	lastMessageChannelId: string | null; // The ID of the last channel the sapling was watered in
}

interface Injuries {
	wounds: number,
	infections: number,
	cold: boolean,
	sprains: number,
	poison: boolean;
}

interface Role {
	roleId: string; // ID of the role
	wayOfEarning: 'rank' | 'levels' | 'experience'; // The kind of requirement to meet to earn the role
	requirement: ('Youngling' | 'Apprentice' | 'Hunter' | 'Healer' | 'Elderly') | number; // The requirement to meet to earn the role
}

interface Skills {
	global: Record<string, number>,
	personal: Record<string, number>;
}

interface Profile {
	readonly serverId: string; // ID of the server that this information is associated with
	rank: 'Youngling' | 'Apprentice' | 'Hunter' | 'Healer' | 'Elderly'; // Rank of the character
	levels: number; // Levels of the character
	experience: number; // Experience Points of the character
	health: number; // Health Points of the character
	energy: number; // Energy Points of the character
	hunger: number; // Hunger Points of the character
	thirst: number; // Thirst Points of the character
	maxHealth: number; // Maximum Health Points of the character
	maxEnergy: number; // Maximum Energy Points of the character
	maxHunger: number; // Maximum Hunger Points of the character
	maxThirst: number; // Maximum Thirst Points of the character
	temporaryStatIncrease: Record<string, 'maxHealth' | 'maxEnergy' | 'maxHunger' | 'maxThirst'>; // Object with a timestamp as the key and the kind of stat that is increased as the value
	isResting: boolean; // Whether the character is resting
	hasCooldown: boolean; // Whether the character is on a cooldown
	hasQuest: boolean; // Whether the character has an open quest.
	currentRegion: 'sleeping dens' | 'food den' | 'medicine den' | 'prairie' | 'ruins' | 'lake'; // The current region the character is in
	unlockedRanks: number; // How many ranks the character has unlocked
	sapling: Sapling; // The sapling of the character
	injuries: Injuries; // Object with injury types as keys and whether the user has them/how many the user has of them as variables
	inventory: Inventory; // Object with item kinds as the keys and an object of the item types and their quantity as the variables
	roles: Array<Role>; // Array of role objects
	skills: Skills; // Object of skills, with global and personal skills as key-value pairs
}

interface Proxy {
	startsWith: string,
	endsWith: string;
}

interface Character {
	readonly _id: string; // Unique ID of the character
	name: string; // Name of the character
	species: string; // Species of the character
	displayedSpecies: string; // Displayed species of the character
	description: string; // Description of the character
	avatarURL: string; // Avatar URL of the character
	pronounSets: Array<Array<string>>; // Array of Arrays of pronouns the character uses
	proxy: Proxy; // Proxy this character uses
	color: `#${number}`; // Embed color used in messages
	mentions: Record<string, Array<number>>; // Object of character_id as key and an array of timestamps of when the mention has been done as the value
	profiles: Record<string, Profile>; // Object of server IDs this character has been used on as the key and the information associated with it as the value
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
	readonly userId: string; // ID of the user that created the account. Cannot be modified
	advice: Advice; // Object of advice kinds as the key and whether the advice has been given as the value
	reminders: Reminders; // Object of reminder kinds as the key and whether the user wants to be reminded/pinged for these occasions as the value
	characters: Record<string, Character>; // Object of names of characters as the key and the characters this user has created as value
	currentCharacter: Record<string, string>; // Object of the server IDs as the key and the id of the character that is currently active as the value
	autoproxy: Record<string, Array<string>>; // Object of the server IDs as the key and an array of channel IDs as the value
	lastPlayedVersion: string; // Last major version that the user played on
	readonly uuid: string;
}


interface DenSchema {
	structure: number; // How strong the structure of the den is
	bedding: number; // How nice the ground of the den is
	thickness: number; // How thick the walls of the den are
	evenness: number; // How even the walls of the den are
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
	readonly serverId: string; // ID of the server. Cannot be modified
	name: string; // Name of the server
	inventory: Inventory; // Object with item kinds as the keys and an object of the item types and their quantity as the variables
	dens: Dens; // Object of the blocked entrance with the name of the den and kind of block as the variables. If no entrance is blocked, they are null
	nextPossibleAttack: number; // Timestamp of the time when the next attack is possible
	visitChannelId: string | null; // ID of the channel that can be visited. If no channel is seleted, this is null
	currentlyVisiting: string | null; // ID of the guild that is currently being visited. If no guild is being visited, this is null
	shop: Array<Role>; // Array of role objects
	proxysetting: ProxySetting; // Object with the keys "all" and "auto", which hold an array each with channels where proxying isn't allowed
	skills: Array<string>; // Array of global skills for this server
	readonly uuid: string;
}

export interface Event {
	name: string; // Name of the event
	once: boolean; // Whether the event should be executed once
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	execute: (client: CustomClient, ...args: Array<any>) => Promise<void>;
}


export interface PlantMapObject {
	name: string; // Name of the plant
	description: string; // Description of the plant
	edibility: 'e' | 'i' | 't'; // Edibabilty of the plant: `e` for edible, `i` for inedible and `t` for toxic
	healsWounds: boolean; // Whether the plant heals wounds
	healsInfectios: boolean; // Whether the plant heals infections
	healsColds: boolean; // Whether the plant heals colds
	healsSprains: boolean; // Whether the plant heals sprains
	healsPoison: boolean; // Whether the plant heals poison
	givesEnergy: boolean; // Whether the plant gives energy
	increasesMaxCondition: boolean; // Whether the plant increases the maximum of one condition
}


export interface MaterialsMapObject {
	name: string; // Name of the material
	description: string; // Description of the material
	reinforcesStructure: boolean; // Whether the material reinforces the structure of a den
	improvesBedding: boolean; // Whether the material improves the bedding of the den
	thickensWalls: boolean; // Whether the material thickens the walls of the den
	removesOverhang: boolean; // Whether the material removes overhang from the walls of the hang
}


export interface SpeciesMapObject {
	name: string; // Name of the species
	diet: 'omnivore' | 'herbivore' | 'carnivore'; // Diet of the species
	habitat: 'cold' | 'warm' | 'water'; // Habitat that the species lives in
	biome1OpponentArray: Array<string>; // Opponents that the species meets in biome 1
	biome2OpponentArray: Array<string>; // Opponents that the species meets in biome 2
	biome3OpponentArray: Array<string>; // Opponents that the species meets in biome 3
}