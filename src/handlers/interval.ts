import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import userModel from '../models/userModel';
import { DeleteList } from '../typedef';
import { getMapData } from '../utils/helperFunctions';

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
								u => u.uuid === userData.uuid,
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
}