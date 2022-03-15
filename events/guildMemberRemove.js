const profileModel = require('../models/profileModel');
const serverModel = require('../models/serverModel');
const fs = require('fs');

module.exports = {
	name: 'guildMemberRemove',
	once: false,
	async execute(client, member) {

		const profileData = await profileModel.findOne({
			userId: member.id,
			serverId: member.guild.id,
		});

		const serverData = await serverModel.findOne({
			serverId: member.guild.id,
		});

		if (profileData === null || serverData === null) {

			return;
		}

		await profileModel.findOneAndUpdate(
			{ userId: member.id, serverId: member.guild.id },
			{ $set: { currentRegion: 'sleeping dens' } },
		);

		fs.renameSync(`./database/profiles/${profileData.uuid}.json`, `./database/toDelete/${profileData.uuid}.json`);
		const toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));
		toDeleteList[`${member.id}${member.guild.id}`] = { fileName: `${profileData.uuid}.json`, deletionTimestamp: Date.now() + 2592000000 };
		fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));

		setTimeout(async () => {

			if (fs.existsSync(`./database/toDelete/${profileData.uuid}.json`) == true) {

				const dataObject = JSON.parse(fs.readFileSync(`./database/toDelete/${profileData.uuid}.json`));
				fs.unlinkSync(`./database/toDelete/${profileData.uuid}.json`);
				console.log('Deleted File: ', dataObject);
			}
		}, 2592000000);
	},
};