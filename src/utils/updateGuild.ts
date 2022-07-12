import { Guild } from 'discord.js';
import { readdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import serverModel from '../models/serverModel';
import { BanList, CustomClient, DeleteList, ServerSchema } from '../typedef';
import { commonPlantsMap, materialsMap, rarePlantsMap, specialPlantsMap, speciesMap, uncommonPlantsMap } from './itemsInfo';

/**
 * This creates a new guild if the guild isn't on the ban list, or restores it from the guilds that are to be deleted.
 */
export async function createGuild(client: CustomClient, guild: Guild): Promise<ServerSchema> {

	const bannedList = JSON.parse(readFileSync('./database/bannedList.json', 'utf-8')) as BanList;
	let serverData: ServerSchema;

	const owner = await client.users
		.fetch(guild.ownerId)
		.catch((error) => { throw new Error(error); });

	await owner
		.createDM()
		.catch((error) => { console.error(error); });

	/* This is checking if the guild is on the ban list. If it is, then the bot will leave the guild and
	send a message to the owner of the guild. */
	if (bannedList.servers.includes(guild.id)) {

		await owner
			.send({ content: `I am sorry to inform you that your guild \`${guild.name}\` has been banned from using this bot.` })
			.catch((error) => { console.error(error); });

		await guild
			.leave()
			.catch((error) => {
				throw new Error(error);
			});

		throw new Error('Forbidden: Request forbidden by administrative rules');
	}

	await owner
		.send({ content: `Thank you for adding Paw and Paper to **${guild.name}**! 🥰\nYour server can receive updates about new releases and features. This is important since the bot is frequently being updated. Just go in your server and type \`rp getupdates #channel\`, with #channel being the channel that you want to receive updates in. Don't worry, I won't spam you! 😊\n\nThere are more features such as being able to visit other servers (\`rp allowvisits\`) or earning roles (\`rp shopadd\`). You can check page 5 of the \`rp help\` command to find out more.` })
		.catch((error) => { console.error(error); });

	const toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8')) as DeleteList;

	/* This is checking if the guild is in the toDelete folder. If it is, then it will move the guild out
	of the toDelete folder and update the guild. */
	for (const fileName of readdirSync('./database/toDelete').filter(f => f.endsWith('.json'))) {

		serverData = JSON.parse(readFileSync(`./database/toDelete/${fileName}`, 'utf-8')) as ServerSchema;

		if (serverData.serverId === guild.id) {

			delete toDeleteList[serverData.uuid];
			renameSync(`./database/toDelete/${fileName}`, `./database/servers/${fileName}`);
			writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
			serverData = serverModel.update(serverData.uuid);
			return serverData;
		}
	}

	serverData = serverModel.create({
		serverId: guild.id,
		name: guild.name,
		inventory: {
			commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, 0])),
			uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, 0])),
			rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, 0])),
			specialPlants: Object.fromEntries([...specialPlantsMap.keys()].sort().map(key => [key, 0])),
			meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
			materials: Object.fromEntries([...materialsMap.keys()].sort().map(key => [key, 0])),
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
		proxysetting: {
			all: [],
			auto: [],
		},
		skills: ['strength', 'dexterity', 'constitution', 'charisma', 'wisdom', 'intelligence'],
		uuid: '',
	});

	return serverData;
}

/**
 * This moves a guild and the user profiles from that guild into the toDelete folder and adds them to the toDeleteList.
 */
export function deleteGuild(guildId: string): void {

	const toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8')) as DeleteList;

	const serverData = serverModel.findOne({ serverId: guildId });
	renameSync(`./database/servers/${serverData.uuid}.json`, `./database/toDelete/${serverData.uuid}.json`);

	const thirtyDaysInMs = 2_592_000_000;
	toDeleteList[serverData.uuid] = Date.now() + thirtyDaysInMs;

	writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
}