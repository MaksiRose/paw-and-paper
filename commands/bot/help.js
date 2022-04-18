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
				description: 'This is an interactive roleplay game. After choosing a name and a species, you will be welcomed to your pack. You start as a Youngling, and your goal is to go up the ranks, gain as much experience as possible, explore all the places and help out your pack. You can go to different biomes, where you can find herbs, stumble upon animals to fight, or do quests. But beware of your stats! If one of them reaches zero, you will pass out and lose all your items.\n\nClick on the menu options below to get an overview of the available commands!\n**If you are new, start your adventure with `rp name (name)`!**',
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