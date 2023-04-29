import { Client, Collection, GatewayIntentBits, Options } from 'discord.js';
import { Sequelize } from 'sequelize-typescript';
import { readdirSync } from 'fs';
import path from 'path';
import { ContextMenuCommand, SlashCommand } from './typings/handle';
import { Octokit } from '@octokit/rest';
import { execute as executeCommandHandler } from './handlers/commands';
import { execute as executeEventHandler } from './handlers/events';
const { token, github_token, database_password } = require('../config.json');


const tablePath = path.join(__dirname, './models/');
export const sequelize = new Sequelize('patchwork', 'postgres', database_password, {
	host: 'localhost',
	dialect: 'postgres',
	define: {
		freezeTableName: true,
	},
	models: readdirSync(tablePath).map(el => tablePath + el),
	logging: (_msg, sequelizeLogParams: any) => {
		if (
			sequelizeLogParams &&
			sequelizeLogParams.instance &&
			sequelizeLogParams.instance._changed
		) {
			if (sequelizeLogParams.type === 'UPDATE') {
				const changes = (Array.from(sequelizeLogParams.instance._changed) as string[]).map((columnName) => {

					const before = sequelizeLogParams.instance._previousDataValues[columnName];
					const after = sequelizeLogParams.instance.dataValues[columnName];

					if (Array.isArray(after) && Array.isArray(before)) {
						const countMap = new Map<any, number>();
						for (const val of before) { countMap.set(val, (countMap.get(val) || 0) - 1); }
						for (const val of after) { countMap.set(val, (countMap.get(val) || 0) + 1); }

						const removed = Array.from(countMap.entries())
							.filter(([, count]) => count < 0)
							.flatMap(([val, count]) => Array(Math.abs(count)).fill(val));

						const added = Array.from(countMap.entries())
							.filter(([, count]) => count > 0)
							.flatMap(([val, count]) => Array(count).fill(val));

						return { column: columnName, removed, added };
					}
					else {
						return { column: columnName, before, after };
					}
				});
				console.log(`${sequelizeLogParams.instance.constructor.name} ${sequelizeLogParams.instance.id} updated:`, changes);
			}
			else if (sequelizeLogParams.type === 'INSERT') {
				const changes: Record<string, any> = { id: sequelizeLogParams.instance.dataValues.id };
				(Array.from(sequelizeLogParams.instance._changed) as string[]).forEach((columnName) => {
					changes[columnName] = sequelizeLogParams.instance.dataValues[columnName];
				});
				console.log(`Created ${sequelizeLogParams.instance.constructor.name}:`, changes);
			}
			else if (sequelizeLogParams.type === 'DELETE') {
				console.log(`Deleted ${sequelizeLogParams.instance.constructor.name} ${sequelizeLogParams.instance.id}`);
			}
		}
	},
});

sequelize.authenticate()
	.then(function() {

		console.log('Connection has been established successfully.');
		sequelize.sync();
	})
	.catch(function(error) { console.error('Unable to connect to the database:', error); });


/* Note: Once slash commands replace message commands, DIRECT_MESSAGES intent and CHANNEL partial can be removed */
export const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
	allowedMentions: {
		parse: ['users', 'roles'],
		repliedUser: false,
	},
	makeCache: Options.cacheWithLimits({
		...Options.DefaultMakeCacheSettings,
		ApplicationCommandManager: 0,
		BaseGuildEmojiManager: 0,
		GuildBanManager: 0,
		GuildEmojiManager: 0,
		GuildInviteManager: 0,
		GuildScheduledEventManager: 0,
		GuildStickerManager: 0,
		PresenceManager: 0,
		ReactionManager: 0,
		ReactionUserManager: 0,
		StageInstanceManager: 0,
		VoiceStateManager: 0,
	}),
});

export const handle: {
	slashCommands: Collection<string, SlashCommand>;
	contextMenuCommands: Collection<string, ContextMenuCommand>;
} = {
	slashCommands: new Collection<string, SlashCommand>(),
	contextMenuCommands: new Collection<string, ContextMenuCommand>(),
};

export const octokit = new Octokit({
	auth: github_token,
	userAgent: 'paw-and-paper',
});

executeEventHandler(client)
	.then(function() {

		executeCommandHandler();
		client.login(token);
	});