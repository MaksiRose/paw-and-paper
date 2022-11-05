import { generateId } from 'crystalid';
import { Guild } from 'discord.js';
import { readdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { client } from '../client';
import { commonPlantsInfo, materialsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '..';
import serverModel from '../models/serverModel';
import { BanList, DeleteList } from '../typings/data/general';
import { ServerSchema } from '../typings/data/server';
import { ProxyListType } from '../typings/data/user';

/**
 * This creates a new guild if the guild isn't on the ban list, or restores it from the guilds that are to be deleted.
 */
export async function createGuild(
	guild: Guild,
): Promise<ServerSchema> {

	const bannedList = JSON.parse(readFileSync('./database/bannedList.json', 'utf-8')) as BanList;
	let serverData: ServerSchema;

	const owner = await client.users.fetch(guild.ownerId);

	await owner
		.createDM()
		.catch((error) => { console.error(error); });

	/* This is checking if the guild is on the ban list. If it is, then the bot will leave the guild and
	send a message to the owner of the guild. */
	if (bannedList.servers.includes(guild.id)) {

		await owner
			.send({ content: `I am sorry to inform you that your guild \`${guild.name}\` has been banned from using this bot.` })
			.catch((error) => { console.error(error); });

		await guild.leave();

		throw new Error('Forbidden: Request forbidden by administrative rules');
	}

	await owner
		.send({ content: `Thank you for adding Paw and Paper to **${guild.name}**! 🥰\nYour server can receive updates about new releases and features. This is important since the bot is frequently being updated. You can configure this and more by typing **\`/server-settings\`** Don't worry, I won't spam you! 😊` })
		.catch((error) => { console.error(error); });

	const toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8')) as DeleteList;

	/* This is checking if the guild is in the toDelete folder. If it is, then it will move the guild out
	of the toDelete folder and update the guild. */
	for (const fileName of readdirSync('./database/toDelete').filter(f => f.endsWith('.json'))) {

		serverData = JSON.parse(readFileSync(`./database/toDelete/${fileName}`, 'utf-8')) as ServerSchema;

		if (serverData.serverId === guild.id) {

			delete toDeleteList[serverData._id];
			renameSync(`./database/toDelete/${fileName}`, `./database/servers/${fileName}`);
			writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
			serverData = await serverModel.findOneAndUpdate(s => s._id === serverData._id, () => { return; });
			return serverData;
		}
	}

	serverData = await serverModel.create({
		serverId: guild.id,
		name: guild.name,
		inventory: {
			commonPlants: Object.fromEntries(Object.keys(commonPlantsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof commonPlantsInfo, number>,
			uncommonPlants: Object.fromEntries(Object.keys(uncommonPlantsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof uncommonPlantsInfo, number>,
			rarePlants: Object.fromEntries(Object.keys(rarePlantsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof rarePlantsInfo, number>,
			specialPlants: Object.fromEntries(Object.keys(specialPlantsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof specialPlantsInfo, number>,
			meat: Object.fromEntries(Object.keys(speciesInfo).map(k => [k, 0]).sort()) as Record<keyof typeof speciesInfo, number>,
			materials: Object.fromEntries(Object.keys(materialsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof materialsInfo, number>,
		},
		dens: {
			sleepingDens: {
				structure: 100,
				bedding: 100,
				thickness: 100,
				evenness: 100,
			},
			foodDen: {
				structure: 100,
				bedding: 100,
				thickness: 100,
				evenness: 100,
			},
			medicineDen: {
				structure: 100,
				bedding: 100,
				thickness: 100,
				evenness: 100,
			},
		},
		nextPossibleAttack: Date.now(),
		visitChannelId: null,
		currentlyVisiting: null,
		shop: [],
		proxySettings: {
			channels: {
				setTo: ProxyListType.Blacklist,
				blacklist: [],
				whitelist: [],
			},
			roles: {
				setTo: ProxyListType.Blacklist,
				blacklist: [],
				whitelist: [],
			},
			tagRequired: false,
			requiredInTag: [],
			tagInDisplayname: false,
			logChannelId: null,
		},
		skills: ['strength', 'dexterity', 'constitution', 'charisma', 'wisdom', 'intelligence'],
		_id: generateId(),
	});

	return serverData;
}

/**
 * This moves a guild and the user profiles from that guild into the toDelete folder and adds them to the toDeleteList.
 */
export async function deleteGuild(
	guildId: string,
): Promise<void> {

	const toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8')) as DeleteList;

	const serverData = await serverModel.findOne(s => s.serverId === guildId);
	renameSync(`./database/servers/${serverData._id}.json`, `./database/toDelete/${serverData._id}.json`);

	const thirtyDaysInMs = 2_592_000_000;
	toDeleteList[serverData._id] = Date.now() + thirtyDaysInMs;

	writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
}