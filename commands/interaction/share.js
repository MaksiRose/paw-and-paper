const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const config = require('../../config.json');
const { generateRandomNumber, pullFromWeightedTable } = require('../../utils/randomizers');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { decreaseThirst, decreaseHunger, decreaseEnergy, decreaseHealth } = require('../../utils/checkCondition');
const { checkLevelUp } = require('../../utils/levelHandling');
const { remindOfAttack } = require('../gameplay/attack');
const { pronounAndPlural, pronoun } = require('../../utils/getPronouns');
const sharingCooldownAccountsMap = new Map();

module.exports = {
	name: 'share',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);
		const messageContent = remindOfAttack(message);

		if (sharingCooldownAccountsMap.has('nr' + message.author.id + message.guild.id) && Date.now() - sharingCooldownAccountsMap.get('nr' + message.author.id + message.guild.id) < 7200000) {

			return await message
				.reply({
					content: messageContent,
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						title: 'You can only share every 2 hours!',
						description: `You can share again <t:${Math.floor((sharingCooldownAccountsMap.get('nr' + message.author.id + message.guild.id) + 7200000) / 1000)}:R>.`,
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (profileData.rank != 'Elderly') {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is about to begin sharing a story when an elderly interrupts them.* "Oh, young ${profileData.species}, you need to have a lot more adventures before you can start advising others!"`,
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

		if (message.mentions.users.size > 0 && message.mentions.users.first().id == message.author.id) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is very wise from all the adventures ${pronoun(profileData, 0)} had, but also a little... quaint. Sometimes ${pronounAndPlural(profileData, 0, 'sit')} down at the fireplace, mumbling to ${pronoun(profileData, 4)} a story from back in the day. Busy packmates look at ${pronoun(profileData, 1)} in confusion as they pass by.*`,
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

		const thirstPoints = await decreaseThirst(profileData);
		const hungerPoints = await decreaseHunger(profileData);
		const energyPoints = function(energy) { return (profileData.energy - energy < 0) ? profileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(profileData));

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{
				$inc: {
					energy: -energyPoints,
					hunger: -hungerPoints,
					thirst: -thirstPoints,
				},
				$set: { currentRegion: 'ruins' },
			},
		);

		let embedFooterStatsText = `-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

		if (hungerPoints >= 1) {

			embedFooterStatsText += `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
		}

		if (thirstPoints >= 1) {

			embedFooterStatsText += `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
		}

		if (profileData.currentRegion != 'ruins') {

			embedFooterStatsText += '\nYou are now at the ruins';
		}

		let healthPoints = 0;
		const userInjuryObject = { ...profileData.injuryObject };

		const embed = {
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: '',
			footer: { text: '' },
		};

		let partnerProfileData;

		if (!message.mentions.users.size) {

			const allRuinsProfilesArray = (await profileModel
				.find({
					serverId: message.guild.id,
					currentRegion: 'ruins',
				}))
				.map(user => user.userId)
				.filter(userId => userId != profileData.userId);

			if (allRuinsProfilesArray.length > 0) {

				const allRuinsProfilesArrayRandomIndex = generateRandomNumber(allRuinsProfilesArray.length, 0);

				partnerProfileData = await profileModel.findOne({
					userId: allRuinsProfilesArray[allRuinsProfilesArrayRandomIndex],
					serverId: message.guild.id,
				});

				if (partnerProfileData.energy > 0 && partnerProfileData.health > 0 && partnerProfileData.hunger > 0 || partnerProfileData.thirst > 0) {

					await shareStory();
				}
				else {

					await noSharing();
				}
			}
			else {

				await noSharing();
			}
		}
		else {

			partnerProfileData = await profileModel.findOne({
				userId: message.mentions.users.first().id,
				serverId: message.guild.id,
			});

			if (!partnerProfileData || partnerProfileData.name == '' || partnerProfileData.species == '' || partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0) {

				await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{
						$inc: {
							energy: +energyPoints,
							hunger: +hungerPoints,
							thirst: +thirstPoints,
						},
					},
				);

				embedArray.push({
					color: config.error_color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'The mentioned user has no account or is passed out :(',
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
			else {

				await shareStory();
			}
		}

		let botReply = await message
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

		botReply = await checkLevelUp(message, botReply, profileData, serverData);
		await decreaseHealth(message, profileData, botReply, userInjuryObject);
		await isPassedOut(message, profileData, false);


		async function shareStory() {

			sharingCooldownAccountsMap.set('nr' + message.author.id + message.guild.id, Date.now());

			const partnerExperiencePoints = generateRandomNumber(Math.round((partnerProfileData.levels * 50) * 0.15), Math.round((partnerProfileData.levels * 50) * 0.05));

			partnerProfileData = await profileModel.findOneAndUpdate(
				{ userId: partnerProfileData.userId, serverId: message.guild.id },
				{ $inc: { experience: +partnerExperiencePoints } },
			);

			embed.description = `*${partnerProfileData.name} comes running to the old wooden trunk at the ruins where ${profileData.name} sits, ready to tell an exciting story from long ago. Their eyes are sparkling as the ${profileData.species} recounts great adventures and the lessons to be learned from them.*`;
			embed.footer.text = `${embedFooterStatsText}\n+${partnerExperiencePoints} XP for ${partnerProfileData.name} (${partnerProfileData.experience}/${partnerProfileData.levels * 50})`;

			if (partnerProfileData.experience >= partnerProfileData.levels * 50) {

				partnerProfileData = await profileModel.findOneAndUpdate(
					{ userId: partnerProfileData.userId, serverId: message.guild.id },
					{
						$inc: {
							experience: -(partnerProfileData.levels * 50),
							levels: +1,
						},
					},
				);

				embedArray.push(embed, {
					color: partnerProfileData.color,
					author: { name: partnerProfileData.name, icon_url: partnerProfileData.avatarURL },
					title: `${partnerProfileData.name} just leveled up! They are now level ${partnerProfileData.levels}.`,
				});
			}
			else {

				embedArray.push(embed);
			}

			if (partnerProfileData.injuryObject.cold == true && profileData.injuryObject.cold == false) {

				const getsInfectedChance = pullFromWeightedTable({ 0: 3, 1: 7 });
				if (getsInfectedChance == 0) {

					healthPoints = generateRandomNumber(5, 3);

					if (profileData.health - healthPoints < 0) {

						healthPoints = profileData.health;
					}

					profileData = await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $inc: { health: -healthPoints } },
					);

					userInjuryObject.cold = true;

					embedArray.push({
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*Suddenly, ${profileData.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${partnerProfileData.name}, who was coughing as well. That was probably not the best idea!*`,
						footer: { text: `-${healthPoints} HP (from cold)` },
					});
				}
			}

			return embedArray;
		}

		async function noSharing() {

			embed.description = `*${profileData.name} sits on an old wooden trunk at the ruins, ready to tell a story to any willing listener. But to ${pronoun(profileData, 2)} disappointment, no one seems to be around.*`;
			embed.footer.text = '';

			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$inc: {
						energy: +energyPoints,
						hunger: +hungerPoints,
						thirst: +thirstPoints,
					},
					$set: { currentRegion: 'ruins' },
				},
			);

			embedArray.push(embed);
			return embedArray;
		}
	},
};
