// @ts-check
const { error_color, default_color } = require('../../config.json');
const { profileModel } = require('../../models/profileModel');
const { createCommandCollector } = require('../../utils/commandCollector');

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
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'You have no account!',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const botReply = await message
		.reply({
			embeds: [{
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: 'Are you sure you want to delete all your data? This will be **permanent**!!!',
			}],
			components: [{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'delete-confirm',
					label: 'Confirm',
					emoji: '✔',
					style: 'DANGER',
				}, {
					type: 'BUTTON',
					customId: 'delete-cancel',
					label: 'Cancel',
					emoji: '✖',
					style: 'SECONDARY',
				}],
			}],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild.id, botReply);
	const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => (i.customId == 'delete-confirm' || i.customId == 'delete-cancel') && i.user.id == message.author.id;

	/** @type {import('discord.js').MessageComponentInteraction | null} } */
	const interaction = await botReply
		.awaitMessageComponent({ filter, time: 120000 })
		.catch(async () => {return null;});

	if (interaction === null) {

		await botReply
			.edit({
				components: [],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (interaction.customId === 'delete-confirm') {

		await profileModel.findOneAndDelete({
			userId: message.author.id,
			serverId: message.guild.id,
		});

		await /** @type {import('discord.js').Message} */ (interaction.message)
			.edit({
				embeds: [{
					color: '#9d9e51',
					author: { name: `${interaction.guild.name}`, icon_url: interaction.guild.iconURL() },
					title: 'Your account was deleted permanently! Type "rp name [name]" to start again.',
				}],
				components: [],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (interaction.customId === 'delete-cancel') {

		await /** @type {import('discord.js').Message} */ (interaction.message)
			.edit({
				embeds: [{
					color: '#9d9e51',
					author: { name: `${interaction.guild.name}`, icon_url: interaction.guild.iconURL() },
					title: 'Account deletion canceled.',
				}],
				components: [],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}
};