import { Op } from 'sequelize';
import { commonPlantsInfo, materialsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '..';
import { addCorrectDietHungerPoints, removeHungerPoints } from '../commands/gameplay_maintenance/eat';
import { getStatsPoints, isUnlucky as healingIsUnlucky, quidNeedsHealing } from '../commands/gameplay_maintenance/heal';
import { addMaterialPoints, isUnlucky as repairingIsUnlucky } from '../commands/gameplay_maintenance/repair';
import Den from '../models/den';
import Quid from '../models/quid';
import QuidToServer from '../models/quidToServer';
import Server from '../models/server';
import { CommonPlantNames, MaterialNames, RarePlantNames, SpecialPlantNames, SpeciesNames, UncommonPlantNames } from '../typings/data/general';
import { RankType } from '../typings/data/user';
import { PlantEdibilityType, PlantInfo, SpeciesDietType } from '../typings/main';
import { changeCondition } from './changeCondition';
import { getArrayElement, keyInObject, now } from './helperFunctions';
import { getRandomNumber } from './randomizers';
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

	const twoWeeksInS = 1_209_600;
	return await QuidToServer.findAll({
		include: [{
			model: Quid<true>,
			where: {
				name: { [Op.not]: '' },
				species: { [Op.not]: null },
			},
		}],
		where: {
			serverId: serverId,
			lastActiveTimestamp: { [Op.gte]: activeUsersOnly ? (now() - twoWeeksInS) : 0 },
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
	server: Server,
	activeUsersOnly: boolean,
): Promise<number> {

	const quidsToServer = await getProfilesInServer(server.id, activeUsersOnly);
	let neededItems = 0;

	const foodDen = await Den.findByPk(server.foodDenId, { rejectOnEmpty: true });

	for (const quidToServer of quidsToServer.filter(qts => qts.quid.species !== null && speciesInfo[qts.quid.species].diet !== SpeciesDietType.Herbivore)) {

		while (quidToServer.hunger < quidToServer.maxHunger) {

			neededItems += 1;
			quidToServer.hunger += addCorrectDietHungerPoints() - removeHungerPoints(foodDen);

			const denStatkind = (['structure', 'bedding', 'thickness', 'evenness'] as const)[getRandomNumber(4)];
			if (denStatkind === undefined) { throw new TypeError('denStatkind is undefined'); }
			foodDen[denStatkind] -= wearDownAmount(foodDen[denStatkind]);
		}
	}

	const meat = Object.keys(speciesInfo);
	const existingItems = server.inventory.filter(i => meat.includes(i)).length;

	return existingItems - neededItems;
}

/**
 * It takes an array of meat types, and an inventory, and returns a random meat type from the array, weighted by how many of each meat type is in the inventory
 * @param {SpeciesNames[]} options - SpeciesNames[] - An array of the meat types you want to choose
 * from.
 * @param {Inventory} inventory - The inventory of the server
 * @returns A species name.
 */
export async function pickMeat(
	options: SpeciesNames[],
	server: Server,
): Promise<SpeciesNames> {

	let inventory = [...server.inventory];
	const quidsToServer = await getProfilesInServer(server.id, false);

	const foodDen = await Den.findByPk(server.foodDenId, { rejectOnEmpty: true });

	const neededEatingItems = getNeededHungerItems(quidsToServer, foodDen);
	for (let i = 0; i < neededEatingItems; i++) {

		const meatInventory = inventory.filter(i => keyInObject(speciesInfo, i));
		if (meatInventory.length === 0) { break; }

		const anyMeatItem = getArrayElement(meatInventory, getRandomNumber(meatInventory.length));

		const index = inventory.indexOf(anyMeatItem);
		if (index === -1) { throw new Error('index is -1'); }
		inventory = inventory.splice(index, 1);
	}

	const items = new Map<SpeciesNames, number>();
	(Object.keys(speciesInfo) as SpeciesNames[]).forEach((item) => {

		if (!options.includes(item)) { return; }
		items.set(item, inventory.filter(i => i === item).length);
	});

	return pickItem(items);
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
			const specificItems = (Object.entries(itemInfo) as [CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames, PlantInfo][])
				.filter(([, info]) => quidToServer.energy <= 0 ? info.givesEnergy : quidToServer.hunger <= 0 ? info.edibility === PlantEdibilityType.Edible : quidToServer.injuries_wounds > 0 ? info.healsWounds : quidToServer.injuries_infections > 0 ? info.healsInfections : quidToServer.injuries_cold ? info.healsColds : quidToServer.injuries_sprains > 0 ? info.healsSprains : info.healsPoison);

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
	server: Server,
	activeUsersOnly: boolean,
): Promise<number> {

	const itemInfo = Object.keys({ ...commonPlantsInfo, ...uncommonPlantsInfo, ...rarePlantsInfo, ...specialPlantsInfo });
	const quidsToServer = await getProfilesInServer(server.id, activeUsersOnly);

	const foodDen = await Den.findByPk(server.foodDenId, { rejectOnEmpty: true });
	const medicineDen = await Den.findByPk(server.medicineDenId, { rejectOnEmpty: true });

	const existingItems = server.inventory.filter(i => itemInfo.includes(i)).length;
	const neededItems = getNeededHungerItems(quidsToServer, foodDen) + getNeededMedicineItems(quidsToServer, medicineDen);

	return existingItems - neededItems;
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

	let inventory = [...server.inventory];
	const itemInfo = { ...commonPlantsInfo, ...uncommonPlantsInfo, ...rarePlantsInfo, ...specialPlantsInfo };
	const quidsToServer = await getProfilesInServer(server.id, false);

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

	inventory = removeLeastUsefulItem(inventory, 'edibility', itemInfo, neededEatingItems + neededHungerItems);
	inventory = removeLeastUsefulItem(inventory, 'givesEnergy', itemInfo, neededEnergyItems);
	inventory = removeLeastUsefulItem(inventory, 'healsWounds', itemInfo, neededWoundItems);
	inventory = removeLeastUsefulItem(inventory, 'healsInfections', itemInfo, neededInfectionItems);
	inventory = removeLeastUsefulItem(inventory, 'healsColds', itemInfo, neededColdItems);
	inventory = removeLeastUsefulItem(inventory, 'healsSprains', itemInfo, neededSprainItems);
	inventory = removeLeastUsefulItem(inventory, 'healsPoison', itemInfo, neededPoisonItems);

	const items = new Map<CommonPlantNames | UncommonPlantNames | RarePlantNames, number>();
	Object.keys(itemInfo).forEach((item) => {

		if ((include < 2 && keyInObject(rarePlantsInfo, item)) ||
			(include < 1 && keyInObject(uncommonPlantsInfo, item)) ||
			keyInObject(commonPlantsInfo, item)) {

			items.set(item, inventory.filter(i => i === item).length);
		}
	});

	return pickItem(items) ;
}

/**
 * It takes an inventory and returns a random material weighted by how much of each material is in the inventory
 * @param {Inventory} inventory - Inventory - this is the inventory object that we're going to be
 * picking from.
 * @returns A MaterialNames
 */
export async function pickMaterial(
	server: Server,
): Promise<MaterialNames> {


	const quidsToServer = await getProfilesInServer(server.id, false);

	const medicineDen = await Den.findByPk(server.medicineDenId, { rejectOnEmpty: true });
	const foodDen = await Den.findByPk(server.foodDenId, { rejectOnEmpty: true });
	const sleepingDen = await Den.findByPk(server.sleepingDenId, { rejectOnEmpty: true });


	const neededItems = getNeededMaterialItems(quidsToServer, medicineDen, foodDen, sleepingDen);

	let foundBeddingCount = 0;
	server.inventory = server.inventory.filter((item) => {
		if (keyInObject(materialsInfo, item) && materialsInfo[item].improvesBedding && foundBeddingCount < neededItems.neededBeddingItems) {
			foundBeddingCount++;
			return false;
		}
		return true;
	});

	const foundStructureCount = 0;
	server.inventory = server.inventory.filter((item) => {
		if (keyInObject(materialsInfo, item) && materialsInfo[item].reinforcesStructure && foundStructureCount < neededItems.neededStructureItems) {
			foundBeddingCount++;
			return false;
		}
		return true;
	});

	const foundEvennessCount = 0;
	server.inventory = server.inventory.filter((item) => {
		if (keyInObject(materialsInfo, item) && materialsInfo[item].removesOverhang && foundEvennessCount < neededItems.neededEvennessItems) {
			foundBeddingCount++;
			return false;
		}
		return true;
	});

	const foundThicknessCount = 0;
	server.inventory = server.inventory.filter((item) => {
		if (keyInObject(materialsInfo, item) && materialsInfo[item].thickensWalls && foundThicknessCount < neededItems.neededThicknessItems) {
			foundBeddingCount++;
			return false;
		}
		return true;
	});


	const inventory = [...server.inventory];

	const items = new Map<MaterialNames, number>();
	(Object.keys(materialsInfo) as MaterialNames[]).forEach((item) => {

		items.set(item, inventory.filter(i => i === item).length);
	});

	return pickItem(items);
}

function getNeededMaterialItems(
	quidsToServer: QuidToServer[],
	medicineDen: Den,
	foodDen: Den,
	sleepingDen: Den,
): { neededBeddingItems: number, neededEvennessItems: number, neededStructureItems: number, neededThicknessItems: number} {

	let neededBeddingItems = 0;
	let neededEvennessItems = 0;
	let neededStructureItems = 0;
	let neededThicknessItems = 0;
	for (const den of [medicineDen, foodDen, sleepingDen]) {

		while (den.bedding < 100 || den.evenness < 100 || den.structure < 100 || den.thickness < 100) {

			const repairerArray1 = quidsToServer.filter(qts => {
				return qts.rank !== RankType.Youngling && qts.health > 0 && qts.energy > 0 && qts.hunger > 0 && qts.thirst > 0;
			});
			const repairerArray2 = repairerArray1.filter(qts => !quidNeedsHealing(qts));
			const repairer = repairerArray2.length > 0 ? getArrayElement(repairerArray2, getRandomNumber(repairerArray2.length)) : repairerArray1.length > 0 ? getArrayElement(repairerArray1, getRandomNumber(repairerArray1.length)) : undefined;
			if (repairer === undefined) { break; }

			const isUnlucky = repairingIsUnlucky(repairer);
			if (!isUnlucky) {

				const repairAmount = addMaterialPoints();
				if (den.bedding < 100) {

					den.bedding += repairAmount;
					neededBeddingItems += 1;
				}
				else if (den.evenness < 100) {

					den.evenness += repairAmount;
					neededEvennessItems += 1;
				}
				else if (den.structure < 100) {

					den.structure += repairAmount;
					neededStructureItems += 1;
				}
				else {

					den.thickness += repairAmount;
					neededThicknessItems += 1;
				}
			}

			changeCondition(repairer, repairer.quid, 0, undefined, false, false);
		}
	}
	return { neededBeddingItems, neededEvennessItems, neededStructureItems, neededThicknessItems };
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

function pickItem<T extends string>(items: Map<T, number>): T {

	// Create an array of [item, count] pairs from the Map
	const itemsArr = Array.from(items.values());

	// Sort the items by count, from lowest to highest
	itemsArr.sort((a, b) => a - b);

	const min = Math.min(...itemsArr);
	const max = Math.max(...itemsArr);
	const median = itemsArr[Math.floor(itemsArr.length / 2)] || 1;

	const inventoryMap = new Map<number, T[]>();
	for (const [item, inventory] of items) {

		const entry = inventoryMap.get(inventory);
		if (!entry) { inventoryMap.set(inventory, [item]); }
		else { entry.push(item); }
	}

	const result: T[] = [];
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
	server: Server,
	activeUsersOnly: boolean,
): Promise<number> {

	const quidsToServer = await getProfilesInServer(server.id, activeUsersOnly);

	const medicineDen = await Den.findByPk(server.medicineDenId, { rejectOnEmpty: true });
	const foodDen = await Den.findByPk(server.foodDenId, { rejectOnEmpty: true });
	const sleepingDen = await Den.findByPk(server.sleepingDenId, { rejectOnEmpty: true });

	const materialNames = Object.keys(materialsInfo);
	const existingItems = server.inventory.filter(i => materialNames.includes(i)).length;
	const neededItems = Object.values(getNeededMaterialItems(quidsToServer, medicineDen, foodDen, sleepingDen)).reduce((a, b) => a + b, 0);

	return existingItems - neededItems;
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