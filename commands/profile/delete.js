// @ts-check
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const { error_color, default_color } = require('../../config.json');
const { profileModel } = require('../../models/profileModel');
const { createCommandCollector } = require('../../utils/commandCollector');
const disableAllComponents = require('../../utils/disableAllComponents');

module.exports.name = 'delete';
module.exports.aliases = ['purge', 'remove', 'reset'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData) => {

	if (!profileData) {

		await message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'You have no account!',
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const botReply = await message
		.reply({
			embeds: [ new MessageEmbed({
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: 'Are you sure you want to delete all your data? This will be **permanent**!!!',
			})],
			components: [ new MessageActionRow({
				components: [ new MessageButton({
					customId: 'delete-confirm',
					label: 'Confirm',
					emoji: '✔',
					style: 'DANGER',
				}), new MessageButton({
					customId: 'delete-cancel',
					label: 'Cancel',
					emoji: '✖',
					style: 'SECONDARY',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild.id, botReply);
	const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => (i.customId == 'delete-confirm' || i.customId == 'delete-cancel') && i.user.id == message.author.id;

	await botReply
		.awaitMessageComponent({ filter, time: 120_000 })
		.then(async interaction => {

			if (interaction.customId === 'delete-confirm') {

				await profileModel.findOneAndDelete({
					userId: message.author.id,
					serverId: message.guild.id,
				});

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: [ new MessageEmbed({
							color: '#9d9e51',
							author: { name: `${interaction.guild.name}`, icon_url: interaction.guild.iconURL() },
							title: 'Your account was deleted permanently! Type "rp name [name]" to start again.',
						})],
						components: disableAllComponents(/** @type {import('discord.js').Message} */ (interaction.message).components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			}

			if (interaction.customId === 'delete-cancel') {

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: [ new MessageEmbed({
							color: '#9d9e51',
							author: { name: `${interaction.guild.name}`, icon_url: interaction.guild.iconURL() },
							title: 'Account deletion canceled.',
						})],
						components: disableAllComponents(/** @type {import('discord.js').Message} */ (interaction.message).components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			}
		})
		.catch(async () => {

			await botReply
				.edit({
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		});
};