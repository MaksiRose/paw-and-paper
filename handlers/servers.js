const fs = require('fs');
const serverModel = require('../models/serverModel');

module.exports = {
	execute(client) {

		const validGuilds = new Map();
		const invalidGuilds = [];
		const files = fs.readdirSync('./database/servers').filter(file => file.endsWith('.json'));

		for (const file of files) {

			const dataObject = JSON.parse(fs.readFileSync(`./database/servers/${file}`));

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

						moveFile(file, dataObject.serverId);
					}
					else if (validGuilds.has(dataObject.serverId) == false) {

						client.guilds
							.fetch(dataObject.serverId)
							.then(guild => validGuilds.set(dataObject.serverId, guild))
							.catch(error => {

								invalidGuilds.push(dataObject.serverId);
								if (error.httpStatus === 403) {

									moveFile(file, dataObject.serverId);
								}
								else {
									console.error(error);
								}
							});
					}
				});
		}
	},
};

function moveFile(file, id) {
	fs.renameSync(`./database/servers/${file}`, `./database/toDelete/${file}`);
	const toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));
	toDeleteList[id] = { fileName: file, deletionTimestamp: Date.now() + 2073600000 };
	fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
}
