const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('../specific/attack');
const profileModel = require('../../models/profileModel');
const { pullFromWeightedTable } = require('../../utils/randomizers');
const { checkLevelUp } = require('../../utils/levelHandling');

const oneMinute = 60000;
const thirtyMinutes = oneMinute * 30;
const oneHour = thirtyMinutes * 2;
const threeHours = oneHour * 3;
const twentyFourHours = threeHours * 8;

module.exports = {
	name: 'water',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);
		const messageContent = remindOfAttack(message);

		if (profileData.saplingObject.exists === false) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} has no gingko tree to water!* PLACEHOLDER`,
			});

			return await message
				.reply({
					content: messageContent,
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		const saplingObject = { ...profileData.saplingObject };
		const timeDifference = Date.now() - saplingObject.nextWaterTimestamp;
		const timeDifferenceInMinutes = timeDifference / oneMinute;

		let experiencePoints = 0;
		let healthPoints = 0;

		if (timeDifference >= -thirtyMinutes && timeDifference <= thirtyMinutes) {

			const saplingHealthPoints = 4 - Math.round(timeDifferenceInMinutes / 10);
			saplingObject.health += saplingHealthPoints;
			saplingObject.waterCycles += 1;

			experiencePoints = saplingObject.waterCycles * 2;
			healthPoints = pullFromWeightedTable({ 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 });

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is perfectly in time!* PLACEHOLDER`,
				footer: { text: `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})${healthPoints > 0 ? `\n+${healthPoints} health (${profileData.health + healthPoints}/${profileData.maxEnergy})` : ''}\n\n+${saplingHealthPoints} health for gingko sapling\nCome back to water it in 24 hours.` },
			});
		}
		else if (timeDifference >= -threeHours && timeDifference <= threeHours) {

			saplingObject.waterCycles += 1;
			experiencePoints = saplingObject.waterCycles * 2;

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is just in time!* PLACEHOLDER`,
				footer: { text: `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})\n\nCome back to water the gingko sapling in 24 hours.` },
			});
		}
		else if (timeDifference < -threeHours) {

			const saplingHealthPoints = Math.floor((timeDifferenceInMinutes + 180) / 60);
			saplingObject.health += saplingHealthPoints;

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is too soon!* PLACEHOLDER`,
				footer: { text: `${saplingHealthPoints} health for gingko tree\nCome back to water it in 24 hours.` },
			});
		}
		else {

			const overdueHours = Math.ceil(timeDifference / oneHour);
			const saplingHealthPoints = ((overdueHours * (overdueHours + 1)) / 2) + (Math.round(saplingObject.waterCycles / 10) * overdueHours);
			saplingObject.health -= saplingHealthPoints;

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} decides to see if the gingko tree needs watering, and sure enough: the leaves are drooping, some have lost color, and many of them fell on the ground. It is about time that the poor tree gets some water.*`,
				footer: { text: `-${saplingHealthPoints} health for gingko tree\nCome back to water it in 24 hours.` },
			});
		}

		saplingObject.nextWaterTimestamp = Date.now() + twentyFourHours;

		if (profileData.health + healthPoints > profileData.maxHealth) {

			healthPoints -= (profileData.health + healthPoints) - profileData.maxThirst;
		}

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{
				$set: { saplingObject: saplingObject },
				$inc: {
					experience: experiencePoints,
					health: healthPoints,
				},
			},
		);

		const botReply = await message
			.reply({
				content: messageContent,
				embeds: embedArray,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		await checkLevelUp(profileData, botReply);

		if (profileData.saplingObject.health <= 0) {

			await message.channel
				.send({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name}'s gingko tree died!* PLACEHOLDER`,
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			await profileModel.findOneAndUpdate(
				{ userId: profileData.userId, serverId: profileData.serverId },
				{ $set: { saplingObject: { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null } } },
			);
		}
	},
};