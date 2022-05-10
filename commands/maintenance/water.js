// @ts-check
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('../gameplay/attack');
const profileModel = require('../../models/profileModel');
const { pullFromWeightedTable, generateRandomNumber } = require('../../utils/randomizers');
const { checkLevelUp } = require('../../utils/levelHandling');
const { pronounAndPlural } = require('../../utils/getPronouns');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');

const oneMinute = 60000;
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
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	let profileData = characterData?.profiles?.[message.guild.id];

	if (await hasNotCompletedAccount(message, characterData)) {

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
	const timeDifference = Date.now() - saplingObject.nextWaterTimestamp;
	const timeDifferenceInMinutes = timeDifference / oneMinute;

	let experiencePoints = 0;
	let healthPoints = 0;

	const embed = new MessageEmbed({
		color: characterData.color,
		author: { name: characterData.name, icon_url: characterData.avatarURL },
		description: null,
		footer: { text: null },
	});

	if (timeDifference >= -thirtyMinutes && timeDifference <= thirtyMinutes) {

		const saplingHealthPoints = 4 - Math.round(timeDifferenceInMinutes / 10);
		saplingObject.health += saplingHealthPoints;
		saplingObject.waterCycles += 1;

		experiencePoints = saplingObject.waterCycles * 2;
		healthPoints = pullFromWeightedTable({ 0: 6, 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 }) + generateRandomNumber(Math.round(saplingObject.waterCycles / 4), 0);
		if (profileData.health + healthPoints > profileData.maxHealth) { healthPoints = profileData.maxHealth - profileData.health; }

		embed.description = `*${characterData.name} waters the seedling, and it look it's at the perfect time. The ginkgo tree looks healthy, the leaves have a strong green color, and a pleasant fragrance emanates from them. The ${characterData.species} feels warm and safe from the scent.*`,
		embed.footer.text = `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})${healthPoints > 0 ? `\n+${healthPoints} health (${profileData.health + healthPoints}/${profileData.maxEnergy})` : ''}\n\n+${saplingHealthPoints} health for ginkgo sapling\nCome back to water it in 24 hours.`;
	}
	else if (timeDifference >= -threeHours && timeDifference <= threeHours) {

		saplingObject.waterCycles += 1;
		experiencePoints = saplingObject.waterCycles * 2;

		embed.description = `*${characterData.name} waters the seedling, and it look like the sapling needs it. Although the ginkgo tree looks healthy, with leaves of beautiful green color and a light scent, the soil seems to be already quite dry.*`;
		embed.footer.text = `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})\n\nCome back to water the ginkgo sapling in 24 hours.`;
	}
	else if (timeDifference < -threeHours) {

		const saplingHealthPoints = Math.floor((timeDifferenceInMinutes + 180) / 60);
		saplingObject.health += saplingHealthPoints;

		embed.description = `*The soil is already soggy when ${characterData.name} adds more water to it. The leaves are yellow-brown, the stem is muddy and has a slight mold. Next time the ${characterData.species} should wait a little with the watering.*`;
		embed.footer.text = `${saplingHealthPoints} health for ginkgo tree\nCome back to water it in 24 hours.`;
	}
	else {

		const overdueHours = Math.ceil(timeDifference / oneHour);
		const saplingHealthPoints = overdueHours + (Math.floor(saplingObject.waterCycles / 7) * overdueHours);
		saplingObject.health -= saplingObject.health - saplingHealthPoints > 0 ? saplingHealthPoints : saplingHealthPoints - saplingHealthPoints > -10 ? saplingObject.health - 1 : saplingObject.health;

		embed.description = `*${characterData.name} decides to see if the ginkgo tree needs watering, and sure enough: the leaves are drooping, some have lost color, and many of them fell on the ground. It is about time that the poor tree gets some water.*`,
		embed.footer.text = `-${saplingHealthPoints} health for ginkgo tree\nCome back to water it in 24 hours.`;
	}

	saplingObject.nextWaterTimestamp = Date.now() + twentyFourHours;
	saplingObject.lastMessageChannelId = message.channel.id;

	userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: message.author.id, serverId: message.guild.id },
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

	await checkLevelUp(message, botReply, userData, serverData);

	if (profileData.sapling.health <= 0) {

		await message.channel
			.send({
				embeds: [{
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*No matter what ${characterData.name} does, all the leaves on the ginkgo tree have either fallen off, or are dark brown and hang limply. It's time to say goodbye to the tree.*`,
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

	userMap.set(characterData._id + userData.userId + profileData.serverId, setTimeout(async () => {

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: userData.uuid }));
		characterData = userData.characters[userData.currentCharacter[profileData.serverId]];
		profileData = characterData.profiles[profileData.serverId];

		const isInactive = (userData !== null && userData.currentCharacter[profileData.serverId] !== characterData._id);

		if (userData !== null && characterData !== null && profileData !== null && profileData.sapling.exists === true && userData.reminders.water === true) {

			const channel = await client.channels
				.fetch(profileData.sapling.lastMessageChannelId)
				.catch((error) => { throw new Error(error); });

			if (!channel.isText()) {

				return;
			}

			await channel
				.send({
					content: `<@${userData.userId}>`,
					embeds: [{
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						description: 'It is time to `water` your tree!',
						footer: isInactive ? { text: '⚠️ CAUTION! The account associated with this reminder is currently inactive. Type "rp accounts" and select it before watering your tree.' } : null,
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}
	}, profileData.sapling.nextWaterTimestamp - Date.now()));
};

/**
 *
 * @param {string} _id
 * @param {string} userId
 * @param {string} serverId
 */
module.exports.stopReminder = (_id, userId, serverId) => {

	if (userMap.has(_id + userId + serverId)) {

		clearTimeout(userMap.get(_id + userId + serverId));
	}
};