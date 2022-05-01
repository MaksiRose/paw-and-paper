// @ts-check
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('../gameplay/attack');
const { profileModel, otherProfileModel } = require('../../models/profileModel');
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
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData, serverData, embedArray) => {

	if (await hasNotCompletedAccount(message, profileData)) {

		return;
	}

	if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

		return;
	}

	profileData = await startCooldown(message, profileData);
	const messageContent = remindOfAttack(message);

	if (profileData.saplingObject.exists === false) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} has already fetched water when ${pronounAndPlural(profileData, 0, 'remember')} that ${pronounAndPlural(profileData, 0, 'has', 'have')} nothing to water.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const saplingObject = { ...profileData.saplingObject };
	const timeDifference = Date.now() - saplingObject.nextWaterTimestamp;
	const timeDifferenceInMinutes = timeDifference / oneMinute;

	let experiencePoints = 0;
	let healthPoints = 0;

	const embed = new MessageEmbed({
		color: profileData.color,
		author: { name: profileData.name, icon_url: profileData.avatarURL },
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

		embed.description = `*${profileData.name} waters the seedling, and it look it's at the perfect time. The ginkgo tree looks healthy, the leaves have a strong green color, and a pleasant fragrance emanates from them. The ${profileData.species} feels warm and safe from the scent.*`,
		embed.footer.text = `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})${healthPoints > 0 ? `\n+${healthPoints} health (${profileData.health + healthPoints}/${profileData.maxEnergy})` : ''}\n\n+${saplingHealthPoints} health for ginkgo sapling\nCome back to water it in 24 hours.`;
	}
	else if (timeDifference >= -threeHours && timeDifference <= threeHours) {

		saplingObject.waterCycles += 1;
		experiencePoints = saplingObject.waterCycles * 2;

		embed.description = `*${profileData.name} waters the seedling, and it look like the sapling needs it. Although the ginkgo tree looks healthy, with leaves of beautiful green color and a light scent, the soil seems to be already quite dry.*`;
		embed.footer.text = `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})\n\nCome back to water the ginkgo sapling in 24 hours.`;
	}
	else if (timeDifference < -threeHours) {

		const saplingHealthPoints = Math.floor((timeDifferenceInMinutes + 180) / 60);
		saplingObject.health += saplingHealthPoints;

		embed.description = `*The soil is already soggy when ${profileData.name} adds more water to it. The leaves are yellow-brown, the stem is muddy and has a slight mold. Next time the ${profileData.species} should wait a little with the watering.*`;
		embed.footer.text = `${saplingHealthPoints} health for ginkgo tree\nCome back to water it in 24 hours.`;
	}
	else {

		const overdueHours = Math.ceil(timeDifference / oneHour);
		const saplingHealthPoints = overdueHours + (Math.floor(saplingObject.waterCycles / 7) * overdueHours);
		saplingObject.health -= saplingObject.health - saplingHealthPoints > 0 ? saplingHealthPoints : saplingHealthPoints - saplingHealthPoints > -10 ? saplingObject.health - 1 : saplingObject.health;

		embed.description = `*${profileData.name} decides to see if the ginkgo tree needs watering, and sure enough: the leaves are drooping, some have lost color, and many of them fell on the ground. It is about time that the poor tree gets some water.*`,
		embed.footer.text = `-${saplingHealthPoints} health for ginkgo tree\nCome back to water it in 24 hours.`;
	}

	saplingObject.nextWaterTimestamp = Date.now() + twentyFourHours;
	saplingObject.lastMessageChannelId = message.channel.id;

	profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: message.author.id, serverId: message.guild.id },
		{
			$set: { saplingObject: saplingObject },
			$inc: {
				experience: experiencePoints,
				health: healthPoints,
			},
		},
	));

	const botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, embed],
			components: [ new MessageActionRow({
				components: [ new MessageButton({
					customId: `water-reminder-${profileData.saplingObject.reminder === true ? 'off' : 'on'}`,
					label: `Turn water reminders ${profileData.saplingObject.reminder === true ? 'off' : 'on'}`,
					style: 'SECONDARY',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	if (profileData.saplingObject.reminder === true) {

		module.exports.sendReminder(client, profileData, message.channel.id);
	}

	await checkLevelUp(message, botReply, profileData, serverData);

	if (profileData.saplingObject.health <= 0) {

		await message.channel
			.send({
				embeds: [{
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*No matter what ${profileData.name} does, all the leaves on the ginkgo tree have either fallen off, or are dark brown and hang limply. It's time to say goodbye to the tree.*`,
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		await profileModel.findOneAndUpdate(
			{ userId: profileData.userId, serverId: profileData.serverId },
			{ $set: { saplingObject: { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null, reminder: profileData.saplingObject.reminder, lastMessageChannelId: 0 } } },
		);
	}
};

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {string} channelId
 */
module.exports.sendReminder = (client, profileData, channelId) => {

	module.exports.stopReminder(profileData);

	userMap.set(profileData.uuid, setTimeout(async () => {

		const uuid = profileData.uuid;
		let isInactive = false;
		profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: uuid }));
		if (profileData === null) {

			profileData = /** @type {import('../../typedef').ProfileSchema} */ (await otherProfileModel.findOne({ uuid: uuid }));
			isInactive = true;
		}

		if (profileData !== null && profileData?.saplingObject?.exists === true && profileData?.saplingObject?.reminder === true) {

			const channel = await client.channels
				.fetch(channelId)
				.catch((error) => { throw new Error(error); });

			if (!channel.isText()) {

				return;
			}

			await channel
				.send({
					content: `<@${profileData.userId}>`,
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: 'It is time to `water` your tree!',
						footer: isInactive ? { text: '⚠️ CAUTION! The account associated with this reminder is currently inactive. Type "rp accounts" and select it before watering your tree.' } : null,
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}
	}, profileData.saplingObject.nextWaterTimestamp - Date.now()));
};

/**
 *
 * @param {import('../../typedef').ProfileSchema} profileData
 */
module.exports.stopReminder = (profileData) => {

	if (userMap.has(profileData.uuid)) {

		clearTimeout(userMap.get(profileData.uuid));
	}
};