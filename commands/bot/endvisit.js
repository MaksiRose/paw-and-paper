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
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		const otherServerData = await serverModel.findOne(
			{ serverId: serverData.currentlyVisiting },
		);

		const guestChannnel = await client.channels.fetch(serverData.visitChannelId);
		const hostChannnel = await client.channels.fetch(otherServerData.visitChannelId);

		await guestChannnel
			.send({
				embeds: [{
					color: config.default_color,
					author: { name: hostChannnel.guild.name, icon_url: hostChannnel.guild.iconURL() },
					description: `*Hanging out with friends is always nice but has to end eventually. And so the friends from ${message.guild.name} went back to their territory. Until next time.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		await hostChannnel
			.reply({
				embeds: [{
					color: config.default_color,
					author: { name: guestChannnel.guild.name, icon_url: guestChannnel.guild.iconURL() },
					description: `*Hanging out with friends is always nice but has to end eventually. And so the friends from ${message.guild.name} went back to their territory. Until next time.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		await serverModel.findOneAndUpdate(
			{ serverId: serverData.serverId },
			{ $set: { currentlyVisiting: null } },
		);

		await serverModel.findOneAndUpdate(
			{ serverId: otherServerData.serverId },
			{ $set: { currentlyVisiting: null } },
		);
	},
};