import { GatewayIntentBits, Partials } from 'discord.js';
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs';
import { BanList, CustomClient, DeleteList, GivenIdList, VoteList, WebhookMessages } from './typedef';
import { execute } from './handlers/events';
import { generateId } from 'crystalid';

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

export function start(
	botToken: string,
	bfdToken: string,
	bfdAuthorization: string,
	topToken: string,
	topAuthorization: string,
	dblToken: string,
	dblAuthorization: string,
): void {

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


	const allServerNames = readdirSync('./database/servers').filter(f => f.endsWith('.json'));
	for (const documentName of allServerNames) {
		const doc = JSON.parse(readFileSync(`./database/servers/${documentName}`, 'utf-8'));
		if (doc.uuid.length > 16) {
			if (Object.hasOwn(doc, 'proxysetting')) {
				doc.proxySetting = {
					channels: {
						blacklist: doc.proxysetting.all,
					},
				};
			}
			const { birthtime } = statSync(`./database/servers/${documentName}`);
			const newUUID = generateId(birthtime.getTime());
			doc.uuid = newUUID;
			writeFileSync(`./database/servers/${documentName}`, JSON.stringify(doc, null, '\t'));
			renameSync(`./database/servers/${documentName}`, `./database/servers/${newUUID}.json`);
		}
	}

	const allProfileNames = readdirSync('./database/profiles').filter(f => f.endsWith('.json'));
	for (const documentName of allProfileNames) {
		const doc = JSON.parse(readFileSync(`./database/profiles/${documentName}`, 'utf-8'));
		if (doc.uuid.length > 16) {
			if (typeof doc.userId === 'string') {
				doc.userId = [doc.userId];
			}
			if (Object.hasOwn(doc, 'reminders')) {
				doc.settings = {
					reminders: doc.reminders,
					proxy: {
						servers: {},
						global: {
							autoproxy: false,
							stickymode: false,
						},
					},
				};
			}
			if (Object.hasOwn(doc, 'autoproxy')) {

				for (const [serverId, entry] of Object.entries(doc.autoproxy)) {

					doc.settings.proxy.servers[serverId] = {
						autoproxy: {
							channels: {
								whitelist: entry,
							},
						},
					};
				}
			}
			if (Object.hasOwn(doc, 'characters')) {

				doc.quids = doc.characters;
			}
			if (Object.hasOwn(doc, 'currentCharacter')) {

				doc.currentQuid = doc.currentCharacter;
			}
			const { birthtime } = statSync(`./database/profiles/${documentName}`);
			const newUUID = generateId(birthtime.getTime());
			doc.uuid = newUUID;
			writeFileSync(`./database/profiles/${documentName}`, JSON.stringify(doc, null, '\t'));
			renameSync(`./database/profiles/${documentName}`, `./database/profiles/${newUUID}.json`);
		}
	}


	execute(client);

	client.login(botToken);
}