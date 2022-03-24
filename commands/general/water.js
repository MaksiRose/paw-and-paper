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

		let saplingObject = { ...profileData.saplingObject };
		const timeDifference = Date.now() - saplingObject.nextWaterTimestamp;
		const timeDifferenceInMinutes = timeDifference / oneMinute;

		let experiencePoints = 0;
		let healthPoints = 0;

		if (timeDifference >= -thirtyMinutes && timeDifference <= thirtyMinutes) {

			// + health, +plantHealth, + XP, + WaterCycle
			const saplingHealthPoints = 4 - Math.round(timeDifferenceInMinutes / 10);
			saplingObject.health += saplingHealthPoints;
			saplingObject.waterCycles += 1;

			experiencePoints = saplingObject.waterCycles * 2;
			healthPoints = pullFromWeightedTable({ 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 });

			// you are perfect
			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is perfectly in time!* PLACEHOLDER`,
				footer: { text: `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})${healthPoints > 0 ? `\n+${healthPoints} health (${profileData.health + healthPoints}/${profileData.maxEnergy})` : ''}\n\n+${saplingHealthPoints} health for gingko sapling\nCome back to water it in 24 hours.` },
			});
		}
		else if (timeDifference >= -threeHours && timeDifference <= threeHours) {

			// + XP, + WaterCycle
			saplingObject.waterCycles += 1;
			experiencePoints = saplingObject.waterCycles * 2;

			// you are just in time
			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is just in time!* PLACEHOLDER`,
				footer: { text: `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})\n\nCome back to water the gingko sapling in 24 hours.` },
			});
		}
		else if (timeDifference < -threeHours) {

			// -plantHealth
			console.log(timeDifferenceInMinutes, (timeDifferenceInMinutes + 180) / 60);
			const saplingHealthPoints = Math.floor((timeDifferenceInMinutes + 180) / 60);
			saplingObject.health += saplingHealthPoints;

			// you are too soon
			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is too soon!* PLACEHOLDER`,
				footer: { text: `${saplingHealthPoints} health for gingko tree\nCome back to water it in 24 hours.` },
			});
		}
		else {

			// the health got reduced already, so that doesn't have to be done anymore

			// you are too late
			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is too late!* PLACEHOLDER`,
				footer: { text: 'Come back to water it in 24 hours.' },
			});
		}

		// new nextWaterTimestamp = now + 24 hours
		saplingObject.nextWaterTimestamp = Date.now() + twentyFourHours;

		if (saplingObject.health <= 0) {

			// plant dies
			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name}'s gingko tree died!* PLACEHOLDER`,
			});

			saplingObject = { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null };
		}

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
	},
};