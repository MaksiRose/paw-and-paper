import { ProxyListType, RankType, WayOfEarningType } from './user';

/** This object holds references to guilds and users that cannot make accounts in their respective Arrays. */
export interface BanList {
	users: Array<string>;
	servers: Array<string>;
}

/** This object holds references to user accounts that are friends. */
export type GivenIdList = Array<string>;

/** This object holds references to files that will be deleted, with either a guild ID or a user + guild ID as the key, and an object with the file name and deletion timestamp as variables. */
export type DeleteList = { [key: string]: number; };

/** This object holds errorIds as keys with their error stacks as variables. */
export type ErrorStacks = { [key: string]: string; };

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


/** Object with a whitelist and blacklist and which one it is set to */
export interface ProxyLimitedList {
	/** Whether the whitelist or blacklist is enabled */
	setTo: ProxyListType,
	/** Array of IDs that are on the whitelist */
	whitelist: Array<string>,
	/** Array of IDs that are on the blacklist */
	blacklist: Array<string>;
}


export type CommonPlantNames = 'raspberry' | 'garlic' | 'herb Robert' | 'field scabious' | 'henna' | 'elderberry' | 'comfrey' | 'marigold' | 'common hollyhock' | 'arnica' | 'clover' | 'passion fruit' | 'bergamot orange' | 'cicely' | 'acorn' | 'rhodiola';

export type UncommonPlantNames = 'solomon\'s seal' | 'gotu kola' | 'great mullein' | 'purple coneflower' | 'field horsetail' | 'bay laurel' | 'chick weed' | 'yerba mate';

export type RarePlantNames = 'ribwort plantain' | 'charcoal-tree leaves' | 'marsh mallow';

export type SpecialPlantNames = 'black-eyed Susan';

export type SpeciesNames = 'wolf' | 'cat' | 'fox' | 'leopard' | 'tiger' | 'shark' | 'caracal' | 'bear' | 'coyote' | 'rabbit' | 'squirrel' | 'lion' | 'seal' | 'salmon' | 'tuna' | 'squid' | 'crab' | 'orca' | 'maned wolf' | 'dog' | 'owl' | 'deer' | 'penguin' | 'gaboon viper' | 'hoatzin' | 'weasel' | 'hawk' | 'eagle' | 'raccoon' | 'horse' | 'elk' | 'cassowary' | 'humpback whale' | 'goat' | 'kinkajou' | 'praying mantis' | 'cricket' | 'beetle' | 'moth' | 'bee' | 'cougar' | 'frog' | 'crow' | 'king cobra' | 'rat' | 'hedgehog' | 'beaver' | 'turtle' | 'anole' | 'porcupine' | 'mongoose' | 'otter' | 'ferret' | 'tropical parrot' | 'warthog';

export type MaterialNames = 'stick' | 'pine cone' | 'root' | 'moss' | 'leaf' | 'algae' | 'clay' | 'vine' | 'soil' | 'rock' | 'seashell' | 'bone';

export interface Inventory {
	commonPlants: { [key in CommonPlantNames]: number },
	uncommonPlants: { [key in UncommonPlantNames]: number },
	rarePlants: { [key in RarePlantNames]: number },
	specialPlants: { [key in SpecialPlantNames]: number },
	meat: { [key in SpeciesNames]: number },
	materials: { [key in MaterialNames]: number };
}


export interface ShopRole {
	/** ID of the role */
	roleId: string;
	/** The kind of requirement to meet to earn the role */
	wayOfEarning: WayOfEarningType;
	/** The requirement to meet to earn the role */
	requirement: RankType | number;
}