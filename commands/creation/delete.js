const config = require('../../config.json');
const profileModel = require('../../models/profileModel');

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
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		client.on('messageCreate', async function removeDeleteMessageComponents(newMessage) {

			if (!botReply || newMessage.author.id != message.author.id || !newMessage.content.startsWith(config.prefix)) {

				return;
			}

			if (!newMessage.channel.messages.cache.get(botReply.id)) {

				return client.off('messageCreate', removeDeleteMessageComponents);
			}

			await botReply
				.edit({
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			return client.off('messageCreate', removeDeleteMessageComponents);
		});

		const filter = async (i) => {

			if (!i.message.reference || !i.message.reference.messageId) {

				return false;
			}

			const userMessage = await i.channel.messages
				.fetch(i.message.reference.messageId)
				.catch((error) => {
					throw new Error(error);
				});

			return userMessage.id == message.id && (i.customId == 'delete-confirm' || i.customId == 'delete-cancel') && i.user.id == message.author.id;
		};

		const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 120000 });
		collector.on('end', async function collectorEnd(collected) {

			if (!collected.size) {

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

			const interaction = collected.first();

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
		});
	},
};