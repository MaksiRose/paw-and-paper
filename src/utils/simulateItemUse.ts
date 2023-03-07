import { Op } from 'sequelize';
import { commonPlantsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '..';
import { addCorrectDietHungerPoints, removeHungerPoints } from '../commands/gameplay_maintenance/eat';
import { getStatsPoints, isUnlucky as healingIsUnlucky, quidNeedsHealing } from '../commands/gameplay_maintenance/heal';
import { addMaterialPoints, isUnlucky as repairingIsUnlucky } from '../commands/gameplay_maintenance/repair';
import Den from '../models/den';
import Quid from '../models/quid';
import QuidToServer from '../models/quidToServer';
import Server from '../models/server';
import { CommonPlantNames, Inventory, MaterialNames, RarePlantNames, SpecialPlantNames, SpeciesNames, UncommonPlantNames } from '../typings/data/general';
import { DenSchema } from '../typings/data/server';
import { RankType } from '../typings/data/user';
import { PlantEdibilityType, PlantInfo, SpeciesDietType } from '../typings/main';
import { changeCondition } from './changeCondition';
import { deepCopyObject, getArrayElement } from './helperFunctions';
import { getRandomNumber, pullFromWeightedTable } from './randomizers';
import { wearDownAmount } from './wearDownDen';

/**
 * Get all the quids of all the users who have a profile in the given server.
 * @param {string} serverId - The ID of the server you want to get the users from.
 * @param {boolean} activeUsersOnly - If true, only users who have been active in the last two weeks will be returned.
 * @returns An array of Quid objects.
 */
async function getProfilesInServer(
	serverId: string,
	activeUsersOnly: boolean,
): Promise<QuidToServer[]> {

	const twoWeeksInMs = 1_209_600_000;
	return await QuidToServer.findAll({
		include: [{
			model: Quid,
			where: {
				name: { [Op.not]: '' },
				species: { [Op.not]: null },
			},
		}],
		where: {
			serverId: serverId,
			lastActiveTimestamp: { [Op.gte]: activeUsersOnly ? (Date.now() - twoWeeksInMs) : 0 },
		},
	});
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

	const serverData_ = deepCopyObject(serverData);
	const users = await getProfilesInServer(serverData_.serverId, activeUsersOnly);
	let neededItems = 0;

	for (const user of users.filter(u => speciesInfo[u.quid.species].diet !== SpeciesDietType.Herbivore)) {

		while (user.quidToServer.hunger < user.quidToServer.maxHunger) {

			neededItems += 1;
			user.quidToServer.hunger += addCorrectDietHungerPoints() - removeHungerPoints(serverData_);

			const denStatkind = (['structure', 'bedding', 'thickness', 'evenness'] as const)[getRandomNumber(4)];
			if (denStatkind === undefined) { throw new TypeError('denStatkind is undefined'); }
			serverData_.dens.foodDen[denStatkind] -= wearDownAmount(serverData_.dens.foodDen[denStatkind]);
		}
	}

	const existingItems = calculateInventorySize(server.inventory, ([key]) => key === 'meat');
	const itemDifference = existingItems - neededItems;

	return itemDifference;
}

/**
 * It takes an array of meat types, and an inventory, and returns a random meat type from the array, weighted by how many of each meat type is in the inventory
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
	const object = options.reduce((prev, cur, index) => ({ ...prev, [index]: inventory.meat[cur] + 1 }), {} as Record<number, number>);
	return pickItem(object, options);
}


function getNeededHungerItems(
	quidsToServer: QuidToServer[],
	foodDen: Den,
): number {

	let neededItems = 0;
	for (const quidToServer of quidsToServer.filter(qts => qts.quid.species !== null && speciesInfo[qts.quid.species].diet !== SpeciesDietType.Carnivore)) {

		while (quidToServer.hunger < quidToServer.maxHunger) {

			neededItems += 1;
			quidToServer.hunger += addCorrectDietHungerPoints() - removeHungerPoints(foodDen);

			const denStatkind = (['structure', 'bedding', 'thickness', 'evenness'] as const)[getRandomNumber(4)];
			if (denStatkind === undefined) { throw new TypeError('denStatkind is undefined'); }
			foodDen[denStatkind] -= wearDownAmount(foodDen[denStatkind]);
		}
	}
	return neededItems;
}

function getNeededMedicineItems(
	quidsToServer: QuidToServer[],
	medicineDen: Den,
	checkOnlyFor?: 'energy' | 'hunger' | 'wounds' | 'infections' | 'cold' | 'sprains' | 'poison',
): number {

	let neededItems = 0;
	/* For each quid, we are getting a random quid that is able to heal, preferably not the current quid unless that is the only available one, and preferably one that doesn't need healing unless that is not possible. Healing takes hunger away, which is why this is done before the other loop and separately from it. */
	for (const quidToServer of quidsToServer.filter(u => quidNeedsHealing(u, checkOnlyFor))) {

		let healerArray1 = quidsToServer.filter(qts => {
			return qts.rank !== RankType.Youngling && qts.health > 0 && qts.energy > 0 && qts.hunger > 0 && qts.thirst > 0;
		});
		if (healerArray1.length > 1) { healerArray1 = healerArray1.filter(u => u.id !== quidToServer.id); }
		const healerArray2 = healerArray1.filter(u => !quidNeedsHealing(u));
		const healer = healerArray2.length > 0 ? getArrayElement(healerArray2, getRandomNumber(healerArray2.length)) : healerArray1.length > 0 ? getArrayElement(healerArray1, getRandomNumber(healerArray1.length)) : undefined;
		if (healer === undefined) { break; }

		while (quidNeedsHealing(quidToServer, checkOnlyFor)) {

			// First, get the quid with the highest rank. Based on that, define itemInfo with or without uncommonPlants and/or rarePlants
			const highestRank = quidsToServer.some(qts => qts.rank === RankType.Elderly) ? 2 : quidsToServer.some(qts => quidToServer.rank === RankType.Hunter || qts.rank === RankType.Healer) ? 1 : 0;
			const itemInfo = { ...specialPlantsInfo, ...commonPlantsInfo, ...highestRank > 0 ? uncommonPlantsInfo : {}, ...highestRank > 1 ? rarePlantsInfo : {} };

			// Based on the quids condition, choose item to pick. 0 thirst: water, 0 energy: itemInfo.filter(givesEnergy), 0 hunger: itemInfo.filter(edibility === PlantEdibilityType.Edible), wound: itemInfo.filter(healsWounds), infection: itemInfo.filter(healsInfection), cold: itemInfo.filter(healsColds), sprains: itemInfo.filter(healsSprains), poison: itemInfo.filter(healsPoison). If this returns undefined (which it can, ie when theres nothing that can heal poison), break the while loop.
			const specificItems = (Object.entries(itemInfo) as [CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames, PlantInfo][]).filter(([, info]) => quidToServer.energy <= 0 ? info.givesEnergy : quidToServer.hunger <= 0 ? info.edibility === PlantEdibilityType.Edible : quidToServer.injuries_wounds > 0 ? info.healsWounds : quidToServer.injuries_infections > 0 ? info.healsInfections : quidToServer.injuries_cold ? info.healsColds : quidToServer.injuries_sprains > 0 ? info.healsSprains : info.healsPoison);
			const item = quidToServer.thirst <= 0 ? 'water' : specificItems[getRandomNumber(specificItems.length)]?.[0];
			if (item === undefined) { break; }
			if (item !== 'water') { neededItems += 1; }

			// Copy the isSuccessful checks that have a chance that isSucessful goes from true to false. A function needs to be created in the heal file
			// If it's successful, make the problems go away that this specific item can make go away, using getStatsPoints and the individual things for the injuries.
			if (!healingIsUnlucky(quidToServer.quid.userId, healer.quid.id, healer, medicineDen)) {

				const stats = getStatsPoints(item, quidToServer);
				quidToServer.health += stats.health;
				quidToServer.energy += stats.energy;
				quidToServer.hunger += stats.hunger;
				quidToServer.thirst += stats.thirst;
				quidToServer.injuries_wounds -= item !== 'water' && itemInfo[item]?.healsWounds === true ? 1 : 0;
				quidToServer.injuries_infections -= item !== 'water' && itemInfo[item]?.healsInfections === true ? 1 : 0;
				quidToServer.injuries_cold = item !== 'water' && itemInfo[item]?.healsColds === true ? false : quidToServer.injuries_cold;
				quidToServer.injuries_sprains -= item !== 'water' && itemInfo[item]?.healsSprains === true ? 1 : 0;
				quidToServer.injuries_poison = item !== 'water' && itemInfo[item]?.healsPoison === true ? false : quidToServer.injuries_poison;
			}

			// change the condition based on a simulation-version of changeCondition, and wear down the den
			changeCondition(healer, healer.quid, 0, undefined, false, false);

			const denStatkind = (['structure', 'bedding', 'thickness', 'evenness'] as const)[getRandomNumber(4)];
			if (denStatkind === undefined) { throw new TypeError('denStatkind is undefined'); }
			medicineDen[denStatkind] -= wearDownAmount(medicineDen[denStatkind]);
		}
	}
	return neededItems;
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

	const quids = await getProfilesInServer(serverData.serverId, activeUsersOnly);
	const neededItems = getNeededHungerItems(quids, serverData) + getNeededMedicineItems(quids, serverData);

	const existingItems = calculateInventorySize(server.inventory, ([key]) => key === 'commonPlants' || key === 'uncommonPlants' || key === 'rarePlants' || key === 'specialPlants');
	const itemDifference = existingItems - neededItems;

	return itemDifference;
}

