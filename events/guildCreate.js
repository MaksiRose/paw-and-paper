const createGuild = require('../utils/createGuild');

module.exports = {
	name: 'guildCreate',
	once: false,
	async execute(client, guild) {

		await createGuild(client, guild);
	},
};