const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const config = require('../../config.json');
const serverModel = require('../../models/serverModel');

module.exports = {
	name: 'endvisit',
	async sendMessage(client, message, argumentsArray, profileData, serverData) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (serverData.currentlyVisiting === null) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'You are not visiting someonne!',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		const otherServerData = await serverModel.findOne(
			{ serverId: serverData.currentlyVisiting },
		);

		const thisChannel = await client.channels.fetch(serverData.visitChannelId);
		const otherChannel = await client.channels.fetch(otherServerData.visitChannelId);

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
					color: config.default_color,
					author: { name: otherChannel.guild.name, icon_url: otherChannel.guild.iconURL() },
					description: `*Hanging out with friends is always nice but has to end eventually. And so the friends from ${message.guild.name} went back to their territory. Until next time.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		await otherChannel
			.send({
				embeds: [{
					color: config.default_color,
					author: { name: thisChannel.guild.name, icon_url: thisChannel.guild.iconURL() },
					description: `*Hanging out with friends is always nice but has to end eventually. And so the friends from ${message.guild.name} went back to their territory. Until next time.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	},
};