/**
 * It picks out a random plant randomly but weighted based on what purpose the plant has and which purposes are needed the most, and which plant with that purpose the server has least of
 * @param {0 | 1 | 2} include - 0 = only common, 1 = common and uncommon, 2 = common, uncommon and rare
 * @param {ServerSchema} serverData - The server data.
 * @returns A plant name.
 */
export async function pickPlant(
	include: 0,
	server: Server,
): Promise<CommonPlantNames>
export async function pickPlant(
	include: 1,
	server: Server,
): Promise<CommonPlantNames | UncommonPlantNames>
export async function pickPlant(
	include: 0 | 1 | 2,
	server: Server,
): Promise<CommonPlantNames | UncommonPlantNames | RarePlantNames>
export async function pickPlant(
	include: 0 | 1 | 2,
	server: Server,
): Promise<CommonPlantNames | UncommonPlantNames | RarePlantNames> {

	const itemInfo = { ...commonPlantsInfo, ...uncommonPlantsInfo, ...rarePlantsInfo, ...specialPlantsInfo };
	const quidsToServer = await getProfilesInServer(server.id, false);

	server.inventory;

	const foodDen = await Den.findByPk(server.foodDenId, { rejectOnEmpty: true });
	const medicineDen = await Den.findByPk(server.medicineDenId, { rejectOnEmpty: true });

	const neededEatingItems = getNeededHungerItems(quidsToServer, foodDen);
	const neededEnergyItems = getNeededMedicineItems(quidsToServer, medicineDen, 'energy');
	const neededHungerItems = getNeededMedicineItems(quidsToServer, medicineDen, 'hunger');
	const neededWoundItems = getNeededMedicineItems(quidsToServer, medicineDen, 'wounds');
	const neededInfectionItems = getNeededMedicineItems(quidsToServer, medicineDen, 'infections');
	const neededColdItems = getNeededMedicineItems(quidsToServer, medicineDen, 'cold');
	const neededSprainItems = getNeededMedicineItems(quidsToServer, medicineDen, 'sprains');
	const neededPoisonItems = getNeededMedicineItems(quidsToServer, medicineDen, 'poison');

	server.inventory = removeLeastUsefulItem(server.inventory, 'edibility', itemInfo, neededEatingItems + neededHungerItems);
	server.inventory = removeLeastUsefulItem(server.inventory, 'givesEnergy', itemInfo, neededEnergyItems);
	server.inventory = removeLeastUsefulItem(server.inventory, 'healsWounds', itemInfo, neededWoundItems);
	server.inventory = removeLeastUsefulItem(server.inventory, 'healsInfections', itemInfo, neededInfectionItems);
	server.inventory = removeLeastUsefulItem(server.inventory, 'healsColds', itemInfo, neededColdItems);
	server.inventory = removeLeastUsefulItem(server.inventory, 'healsSprains', itemInfo, neededSprainItems);
	server.inventory = removeLeastUsefulItem(server.inventory, 'healsPoison', itemInfo, neededPoisonItems);

	const items = new Map<string, number>();
	const rarePlants = Object.keys(rarePlantsInfo);
	const uncommonPlants = Object.keys(uncommonPlantsInfo);
	const commonPlants = Object.keys(commonPlantsInfo);
	server.inventory.forEach((item) => {

		const isRightItemType = (include < 2 ? false : rarePlants.includes(item)) ||
		(include < 1 ? false : uncommonPlants.includes(item)) ||
		commonPlants.includes(item);
		if (!isRightItemType) { return; }

		const itemCount = items.get(item);
		if (itemCount) { items.set(item, itemCount + 1); }
		else { items.set(item, 1); }
	});

	return pickItem(items) as CommonPlantNames | UncommonPlantNames | RarePlantNames;
}

