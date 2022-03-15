const serverModel = require('../models/serverModel');
const profileModel = require('../models/profileModel');
const fs = require('fs');

module.exports = {
	name: 'guildDelete',
	once: false,
	async execute(client, guild) {

		const serverData = await serverModel.findOne({
			serverId: guild.id,
		});

		if (serverData === null) {

			return;
		}

		fs.renameSync(`./database/servers/${serverData.uuid}.json`, `./database/toDelete/${serverData.uuid}.json`);
		let toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));
		toDeleteList[guild.id] = { fileName: `${serverData.uuid}.json`, deletionDate: Date.now() + 2592000000 };
		fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));

		for (const profileData of (await profileModel.find({ serverId: guild.id }))) {

			fs.renameSync(`./database/servers/${profileData.uuid}.json`, `./database/toDelete/${profileData.uuid}.json`);
			toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));
			toDeleteList[`${profileData.userId}${profileData.serverId}`] = { fileName: `${profileData.uuid}.json`, deletionTimestamp: Date.now() + 2592000000 };
			fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));

			setTimeout(async () => {

				if (fs.existsSync(`./database/toDelete/${profileData.uuid}.json`) == true) {

					const dataObject = JSON.parse(fs.readFileSync(`./database/toDelete/${profileData.uuid}.json`));
					fs.unlinkSync(`./database/toDelete/${profileData.uuid}.json`);
					console.log('Deleted File: ', dataObject);
				}
			}, 2592000000);
		}

		setTimeout(async () => {

			if (fs.existsSync(`./database/toDelete/${serverData.uuid}.json`) == true) {

				const dataObject = JSON.parse(fs.readFileSync(`./database/toDelete/${serverData.uuid}.json`));
				fs.unlinkSync(`./database/toDelete/${serverData.uuid}.json`);
				console.log('Deleted File: ', dataObject);
			}
		}, 2592000000);
	},
};