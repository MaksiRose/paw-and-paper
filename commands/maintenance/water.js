const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('../gameplay/attack');
const profileModel = require('../../models/profileModel');
const { pullFromWeightedTable, generateRandomNumber } = require('../../utils/randomizers');
const { checkLevelUp } = require('../../utils/levelHandling');
const { pronounAndPlural } = require('../../utils/getPronouns');

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
				description: `*${profileData.name} has already fetched water when ${pronounAndPlural(profileData, 0, 'remember')} that ${pronounAndPlural(profileData, 0, 'has', 'have')} nothing to water.*`,
			});

			return await message
				.reply({
					content: messageContent,
					embeds: embedArray,
					failIfNotExists: false,
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
			healthPoints = pullFromWeightedTable({ 0: 6, 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 }) + generateRandomNumber(Math.round(saplingObject.waterCycles / 4), 0);
			if (profileData.health + healthPoints > profileData.maxHealth) { healthPoints = profileData.maxHealth - profileData.health; }

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} waters the seedling, and it look it's at the perfect time. The ginkgo tree looks healthy, the leaves have a strong green color, and a pleasant fragrance emanates from them. The ${profileData.species} feels warm and safe from the scent.*`,
				footer: { text: `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})${healthPoints > 0 ? `\n+${healthPoints} health (${profileData.health + healthPoints}/${profileData.maxEnergy})` : ''}\n\n+${saplingHealthPoints} health for ginkgo sapling\nCome back to water it in 24 hours.` },
			});
		}
		else if (timeDifference >= -threeHours && timeDifference <= threeHours) {

			saplingObject.waterCycles += 1;
			experiencePoints = saplingObject.waterCycles * 2;

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} waters the seedling, and it look like the sapling needs it. Although the ginkgo tree looks healthy, with leaves of beautiful green color and a light scent, the soil seems to be already quite dry.*`,
				footer: { text: `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})\n\nCome back to water the ginkgo sapling in 24 hours.` },
			});
		}
		else if (timeDifference < -threeHours) {

			const saplingHealthPoints = Math.floor((timeDifferenceInMinutes + 180) / 60);
			saplingObject.health += saplingHealthPoints;

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*The soil is already soggy when ${profileData.name} adds more water to it. The leaves are yellow-brown, the stem is muddy and has a slight mold. Next time the ${profileData.species} should wait a little with the watering.*`,
				footer: { text: `${saplingHealthPoints} health for ginkgo tree\nCome back to water it in 24 hours.` },
			});
		}
		else {

			const overdueHours = Math.ceil(timeDifference / oneHour);
			const saplingHealthPoints = ((overdueHours * (overdueHours + 1)) / 2) + (Math.round(saplingObject.waterCycles / 10) * overdueHours);
			saplingObject.health -= saplingHealthPoints;

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} decides to see if the ginkgo tree needs watering, and sure enough: the leaves are drooping, some have lost color, and many of them fell on the ground. It is about time that the poor tree gets some water.*`,
				footer: { text: `-${saplingHealthPoints} health for ginkgo tree\nCome back to water it in 24 hours.` },
			});
		}

		saplingObject.nextWaterTimestamp = Date.now() + twentyFourHours;

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
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

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
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			await profileModel.findOneAndUpdate(
				{ userId: profileData.userId, serverId: profileData.serverId },
				{ $set: { saplingObject: { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null, reminder: profileData.saplingObject.reminder } } },
			);
		}
	},
};