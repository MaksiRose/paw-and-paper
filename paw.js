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
const mongoose = require('mongoose');

client.commands = new Discord.Collection();

for (const file of fs.readdirSync('./handlers/')) {

	require(`./handlers/${file}`).execute(client);
}

mongoose
	.connect(config.mongodb_srv, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	})
	.then(() => {
		console.log('Connected to database!');
	})
	.catch((err) => {
		console.log(err);
	});

client.login(config.test_token);