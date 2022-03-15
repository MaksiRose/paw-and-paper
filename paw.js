const Discord = require('discord.js');
const config = require('./config.json');
const fs = require('fs');

const client = new Discord.Client({
	intents: [
		Discord.Intents.FLAGS.GUILDS,
		Discord.Intents.FLAGS.GUILD_MESSAGES,
		Discord.Intents.FLAGS.GUILD_MEMBERS,
	],
	allowedMentions: {
		parse: ['users', 'roles'],
		repliedUser: false,
	},
});

module.exports.client = client;

client.commands = new Discord.Collection();

for (const file of fs.readdirSync('./handlers/')) {

	require(`./handlers/${file}`).execute(client);
}

client.login(config.token);