// @ts-check
const { readdirSync, readFileSync } = require('fs');
const serverModel = require('../models/serverModel');
const { deleteGuild } = require('../utils/updateGuild');

/**
 * Updates all server accounts
 * @param {import('../paw').client} client
 */
module.exports.execute = async (client) => {

	const files = readdirSync('./database/servers').filter(file => file.endsWith('.json'));

	for (const file of files) {

		/** @type {import('../typedef').ServerSchema} */
		const dataObject = JSON.parse(readFileSync(`./database/servers/${file}`, 'utf-8'));

		await serverModel
			.findOneAndUpdate(
				{ serverId: dataObject.serverId },
				{
					$set: {
						activeUsersArray: [],
						currentlyVisiting: null,
					},
				},
			)
			.then(async () => {

				await client.guilds
					.fetch(dataObject.serverId)
					.catch(error => {

						if (error.httpStatus === 403) {

							deleteGuild(dataObject.serverId);
						}
						else {
							console.error(error);
						}
					});
			});
	}
};