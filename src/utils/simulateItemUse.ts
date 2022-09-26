import { addCorrectDietHungerPoints, removeHungerPoints } from '../commands/gameplay_maintenance/eat';
import userModel from '../models/userModel';
import { Inventory, Quid, ServerSchema, SpeciesDietType, speciesInfo, SpeciesNames, UserSchema } from '../typedef';
import { deepCopyObject, getMapData } from './helperFunctions';
import { getRandomNumber } from './randomizers';
import { wearDownAmount } from './wearDownDen';

type InventoryEntry = [keyof Inventory, Inventory[keyof Inventory]]
/**
 * It takes an inventory object and returns the amount of items in the inventory
 * @param {Inventory} inventory - This is the inventory object.
 * @param [filter] - A filter that can optionally be applied.
 * @returns The amount of items in the inventory.
 */
export function calculateInventorySize(
	inventory: Inventory,
	filter?: (value: InventoryEntry, index: number, array: InventoryEntry[]) => boolean,
): number {

	/** This is an array of all the inventory objects. */
	const inventoryObjectEntries = Object.entries(inventory) as InventoryEntry[];
	/** This is an array of numbers as the properties of the keys in the inventory objects, which are numbers representing the amount one has of the key which is an item type. */
	const inventoryNumberValues = inventoryObjectEntries.filter(filter ?? (() => true)).map(([, type]) => Object.values(type)).flat();

	/* Returns the amount of items in the inventory. */
	return inventoryNumberValues.reduce((a, b) => a + b);
}

/**
 * Get all the quids of all the users who have a profile in the given server.
 * @param {string} guildId - The ID of the server you want to get the users from.
 * @param {boolean} activeUsersOnly - If true, only users who have been active in the last two weeks will be returned.
 * @returns An array of Quid objects.
 */
async function getUsersInServer(
	guildId: string,
	activeUsersOnly: boolean,
): Promise<Quid[]> {

	const twoWeeksInMs = 1_209_600_000;

	const userToProfileArray = (u: UserSchema) => Object.values(u.quids).filter(q => {
		const p = q.profiles[guildId];
		return p !== undefined && (activeUsersOnly ? p.lastActiveTimestamp > Date.now() - twoWeeksInMs : true);
	});

	return (await userModel.find((u) => userToProfileArray(u).length > 0))
		.map(userToProfileArray).flat();
}

/**
 * It simulates the use of meat in a server, and returns the difference between the amount of meat needed and the amount of meat in the server's inventory
 * @param {ServerSchema} serverData - The server data to use.
 * @param {boolean} activeUsersOnly - If true, only users who have been active in the past week will be simulated.
 * @returns The difference between the number of meat items needed and the number of meat items in the inventory.
 */
export async function simulateMeatUse(
	serverData: ServerSchema,
	activeUsersOnly: boolean,
): Promise<number> {

	const quids = await getUsersInServer(serverData.serverId, activeUsersOnly);
	const serverData_ = deepCopyObject(serverData);
	let neededItems = 0;

	for (const quid of quids) {

		if (speciesInfo[quid.species as SpeciesNames].diet === SpeciesDietType.Herbivore) { continue; }
		console.log({ name: quid.name });

		const profile = getMapData(quid.profiles, serverData.serverId);
		while (profile.hunger < profile.maxHunger) {

			neededItems += 1;
			profile.hunger += addCorrectDietHungerPoints() - removeHungerPoints(serverData_);

			const denStatkind = (['structure', 'bedding', 'thickness', 'evenness'] as const)[getRandomNumber(4)];
			if (denStatkind === undefined) { throw new TypeError('denStatkind is undefined'); }
			serverData_.dens.foodDen[denStatkind] -= wearDownAmount(serverData_.dens.foodDen[denStatkind]);
		}
	}

	const existingItems = calculateInventorySize(serverData_.inventory, ([key]) => key === 'meat');
	console.log({ existingItems, neededItems });
	const itemDifference = neededItems - existingItems;

	return itemDifference;
}