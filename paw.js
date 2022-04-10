// @ts-check
const { Client, Intents } = require('discord.js');
const { existsSync, writeFileSync, readFileSync, unlinkSync } = require('fs');

class CustomClient extends Client {
	/**
	 * @param {import("discord.js").ClientOptions} options
	 */
	constructor(options) {

		super(options);

		/**
		 * A command
		 * @typedef {Object} Command
		 * @property {string} name - Command name
		 * @property {Array<string>} aliases - Command aliases
		 * @property {Function} sendMessage - Command function
		 */

		/**
		 * This object holds all the commands with their names as key and the module export as their value
		 * @type {Object<string, Command>}
		 */
		this.commands = {};

		/**
		 * A command
		 * @typedef {Object} WebsiteCredentials
		 * @property {string} token - Website Token
		 * @property {string} authorization - Website Authorization
		 */

		/**
		 * This object holds the structure for the websites the bot can voted on, with the website name as the key and the token and authorization as the value
		 * @type {Object<string, WebsiteCredentials>}
		 */
		this.votes = {};
	}
}

const client = new CustomClient({
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_MEMBERS,
	],
	allowedMentions: {
		parse: ['users', 'roles'],
		repliedUser: false,
	},
});

client.commands = {};
client.votes = {};

module.exports.client = client;

/**
 * Starts the bot up, authorizes vote-websites and creates database files where necessary
 * @param {string} botToken
 * @param {string} bfdToken
 * @param {string} bfdAuthorization
 * @param {string} topToken
 * @param {string} topAuthorization
 * @param {string} dblToken
 * @param {string} dblAuthorization
 */
module.exports.start = (botToken, bfdToken, bfdAuthorization, topToken, topAuthorization, dblToken, dblAuthorization) => {

	client.votes.bfd = { token: bfdToken, authorization: bfdAuthorization };
	client.votes.top = { token: topToken, authorization: topAuthorization };
	client.votes.dbl = { token: dblToken, authorization: dblAuthorization };

	/**
	 * @type {import('./typedef').BanList}
	 */
	const bannedList = {
		users: [],
		servers: [],
	};

	/**
	 * @type {import('./typedef').DeleteList}
	 */
	let toDeleteList = {};

	/**
	 * @type {import('./typedef').VoteList}
	 */
	const voteCache = {};

	/**
	 * @type {import('./typedef').WebhookMessages}
	 */
	const webhookCache = {};

	if (existsSync('./database/bannedList.json') == false) {


		writeFileSync('./database/bannedList.json', JSON.stringify(bannedList, null, '\t'));
	}

	if (existsSync('./database/toDeleteList.json') == false) {

		writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
	}

	if (existsSync('./database/voteCache.json') == false) {

		writeFileSync('./database/voteCache.json', JSON.stringify(voteCache, null, '\t'));
	}

	if (existsSync('./database/webhookCache.json') == false) {

		writeFileSync('./database/webhookCache.json', JSON.stringify(webhookCache, null, '\t'));
	}

	require('./handlers/events').execute(client);

	toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

	for (const [id, accounts] of Object.entries(toDeleteList)) {

		for (const [accountName, accountObject] of Object.entries(accounts)) {

			setTimeout(async () => {

				if (existsSync(`./database/toDelete/${accountObject.fileName}`) == true) {

					/**
					 * @type {import('./typedef').ProfileSchema}
					 */
					const dataObject = JSON.parse(readFileSync(`./database/toDelete/${accountObject.fileName}`, 'utf-8'));
					unlinkSync(`./database/toDelete/${accountObject.fileName}`);
					console.log('Deleted File: ', dataObject);

					toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

					delete toDeleteList[id][accountName];
					if (Object.entries(toDeleteList[id]).length === 0) { delete toDeleteList[id]; }

					writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
				}
			}, accountObject.deletionTimestamp - Date.now());
		}
	}

	client.login(botToken);
};