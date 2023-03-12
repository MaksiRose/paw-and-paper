import { generateId } from 'crystalid';
import { Guild } from 'discord.js';
import { client } from '..';
import BannedServer from '../models/bannedServer';
import Den from '../models/den';
import ProxyLimits from '../models/proxyLimits';
import Server from '../models/server';

/**
 * This creates a new guild if the guild isn't on the ban list, or restores it from the guilds that are to be deleted.
 */
export async function createGuild(
	guild: Guild,
): Promise<Server> {

	const banEntry = await BannedServer.findByPk(guild.id);

	const owner = await client.users.fetch(guild.ownerId);

	await owner
		.createDM()
		.catch((error) => { console.error(error); });

	/* This is checking if the guild is on the ban list. If it is, then the bot will leave the guild and
	send a message to the owner of the guild. */
	if (banEntry !== null) {

		await owner
			.send({ content: `I am sorry to inform you that your guild \`${guild.name}\` has been banned from using this bot.` })
			.catch((error) => { console.error(error); });

		await guild.leave();

		throw new Error('Forbidden: Request forbidden by administrative rules');
	}

	await owner
		.send({ content: `Thank you for adding Paw and Paper to **${guild.name}**! 🥰\nYour server can receive updates about new releases and features. This is important since the bot is frequently being updated. You can configure this and more by typing **\`/server-settings\`** Don't worry, I won't spam you! 😊` })
		.catch((error) => { console.error(error); });

	return await Server.create({
		id: guild.id,
		proxy_channelLimitsId: (await ProxyLimits.create({ id: generateId() })).id,
		proxy_roleLimitsId: (await ProxyLimits.create({ id: generateId() })).id,
		sleepingDenId: (await Den.create({ id: generateId() })).id,
		medicineDenId: (await Den.create({ id: generateId() })).id,
		foodDenId: (await Den.create({ id: generateId() })).id,
	});
}