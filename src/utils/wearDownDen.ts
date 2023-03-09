// @ts-check
import Den from '../models/den';
import Server from '../models/server';
import { CurrentRegionType } from '../typings/data/user';
import { getRandomNumber } from './randomizers';

/**
 * It randomly selects one of the four den stats, and then randomly selects a number between 1 and 5, and then subtracts that number from the selected stat
 */
export async function wearDownDen(
	server: Server,
	denKind: CurrentRegionType.SleepingDens | CurrentRegionType.FoodDen | CurrentRegionType.MedicineDen,
): Promise<string> {

	const denName = (['sleepingDenId', 'foodDenId', 'medicineDenId'] as const)[
		[CurrentRegionType.SleepingDens, CurrentRegionType.FoodDen, CurrentRegionType.MedicineDen].indexOf(denKind)
	];
	if (denName === undefined) { throw new TypeError('denName is undefined'); }
	const denStatkind = (['structure', 'bedding', 'thickness', 'evenness'] as const)[getRandomNumber(4)];
	if (denStatkind === undefined) { throw new TypeError('denStatkind is undefined'); }

	const den = await Den.findByPk(server[denName], { rejectOnEmpty: true });
	const denWeardownPoints = wearDownAmount(den[denStatkind]);

	await den.update({ [denStatkind]: den[denStatkind] - denWeardownPoints });

	return `-${denWeardownPoints}% ${denStatkind} for ${denKind} (${den[denStatkind]}% total)`;
}

export function wearDownAmount(
	denAmount: number,
): number { return Math.min(denAmount, getRandomNumber(5, 1)); }