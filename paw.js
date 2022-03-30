const Discord = require('discord.js');
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

client.commands = {};

module.exports.client = client;
module.exports.start = (token) => {

	if (fs.existsSync('./database/bannedList.json') == false) {

		fs.writeFileSync('./database/bannedList.json', JSON.stringify({
			usersArray: [],
			serversArray: [],
		}, null, '\t'));
	}

	if (fs.existsSync('./database/noUpdatesUserList.json') == false) {

		fs.writeFileSync('./database/noUpdatesUserList.json', JSON.stringify({
			usersArray: [],
		}, null, '\t'));
	}

	if (fs.existsSync('./database/toDeleteList.json') == false) {

		fs.writeFileSync('./database/toDeleteList.json', JSON.stringify({}, null, '\t'));
	}

	if (fs.existsSync('./database/webhookCache.json') == false) {

		fs.writeFileSync('./database/webhookCache.json', JSON.stringify({}, null, '\t'));
	}

	require('./handlers/events').execute(client);

	let toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));

	for (const [id, object] of Object.entries(toDeleteList)) {

		setTimeout(async () => {

			if (fs.existsSync(`./database/toDelete/${object.fileName}`) == true) {

				const dataObject = JSON.parse(fs.readFileSync(`./database/toDelete/${object.fileName}`));
				fs.unlinkSync(`./database/toDelete/${object.fileName}`);
				console.log('Deleted File: ', dataObject);

				toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));

				delete toDeleteList[id][dataObject.name];
				if (Object.entries(toDeleteList[id]).length === 0) {

					delete toDeleteList[id];
				}

				fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
			}
		}, object.deletionTimestamp - Date.now());
	}

	client.login(token);
};