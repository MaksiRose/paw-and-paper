// @ts-check
const otherProfileModel = require('../models/otherProfileModel');
const serverModel = require('../models/serverModel');
const { readFileSync, renameSync, writeFileSync } = require('fs');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');

/**
 * @type {import('../typedef').Event}
 */
const event = {
	name: 'guildMemberAdd',
	once: false,

	/**
	 * Emitted whenever a user joins a guild.
	 * @param {import('../paw').client} client
	 * @param {import('discord.js').GuildMember} member
	 */
	async execute(client, member) {

		const serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOne({
			serverId: member.guild.id,
		}));

		/**
		 * @type {import('../typedef').DeleteList}
		 */
		const toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

		if (serverData === null || toDeleteList[`${member.id}${member.guild.id}`] === undefined) {

			return;
		}

		for (const profileName of Object.keys(toDeleteList[`${member.id}${member.guild.id}`])) {

			const userFile = toDeleteList[`${member.id}${member.guild.id}`][profileName].fileName;
			renameSync(`./database/toDelete/${userFile}`, `./database/profiles/inactiveProfiles/${userFile}`);

			delete toDeleteList[`${member.id}${member.guild.id}`][profileName];
			if (Object.entries(toDeleteList[`${member.id}${member.guild.id}`]).length === 0) {

				delete toDeleteList[`${member.id}${member.guild.id}`];
			}

			writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));


			const profileData = /** @type {import('../typedef').ProfileSchema} */ (await otherProfileModel.findOne({
				userId: member.id,
				serverId: member.guild.id,
				name: profileName,
			}));

			profileData.inventoryObject = {
				commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, profileData.inventoryObject.commonPlants[key] || 0])),
				uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, profileData.inventoryObject.uncommonPlants[key] || 0])),
				rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, profileData.inventoryObject.rarePlants[key] || 0])),
				meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, profileData.inventoryObject.meat[key] || 0])),
			};

			await otherProfileModel.findOneAndUpdate(
				{ userId: profileData.userId, serverId: profileData.serverId, name: profileName },
				{
					$set: {
						inventoryObject: profileData.inventoryObject,
						hasCooldown: false,
						isResting: false,
						energy: profileData.maxEnergy,
					},
				},
			);
		}
	},
};
module.exports = event;