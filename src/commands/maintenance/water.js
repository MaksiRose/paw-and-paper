// @ts-check
const { hasCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('../gameplay/attack');
const profileModel = require('../../models/profileModel');
const { pullFromWeightedTable, generateRandomNumber } = require('../../utils/randomizers');
const { checkLevelUp } = require('../../utils/levelHandling');
const { pronounAndPlural } = require('../../utils/getPronouns');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const isInGuild = require('../../utils/isInGuild');

const oneMinute = 60_000;
const thirtyMinutes = oneMinute * 30;
const oneHour = thirtyMinutes * 2;
const threeHours = oneHour * 3;
const twentyFourHours = threeHours * 8;
const userMap = new Map();

module.exports.name = 'water';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	const currentTimestamp = message.createdTimestamp;

	if (!isInGuild(message)) {

		return;
	}

	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	let profileData = characterData?.profiles?.[message.guild.id];

	if (!hasCompletedAccount(message, characterData)) {

		return;
	}

	if (await isInvalid(message, userData, embedArray, [module.exports.name])) {

		return;
	}

	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	if (profileData.sapling.exists === false) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} has already fetched water when ${pronounAndPlural(characterData, 0, 'remember')} that ${pronounAndPlural(characterData, 0, 'has', 'have')} nothing to water.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const saplingObject = { ...profileData.sapling };
	// timeDifference is positive if nextWaterTimestamp is in the past, and negative if nextWaterTimestamp is in the future
	const timeDifference = Math.abs(currentTimestamp - (saplingObject.nextWaterTimestamp || 0));
	const timeDifferenceInMinutes = Math.round(timeDifference / oneMinute);

	let experiencePoints = 0;
	let healthPoints = 0;

	const embed = new MessageEmbed()
		.setColor(characterData.color)
		.setAuthor({ name: characterData.name, iconURL: characterData.avatarURL });

	/* This is the first of three `if` statements that check the time difference between the current
	timestamp and the timestamp of the perfect watering time. If the time difference is less than or equal to
	30 minutes, the sapling's health is increased by a number between 1 and 4, the number of watering
	cycles is increased by 1, the experience points are set to the number of watering cycles, the
	health points are set to a number between 1 and 6, and the embed's description and footer are set. */
	if (timeDifference <= thirtyMinutes) {

		const saplingHealthPoints = 4 - Math.round(timeDifferenceInMinutes / 10);
		saplingObject.health += saplingHealthPoints;
		saplingObject.waterCycles += 1;

		experiencePoints = saplingObject.waterCycles;
		healthPoints = pullFromWeightedTable({ 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 }) + generateRandomNumber(Math.round(saplingObject.waterCycles / 4), 0);
		if (profileData.health + healthPoints > profileData.maxHealth) { healthPoints = profileData.maxHealth - profileData.health; }

		embed.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Perfect.png');
		embed.setDescription(`*${characterData.name} waters the seedling, and it look it's at the perfect time. The ginkgo tree looks healthy, the leaves have a strong green color, and a pleasant fragrance emanates from them. The ${characterData.displayedSpecies || characterData.species} feels warm and safe from the scent.*`),
		embed.setFooter({ text: `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})${healthPoints > 0 ? `\n+${healthPoints} health (${profileData.health + healthPoints}/${profileData.maxEnergy})` : ''}\n\n+${saplingHealthPoints} health for ginkgo sapling\nCome back to water it in 24 hours.` });
	}
	/* This is the second of three `if` statements that check the time difference between the current
	timestamp and the timestamp of the perfect watering time. If the time difference is less than or
	equal to 3 hours, the number of watering cycles is increased by 1, the experience points are set
	to the number of watering cycles, and the embed's description and footer are set. */
	else if (timeDifference <= threeHours) {

		saplingObject.waterCycles += 1;
		experiencePoints = saplingObject.waterCycles;

		embed.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Good.png');
		embed.setDescription(`*${characterData.name} waters the seedling, and it look like the sapling needs it. Although the ginkgo tree looks healthy, with leaves of beautiful green color and a light scent, the soil seems to be already quite dry.*`);
		embed.setFooter({ text: `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})\n\nCome back to water the ginkgo sapling in 24 hours.` });
	}
	/* Checking if the sapling is overdue for watering, and if it is, it is calculating how much health it
	has lost. */
	else {

		const weeksAlive = Math.floor(saplingObject.waterCycles / 7);
		const overdueHours = Math.ceil(timeDifference / oneHour) - 3;
		const percentage = (overdueHours * 3) / 100;
		const lostHealthPoints = Math.round(saplingObject.health * percentage) + weeksAlive;
		saplingObject.health -= (saplingObject.health - lostHealthPoints > 0 ? lostHealthPoints : saplingObject.health - lostHealthPoints > -weeksAlive ? saplingObject.health - 1 : saplingObject.health);

		embed.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Miss.png');
		if (currentTimestamp < (saplingObject.nextWaterTimestamp || 0)) {

			embed.setDescription(`*The soil is already soggy when ${characterData.name} adds more water to it. The leaves are yellow-brown, the stem is muddy and has a slight mold. Next time the ${characterData.displayedSpecies || characterData.species} should wait a little with the watering.*`);
		}
		else {

			embed.setDescription(`*${characterData.name} decides to see if the ginkgo tree needs watering, and sure enough: the leaves are drooping, some have lost color, and many of them fell on the ground. It is about time that the poor tree gets some water.*`);
		}
		embed.setFooter({ text: `-${lostHealthPoints} health for ginkgo tree\nCome back to water it in 24 hours.` });
	}

	saplingObject.nextWaterTimestamp = currentTimestamp + twentyFourHours;
	saplingObject.lastMessageChannelId = message.channel.id;

	userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: message.author.id },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].sapling = saplingObject;
			p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].experience += experiencePoints;
			p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].health += healthPoints;
		},
	));
	characterData = userData.characters[userData.currentCharacter[message.guild.id]];
	profileData = characterData.profiles[message.guild.id];

	const botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, embed],
			components: [ new MessageActionRow({
				components: [ new MessageButton({
					customId: `water-reminder-${userData.reminders.water === true ? 'off' : 'on'}`,
					label: `Turn water reminders ${userData.reminders.water === true ? 'off' : 'on'}`,
					style: 'SECONDARY',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	if (userData.reminders.water === true) {

		module.exports.sendReminder(client, userData, characterData, profileData);
	}

	await checkLevelUp(message, userData, serverData, botReply);

	if (profileData.sapling.health <= 0) {

		await message.channel
			.send({
				embeds: [{
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*No matter what ${characterData.name} does, all the leaves on the ginkgo tree have either fallen off, or are dark brown and hang limply. It's time to say goodbye to the tree.*`,
					image: { url: 'https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Dead.png' },
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].sapling = { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null, lastMessageChannelId: null };
			},
		);
	}
};

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').Character} characterData
 * @param {import('../../typedef').Profile} profileData
 */
module.exports.sendReminder = (client, userData, characterData, profileData) => {

	module.exports.stopReminder(characterData._id, userData.userId, profileData.serverId);

	if (typeof profileData.sapling.lastMessageChannelId !== 'string') {

		module.exports.removeChannel(userData, profileData.serverId);
		return;
	}

	userMap.set(characterData._id + userData.userId + profileData.serverId, setTimeout(async () => {

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: userData.uuid }));
		characterData = userData.characters[characterData._id];
		profileData = characterData?.profiles?.[profileData.serverId];

		if (typeof profileData.sapling.lastMessageChannelId !== 'string') {

			await module.exports.removeChannel(userData, profileData.serverId);
			return;
		}

		const isInactive = (userData !== null && userData.currentCharacter[profileData.serverId] !== characterData._id);

		if (userData !== null && characterData !== null && profileData !== null && profileData.sapling.exists === true && userData.reminders.water === true) {

			const channel = await client.channels
				.fetch(profileData.sapling.lastMessageChannelId)
				.catch(async (error) => {
					if (error.httpStatus === '403' || error.httpStatus === '404') {
						await module.exports.removeChannel(userData, profileData.serverId);
						throw new Error('Missing Access: Cannot fetch this channel');
					}
					else { throw new Error(error); }
				});

			if (!channel || !channel.isText() || channel.type === 'DM') {

				return;
			}

			await channel.guild.members
				.fetch(userData.userId)
				.catch(async (error) => {
					if (error.httpStatus === '403' || error.httpStatus === '404') {
						await module.exports.removeChannel(userData, profileData.serverId);
						throw new Error('Missing Access: Cannot find this user');
					}
					else { throw new Error(error); }
				});

			await channel
				.send({
					content: `<@${userData.userId}>`,
					embeds: [{
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						description: 'It is time to `water` your tree!',
						footer: isInactive ? { text: '⚠️ CAUTION! The character associated with this reminder is currently inactive. Type "rp profile" and select the character from the drop-down list before watering your tree.' } : undefined,
					}],
				})
				.catch(async (error) => {
					if (error.httpStatus === '403' || error.httpStatus === '404') {
						await module.exports.removeChannel(userData, profileData.serverId);
						throw new Error('Missing Access: Cannot send to this channel');
					}
					else { throw new Error(error); }
				});
		}
	}, (profileData.sapling.nextWaterTimestamp || 0) - Date.now()));
};

/**
 *
 * @param {string} _id
 * @param {string} userId
 * @param {string} serverId
 */
module.exports.stopReminder = (_id, userId, serverId) => {

	if (userMap.has(_id + userId + serverId)) { clearTimeout(userMap.get(_id + userId + serverId)); }
};

/**
 *
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {string} serverId
 */
module.exports.removeChannel = async (userData, serverId) => {

	await profileModel.findOneAndUpdate(
		{ uuid: userData.uuid },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[p.currentCharacter[serverId]].profiles[serverId].sapling.lastMessageChannelId = null;
		},
	);
};