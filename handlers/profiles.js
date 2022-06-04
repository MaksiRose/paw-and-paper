// @ts-check
const { readdirSync, readFileSync } = require('fs');
const profileModel = require('../models/profileModel');
const { sendReminder } = require('../commands/maintenance/water');


/**
 * Updates all profiles
 * @param {import('../paw').client} client
 */
module.exports.execute = async (client) => {

	const files = readdirSync('./database/profiles').map(file => ['./database/profiles', file]).filter(([, file]) => file.endsWith('.json'));

	for (const [path, file] of files) {

		const userData = /** @type {import('../typedef').ProfileSchema} */ (JSON.parse(readFileSync(`${path}/${file}`, 'utf-8')));

		if (userData.reminders.water === true) {

			for (const character of Object.values(userData.characters)) {

				for (const profile of Object.values(character.profiles)) {

					if (typeof profile.sapling.lastMessageChannelId === 'string') { sendReminder(client, userData, character, profile); }
				}
			}
		}


		await profileModel
			.findOneAndUpdate(
				{ uuid: userData.uuid },
				(/** @type {import('../typedef').ProfileSchema} */ p) => {
					for (const character of Object.values(p.characters)) {

						for (const profile of Object.values(character.profiles)) {

							p.characters[character._id].profiles[profile.serverId].hasCooldown = false;
							p.characters[character._id].profiles[profile.serverId].isResting = false;
							p.characters[character._id].profiles[profile.serverId].energy = p.characters[character._id].profiles[profile.serverId].energy === 0 ? 0 : p.characters[character._id].profiles[profile.serverId].maxEnergy;
						}
					}
				},
			);
	}
};