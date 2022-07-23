import { readdirSync, readFileSync } from 'fs';
import { sendReminder } from '../commands/gameplay_maintenance/water-tree';
import profileModel from '../models/userModel';
import { CustomClient, UserSchema } from '../typedef';

/** Updates all profiles */
export async function execute(client: CustomClient) {

	const userFiles = readdirSync('./database/profiles').map(file => ['./database/profiles', file]).filter(([, file]) => file.endsWith('.json'));

	for (const [path, file] of userFiles) {

		const userData = (JSON.parse(readFileSync(`${path}/${file}`, 'utf-8'))) as UserSchema;

		/* This executes the sendReminder function for each profile for which the sapling exists
		and where lastMessageChannelId is a string, if the user has enabled water reminders. */
		if (userData.settings.reminders.water === true) {

			for (const character of Object.values(userData.characters)) {

				for (const profile of Object.values(character.profiles)) {

					if (profile.sapling.exists && typeof profile.sapling.lastMessageChannelId === 'string') { sendReminder(client, userData, character, profile); }
				}
			}
		}


		/* This updates each profile to have no cooldown, not rest, and maximum energy. */
		await profileModel
			.findOneAndUpdate(
				u => u.uuid === userData.uuid,
				(u: UserSchema) => {
					for (const character of Object.values(u.characters)) {

						for (const profile of Object.values(character.profiles)) {

							u.characters[character._id].profiles[profile.serverId].isResting = false;
							u.characters[character._id].profiles[profile.serverId].energy = u.characters[character._id].profiles[profile.serverId].energy === 0 ? 0 : u.characters[character._id].profiles[profile.serverId].maxEnergy;
						}
					}
				},
			);
	}
}