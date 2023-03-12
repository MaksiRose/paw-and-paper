import { Op } from 'sequelize';
import { isResting, startResting } from '../commands/gameplay_maintenance/rest';
import { lastInteractionMap, serverActiveUsersMap } from '../events/interactionCreate';
import DiscordUser from '../models/discordUser';
import DiscordUserToServer from '../models/discordUserToServer';
import Quid from '../models/quid';
import QuidToServer from '../models/quidToServer';
import Server from '../models/server';
import TemporaryStatIncrease from '../models/temporaryStatIncrease';
import User from '../models/user';
import UserToServer from '../models/userToServer';
import { hasNameAndSpecies } from '../utils/checkUserState';
import { now, sendErrorMessage } from '../utils/helperFunctions';

/** It's checking whether the deletionTime of a property on the toDeleteList is older than an hour from now, and if it is, delete the property and delete the file from the toDelete folder. It's also checking whether a profile has a temporaryStatIncrease with a timestamp that is older than a week ago, and if it does, bring the stat back and delete the property from temporaryStatIncrease. */
export async function execute(): Promise<void> {

	setInterval(async () => {

		/* It's checking whether the deletionTime of a property on the toDeleteList is older than an hour from now, and if it is, delete the property and delete the file from the toDelete folder. */
		// const toDeleteList: DeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

		// for (const [filename, deletionTime] of Object.entries(toDeleteList)) {

		// 	if (deletionTime < Date.now() + 3_600_000) {

		// 		unlinkSync(`./database/toDelete/${filename}.json`);
		// 		delete toDeleteList[filename];
		// 	}
		// }

		// writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));


		/* It's checking whether a profile has a temporaryStatIncrease with a timestamp that is older than a week ago, and if it does, bring the stat back and delete the property from temporaryStatIncrease. */
		const temporaryStatIncreases = await TemporaryStatIncrease.findAll({ where: { startedTimestamp: { [Op.lt]: now() - 604_800 } } });
		for (const temporaryStatIncrease of temporaryStatIncreases) {

			const quidToServer = await QuidToServer.findByPk(temporaryStatIncrease.quidToServerId);
			if (quidToServer) {

				const stat = (temporaryStatIncrease.type.replace('max', '').toLowerCase()) as 'health' | 'energy' | 'hunger' | 'thirst';
				const newStatAmount = Math.min(quidToServer[stat], quidToServer[temporaryStatIncrease.type]);
				await quidToServer.update({ [temporaryStatIncrease.type]: quidToServer[temporaryStatIncrease.type] - 10, [stat]: newStatAmount });
			}
			await temporaryStatIncrease.destroy();
		}
	}, 3_600_000);


	async function tenSecondInterval() {

		const tenMinutesInS = 600;
		const usersToServers = await UserToServer.findAll({
			where: {
				activeQuidId: { [Op.not]: null },
				lastInteraction_timestamp: { [Op.not]: null, [Op.lt]: now() - tenMinutesInS },
				hasCooldown: false,
			},
		});
		for (const userToServer of usersToServers) {

			if (!userToServer.activeQuidId || !userToServer.lastInteraction_timestamp) { continue; } // This should never happen and is just for typings
			const quid = await Quid.findByPk(userToServer.activeQuidId);

			/* start resting if possible */
			if (!hasNameAndSpecies(quid)) { continue; }

			const user = await User.findByPk(userToServer.userId);
			const quidToServer = await QuidToServer.findOne({ where: { quidId: quid.id } });
			const server = await Server.findByPk(userToServer.serverId);
			const discordUsers = await DiscordUser.findAll({ where: { userId: userToServer.userId } });
			const discordUsersToServer = await DiscordUserToServer.findOne({
				where: {
					discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
					isMember: true,
				},
			});
			if (!user || !quidToServer || !server || !discordUsersToServer) { continue; }

			const hasLessThanMaxEnergy = quidToServer.energy < quidToServer.maxEnergy;
			const isConscious = quidToServer.energy > 0 && quidToServer.health > 0 && quidToServer.hunger > 0 && quidToServer.thirst > 0;
			if (isResting(userToServer) === false && hasLessThanMaxEnergy && isConscious) {

				const lastInteraction = lastInteractionMap.get(user.id + server.id);
				await startResting(lastInteraction, discordUsersToServer.discordUserId, user, quid, userToServer, quidToServer, server, '', true)
					.catch(async (error) => {
						if (lastInteraction !== undefined) {

							await sendErrorMessage(lastInteraction, error)
								.catch(e => { console.error(e); });
							lastInteractionMap.delete(user.id + server.id); // This is to avoid sending repeating error messages every 10 seconds
						}
						else {

							console.error(error);
							// This is to avoid sending repeating error messages to the console every 10 seconds
							await userToServer.update({ lastInteraction_timestamp: null });
						}
					});
			}
		}

		for (let [guildId, array] of serverActiveUsersMap.entries()) {

			for (const userId of array) {

				const userToServer = await UserToServer.findOne({ where: { userId: userId, serverId: guildId } });

				/* If there is no last interaction or if the last interaction was created more than 5 minutes ago, remove the user from the array */
				if (!userToServer || !userToServer.lastInteraction_timestamp || userToServer.lastInteraction_timestamp <= now() - 300) { array = array.filter(v => v !== userId); }
			}
			serverActiveUsersMap.set(guildId, array);
		}
	}
	tenSecondInterval();
	setInterval(tenSecondInterval, 10_000);
}