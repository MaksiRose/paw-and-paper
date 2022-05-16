// @ts-check
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { default_color } = require('../../config.json');

module.exports.name = 'help';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message) => {

	await message
		.reply({
			embeds: [{
				color: /** @type {`#${string}`} */ (default_color),
				title: 'Welcome to Paw and Paper!',
				description: 'This bot has powerful tools to help make your roleplay more immersive. Additionally, it features a community-driven RPG about animals surviving in the wild. Your goal is to go up the ranks, level up, find items, help your friends and keep your stats high.\n\nClick on the menu options below to get an overview of the available commands!\n**If you are new, start your adventure with `rp name (name)`!**',
			}],
			components: [ new MessageActionRow({
				components: [ new MessageSelectMenu({
					customId: 'help-page',
					placeholder: 'Select a page',
					options: [
						{ label: 'Page 1', value: 'help_page1', description: 'Profile Creation', emoji: '📝' },
						{ label: 'Page 2', value: 'help_page2', description: 'Gameplay', emoji: '🎲' },
						{ label: 'Page 3', value: 'help_page3', description: 'Maintenance', emoji: '🍗' },
						{ label: 'Page 4', value: 'help_page4', description: 'Interaction', emoji: '👥' },
						{ label: 'Page 5', value: 'help_page5', description: 'Bot', emoji: '⚙️' },
					],
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;
};