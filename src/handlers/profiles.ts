import { sendReminder } from '../commands/gameplay_maintenance/water-tree';
import userModel, { getUserData } from '../models/userModel';
import { hasNameAndSpecies } from '../utils/checkUserState';
import { getMapData } from '../utils/helperFunctions';

/** It updates each profile to have no cooldown, not rest, and maximum energy, and then it executes the sendReminder function for each profile for which the sapling exists and where lastMessageChannelId is a string, if the user has enabled water reminders */
export async function execute(
): Promise<void> {

	const users = await userModel.find();
	for (const user of users) {

		/* This updates each profile to have no cooldown, not rest, and maximum energy. */
		await userModel
			.findOneAndUpdate(
				u => u._id === user._id,
				(u) => {
					for (const userId of u.userId) {
						if (u.userIds[userId] === undefined) {

							u.userIds[userId] = {};
							Object.values(u.quids).map(q => Object.values(q.profiles)).flat().forEach(p => {
								p.serverId;
								u.userIds[userId] = {
									...(u.userIds[userId] ?? {}),
									[p.serverId]: { isMember: false, lastUpdatedTimestamp: 0 },
								};
							});
						}
					}
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
		if (user.settings.reminders.water === true) {
			for (const quid of Object.values(user.quids)) {
				for (const profile of Object.values(quid.profiles)) {

					const userData = getUserData(user, profile.serverId, quid);
					if (hasNameAndSpecies(userData) && userData.quid.profile.sapling.exists && typeof userData.quid.profile.sapling.lastMessageChannelId === 'string' && !userData.quid.profile.sapling.sentReminder) { await sendReminder(userData); }
				}
			}
		}
	}
}