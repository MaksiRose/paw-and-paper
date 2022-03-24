const config = require('../../config.json');
const profileModel = require('../../models/profileModel');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../../utils/itemsInfo');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'name',
	async sendMessage(client, message, argumentsArray, profileData) {

		try {

			profileData = await profileModel.findOne({
				userId: message.author.id,
				serverId: message.guild.id,
			});

			if (!profileData) {

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
					saplingObject: { exists: false, health: 100, waterCycles: 0, nextWaterTimestamp: null },
					pronounSets: [['they', 'them', 'their', 'theirs', 'themselves', 'plural']],
					injuryObject: { wounds: 0, infections: 0, cold: false, sprains: 0, poison: false },
					inventoryObject: profileInventoryObject,
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
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
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
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};