function findLeastUsefulItem(
	inventory: string[],
	checkFor: 'givesEnergy' | 'edibility' | 'healsWounds' | 'healsInfections' | 'healsColds' | 'healsSprains' | 'healsPoison',
	itemInfo: Record<string, PlantInfo>,
): string | null {

	let leastUsefulItem: string | null = null;
	let leastUsefulItemUsefulness = 7;

	for (const item of inventory) {

		const itemData = itemInfo[item];
		if (!itemData) { continue; }

		if (checkFor === 'edibility' ? itemData[checkFor] !== PlantEdibilityType.Edible : itemData[checkFor] === false) { continue; }
		const itemUsefulness = [itemData.edibility === PlantEdibilityType.Edible, itemData.healsWounds, itemData.healsInfections, itemData.healsColds, itemData.healsSprains, itemData.healsPoison, itemData.givesEnergy].filter(v => v).length;
		if (itemUsefulness < leastUsefulItemUsefulness) {

			leastUsefulItem = item;
			leastUsefulItemUsefulness = itemUsefulness;
		}
	}

	return leastUsefulItem;
}

function removeLeastUsefulItem(
	inventory: string[],
	checkFor: 'givesEnergy' | 'edibility' | 'healsWounds' | 'healsInfections' | 'healsColds' | 'healsSprains' | 'healsPoison',
	itemInfo: Record<string, PlantInfo>,
	amount: number,
): string[] {

	let leastUsefulItem: string | null = null;
	for (let i = 0; i < amount; i++) {

		if (inventory.length === 0) { break; }
		leastUsefulItem = (leastUsefulItem && inventory.includes(leastUsefulItem)) ? leastUsefulItem : findLeastUsefulItem(inventory, checkFor, itemInfo);
		if (!leastUsefulItem) { break; }

		const index = inventory.indexOf(leastUsefulItem);
		if (index === -1) { throw new Error('index is -1'); }
		inventory = inventory.splice(index, 1);
	}

	return inventory;
}

