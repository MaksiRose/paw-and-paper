// @ts-check
const { default_color, error_color } = require('../../config.json');
const { readFileSync } = require('fs');
const profileModel = require('../../models/profileModel');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../../utils/itemsInfo');
const startCooldown = require('../../utils/startCooldown');
const { checkRankRequirements, checkLevelRequirements } = require('../../utils/checkRoleRequirements');
const { MessageEmbed } = require('discord.js');
const createId = require('../../utils/createId');

module.exports.name = 'name';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData) => {

	try {

		if (!userData) {

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

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.create({
				userId: message.author.id,
				advice: { resting: false, drinking: false, eating: false, passingout: false, coloredbuttons: false },
				reminders: { water: true, resting: true },
				characters: {},
				currentCharacter: {},
			}));
		}
	}
	catch (error) {

		throw new Error(error);
	}

	userData = await startCooldown(message);


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

	for (const character of Object.keys(userData.characters)) {

		if (name === character) {

			await message
				.reply({
					embeds: [ new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'You cannot have two characters with the same name.',
					})],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
	}

	const characterData = userData.characters[userData.currentCharacter[message.guild.id]];
	const _id = characterData ? characterData._id : await createId();

	userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ uuid: userData.uuid },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			if (!characterData) {

				p.characters[_id] = {
					_id: _id,
					name: name,
					species: '',
					description: '',
					avatarURL: message.author.avatarURL(),
					pronounSets: [['they', 'them', 'their', 'theirs', 'themselves', 'plural']],
					proxy: '',
					color: /** @type {`#${number}`} */ (default_color),
					mentions: {},
					profiles: {
						[message.guild.id]: {
							serverId: message.guild.id,
							rank: 'Youngling',
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
							currentRegion: 'ruins',
							unlockedRanks: 0,
							sapling: { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null, lastMessageChannelId: null },
							injuries: { wounds: 0, infections: 0, cold: false, sprains: 0, poison: false },
							inventory: {
								commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, 0])),
								uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, 0])),
								rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, 0])),
								meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
							},
							roles: [],
						},
					},
				};
			}
			else {

				p.characters[_id].name = name;
			}

			p.currentCharacter[message.guild.id] = _id;
		},
	));

	await message
		.reply({
			embeds: [ new MessageEmbed({
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: characterData === undefined ? null : `You successfully renamed your character to ${name}!`,
				description: characterData === undefined ? `*A stranger carefully steps over the pack's borders. Their face seems friendly. Curious eyes watch them as they come close to the Alpha.* "Welcome," *the Alpha says.* "What is your name?" \n**"${name},"** *the creature responds.*` : null,
				footer: { text: characterData === undefined ? 'To continue setting up your profile for the RPG, type "rp species". For other options, review "rp help".' : null },
			})],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	await checkRankRequirements(serverData, message, message.member, 'Youngling');
	await checkLevelRequirements(serverData, message, message.member, 1);
};