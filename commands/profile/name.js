const config = require('../../config.json');
const fs = require('fs');
const profileModel = require('../../models/profileModel');
const otherProfileModel = require('../../models/otherProfileModel');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../../utils/itemsInfo');
const startCooldown = require('../../utils/startCooldown');
const { checkRankRequirements } = require('../../utils/checkRoleRequirements');

module.exports = {
	name: 'name',
	async sendMessage(client, message, argumentsArray, profileData, serverData) {

		try {

			profileData = await profileModel.findOne({
				userId: message.author.id,
				serverId: message.guild.id,
			});

			if (!profileData) {

				const bannedList = JSON.parse(fs.readFileSync('./database/bannedList.json'));

				if (bannedList.usersArray.includes(message.author.id)) {

					const user = await client.users.fetch(message.author.id);

					await user
						.createDM()
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					await user
						.send({ content: 'I am sorry to inform you that you have been banned from using this bot.' })
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					return;
				}

				const profileInventoryObject = {
					commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, 0])),
					uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, 0])),
					rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, 0])),
					meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
				};

				profileData = await profileModel.create({
					userId: message.author.id,
					serverId: message.guild.id,
					name: '',
					description: '',
					color: config.default_color,
					species: '',
					rank: 'Youngling',
					avatarURL: message.author.avatarURL(),
					levels: 1,
					experience: 0,
					health: 100,
					energy: 100,
					hunger: 100,
					thirst: 100,
					maxHealth: 100,
					maxEnergy: 100,
					maxHunger: 100,
					maxThirst: 100,
					isResting: false,
					hasCooldown: false,
					hasQuest: false,
					currentRegion: 'sleeping dens',
					unlockedRanks: 0,
					saplingObject: { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null },
					pronounSets: [['they', 'them', 'their', 'theirs', 'themselves', 'plural']],
					injuryObject: { wounds: 0, infections: 0, cold: false, sprains: 0, poison: false },
					inventoryObject: profileInventoryObject,
					advice: { resting: false, drinking: false, eating: false, passingout: false },
					roles: [],
				});
			}
		}
		catch (error) {

			throw new Error(error);
		}

		profileData = await startCooldown(message, profileData);

		const name = argumentsArray.join(' ').charAt(0).toUpperCase() + argumentsArray.join(' ').slice(1);

		if (!name.length) {

			return await message
				.reply({
					embeds: [{
						color: config.default_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Use this command to name or rename your character. Here is how to use it:',
						description: '\n\nrp name [name]\nReplace [name] with the desired name.',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (name.length > 25) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Names can only be up to 25 characters long.',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		const inactiveUserProfiles = await otherProfileModel.find({
			userId: message.author.id,
			serverId: message.guild.id,
		});

		for (const profile of inactiveUserProfiles) {

			if (name === profile.name) {

				return await message
					.reply({
						embeds: [{
							color: config.error_color,
							author: { name: message.guild.name, icon_url: message.guild.iconURL() },
							title: 'You cannot have two accounts with the same name.',
						}],
						failIfNotExists: false,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}
		}

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { name: name } },
		);

		await message
			.reply({
				embeds: [{
					color: config.default_color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					description: `*A stranger carefully steps over the pack's borders. Their face seems friendly. Curious eyes watch them as they come close to the Alpha.* "Welcome," *the Alpha says.* "What is your name?" \n**"${name},"** *the creature responds.*`,
					footer: { text: 'To continue setting up your profile, type "rp species"' },
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		await checkRankRequirements(serverData, message, message.member, 'Youngling');
	},
};
