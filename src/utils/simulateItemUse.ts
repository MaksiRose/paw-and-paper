import { commonPlantsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '..';
import { addCorrectDietHungerPoints, removeHungerPoints } from '../commands/gameplay_maintenance/eat';
import { getStatsPoints, isUnlucky as healingIsUnlucky, quidNeedsHealing } from '../commands/gameplay_maintenance/heal';
import { addMaterialPoints, isUnlucky as repairingIsUnlucky } from '../commands/gameplay_maintenance/repair';
import { userModel, getUserData } from '../oldModels/userModel';
import { CommonPlantNames, Inventory, MaterialNames, RarePlantNames, SpecialPlantNames, SpeciesNames, UncommonPlantNames } from '../typings/data/general';
import { DenSchema, ServerSchema } from '../typings/data/server';
import { RankType, UserData, UserSchema } from '../typings/data/user';
import { PlantEdibilityType, PlantInfo, SpeciesDietType } from '../typings/main';
import { changeCondition } from './changeCondition';
import { hasNameAndSpecies } from './checkUserState';
import { deepCopyObject, getArrayElement, getSmallerNumber, keyInObject, unsafeKeys, widenValues } from './helperFunctions';
import { getRandomNumber, pullFromWeightedTable } from './randomizers';
import { wearDownAmount } from './wearDownDen';

/**
 * Get all the quids of all the users who have a profile in the given server.
 * @param {string} guildId - The ID of the server you want to get the users from.
 * @param {boolean} activeUsersOnly - If true, only users who have been active in the last two weeks will be returned.
 * @returns An array of Quid objects.
 */
async function getUsersInServer(
	guildId: string,
	activeUsersOnly: boolean,
): Promise<UserData<never, never>[]> {

	const twoWeeksInMs = 1_209_600_000;

	const userToQuidArray = (u: UserSchema) => (Object.values(u.quids).map(q => q.profiles[guildId] === undefined ? null : getUserData(u, guildId, q)).filter((user): user is UserData<never, never> => {
		return hasNameAndSpecies(user) && (activeUsersOnly ? (user.quidToServer.lastActiveTimestamp > (Date.now() - twoWeeksInMs)) : true);
	}));

	return (await userModel.find((u) => userToQuidArray(u).length > 0)).map(userToQuidArray).flat();
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
	const users = await getUsersInServer(serverData_.serverId, activeUsersOnly);
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

	const existingItems = calculateInventorySize(serverData.inventory, ([key]) => key === 'meat');
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
	users: UserData<never, never>[],
	serverData: ServerSchema,
): number {

	const serverData_ = deepCopyObject(serverData);
	let neededItems = 0;
	for (const user of users.filter(u => speciesInfo[u.quid.species].diet !== SpeciesDietType.Carnivore)) {

		while (user.quidToServer.hunger < user.quidToServer.maxHunger) {

			neededItems += 1;
			user.quidToServer.hunger += addCorrectDietHungerPoints() - removeHungerPoints(serverData_);

			const denStatkind = (['structure', 'bedding', 'thickness', 'evenness'] as const)[getRandomNumber(4)];
			if (denStatkind === undefined) { throw new TypeError('denStatkind is undefined'); }
			serverData_.dens.medicineDen[denStatkind] -= wearDownAmount(serverData_.dens.medicineDen[denStatkind]);
		}
	}
	return neededItems;
}

function getNeededMedicineItems(
	users: UserData<never, never>[],
	serverData: ServerSchema,
	checkOnlyFor?: 'energy' | 'hunger' | 'wounds' | 'infections' | 'cold' | 'sprains' | 'poison',
): number {

	const serverData_ = deepCopyObject(serverData);
	let neededItems = 0;
	/* For each quid, we are getting a random quid that is able to heal, preferably not the current quid unless that is the only available one, and preferably one that doesn't need healing unless that is not possible. Healing takes hunger away, which is why this is done before the other loop and separately from it. */
	for (const user of users.filter(u => quidNeedsHealing(u, checkOnlyFor))) {

		let healerArray1 = users.filter(u => {
			return u.quidToServer.rank !== RankType.Youngling && u.quidToServer.health > 0 && u.quidToServer.energy > 0 && u.quidToServer.hunger > 0 && u.quidToServer.thirst > 0;
		});
		if (healerArray1.length > 1) { healerArray1 = healerArray1.filter(u => u.id !== user.id); }
		const healerArray2 = healerArray1.filter(u => !quidNeedsHealing(u));
		const healer = healerArray2.length > 0 ? getArrayElement(healerArray2, getRandomNumber(healerArray2.length)) : healerArray1.length > 0 ? getArrayElement(healerArray1, getRandomNumber(healerArray1.length)) : undefined;
		if (healer === undefined) { break; }

		while (quidNeedsHealing(user, checkOnlyFor)) {

			// First, get the quid with the highest rank. Based on that, define itemInfo with or without uncommonPlants and/or rarePlants
			const highestRank = users.some(u => u.quidToServer.rank === RankType.Elderly) ? 2 : users.some(u => u.quidToServer.rank === RankType.Hunter || u.quidToServer.rank === RankType.Healer) ? 1 : 0;
			const itemInfo = { ...specialPlantsInfo, ...commonPlantsInfo, ...highestRank > 0 ? uncommonPlantsInfo : {}, ...highestRank > 1 ? rarePlantsInfo : {} };

			// Based on the quids condition, choose item to pick. 0 thirst: water, 0 energy: itemInfo.filter(givesEnergy), 0 hunger: itemInfo.filter(edibility === PlantEdibilityType.Edible), wound: itemInfo.filter(healsWounds), infection: itemInfo.filter(healsInfection), cold: itemInfo.filter(healsColds), sprains: itemInfo.filter(healsSprains), poison: itemInfo.filter(healsPoison). If this returns undefined (which it can, ie when theres nothing that can heal poison), break the while loop.
			const specificItems = (Object.entries(itemInfo) as [CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames, PlantInfo][]).filter(([, info]) => user.quidToServer.energy <= 0 ? info.givesEnergy : user.quidToServer.hunger <= 0 ? info.edibility === PlantEdibilityType.Edible : user.quidToServer.injuries.wounds > 0 ? info.healsWounds : user.quidToServer.injuries.infections > 0 ? info.healsInfections : user.quidToServer.injuries.cold ? info.healsColds : user.quidToServer.injuries.sprains > 0 ? info.healsSprains : info.healsPoison);
			const item = user.quidToServer.thirst <= 0 ? 'water' : specificItems[getRandomNumber(specificItems.length)]?.[0];
			if (item === undefined) { break; }
			if (item !== 'water') { neededItems += 1; }

			// Copy the isSuccessful checks that have a chance that isSucessful goes from true to false. A function needs to be created in the heal file
			// If it's successful, make the problems go away that this specific item can make go away, using getStatsPoints and the individual things for the injuries.
			if (!healingIsUnlucky(user, healer, serverData_)) {

				const stats = getStatsPoints(item, user);
				user.quidToServer.health += stats.health;
				user.quidToServer.energy += stats.energy;
				user.quidToServer.hunger += stats.hunger;
				user.quidToServer.thirst += stats.thirst;
				user.quidToServer.injuries.wounds -= item !== 'water' && itemInfo[item]?.healsWounds === true ? 1 : 0;
				user.quidToServer.injuries.infections -= item !== 'water' && itemInfo[item]?.healsInfections === true ? 1 : 0;
				user.quidToServer.injuries.cold = item !== 'water' && itemInfo[item]?.healsColds === true ? false : user.quidToServer.injuries.cold;
				user.quidToServer.injuries.sprains -= item !== 'water' && itemInfo[item]?.healsSprains === true ? 1 : 0;
				user.quidToServer.injuries.poison = item !== 'water' && itemInfo[item]?.healsPoison === true ? false : user.quidToServer.injuries.poison;
			}

			// change the condition based on a simulation-version of changeCondition, and wear down the den
			changeCondition(healer, 0, undefined, false, false);

			const denStatkind = (['structure', 'bedding', 'thickness', 'evenness'] as const)[getRandomNumber(4)];
			if (denStatkind === undefined) { throw new TypeError('denStatkind is undefined'); }
			serverData_.dens.medicineDen[denStatkind] -= wearDownAmount(serverData_.dens.medicineDen[denStatkind]);
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

	const quids = await getUsersInServer(serverData.serverId, activeUsersOnly);
	const neededItems = getNeededHungerItems(quids, serverData) + getNeededMedicineItems(quids, serverData);

	const existingItems = calculateInventorySize(serverData.inventory, ([key]) => key === 'commonPlants' || key === 'uncommonPlants' || key === 'rarePlants' || key === 'specialPlants');
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
	include: 0 | 1 | 2,
	serverData: ServerSchema,
): Promise<CommonPlantNames | UncommonPlantNames | RarePlantNames> {

	function changeInventory(
		inventory: Inventory,
		checkOnlyFor: 'energy' | 'hunger' | 'wounds' | 'infections' | 'cold' | 'sprains' | 'poison',
	): Inventory {

		inventory = deepCopyObject(inventory);
		const inventory_ = widenValues(inventory);
		for (const itemType of unsafeKeys(inventory_)) {

			for (const item of unsafeKeys(inventory_[itemType])) {

				if (!keyInObject(itemInfo, item) || (
					(checkOnlyFor === 'hunger' && itemInfo[item].edibility !== PlantEdibilityType.Edible)
				|| (checkOnlyFor === 'energy' && !itemInfo[item].givesEnergy)
				|| (checkOnlyFor === 'wounds' && !itemInfo[item].healsWounds)
				|| (checkOnlyFor === 'infections' && !itemInfo[item].healsInfections)
				|| (checkOnlyFor === 'cold' && !itemInfo[item].healsColds)
				|| (checkOnlyFor === 'sprains' && !itemInfo[item].healsSprains)
				|| (checkOnlyFor === 'poison' && !itemInfo[item].healsPoison)
				)) { inventory_[itemType][item] = 0; }
			}
		}
		return inventory_;
	}

	const itemInfo = { ...commonPlantsInfo, ...uncommonPlantsInfo, ...rarePlantsInfo, ...specialPlantsInfo };
	const serverData_ = deepCopyObject(serverData);
	const quids = await getUsersInServer(serverData_.serverId, false);

	let diffEating = getNeededHungerItems(quids, serverData_) - calculateInventorySize(changeInventory(serverData.inventory, 'hunger'));
	let diffEnergy = getNeededMedicineItems(quids, serverData_, 'energy') - calculateInventorySize(changeInventory(serverData.inventory, 'energy'));
	let diffHunger = getNeededMedicineItems(quids, serverData_, 'hunger') - calculateInventorySize(changeInventory(serverData.inventory, 'hunger'));
	let diffWounds = getNeededMedicineItems(quids, serverData_, 'wounds') - calculateInventorySize(changeInventory(serverData.inventory, 'wounds'));
	let diffInfections = getNeededMedicineItems(quids, serverData_, 'infections') - calculateInventorySize(changeInventory(serverData.inventory, 'infections'));
	let diffCold = getNeededMedicineItems(quids, serverData_, 'cold') - calculateInventorySize(changeInventory(serverData.inventory, 'cold'));
	let diffSprains = getNeededMedicineItems(quids, serverData_, 'sprains') - calculateInventorySize(changeInventory(serverData.inventory, 'sprains'));
	let diffPoison = getNeededMedicineItems(quids, serverData_, 'poison') - calculateInventorySize(changeInventory(serverData.inventory, 'poison'));

	const smallest = getSmallerNumber(getSmallerNumber(getSmallerNumber(getSmallerNumber(getSmallerNumber(getSmallerNumber(getSmallerNumber(diffEating, diffEnergy), diffHunger), diffWounds), diffInfections), diffCold), diffSprains), diffPoison);

	diffEating = diffEating - smallest + 1;
	diffEnergy = diffEnergy - smallest + 1;
	diffHunger = diffHunger - smallest + 1;
	diffWounds = diffWounds - smallest + 1;
	diffInfections = diffInfections - smallest + 1;
	diffCold = diffCold - smallest + 1;
	diffSprains = diffSprains - smallest + 1;
	diffPoison = include < 2 ? 0 : (diffPoison - smallest + 1); // Because there is no common plant against poison, if only common plants are included, the chance that poison is picked must be null

	const pick = pullFromWeightedTable({ 0: diffEating + diffHunger, 1: diffEnergy, 2: diffWounds, 3: diffInfections, 4: diffCold, 5: diffSprains, 6: diffPoison });
	const options: Array<['commonPlants' | 'uncommonPlants' | 'rarePlants', CommonPlantNames | UncommonPlantNames | RarePlantNames]> = [];

	const inventory_ = widenValues({ commonPlants: serverData.inventory.commonPlants, uncommonPlants: serverData.inventory.uncommonPlants, rarePlants: serverData.inventory.rarePlants });
	for (const itemType of unsafeKeys(inventory_)) {

		if (itemType !== 'commonPlants' && (include === 0 || itemType !== 'uncommonPlants') && (include < 2 || itemType !== 'rarePlants')) { continue; }
		for (const item of unsafeKeys(inventory_[itemType])) {

			if (
				(pick === 0 && itemInfo[item].edibility === PlantEdibilityType.Edible)
				|| (pick === 1 && itemInfo[item].givesEnergy)
				|| (pick === 2 && itemInfo[item].healsWounds)
				|| (pick === 3 && itemInfo[item].healsInfections)
				|| (pick === 4 && itemInfo[item].healsColds)
				|| (pick === 5 && itemInfo[item].healsSprains)
				|| (pick === 6 && itemInfo[item].healsPoison)
			) {

				options.push([itemType, item]);
				if (itemType === 'commonPlants' && include >= 1) { options.push([itemType, item]); }
				if (itemType === 'commonPlants' && include === 2) { options.push([itemType, item]); }
				if (itemType === 'uncommonPlants' && include === 2) { options.push([itemType, item]); }
			}
		}
	}

	if (options.length === 0) { throw new Error(`options is empty (include is ${include}, pick is ${pick})`); }

	const object = options.reduce((prev, [curItemType, curItem], index) => ({ ...prev, [index]: inventory_[curItemType][curItem] + 1 }), {} as Record<number, number>);
	return pickItem(object, options.map(([, item]) => item));
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
	const users = await getUsersInServer(serverData_.serverId, activeUsersOnly);
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

	const existingItems = calculateInventorySize(serverData.inventory, ([key]) => key === 'materials');
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


function pickItem<T extends string>(object: Record<number, number>, options: T[]): T {

	const numerator = Math.min(...Object.values(object));
	const smallestCommon = smallestCommons(Object.values(object));

	// We make a new array, from the values of the object, where each item is the common denominotor divided by the property of the object multiplied by the numerator.
	const sumArr = Object.values(object).reduce((prev, cur) => [...prev, (smallestCommon / cur) * numerator], [] as number[]);
	const sum = sumArr.reduce((a, b) => a + b, 0);
	const x = 100 * (smallestCommon / sum);

	// For the old object, we do Math.round(x * (numerator / property))
	object = Object.values(object).reduce((prev, cur, index) => ({ ...prev, [index]: Math.round(x * (numerator / cur)) }), {} as Record<number, number>);
	const random = pullFromWeightedTable(object);
	return getArrayElement(options, random);
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