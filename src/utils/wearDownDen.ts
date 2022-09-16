// @ts-check
import serverModel from '../models/serverModel';
import { CurrentRegionType, ServerSchema } from '../typedef';
import { getSmallerNumber } from './helperFunctions';
import { getRandomNumber } from './randomizers';

/**
 * It randomly selects one of the four den stats, and then randomly selects a number between 1 and 5, and then subtracts that number from the selected stat
 */
export default async function wearDownDen(
	serverData: ServerSchema,
	denKind: CurrentRegionType.SleepingDens | CurrentRegionType.FoodDen | CurrentRegionType.MedicineDen,
): Promise<string> {

	const denName = (['sleepingDens', 'foodDen', 'medicineDen'] as const)[
		[CurrentRegionType.SleepingDens, CurrentRegionType.FoodDen, CurrentRegionType.MedicineDen].indexOf(denKind)
	];
	if (!denName) { throw new TypeError('denName is undefined'); }
	const denStatkind = (['structure', 'bedding', 'thickness', 'evenness'] as const)[getRandomNumber(4)];
	if (!denStatkind) { throw new TypeError('denStatkind is undefined'); }

	const denWeardownPoints = getSmallerNumber(serverData.dens[denName][denStatkind], getRandomNumber(5, 1));

	serverData = await serverModel.findOneAndUpdate(
		s => s.serverId === serverData.serverId,
		(s) => { s.dens[denName][denStatkind] -= denWeardownPoints; },
	);

	return `-${denWeardownPoints}% ${denStatkind} for ${denKind} (${serverData.dens[denName][denStatkind]}% total)`;
}