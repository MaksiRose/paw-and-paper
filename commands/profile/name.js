// @ts-check
const { default_color, error_color } = require('../../config.json');
const { readFileSync } = require('fs');
const { profileModel, otherProfileModel } = require('../../models/profileModel');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../../utils/itemsInfo');
const startCooldown = require('../../utils/startCooldown');
const { checkRankRequirements } = require('../../utils/checkRoleRequirements');
const { MessageEmbed } = require('discord.js');

module.exports.name = 'name';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ServerSchema} serverData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData, serverData) => {

	try {

		profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({
			userId: message.author.id,
			serverId: message.guild.id,
		}));

		if (!profileData) {

			/** @type {import('../../typedef').BanList} */
			const bannedList = JSON.parse(readFileSync('./database/bannedList.json', 'utf-8'));

			if (bannedList.users.includes(message.author.id)) {

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
						if (error.httpStatus !== 404) { throw new Error(error); }
					});

				return;
			}

			const profileInventoryObject = {
				commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, 0])),
				uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, 0])),
				rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, 0])),
				meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
			};

			profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.create({
				userId: message.author.id,
				serverId: message.guild.id,
				name: '',
				description: '',
				color: default_color,
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
				saplingObject: { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null, reminder: false },
				pronounSets: [['they', 'them', 'their', 'theirs', 'themselves', 'plural']],
				injuryObject: { wounds: 0, infections: 0, cold: false, sprains: 0, poison: false },
				inventoryObject: profileInventoryObject,
				advice: { resting: false, drinking: false, eating: false, passingout: false },
				roles: [],
			}));
		}
	}
	catch (error) {

		throw new Error(error);
	}

	profileData = await startCooldown(message, profileData);

	const name = argumentsArray.join(' ').charAt(0).toUpperCase() + argumentsArray.join(' ').slice(1);

	if (!name.length) {

		await message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'Use this command to name or rename your character. Here is how to use it:',
					description: '\n\nrp name [name]\nReplace [name] with the desired name.',
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (name.length > 25) {

		await message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'Names can only be up to 25 characters long.',
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const inactiveUserProfiles = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await otherProfileModel.find({
		userId: message.author.id,
		serverId: message.guild.id,
	}));

	for (const profile of inactiveUserProfiles) {

		if (name === profile.name) {

			await message
				.reply({
					embeds: [ new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'You cannot have two accounts with the same name.',
					})],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
	}

	await profileModel.findOneAndUpdate(
		{ userId: message.author.id, serverId: message.guild.id },
		{ $set: { name: name } },
	);

	await message
		.reply({
			embeds: [ new MessageEmbed({
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: profileData.species === '' ? null : `You successfully renamed your character to ${name}!`,
				description: profileData.species === '' ? `*A stranger carefully steps over the pack's borders. Their face seems friendly. Curious eyes watch them as they come close to the Alpha.* "Welcome," *the Alpha says.* "What is your name?" \n**"${name},"** *the creature responds.*` : null,
				footer: { text: profileData.species === '' ? 'To continue setting up your profile, type "rp species"' : null },
			})],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	await checkRankRequirements(serverData, message, message.member, 'Youngling');
};