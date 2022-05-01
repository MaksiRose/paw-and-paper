// @ts-check
const { readdirSync, readFileSync } = require('fs');
const { profileModel, otherProfileModel } = require('../models/profileModel');
const { sendReminder } = require('../commands/maintenance/water');


/**
 * Updates all profiles
 * @param {import('../paw').client} client
 */
module.exports.execute = async (client) => {

	const files = [
		...readdirSync('./database/profiles').map(file => ['./database/profiles', file]),
		...readdirSync('./database/profiles/inactiveProfiles').map(file => ['./database/profiles/inactiveProfiles', file]),
	].filter(([, file]) => file.endsWith('.json'));

	for (const [path, file] of files) {

		/**
		 * @type {import('../typedef').ProfileSchema}
		 */
		const dataObject = JSON.parse(readFileSync(`${path}/${file}`, 'utf-8'));

		if (dataObject.saplingObject.reminder === true) {

			sendReminder(client, dataObject, dataObject.saplingObject.lastMessageChannelId);
		}

		await (path.includes('inactiveProfiles') ? otherProfileModel : profileModel)
			.findOneAndUpdate(
				{ uuid: dataObject.uuid },
				{
					$set: {
						hasCooldown: false,
						isResting: false,
						energy: dataObject.energy === 0 ? 0 : dataObject.maxEnergy,
					},
				},
			);
	}
};