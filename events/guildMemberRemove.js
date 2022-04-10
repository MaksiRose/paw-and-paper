// @ts-check
const profileModel = require('../models/profileModel');
const otherProfileModel = require('../models/otherProfileModel');
const serverModel = require('../models/serverModel');
const { renameSync, readFileSync, writeFileSync, existsSync, unlinkSync } = require('fs');

/**
 * @type {import('../typedef').Event}
 */
const event = {
	name: 'guildMemberRemove',
	once: false,

	/**
	 * Emitted whenever a member leaves a guild, or is kicked.
	 * @param {import('../paw').client} client
	 * @param {import('discord.js').GuildMember} member
	 */
	async execute(client, member) {

		const profileData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({
			userId: member.id,
			serverId: member.guild.id,
		}));

		const serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOne({
			serverId: member.guild.id,
		}));

		if (profileData === null || serverData === null) {

			return;
		}

		await profileModel.findOneAndUpdate(
			{ userId: member.id, serverId: member.guild.id },
			{ $set: { currentRegion: 'sleeping dens' } },
		);

		renameSync(`./database/profiles/${profileData.uuid}.json`, `./database/toDelete/${profileData.uuid}.json`);

		/**
		 * @type {import('../typedef').DeleteList}
		 */
		let toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

		toDeleteList[`${member.id}${member.guild.id}`] = toDeleteList[`${member.id}${member.guild.id}`] || {};
		toDeleteList[`${member.id}${member.guild.id}`][`${profileData.name}`] = { fileName: `${profileData.uuid}.json`, deletionTimestamp: Date.now() + 2073600000 };

		writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));

		setTimeout(async () => {

			if (existsSync(`./database/toDelete/${profileData.uuid}.json`) == true) {

				const dataObject = JSON.parse(readFileSync(`./database/toDelete/${profileData.uuid}.json`, 'utf-8'));
				unlinkSync(`./database/toDelete/${profileData.uuid}.json`);
				console.log('Deleted File: ', dataObject);

				toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

				delete toDeleteList[`${profileData.userId}${profileData.serverId}`][dataObject.name];
				if (Object.entries(toDeleteList[`${profileData.userId}${profileData.serverId}`]).length === 0) {

					delete toDeleteList[`${profileData.userId}${profileData.serverId}`];
				}

				writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
			}
		}, 2592000000);

		const inactiveUserProfiles = await otherProfileModel.find({
			userId: profileData.userId,
			serverId: profileData.serverId,
		});

		for (const profile of inactiveUserProfiles) {

			renameSync(`./database/profiles/inactiveProfiles/${profile.uuid}.json`, `./database/toDelete/${profile.uuid}.json`);

			toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

			toDeleteList[`${profile.serverId}${profile.userId}`] = toDeleteList[`${profile.serverId}${profile.userId}`] || {};
			toDeleteList[`${profile.serverId}${profile.userId}`][`${profile.name}`] = { fileName: `${profile.uuid}.json`, deletionTimestamp: Date.now() + 2073600000 };

			writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));

			setTimeout(async () => {

				if (existsSync(`./database/toDelete/${profile.uuid}.json`) == true) {

					const dataObject = JSON.parse(readFileSync(`./database/toDelete/${profile.uuid}.json`, 'utf-8'));
					unlinkSync(`./database/toDelete/${profile.uuid}.json`);
					console.log('Deleted File: ', dataObject);

					toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

					delete toDeleteList[`${profile.userId}${profile.serverId}`][profile.name];
					if (Object.entries(toDeleteList[`${profile.userId}${profile.serverId}`]).length === 0) { delete toDeleteList[`${profile.userId}${profile.serverId}`]; }

					writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
				}
			}, 2592000000);
		}
	},
};
module.exports = event;