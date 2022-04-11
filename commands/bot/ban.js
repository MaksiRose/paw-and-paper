// @ts-check
const { readFileSync, writeFileSync } = require('fs');
const { profileModel, otherProfileModel } = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');

module.exports.name = 'ban';

/**
 *
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray) => {

	if (message.author.id !== client.application.owner.id && /** @type {import('discord.js').Team} */ (client.application.owner).members?.has(message.author.id) === false) {

		return;
	}

	/** @type {import('../../typedef').BanList} */
	const bannedList = JSON.parse(readFileSync('./database/bannedList.json', 'utf-8'));

	const id = argumentsArray.pop();
	const type = argumentsArray.pop();

	if (type === 'user') {

		bannedList.users.push(id);
		writeFileSync('./database/bannedList.json', JSON.stringify(bannedList, null, '\t'));

		const profiles = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find({ userId: id }));
		const otherProfiles = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await otherProfileModel.find({ userId: id }));

		for (const profile of profiles) {

			await profileModel.findOneAndDelete({ userId: profile.userId, serverId: profile.serverId });
		}

		for (const profile of otherProfiles) {

			await otherProfileModel.findOneAndDelete({ userId: profile.userId, serverId: profile.serverId });
		}

		if (profiles.length > 0 || otherProfiles.length > 0) {

			const user = await client.users.fetch(id);

			await user
				.createDM()
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			await user
				.send({ content: 'I am sorry to inform you that you have been banned from using this bot.' })
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}
	}

	if (type === 'server' || type === 'guild') {

		bannedList.servers.push(id);
		writeFileSync('./database/bannedList.json', JSON.stringify(bannedList, null, '\t'));

		const server = /** @type {Array<import('../../typedef').ServerSchema>} */ (await serverModel.findOne({ serverId: id }));
		const profiles = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find({ serverId: id }));
		const otherProfiles = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await otherProfileModel.find({ serverId: id }));

		await serverModel.findOneAndDelete({ serverId: id });

		for (const profile of profiles) {

			await profileModel.findOneAndDelete({ userId: profile.userId, serverId: profile.serverId });
		}

		for (const profile of otherProfiles) {

			await otherProfileModel.findOneAndDelete({ userId: profile.userId, serverId: profile.serverId });
		}

		if (server !== null) {

			const guild = await client.guilds.fetch(id);
			const user = await client.users.fetch(guild.ownerId);

			await user
				.createDM()
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			await user
				.send({ content: `I am sorry to inform you that your guild \`${guild.name}\` has been banned from using this bot.` })
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			await guild
				.leave()
				.catch((error) => {
					throw new Error(error);
				});
		}
	}
};