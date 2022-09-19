import { GatewayIntentBits, Partials } from 'discord.js';
import { existsSync, writeFileSync } from 'fs';
import { BanList, CustomClient, DeleteList, GivenIdList, VoteList, WebhookMessages } from './typedef';

/* Note: Once slash commands replace message commands, DIRECT_MESSAGES intent and CHANNEL partial can be removed */
export const client = new CustomClient({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.MessageContent,
	],
	partials: [
		Partials.Channel,
	],
	allowedMentions: {
		parse: ['users', 'roles'],
		repliedUser: false,
	},
});

export async function start(
	botToken: string,
	bfdToken: string,
	bfdAuthorization: string,
	topToken: string,
	topAuthorization: string,
	dblToken: string,
	dblAuthorization: string,
): Promise<void> {

	client.votes.bfd = { token: bfdToken, authorization: bfdAuthorization, client: null };
	client.votes.top = { token: topToken, authorization: topAuthorization, client: null };
	client.votes.dbl = { token: dblToken, authorization: dblAuthorization, client: null };

	if (existsSync('./database/bannedList.json') == false) {

		writeFileSync('./database/bannedList.json', JSON.stringify(({ users: [], servers: [] }) as BanList, null, '\t'));
	}

	if (existsSync('./database/errorStacks.json') == false) {

		writeFileSync('./database/errorStacks.json', JSON.stringify(({}) as WebhookMessages, null, '\t'));
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

	/* It's loading all the files in the handlers folder. */
	for (const file of ['commands', 'events', 'votes']) {

		try { await require(`./handlers/${file}`).execute(client); }
		catch (error) { console.error(error); }
	}

	await client.login(botToken);
}