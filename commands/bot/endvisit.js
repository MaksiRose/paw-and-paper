// @ts-check
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { error_color, default_color } = require('../../config.json');
const serverModel = require('../../models/serverModel');

module.exports.name = 'endvisit';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ServerSchema} serverData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData, serverData) => {

	if (await hasNotCompletedAccount(message, profileData)) {

		return;
	}

	if (serverData.currentlyVisiting === null) {

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'You are not visiting someonne!',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const otherServerData = await serverModel.findOne(
		{ serverId: serverData.currentlyVisiting },
	);

	const thisChannel = /** @type {import('discord.js').TextChannel} */ (await client.channels.fetch(serverData.visitChannelId));
	const otherChannel = /** @type {import('discord.js').TextChannel} */ (await client.channels.fetch(otherServerData.visitChannelId));

	if (thisChannel.isText() === false || otherChannel.isText() === false) {

		return;
	}

	await serverModel.findOneAndUpdate(
		{ serverId: serverData.serverId },
		{ $set: { currentlyVisiting: null } },
	);

	await serverModel.findOneAndUpdate(
		{ serverId: otherServerData.serverId },
		{ $set: { currentlyVisiting: null } },
	);

	await thisChannel
		.send({
			embeds: [{
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: otherChannel.guild.name, icon_url: otherChannel.guild.iconURL() },
				description: `*Hanging out with friends is always nice but has to end eventually. And so the friends from ${message.guild.name} went back to their territory. Until next time.*`,
			}],
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	await otherChannel
		.send({
			embeds: [{
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: thisChannel.guild.name, icon_url: thisChannel.guild.iconURL() },
				description: `*Hanging out with friends is always nice but has to end eventually. And so the friends from ${message.guild.name} went back to their territory. Until next time.*`,
			}],
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
};