import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import userModel from '../models/userModel';
import serverModel from '../models/serverModel';
import { CustomClient, DeleteList, Event } from '../typedef';
import { createGuild } from '../utils/updateGuild';

export const event: Event = {
	name: 'ready',
	once: true,
	async execute(client: CustomClient) {

		/* Logging to the console that the bot is online and setting the bot's activity. */
		console.log('Paw and Paper is online!');
		client.user?.setActivity('/help', { type: 'PLAYING' });

		/* It's loading all the files in the handlers folder. */
		for (const file of ['commands', 'votes', 'servers', 'profiles']) {

			try {

				await require(`../handlers/${file}`).execute(client);
			}
			catch (error) {

				console.error(error);
			}
		}

		/* For each server, it is updating the servers name in the database and adding an entry
		to the database if the server doesn't have one. */
		const allServers = await client.guilds.fetch();
		for (const [, OAuth2Guild] of allServers) {

			await serverModel.findOneAndUpdate(
				{ serverId: OAuth2Guild.id },
				(s) => {
					s.name = OAuth2Guild.name;
				},
			).catch(async () => {
				const guild = await client.guilds.fetch(OAuth2Guild.id);
				await createGuild(client, guild);
			});
		}

		/* It's checking every hour whether  */
		setInterval(async () => {

			/* It's checking whether the deletionTime of a property on the toDeleteList is older than
			an hour from now, and if it is, delete the property and delete the file from the toDelete folder. */
			const toDeleteList: DeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

			for (const [filename, deletionTime] of Object.entries(toDeleteList)) {

				if (deletionTime < Date.now() + 3_600_000) {

					unlinkSync(`./database/toDelete/${filename}.json`);
					delete toDeleteList[filename];
				}
			}

			writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));


			/* It's checking whether a profile has a temporaryStatIncrease with a timestamp that is older than a
			week ago, and if it does, bring the stat back and delete the property from temporaryStatIncrease. */
			const userList = await userModel.find();
			for (const userData of userList) {

				for (const characterData of Object.values(userData.characters)) {

					for (const profileData of Object.values(characterData.profiles)) {

						for (const [timestamp, statKind] of Object.entries(profileData.temporaryStatIncrease)) {

							if (Number(timestamp) < Date.now() - 604_800_000) {

								userModel.findOneAndUpdate(
									{ uuid: userData.uuid },
									(u) => {
										u.characters[characterData._id].profiles[profileData.serverId][statKind] -= 10;
										const stat = (statKind.replace('max', '').toLowerCase()) as 'health' | 'energy' | 'hunger' | 'thirst';
										if (u.characters[characterData._id].profiles[profileData.serverId][stat] > u.characters[characterData._id].profiles[profileData.serverId][statKind]) {
											u.characters[characterData._id].profiles[profileData.serverId][stat] = u.characters[characterData._id].profiles[profileData.serverId][statKind];
										}
										delete u.characters[characterData._id].profiles[profileData.serverId].temporaryStatIncrease[timestamp];
									},
								);
							}
						}
					}
				}
			}
		}, 3_600_000);
	},
};