function pickItem(items: Map<string, number>): string {

	// Create an array of [item, count] pairs from the Map
	const itemsArr = Array.from(items.values());

	// Sort the items by count, from lowest to highest
	itemsArr.sort((a, b) => a - b);

	const min = Math.min(...itemsArr);
	const max = Math.max(...itemsArr);
	const median = itemsArr[Math.floor(itemsArr.length / 2)] || 1;

	const inventoryMap = new Map<number, string[]>();
	for (const [item, inventory] of items) {

		const entry = inventoryMap.get(inventory);
		if (!entry) { inventoryMap.set(inventory, []); }
		else { entry.push(item); }
	}

	const result = [];
	for (let i = min; i <= max; i++) {

		const items = inventoryMap.get(i) || [];
		const count = (max - i + 1) * (i > median ? 1 : (max - i + 1));
		for (let j = 0; j < count; j++) { result.push(...items); }
	}

	return getArrayElement(result, getRandomNumber(result.length));
}

/**
 * It simulates the use of material in a server, and returns the difference between the amount of material in the server's inventory and the amount of material needed
 * @param {ServerSchema} serverData - The server data to use.
 * @param {boolean} activeUsersOnly - If true, only users who have been active in the past week will be simulated.
 * @returns The difference between the amount of material in the server's inventory and the amount of material needed
 */
