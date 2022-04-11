const config = require('../../config.json');
const profileModel = require('../../models/profileModel');
const { createCommandCollector } = require('../../utils/commandCollector');

module.exports = {
	name: 'delete',
	aliases: ['purge', 'remove', 'reset'],
	async sendMessage(client, message, argumentsArray, profileData) {

		if (!profileData) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'You have no account!',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		const botReply = await message
			.reply({
				embeds: [{
					color: config.default_color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'Are you sure you want to delete all your data? This will be **permanent**!!!',
					footer: { text: 'Consider starting a second account via `rp accounts`.' },
				}],
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: 'delete-confirm',
						label: 'Confirm',
						emoji: { name: '✔' },
						style: 'DANGER',
					}, {
						type: 'BUTTON',
						customId: 'delete-cancel',
						label: 'Cancel',
						emoji: { name: '✖' },
						style: 'SECONDARY',
					}],
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		createCommandCollector(message.author.id, message.guild.id, botReply);
		const filter = i => (i.customId == 'delete-confirm' || i.customId == 'delete-cancel') && i.user.id == message.author.id;

		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 120000 })
			.catch(async () => {return null;});

		if (interaction == null) {

			return await botReply
				.edit({
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (interaction.customId == 'delete-confirm') {

			await profileModel.findOneAndDelete({
				userId: message.author.id,
				serverId: message.guild.id,
			});

			return await interaction.message
				.edit({
					embeds: [{
						color: '#9d9e51',
						author: { name: `${interaction.guild.name}`, icon_url: interaction.guild.iconURL() },
						title: 'Your account was deleted permanently! Type "rp name [name]" to start again.',
					}],
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (interaction.customId == 'delete-cancel') {

			return await interaction.message
				.edit({
					embeds: [{
						color: '#9d9e51',
						author: { name: `${interaction.guild.name}`, icon_url: interaction.guild.iconURL() },
						title: 'Account deletion canceled.',
					}],
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}
	},
};