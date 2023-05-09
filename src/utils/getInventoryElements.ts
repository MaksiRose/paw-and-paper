import { RestOrArray, SelectMenuComponentOptionData } from 'discord.js';
import { commonPlantsInfo, materialsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '../cluster';
import { objectHasKey } from './helperFunctions';

export default function getInventoryElements(
	inventory: string[],
	page: 1 | 2 | 3 | 4,
): {
    embedDescription: string;
    selectMenuOptions: SelectMenuComponentOptionData[];
} {

	const selectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];
	let embedDescription = '';

	const itemsInfo = page === 1
		? Object.entries(commonPlantsInfo)
		: page === 2
			? Object.entries({ ...uncommonPlantsInfo, ...rarePlantsInfo, ...specialPlantsInfo })
			: page === 3
				? Object.entries(speciesInfo)
				: Object.entries(materialsInfo);

	for (const [item, itemInfo] of itemsInfo) {

		const amountInInventory = inventory.filter(i => i === item).length;
		if (amountInInventory === 0) { continue; }
		const itemDescription = objectHasKey(itemInfo, 'description') ? ` - ${itemInfo.description}` : '';

		embedDescription += `**${item}: ${amountInInventory}**${itemDescription}\n`;
		selectMenuOptions.push({ label: item, value: item, description: `${amountInInventory}` });
	}

	return { embedDescription, selectMenuOptions };
}