// @ts-check
const { randomUUID } = require('crypto');
const { readdirSync, readFileSync, writeFileSync, unlinkSync, rmSync } = require('fs');
const createId = require('../utils/createId');

for (const file of readdirSync('./database/servers').filter(f => f.endsWith('.json'))) {

	const serverData = JSON.parse(readFileSync(`./database/servers/${file}`, 'utf-8'));

	serverData.inventory = { ...serverData.inventoryObject };
	delete serverData.inventoryObject;
	serverData.blockedEntrance = { ...serverData.blockedEntranceObject };
	delete serverData.blockedEntranceObject;
	serverData.activeUsers = [...serverData.activeUsersArray];
	delete serverData.activeUsersArray;

	writeFileSync(`./database/servers/${serverData.uuid}.json`, JSON.stringify(serverData, null, '\t'));
}


createId().then(_id => {
	const allUsersFiles = [];
	const allNewUserFiles = [];

	for (const file of readdirSync('./database/profiles').filter(f => f.endsWith('.json'))) {

		const profileData = JSON.parse(readFileSync(`./database/profiles/${file}`, 'utf-8'));
		profileData.isActive = true;
		allUsersFiles.push(profileData);
	}

	for (const file of readdirSync('./database/profiles/inactiveProfiles').filter(f => f.endsWith('.json'))) {

		const otherProfileData = JSON.parse(readFileSync(`./database/profiles/inactiveProfiles/${file}`, 'utf-8'));
		otherProfileData.isActive = false;
		allUsersFiles.push(otherProfileData);
	}

	const userIds = [...new Set(allUsersFiles.map(f => f.userId))];
	for (const userId of userIds) {

		const thisUserFiles = allUsersFiles.filter(f => f.userId === userId);
		const newUserFile = /** @type {import('../typedef').ProfileSchema} */ ({
			userId: userId,
			advice: {
				resting: thisUserFiles.filter(f => f.advice.resting === true).length > 0,
				drinking: thisUserFiles.filter(f => f.advice.drinking === true).length > 0,
				eating: thisUserFiles.filter(f => f.advice.eating === true).length > 0,
				passingout: thisUserFiles.filter(f => f.advice.passingout === true).length > 0,
				coloredbuttons: thisUserFiles.filter(f => f.advice.coloredbuttons === true).length > 0,
			},
			reminders: {
				water: thisUserFiles.filter(f => f.saplingObject.reminder === true).length > 0,
				resting: true,
			},
			characters: { },
			currentCharacter: {},
			autoproxy: {},
		});

		for (const thisUserFile of thisUserFiles) {

			const character = /** @type {import('../typedef').Character} */ ({
				_id: _id,
				name: thisUserFile?.name,
				species: thisUserFile?.species,
				description: thisUserFile?.description,
				avatarURL: thisUserFile?.avatarURL,
				pronounSets: thisUserFile?.pronounSets,
				proxy: {
					startsWith: '',
					endsWith: '',
				},
				color: thisUserFile?.color,
				mentions: {},
				profiles: {},
			});
			character.profiles[thisUserFile?.serverId] = /** @type {import('../typedef').Profile} */ ({
				serverId: thisUserFile?.serverId,
				rank: thisUserFile?.rank,
				levels: thisUserFile?.levels,
				experience: thisUserFile?.experience,
				health: thisUserFile?.health,
				energy: thisUserFile?.energy,
				hunger: thisUserFile?.hunger,
				thirst: thisUserFile?.thirst,
				maxHealth: thisUserFile?.maxHealth,
				maxEnergy: thisUserFile?.maxEnergy,
				maxHunger: thisUserFile?.maxHunger,
				maxThirst: thisUserFile?.maxThirst,
				isResting: thisUserFile?.isResting,
				hasCooldown: thisUserFile?.hasCooldown,
				hasQuest: thisUserFile?.hasQuest,
				currentRegion: thisUserFile?.currentRegion,
				unlockedRanks: thisUserFile?.unlockedRanks,
				sapling: {
					exists: thisUserFile?.saplingObject?.exists || false,
					health: thisUserFile?.saplingObject?.health || 50,
					waterCycles: thisUserFile?.saplingObject?.waterCycles || 0,
					nextWaterTimestamp: thisUserFile?.saplingObject?.nextWaterTimestamp || null,
					lastMessageChannelId: thisUserFile?.saplingObject?.lastMessageChannelId || null,
				},
				injuries: {
					wounds: thisUserFile?.injuryObject?.wounds || 0,
					infections: thisUserFile?.injuryObject?.infections || 0,
					cold: thisUserFile?.injuryObject?.cold || false,
					sprains: thisUserFile?.injuryObject?.sprains || 0,
					poison: thisUserFile?.injuryObject?.poison || false,
				},
				inventory: thisUserFile?.inventoryObject || {},
				roles: thisUserFile?.roles || [],
			});

			newUserFile.characters[thisUserFile._id] = character;
		}

		for (const { serverId, name, isActive } of thisUserFiles) {

			if (isActive) { newUserFile.currentCharacter[serverId] = name; }
		}

		newUserFile.uuid = randomUUID();

		allNewUserFiles.push(newUserFile);
	}

	const dir = './database/profiles';

	readdirSync(dir).filter(f => !f.endsWith('.gitignore')).forEach(f => {
		try {
			unlinkSync(`${dir}/${f}`);
		}
		catch {
			rmSync(`${dir}/${f}`, { recursive: true });
		}
	});

	for (const file of allNewUserFiles) {

		writeFileSync(`./database/profiles/${file.uuid}.json`, JSON.stringify(file, null, '\t'));
	}
});