import { RestOrArray, SelectMenuComponentOptionData } from 'discord.js';
import { CommonPlantNames, commonPlantsInfo, Inventory, MaterialNames, materialsInfo, RarePlantNames, rarePlantsInfo, SpecialPlantNames, specialPlantsInfo, SpeciesNames, UncommonPlantNames, uncommonPlantsInfo } from '../typedef';
import { unsafeKeys, widenValues } from './helperFunctions';

export default function getInventoryElements(
	inventory: Inventory,
	page: 1 | 2 | 3 | 4,
): {
    embedDescription: string;
    selectMenuOptions: SelectMenuComponentOptionData[];
} {

	const selectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];
	let embedDescription = '';

	const itemTypeToPage = { commonPlants: 1, uncommonPlants: 2, rarePlants: 2, specialPlants: 2, meat: 3, materials: 4 };
	const itemInfo = { ...commonPlantsInfo, ...uncommonPlantsInfo, ...rarePlantsInfo, ...specialPlantsInfo, ...materialsInfo };
	const inventory_ = widenValues(inventory);
	for (const itemType of unsafeKeys(inventory_)) {

		if (itemTypeToPage[itemType] !== page) { continue; }
		for (const item of unsafeKeys(inventory_[itemType])) {

			if (inventory_[itemType][item] > 0) {

				const itemDescription = itemHasDescription(itemInfo, item) ? ` - ${itemInfo[item].description}` : '';
				embedDescription += `**${item}: ${inventory_[itemType][item]}**${itemDescription}\n`;

				selectMenuOptions.push({ label: item, value: item, description: `${inventory_[itemType][item]}` });
			}
		}
	}

	return { embedDescription, selectMenuOptions };
}

function itemHasDescription(
	itemInfo: typeof commonPlantsInfo & typeof uncommonPlantsInfo & typeof rarePlantsInfo & typeof specialPlantsInfo & typeof materialsInfo,
	item: CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | MaterialNames | SpeciesNames,
): item is CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | MaterialNames {

	return Object.hasOwn(itemInfo, item);
}