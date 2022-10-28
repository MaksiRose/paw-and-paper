import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { isResting, startResting } from '../commands/gameplay_maintenance/rest';
import { lastInteractionMap, serverActiveUsersMap } from '../events/interactionCreate';
import serverModel from '../models/serverModel';
import userModel, { getUserData } from '../models/userModel';
import { DeleteList } from '../typings/data/general';
import { hasNameAndSpecies } from '../utils/checkUserState';
import { getMapData, sendErrorMessage, userDataServersObject } from '../utils/helperFunctions';

/** It's checking whether the deletionTime of a property on the toDeleteList is older than an hour from now, and if it is, delete the property and delete the file from the toDelete folder. It's also checking whether a profile has a temporaryStatIncrease with a timestamp that is older than a week ago, and if it does, bring the stat back and delete the property from temporaryStatIncrease. */
export async function execute(): Promise<void> {

	setInterval(async () => {

		/* It's checking whether the deletionTime of a property on the toDeleteList is older than an hour from now, and if it is, delete the property and delete the file from the toDelete folder. */
		const toDeleteList: DeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

		for (const [filename, deletionTime] of Object.entries(toDeleteList)) {

			if (deletionTime < Date.now() + 3_600_000) {

				unlinkSync(`./database/toDelete/${filename}.json`);
				delete toDeleteList[filename];
			}
		}

		writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));


		/* It's checking whether a profile has a temporaryStatIncrease with a timestamp that is older than a week ago, and if it does, bring the stat back and delete the property from temporaryStatIncrease. */
		const userList = await userModel.find();
		for (const userData of userList) {

			for (const quidData of Object.values(userData.quids)) {

				for (const profileData of Object.values(quidData.profiles)) {

					for (const [timestamp, statKind] of Object.entries(profileData.temporaryStatIncrease)) {

						if (Number(timestamp) < Date.now() - 604_800_000) {

							userModel.findOneAndUpdate(
								u => u._id === userData._id,
								(u) => {
									const p = getMapData(getMapData(u.quids, quidData._id).profiles, profileData.serverId);
									p[statKind] -= 10;
									const stat = (statKind.replace('max', '').toLowerCase()) as 'health' | 'energy' | 'hunger' | 'thirst';
									if (p[stat] > p[statKind]) { p[stat] = p[statKind]; }
									delete p.temporaryStatIncrease[timestamp];
								},
							);
						}
					}
				}
			}
		}
	}, 3_600_000);


	async function tenSecondInterval() {

		const userArray = await userModel.find();
		for (const user of userArray) {

			for (const [guildId, quidId] of Object.entries(user.currentQuid)) {

				const userData = getUserData(user, guildId, getMapData(user.quids, quidId));


				/* Map the interaction to the database */
				const lastInteraction = lastInteractionMap.get(userData._id + guildId);
				if (lastInteraction) {

					await userData.update(
						(u) => {
							u.servers[guildId] = {
								...userDataServersObject(u, guildId),
								lastInteractionTimestamp: lastInteraction.createdTimestamp,
								lastInteractionToken: lastInteraction.token,
								lastInteractionChannelId: lastInteraction.channelId,
							};
						},
					);
				}


				/* start resting if possible */
				if (!hasNameAndSpecies(userData)) { continue; }
				const tenMinutesInMs = 600_000;

				const serverInfo = userData.serverInfo;
				if (!serverInfo || !serverInfo.lastInteractionTimestamp) { continue; }

				const serverData = serverModel.find(s => s.serverId === guildId)[0];
				if (!serverData) { continue; }

				const lastInteractionIsTenMinutesAgo = serverInfo.lastInteractionTimestamp < Date.now() - tenMinutesInMs;
				const hasLessThanMaxEnergy = userData.quid.profile.energy < userData.quid.profile.maxEnergy;
				const isConscious = userData.quid.profile.energy > 0 || userData.quid.profile.health > 0 || userData.quid.profile.hunger > 0 || userData.quid.profile.thirst > 0;
				const hasNoCooldown = userData.serverInfo?.hasCooldown !== true;
				if (lastInteractionIsTenMinutesAgo && userData.quid.profile.isResting === false && isResting(userData) === false && hasLessThanMaxEnergy && isConscious && hasNoCooldown) {

					const lastInteraction = lastInteractionMap.get(userData._id + guildId);
					await startResting(lastInteraction, userData, serverData, '', true)
						.catch(async (error) => {
							if (lastInteraction !== undefined) {

								await sendErrorMessage(lastInteraction, error)
									.catch(e => { console.error(e); });
							}
							else { console.error(error); }
						});
				}
			}
		}

		for (let [guildId, array] of serverActiveUsersMap.entries()) {

			for (const userId of array) {

				const userData = userModel.find(u => u.userId.includes(userId))[0];
				const serverInfo = userData?.servers[guildId];
				/* If there is no last interaction or if the last interaction was created more than 5 minutes ago, remove the user from the array */
				if (!serverInfo || !serverInfo.lastInteractionTimestamp || serverInfo.lastInteractionTimestamp <= Date.now() - 300_000) { array = array.filter(v => v !== userId); }
			}
			serverActiveUsersMap.set(guildId, array);
		}
	}
	tenSecondInterval();
	setInterval(tenSecondInterval, 10_000);
}