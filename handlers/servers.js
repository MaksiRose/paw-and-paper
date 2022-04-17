// @ts-check
const { readdirSync, readFileSync, renameSync, writeFileSync } = require('fs');
const serverModel = require('../models/serverModel');

/**
 * Updates all server accounts
 * @param {import('../paw').client} client
 */
module.exports.execute = (client) => {

	/**
	 * @type {Map<string, import('discord.js').Guild>}
	 */
	const validGuilds = new Map();

	/**
	 * @type {Array<string>}
	 */
	const invalidGuilds = [];

	const files = readdirSync('./database/servers').filter(file => file.endsWith('.json'));

	for (const file of files) {

		/**
		 * @type {import('../typedef').ServerSchema}
		 */
		const dataObject = JSON.parse(readFileSync(`./database/servers/${file}`, 'utf-8'));

		serverModel
			.findOneAndUpdate(
				{ serverId: dataObject.serverId },
				{
					$set: {
						activeUsersArray: [],
						currentlyVisiting: null,
					},
				},
			)
			.then(() => {

				if (invalidGuilds.includes(dataObject.serverId)) {

					moveFile(file, dataObject.serverId, dataObject.name);
				}
				else if (validGuilds.has(dataObject.serverId) == false) {

					client.guilds
						.fetch(dataObject.serverId)
						.then(guild => validGuilds.set(dataObject.serverId, guild))
						.catch(error => {

							invalidGuilds.push(dataObject.serverId);
							if (error.httpStatus === 403) {

								moveFile(file, dataObject.serverId, dataObject.name);
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
 * @param {string} id - server ID
 * @param {string} name - Name of the server
 */
function moveFile(file, id, name) {

	renameSync(`./database/servers/${file}`, `./database/toDelete/${file}`);

	/**
	 * @type {import('../typedef').DeleteList}
	 */
	const toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

	toDeleteList[id] = toDeleteList[id] || {};
	toDeleteList[id][name] = { fileName: file, deletionTimestamp: Date.now() + 2073600000 };

	writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
}
