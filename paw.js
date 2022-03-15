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

client.commands = new Discord.Collection();

module.exports.client = client;

if (fs.existsSync('./database/noUpdatesUserList.json') == false) {

	fs.writeFileSync('./database/noUpdatesUserList.json', JSON.stringify({
		usersArray: [],
	}, null, '\t'));
}

if (fs.existsSync('./database/toDeleteList.json') == false) {

	fs.writeFileSync('./database/toDeleteList.json', JSON.stringify({}, null, '\t'));
}

for (const file of fs.readdirSync('./handlers/')) {

	require(`./handlers/${file}`).execute(client);
}

const toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));

for (const [id, object] of Object.entries(toDeleteList)) {

	setTimeout(async () => {

		if (fs.existsSync(`./database/toDelete/${object.fileName}`) == true) {

			const dataObject = JSON.parse(fs.readFileSync(`./database/toDelete/${object.fileName}`));
			fs.unlinkSync(`./database/toDelete/${object.fileName}`);
			console.log('Deleted File: ', dataObject);

			delete toDeleteList[id];
			fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
		}
	}, Date.now() - object.deletionTimestamp);
}

client.login(config.token);