export async function simulateMaterialUse(
	serverData: ServerSchema,
	activeUsersOnly: boolean,
): Promise<number> {

	const serverData_ = deepCopyObject(serverData);
	const users = await getProfilesInServer(serverData_.serverId, activeUsersOnly);
	let neededItems = 0;

	for (const den of Object.values(serverData_.dens) as DenSchema[]) {

		while ((Object.values(den) as number[]).every(stat => stat >= 100) === false) {

			const repairerArray1 = users.filter(u => {
				return u.quidToServer.rank !== RankType.Youngling && u.quidToServer.health > 0 && u.quidToServer.energy > 0 && u.quidToServer.hunger > 0 && u.quidToServer.thirst > 0;
			});
			const repairerArray2 = repairerArray1.filter(u => !quidNeedsHealing(u));
			const repairer = repairerArray2.length > 0 ? getArrayElement(repairerArray2, getRandomNumber(repairerArray2.length)) : repairerArray1.length > 0 ? getArrayElement(repairerArray1, getRandomNumber(repairerArray1.length)) : undefined;
			if (repairer === undefined) { break; }

			neededItems += 1;
			const isUnlucky = repairingIsUnlucky(repairer);
			if (!isUnlucky) {

				const repairAmount = addMaterialPoints();
				if (den.bedding < 100) { den.bedding += repairAmount; }
				else if (den.evenness < 100) { den.evenness += repairAmount; }
				else if (den.structure < 100) { den.structure += repairAmount; }
				else { den.thickness += repairAmount; }
			}

			changeCondition(repairer, 0, undefined, false, false);
		}
	}

	const existingItems = calculateInventorySize(server.inventory, ([key]) => key === 'materials');
	const itemDifference = existingItems - neededItems;

	return itemDifference;
}

/**
 * It takes an inventory and returns a random material weighted by how much of each material is in the inventory
 * @param {Inventory} inventory - Inventory - this is the inventory object that we're going to be
 * picking from.
 * @returns A MaterialNames
 */
export function pickMaterial(
	inventory: Inventory,
): MaterialNames {

	const options: MaterialNames[] = Object.keys(inventory.materials) as MaterialNames[];
	const object = options.reduce((prev, curItem, index) => ({ ...prev, [index]: inventory.materials[curItem] + 1 }), {} as Record<number, number>);
	return pickItem(object, options);
}


// function pickItem<T extends string>(map: Map<T, number>): T {

// 	const mapValues = [...map.values()];
// 	const numerator = Math.min(...mapValues);
// 	const smallestCommon = smallestCommons(mapValues);

// 	// We make a new array, from the values of the object, where each item is the common denominotor divided by the property of the object multiplied by the numerator.
// 	const sum = mapValues.reduce((prev, cur) => prev + ((smallestCommon / cur) * numerator), 0);
// 	const x = 100 * (smallestCommon / sum);

// 	// For the old object, we do Math.round(x * (numerator / property))
// 	const obj = [...map.entries()].reduce((prev, [name, cur]) => ({ ...prev, [name]: Math.round(x * (numerator / cur)) }), {} as Record<T, number>);

// 	const table: Array<T> = [];

// 	for (const i of Object.keys(obj) as T[]) {

// 		for (let j = 0; j < (obj[i] ?? 0); j++) { table.push(i); }
// 	}

// 	return getArrayElement(table, getRandomNumber(table.length));

// 	const random = pullFromWeightedTable(map);
// 	return getArrayElement(options, random);
// }

// function smallestCommons(
// 	array: number[],
// ): number {

// 	array = array.sort((a, b) => a - b);

// 	const max = Math.max(...array);
// 	let n = max;
// 	// Creating the function that .every will operate on
// 	const lowestCommon = (currentValue: number) => n % currentValue === 0;
// 	// Checking whether the first value for n is the lowestCommon Multiple
// 	let common = array.every(lowestCommon);
// 	// Checking for a true result from the array
// 	while (common === false) {
// 		n++;
// 		common = array.every(lowestCommon);
// 	}
// 	return n;
// }