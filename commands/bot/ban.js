// @ts-check
const { User } = require('discord.js');
const { readFileSync, writeFileSync } = require('fs');
const profileModel = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');

module.exports.name = 'ban';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray) => {

	if (!client.isReady()) { return; }
	await client.application.fetch();

	if ((client.application.owner instanceof User) ? message.author.id !== client.application.owner.id : client.application.owner ? !client.application.owner.members.has(message.author.id) : false) {

		return;
	}

	/** @type {import('../../typedef').BanList} */
	const bannedList = JSON.parse(readFileSync('./database/bannedList.json', 'utf-8'));

	const id = argumentsArray.pop();
	const type = argumentsArray.pop();

	if (!id) { return; }

	if (type === 'user') {

		bannedList.users.push(id);
		writeFileSync('./database/bannedList.json', JSON.stringify(bannedList, null, '\t'));

		const profile = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: id }));

		await profileModel.findOneAndDelete({ userId: id });

		if (profile !== null) {

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

		const server = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOne({ serverId: id }));

		await serverModel.findOneAndDelete({ serverId: id });

		if (server !== null) {

			const guild = await message.client.guilds.fetch(id);
			const user = await message.client.users.fetch(guild.ownerId);

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