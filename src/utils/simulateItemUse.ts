import { addCorrectDietHungerPoints, removeHungerPoints } from '../commands/gameplay_maintenance/eat';
import { getStatsPoints, isUnlucky, quidNeedsHealing } from '../commands/gameplay_maintenance/heal';
import userModel from '../models/userModel';
import { CommonPlantNames, commonPlantsInfo, Inventory, PlantEdibilityType, PlantInfo, Quid, RankType, RarePlantNames, rarePlantsInfo, ServerSchema, SpecialPlantNames, specialPlantsInfo, SpeciesDietType, speciesInfo, SpeciesNames, UncommonPlantNames, uncommonPlantsInfo, UserSchema } from '../typedef';
import { changeCondition } from './changeCondition';
import { deepCopyObject, getArrayElement, getMapData } from './helperFunctions';
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
): Promise<(Quid<true> & {user_id: string})[]> {

	const twoWeeksInMs = 1_209_600_000;

	const userToQuidArray = (u: UserSchema) => Object.values(u.quids).map(q => ({ ...q, user_id: u._id })).filter((q: Quid & {user_id: string}): q is Quid<true> & {user_id: string} => {
		const p = q?.profiles[guildId];
		return q.species !== '' && p !== undefined && (activeUsersOnly ? p.lastActiveTimestamp > Date.now() - twoWeeksInMs : true);
	});

	return (await userModel.find((u) => userToQuidArray(u).length > 0))
		.map(userToQuidArray).flat();
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

	for (const quid of quids.filter(q => speciesInfo[q.species].diet !== SpeciesDietType.Herbivore)) {

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

/**
 * It takes an array of meat types, and an inventory, and returns a random meat type from the array,
 * weighted by how many of each meat type is in the inventory
 * @param {SpeciesNames[]} options - SpeciesNames[] - An array of the meat types you want to choose
 * from.
 * @param {Inventory} inventory - The inventory of the server
 * @returns A species name.
 */
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


/**
 * It simulates the use of plants in the medicine den, and returns the difference between the amount of plants that are available and the amount of plants that are needed
 * @param {ServerSchema} serverData - The serverData object
 * @param {boolean} activeUsersOnly - boolean - If true, only quids that have been active in the past week will be included in the simulation.
 * @returns The difference between the amount of plants in the inventory and the amount of plants needed.
 */
export async function simulatePlantUse(
	serverData: ServerSchema,
	activeUsersOnly: boolean,
): Promise<number> {

	const quids = await getUsersInServer(serverData.serverId, activeUsersOnly);
	const serverData_ = deepCopyObject(serverData);
	let neededItems = 0;

	/* For each quid, we are getting a random quid that is able to heal, preferably not the current quid unless that is the only available one, and preferably one that doesn't need healing unless that is not possible. Healing takes hunger away, which is why this is done before the other loop and separately from it. */
	for (const quid of quids.filter(q => quidNeedsHealing(q, serverData.serverId))) {

		let healerArray1 = quids.filter(q => {
			const p = q.profiles[serverData.serverId];
			return p && p.rank !== RankType.Youngling && p.health > 0 && p.energy > 0 && p.hunger > 0 && p.thirst > 0;
		});
		if (healerArray1.length > 1) { healerArray1 = healerArray1.filter(q => q._id !== quid._id); }
		const healerArray2 = healerArray1.filter(q => !quidNeedsHealing(q, serverData.serverId));
		const healer = healerArray2.length > 0 ? getArrayElement(healerArray2, getRandomNumber(healerArray2.length)) : healerArray1.length > 0 ? getArrayElement(healerArray1, getRandomNumber(healerArray1.length)) : undefined;
		if (healer === undefined) { break; }

		let profile = getMapData(quid.profiles, serverData.serverId);
		while (quidNeedsHealing(quid, serverData.serverId)) {

			// First, get the quid with the highest rank. Based on that, define itemInfo with or without uncommonPlants and/or rarePlants
			const highestRank = quids.some(q => q.profiles[serverData.serverId]?.rank === RankType.Elderly) ? 2 : quids.some(q => q.profiles[serverData.serverId]?.rank === RankType.Hunter || q.profiles[serverData.serverId]?.rank === RankType.Healer) ? 1 : 0;
			const itemInfo = { ...specialPlantsInfo, ...commonPlantsInfo, ...highestRank > 0 ? uncommonPlantsInfo : {}, ...highestRank > 1 ? rarePlantsInfo : {} };

			// Based on the quids condition, choose item to pick. 0 thirst: water, 0 energy: itemInfo.filter(givesEnergy), 0 hunger: itemInfo.filter(edibility === PlantEdibilityType.Edible), wound: itemInfo.filter(healsWounds), infection: itemInfo.filter(healsInfection), cold: itemInfo.filter(healsColds), sprains: itemInfo.filter(healsSprains), poison: itemInfo.filter(healsPoison). If this returns undefined (which it can, ie when theres nothing that can heal poison), break the while loop.
			const specifcItems = (Object.entries(itemInfo) as [CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames, PlantInfo][]).filter(([, info]) => profile.energy <= 0 ? info.givesEnergy : profile.hunger <= 0 ? info.edibility === PlantEdibilityType.Edible : profile.injuries.wounds > 0 ? info.healsWounds : profile.injuries.infections > 0 ? info.healsInfections : profile.injuries.cold ? info.healsColds : profile.injuries.sprains > 0 ? info.healsSprains : info.healsPoison);
			const item = profile.thirst <= 0 ? 'water' : specifcItems[getRandomNumber(specifcItems.length)]?.[0];
			if (item === undefined) { break; }
			if (item !== 'water') { neededItems += 1; }

			// Copy the isSuccessful checks that have a chance that isSucessful goes from true to false. A function needs to be created in the heal file
			// If it's successful, make the problems go away that this specific item can make go away, using getStatsPoints and the individual things for the injuries.
			if (!isUnlucky(quid.user_id, healer.user_id, profile, serverData)) {

				const stats = getStatsPoints(item, profile);
				profile.health += stats.health;
				profile.energy += stats.energy;
				profile.hunger += stats.hunger;
				profile.thirst += stats.thirst;
				profile.injuries.wounds += item !== 'water' && itemInfo[item]?.healsWounds === true ? 1 : 0;
				profile.injuries.infections += item !== 'water' && itemInfo[item]?.healsInfections === true ? 1 : 0;
				profile.injuries.cold = item !== 'water' && itemInfo[item]?.healsColds === true ? false : profile.injuries.cold;
				profile.injuries.sprains = item !== 'water' && itemInfo[item]?.healsSprains === true ? 1 : 0;
				profile.injuries.poison = item !== 'water' && itemInfo[item]?.healsPoison === true ? false : profile.injuries.poison;
			}

			// change the condition based on a simulation-version of changeCondition, and wear down the den
			profile = (await changeCondition(undefined, quid, profile, 0)).profileData;

			const denStatkind = (['structure', 'bedding', 'thickness', 'evenness'] as const)[getRandomNumber(4)];
			if (denStatkind === undefined) { throw new TypeError('denStatkind is undefined'); }
			serverData_.dens.medicineDen[denStatkind] -= wearDownAmount(serverData_.dens.medicineDen[denStatkind]);
		}
	}

	for (const quid of quids.filter(q => speciesInfo[q.species].diet !== SpeciesDietType.Carnivore)) {

		const profile = getMapData(quid.profiles, serverData.serverId);
		while (profile.hunger < profile.maxHunger) {

			neededItems += 1;
			profile.hunger += addCorrectDietHungerPoints() - removeHungerPoints(serverData_);

			const denStatkind = (['structure', 'bedding', 'thickness', 'evenness'] as const)[getRandomNumber(4)];
			if (denStatkind === undefined) { throw new TypeError('denStatkind is undefined'); }
			serverData_.dens.medicineDen[denStatkind] -= wearDownAmount(serverData_.dens.medicineDen[denStatkind]);
		}
	}

	const existingItems = calculateInventorySize(serverData_.inventory, ([key]) => key === 'commonPlants' || key === 'uncommonPlants' || key === 'rarePlants' || key === 'specialPlants');
	const itemDifference = existingItems - neededItems;

	return itemDifference;
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