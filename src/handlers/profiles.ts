import { readdirSync, readFileSync } from 'fs';
import { sendReminder } from '../commands/gameplay_maintenance/water-tree';
import profileModel from '../models/userModel';
import { CustomClient, UserSchema } from '../typedef';
import { getMapData } from '../utils/getInfo';

/** Updates all profiles */
export const execute = async (
	client: CustomClient,
): Promise<void> => {

	const userFiles = readdirSync('./database/profiles').filter(file => file.endsWith('.json')).map(file => ['./database/profiles', file]);

	for (const [path, file] of userFiles) {

		const userData = (JSON.parse(readFileSync(`${path}/${file}`, 'utf-8'))) as UserSchema;

		/* This executes the sendReminder function for each profile for which the sapling exists
		and where lastMessageChannelId is a string, if the user has enabled water reminders. */
		if (userData.settings.reminders.water === true) {

			for (const quid of Object.values(userData.quids)) {

				for (const profile of Object.values(quid.profiles)) {

					if (profile.sapling.exists && typeof profile.sapling.lastMessageChannelId === 'string') { sendReminder(client, userData, quid, profile); }
				}
			}
		}


		/* This updates each profile to have no cooldown, not rest, and maximum energy. */
		await profileModel
			.findOneAndUpdate(
				u => u.uuid === userData.uuid,
				(u: UserSchema) => {
					for (const quid of Object.values(u.quids)) {

						for (const profile of Object.values(quid.profiles)) {

							const p = getMapData(getMapData(u.quids, quid._id).profiles, profile.serverId);
							p.isResting = false;
							p.energy = p.energy === 0 ? 0 : p.maxEnergy;
						}
					}
				},
			);
	}
};