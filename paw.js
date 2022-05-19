// @ts-check
const { Client, Intents } = require('discord.js');
const { existsSync, writeFileSync } = require('fs');

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
		 * @property {import("@discordjs/builders").SlashCommandBuilder | {name: string, type: number}} data - Command data
		 * @property {Function} sendMessage - Command function
		 * @property {Function} sendCommand - Command function for non-text commands
		 */

		/**
		 * This object holds all the commands with their names as key and the module export as their value
		 * @type {Object<string, Command>}
		 */
		this.commands = {};


		/**
		 * This object holds the structure for the websites the bot can voted on, with the website name as the key and the token and authorization as the value
		 * @type {Object<string, ({ token: string, authorization: string } | import('bfd-api-redux/src/main') | import('@top-gg/sdk').Api)>}
		 */
		this.votes = {};
	}
}

const client = new CustomClient({
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
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


	if (existsSync('./database/bannedList.json') == false) {

		writeFileSync('./database/bannedList.json', JSON.stringify(/** @type {import('./typedef').BanList} */ ({ users: [], servers: [] }), null, '\t'));
	}

	if (existsSync('./database/givenIds.json') == false) {

		writeFileSync('./database/givenIds.json', JSON.stringify(/** @type {import('./typedef').GivenIdList} */ ([]), null, '\t'));
	}

	if (existsSync('./database/toDeleteList.json') == false) {

		writeFileSync('./database/toDeleteList.json', JSON.stringify(/** @type {import('./typedef').DeleteList} */ ({}), null, '\t'));
	}

	if (existsSync('./database/voteCache.json') == false) {

		writeFileSync('./database/voteCache.json', JSON.stringify(/** @type {import('./typedef').VoteList} */ ({}), null, '\t'));
	}

	if (existsSync('./database/webhookCache.json') == false) {

		writeFileSync('./database/webhookCache.json', JSON.stringify(/** @type {import('./typedef').WebhookMessages} */ ({}), null, '\t'));
	}


	require('./handlers/events').execute(client);

	client.login(botToken);
};