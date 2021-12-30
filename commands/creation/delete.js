const config = require('../../config.json');
const profileModel = require('../../models/profileSchema');
const checkValidity = require('../../utils/checkValidity');
const errorHandling = require('../../utils/errorHandling');

module.exports = {
	name: 'delete',
	aliases: ['purge', 'remove', 'reset'],
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await checkValidity.hasCooldown(message, profileData)) {

			return;
		}

		if (!profileData) {

			return await message.reply({
				embeds: [{
					color: config.DEFAULT_COLOR,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'You have no account!',
				}],
			});
		}

		const botReply = await message.reply({
			embeds: [{
				color: config.DEFAULT_COLOR,
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
					style: 'SUCCESS',
				}, {
					type: 'BUTTON',
					customId: 'delete-cancel',
					label: 'Cancel',
					emoji: { name: '✖' },
					style: 'DANGER',
				}],
			}],
		});

		client.on('messageCreate', async function removeDeleteMessageComponents(newMessage) {

			if (!botReply || newMessage.author.id != message.author.id || !newMessage.content.startsWith(config.prefix)) {

				return;
			}

			if (!newMessage.channel.messages.cache.get(botReply.id)) {

				return client.off('messageCreate', removeDeleteMessageComponents);
			}

			await botReply.edit({
				components: [],
			});
			return client.off('messageCreate', removeDeleteMessageComponents);
		});

		const filter = async (i) => {

			if (!i.message.reference || !i.message.reference.messageId) {

				return false;
			}

			const userMessage = await i.channel.messages.fetch(i.message.reference.messageId);
			return userMessage.id == message.id && (i.customId == 'delete-confirm' || i.customId == 'delete-cancel') && i.user.id == message.author.id;
		};

		const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 120000 });
		collector.on('end', async function collectorEnd(collected) {

			if (!collected.size) {

				return await botReply.edit({
					components: [],
				});
			}

			const interaction = collected.first();

			if (interaction.customId == 'delete-confirm') {

				profileModel.deleteOne({ userId: interaction.user.id, serverId: interaction.guild.id }).catch(error => { errorHandling.output(message, error); });

				return await interaction.message.edit({
					embeds: [{
						color: '#9d9e51',
						author: { name: `${interaction.guild.name}`, icon_url: interaction.guild.iconURL() },
						title: 'Your account was deleted permanently! Type "rp name [name]" to start again.',
					}],
					components: [],
				}).catch(error => { errorHandling.output(message, error); });
			}

			if (interaction.customId == 'delete-cancel') {

				return await interaction.message.edit({
					embeds: [{
						color: '#9d9e51',
						author: { name: `${interaction.guild.name}`, icon_url: interaction.guild.iconURL() },
						title: 'Account deletion canceled.',
					}],
					components: [],
				}).catch(error => { errorHandling.output(message, error); });
			}
		});
	},
};