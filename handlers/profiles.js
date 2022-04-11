// @ts-check
const { readdirSync, readFileSync, renameSync, writeFileSync } = require('fs');
const profileModel = require('../models/profileModel');
const otherProfileModel = require('../models/otherProfileModel');
const { sendReminder } = require('../commands/maintenance/water');


/**
 * Updates all profiles
 * @param {import('../paw').client} client
 */
module.exports.execute = (client) => {

	/**
	 * @type {Array<string>}
	 */
	const invalidGuilds = [];

	const files = [
		...readdirSync('./database/profiles').map(file => ['./database/profiles', file]),
		...readdirSync('./database/profiles/inactiveProfiles').map(file => ['./database/profiles/inactiveProfiles', file]),
	].filter(([, file]) => file.endsWith('.json'));

	for (const [path, file] of files) {

		/**
		 * @type {import('../typedef').ProfileSchema}
		 */
		const dataObject = JSON.parse(readFileSync(`${path}/${file}`, 'utf-8'));

		if (dataObject.saplingObject.reminder === true && path.includes('inactiveProfiles') === false) {

			sendReminder(client, dataObject, dataObject.saplingObject.lastMessageChannelId);
		}

		(path.includes('inactiveProfiles') ? otherProfileModel : profileModel)
			.findOneAndUpdate(
				{ userId: dataObject.userId, serverId: dataObject.serverId },
				{
					$set: {
						hasCooldown: false,
						isResting: false,
						energy: dataObject.energy === 0 ? 0 : dataObject.maxEnergy,
					},
				},
			)
			.then(() => {

				if (invalidGuilds.includes(dataObject.serverId)) {

					moveFile(file, `${dataObject.serverId}${dataObject.userId}`, dataObject.name, path);
				}
				else {

					client.guilds
						.fetch(dataObject.serverId)
						.then(guild => {

							guild.members
								.fetch(dataObject.userId)
								.catch(() => moveFile(file, `${dataObject.serverId}${dataObject.userId}`, dataObject.name, path));
						})
						.catch(error => {

							invalidGuilds.push(dataObject.serverId);
							if (error.httpStatus === 403) {

								moveFile(file, `${dataObject.serverId}${dataObject.userId}`, dataObject.name, path);
							}
							else {
								console.error(error);
							}
						});
				}
			});
	}
};

/**
 * Moves a file to the `toDelete` path
 * @param {string} file - File name
 * @param {string} id - user ID + server ID
 * @param {string} name - Name of the user
 * @param {string} path - Path before the file
 */
function moveFile(file, id, name, path) {

	renameSync(`${path}/${file}`, `./database/toDelete/${file}`);

	/**
	 * @type {import('../typedef').DeleteList}
	 */
	const toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

	toDeleteList[id] = toDeleteList[id] || {};
	toDeleteList[id][name] = { fileName: file, deletionTimestamp: Date.now() + 2073600000 };

	writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
}