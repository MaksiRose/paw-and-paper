const config = require('../../config.json');

module.exports = {
	name: 'help',
	async sendMessage(client, message) {

		return await message
			.reply({
				embeds: [{
					color: config.default_color,
					title: 'Welcome to Paw and Paper!',
					description: 'This is an interactive roleplay game. After choosing a name and a species, you will be welcomed to your pack. You start as a Youngling, and your goal is to go up the ranks, gain as much experience as possible, explore all the places and help out your pack. You can go to different biomes, where you can find herbs, stumble upon animals to fight, or do quests. But beware of your stats! If one of them reaches zero, you will pass out and lose all your items.\n\nClick on the menu options below to get an overview of the available commands!\n**If you are new, start your adventure with `rp name (name)`!**',
				}],
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'SELECT_MENU',
						customId: 'help-page',
						placeholder: 'Select a page',
						options: [
							{ label: 'Page 1', value: 'help_page1', description: 'Character Creation', emoji: '📝' },
							{ label: 'Page 2', value: 'help_page2', description: 'General Commands', emoji: '💬' },
							{ label: 'Page 3', value: 'help_page3', description: 'Role-specific Commands', emoji: '🔖' },
						],
					}],
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};