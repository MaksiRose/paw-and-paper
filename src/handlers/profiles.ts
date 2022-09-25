import { sendReminder } from '../commands/gameplay_maintenance/water-tree';
import userModel from '../models/userModel';
import { CustomClient } from '../typedef';
import { getMapData } from '../utils/helperFunctions';

/** It updates each profile to have no cooldown, not rest, and maximum energy, and then it executes the sendReminder function for each profile for which the sapling exists and where lastMessageChannelId is a string, if the user has enabled water reminders */
export async function execute(
	client: CustomClient,
): Promise<void> {

	const users = await userModel.find();
	for (const userData of users) {

		/* This updates each profile to have no cooldown, not rest, and maximum energy. */
		await userModel
			.findOneAndUpdate(
				u => u.uuid === userData.uuid,
				(u) => {
					for (const quid of Object.values(u.quids)) {
						for (const profile of Object.values(quid.profiles)) {
							const p = getMapData(getMapData(u.quids, quid._id).profiles, profile.serverId);
							p.isResting = false;
							p.energy = p.energy === 0 ? 0 : p.maxEnergy;
						}
					}
				},
			);

		/* This executes the sendReminder function for each profile for which the sapling exists and where lastMessageChannelId is a string, if the user has enabled water reminders. */
		if (userData.settings.reminders.water === true) {
			for (const quid of Object.values(userData.quids)) {
				for (const profile of Object.values(quid.profiles)) {
					if (profile.sapling.exists && typeof profile.sapling.lastMessageChannelId === 'string' && !profile.sapling.sentReminder) { await sendReminder(client, userData, quid, profile); }
				}
			}
		}
	}
}