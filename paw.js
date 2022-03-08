const Discord = require('discord.js');
const config = require('./config.json');
const fs = require('fs');
const profileModel = require('./models/profileModel');

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

for (const account of profileModel.find({})) {

	if (account.hasCooldown == true) {

		profileModel.findOneAndUpdate(
			{ userId: account.userId, serverId: account.serverId },
			{ $set: { hasCooldown: false } },
		);
	}

	if (account.isResting == true) {

		profileModel.findOneAndUpdate(
			{ userId: account.userId, serverId: account.serverId },
			{ $set: { isResting: false, energy: account.maxEnergy } },
		);
	}
}

client.login(config.token);