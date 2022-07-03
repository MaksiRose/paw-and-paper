import { Intents } from 'discord.js';
import { existsSync, writeFileSync } from 'fs';
import { BanList, CustomClient, DeleteList, GivenIdList, VoteList, WebhookMessages } from './typedef';
import { execute } from './handlers/events';

/* Note: Once slash commands replace message commands, DIRECT_MESSAGES intent and CHANNEL partial can be removed */
export const client = new CustomClient({
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.DIRECT_MESSAGES,
	],
	partials: [
		'CHANNEL',
	],
	allowedMentions: {
		parse: ['users', 'roles'],
		repliedUser: false,
	},
});

client.commands = {};
client.votes = {};

export function start(botToken: string, bfdToken: string, bfdAuthorization: string, topToken: string, topAuthorization: string, dblToken: string, dblAuthorization: string): void {

	client.votes.bfd = { token: bfdToken, authorization: bfdAuthorization, client: null };
	client.votes.top = { token: topToken, authorization: topAuthorization, client: null };
	client.votes.dbl = { token: dblToken, authorization: dblAuthorization, client: null };

	if (existsSync('./database/bannedList.json') == false) {

		writeFileSync('./database/bannedList.json', JSON.stringify(({ users: [], servers: [] }) as BanList, null, '\t'));
	}

	if (existsSync('./database/givenIds.json') == false) {

		writeFileSync('./database/givenIds.json', JSON.stringify(([]) as GivenIdList, null, '\t'));
	}

	if (existsSync('./database/toDeleteList.json') == false) {

		writeFileSync('./database/toDeleteList.json', JSON.stringify(({}) as DeleteList, null, '\t'));
	}

	if (existsSync('./database/voteCache.json') == false) {

		writeFileSync('./database/voteCache.json', JSON.stringify(({}) as VoteList, null, '\t'));
	}

	if (existsSync('./database/webhookCache.json') == false) {

		writeFileSync('./database/webhookCache.json', JSON.stringify(({}) as WebhookMessages, null, '\t'));
	}


	execute(client);

	client.login(botToken);
}