const profileModel = require('../models/profileModel');
const otherProfileModel = require('../models/otherProfileModel');
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

		let toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));

		toDeleteList[`${member.id}${member.guild.id}`] = toDeleteList[`${member.id}${member.guild.id}`] || {};
		toDeleteList[`${member.id}${member.guild.id}`][`${profileData.name}`] = { fileName: `${profileData.uuid}.json`, deletionTimestamp: Date.now() + 2073600000 };

		fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));

		setTimeout(async () => {

			if (fs.existsSync(`./database/toDelete/${profileData.uuid}.json`) == true) {

				const dataObject = JSON.parse(fs.readFileSync(`./database/toDelete/${profileData.uuid}.json`));
				fs.unlinkSync(`./database/toDelete/${profileData.uuid}.json`);
				console.log('Deleted File: ', dataObject);

				toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));

				delete toDeleteList[`${profileData.userId}${profileData.serverId}`][dataObject.name];
				if (Object.entries(toDeleteList[`${profileData.userId}${profileData.serverId}`]).length === 0) {

					delete toDeleteList[`${profileData.userId}${profileData.serverId}`];
				}

				fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
			}
		}, 2592000000);

		const inactiveUserProfiles = await otherProfileModel.find({
			userId: profileData.userId,
			serverId: profileData.serverId,
		});

		for (const profile of inactiveUserProfiles) {

			fs.renameSync(`./database/profiles/inactiveProfiles/${profile.uuid}.json`, `./database/toDelete/${profile.uuid}.json`);

			toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));

			toDeleteList[`${profile.serverId}${profile.userId}`] = toDeleteList[`${profile.serverId}${profile.userId}`] || {};
			toDeleteList[`${profile.serverId}${profile.userId}`][`${profile.name}`] = { fileName: `${profile.uuid}.json`, deletionTimestamp: Date.now() + 2073600000 };

			fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));

			setTimeout(async () => {

				if (fs.existsSync(`./database/toDelete/${profile.uuid}.json`) == true) {

					const dataObject = JSON.parse(fs.readFileSync(`./database/toDelete/${profile.uuid}.json`));
					fs.unlinkSync(`./database/toDelete/${profile.uuid}.json`);
					console.log('Deleted File: ', dataObject);

					toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));

					delete toDeleteList[`${profile.userId}${profile.serverId}`][profile.name];
					if (Object.entries(toDeleteList[`${profile.userId}${profile.serverId}`]).length === 0) {

						delete toDeleteList[`${profile.userId}${profile.serverId}`];
					}

					fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
				}
			}, 2592000000);
		}
	},
};