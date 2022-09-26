import { addCorrectDietHungerPoints, removeHungerPoints } from '../commands/gameplay_maintenance/eat';
import userModel from '../models/userModel';
import { Inventory, Quid, ServerSchema, SpeciesDietType, speciesInfo, SpeciesNames, UserSchema } from '../typedef';
import { deepCopyObject, getMapData } from './helperFunctions';
import { getRandomNumber, pullFromWeightedTable } from './randomizers';
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
 * It simulates the use of meat in a server, and returns the difference between the amount of meat in the server's inventory and the amount of meat needed
 * @param {ServerSchema} serverData - The server data to use.
 * @param {boolean} activeUsersOnly - If true, only users who have been active in the past week will be simulated.
 * @returns The difference between the amount of meat in the server's inventory and the amount of meat needed
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
	const itemDifference = existingItems - neededItems;

	return itemDifference;
}

export function pickMeat(
	options: SpeciesNames[],
	inventory: Inventory,
): SpeciesNames {

	// First, get how many times each of these meat types exist in the inventory. these are the denominators. We add 1 to each to avoid having null as a possible value, which would break the code
	let object = options.reduce((prev, cur, index) => ({ ...prev, [index]: inventory.meat[cur] + 1 }), {} as Record<number, number>);
	const numerator = Math.min(...Object.values(object));
	const smallestCommon = smallestCommons(Object.values(object));

	// We make a new array, from the values of the object, where each item is the common denominotor divided by the property of the object multiplied by the numerator.
	const sumArr = Object.values(object).reduce((prev, cur) => [...prev, (smallestCommon / cur) * numerator], [] as number[]);
	const sum = sumArr.reduce((a, b) => a + b);
	const x = 100 * (smallestCommon / sum);

	// For the old object, we do Math.round(x * (numerator / property))
	object = Object.values(object).reduce((prev, cur, index) => ({ ...prev, [index]: Math.round(x * (numerator / cur)) }), {} as Record<number, number>);
	const random = pullFromWeightedTable(object);
	const result = options[random];
	if (result === undefined) { throw new TypeError('result is undefined'); }
	return result;
}

function smallestCommons(
	array: number[],
): number {

	array = array.sort((a, b) => a - b);

	const max = Math.max(...array);
	let n = max;
	// Creating the function that .every will operate on
	const lowestCommon = (currentValue: number) => n % currentValue === 0;
	// Checking whether the first value for n is the lowestCommon Multiple
	let common = array.every(lowestCommon);
	// Checking for a true result from the array
	while (common === false) {
		n++;
		common = array.every(lowestCommon);
	}
	return n;
}