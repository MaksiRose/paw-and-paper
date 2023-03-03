export interface DenSchema {
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

// export interface ServerSchema {
// 	/** ID of the server. Cannot be modified */
// 	readonly serverId: string;
// 	/** Name of the server */
// 	name: string;
// 	/** Object with item kinds as the keys and an object of the item types and their quantity as the variables */
// 	inventory: Inventory;
// 	/** Object of the blocked entrance with the name of the den and kind of block as the variables. If no entrance is blocked, they are null */
// 	dens: Dens;
// 	/** Timestamp of the time when the next attack is possible */
// 	nextPossibleAttack: number;
// 	/** ID of the channel that can be visited. If no channel is seleted, this is null */
// 	visitChannelId: string | null;
// 	/** ID of the guild that is currently being visited. If no guild is being visited, this is null */
// 	currentlyVisiting: string | null;
// 	/** Array of role objects */
// 	shop: Array<ShopRole>;
// 	/** Object with settings for the server */
// 	proxySettings: {
// 		/** Object with limits for which channels are allowed */
// 		channels: ProxyLimitedList,
// 		/** Object with limits for which roles are allowed */
// 		roles: ProxyLimitedList,
// 		/** Whether the quid needs a tag to be able to proxy */
// 		tagRequired: boolean,
// 		/** Array of strings of which one has to be included in the tag */
// 		requiredInTag: Array<string>,
// 		/** Whether the tag also has to be in a members display name */
// 		tagInDisplayname: boolean,
// 		/** The ID of the channel that messages should be logged to */
// 		logChannelId: string | null;
// 	};
// 	/** Array of global skills for this server */
// 	skills: Array<string>;
// 	readonly _id: string;
// }