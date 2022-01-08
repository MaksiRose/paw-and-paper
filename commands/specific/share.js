const profileModel = require('../../models/profileSchema');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const condition = require('../../utils/condition');
const levels = require('../../utils/levels');

module.exports = {
	name: 'share',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isInvalid(message, profileData, embedArray)) {

			return;
		}

		if (profileData.rank != 'Elderly') {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is about to begin sharing a story when an elderly interrupts them.* "Oh, young ${profileData.species}, you need to have a lot more adventures before you can start advising others!"`,
			});

			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
						throw new Error(error);
					}
				});
		}

		if (message.mentions.users.size > 0 && message.mentions.users.first().id == message.author.id) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is very wise from all the adventures ${profileData.pronounArray[0]} had, but also a little... quaint. Sometimes ${profileData.pronounArray[0]} sit${(profileData.pronounArray[5] == 'singular') ? 's' : ''} down at the fireplace, mumbling to ${profileData.pronounArray[4]} a story from back in the day. Busy packmates look at ${profileData.pronounArray[1]} in confusion as they pass by.*`,
			});

			await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
						throw new Error(error);
					}
				});
		}

		const thirstPoints = await condition.decreaseThirst(profileData);
		const hungerPoints = await condition.decreaseHunger(profileData);
		const extraLostEnergyPoints = await condition.decreaseEnergy(profileData);
		let energyPoints = Loottable(5, 1) + extraLostEnergyPoints;

		if (profileData.energy - energyPoints < 0) {

			energyPoints = profileData.energy;
		}

		profileData = await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$inc: {
						thirst: -thirstPoints,
						hunger: -hungerPoints,
						energy: -energyPoints,
					},
					$set: { currentRegion: 'ruins' },
				},
				{ new: true },
			)
			.catch((error) => {
				throw new Error(error);
			});

		let embedFooterStatsText = `-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

		if (hungerPoints >= 1) {

			embedFooterStatsText += `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
		}

		if (thirstPoints >= 1) {

			embedFooterStatsText += `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
		}

		let healthPoints = 0;
		const userInjuryArray = [...profileData.injuryArray];

		const embed = {
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: '',
			footer: { text: '' },
		};

		if (!message.mentions.users.size) {

			let allRuinsProfilesArray = await profileModel
				.find({
					serverId: message.guild.id,
					currentRegion: 'ruins',
				})
				.catch((error) => {
					throw new Error(error);
				});

			allRuinsProfilesArray = allRuinsProfilesArray.map(doc => doc.userId);
			const allRuinsProfilesArrayUserIndex = allRuinsProfilesArray.indexOf(`${profileData.userId}`);

			if (allRuinsProfilesArrayUserIndex > -1) {

				allRuinsProfilesArray.splice(allRuinsProfilesArrayUserIndex, 1);
			}

			if (allRuinsProfilesArray.length > 0) {

				const allRuinsProfilesArrayRandomIndex = Loottable(allRuinsProfilesArray.length, 0);

				const partnerProfileData = await profileModel
					.findOne({
						userId: allRuinsProfilesArray[allRuinsProfilesArrayRandomIndex],
						serverId: message.guild.id,
					})
					.catch((error) => {
						throw new Error(error);
					});

				if (partnerProfileData.energy > 0 && partnerProfileData.health > 0 && partnerProfileData.hunger > 0 || partnerProfileData.thirst > 0) {

					await shareStory(partnerProfileData);
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
			const partnerProfileData = await profileModel
				.findOne({
					userId: message.mentions.users.first().id,
					serverId: message.guild.id,
				})
				.catch((error) => {
					throw new Error(error);
				});

			if (!partnerProfileData || partnerProfileData.name == '' || partnerProfileData.species == '' || partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0) {

				await profileModel
					.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{
							$inc: {
								thirst: +thirstPoints,
								hunger: +hungerPoints,
								energy: +energyPoints,
							},
						},
						{ new: true },
					)
					.catch((error) => {
						throw new Error(error);
					});

				embedArray.push({
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					title: 'You can\'t play with the mentioned user :(',
				});

				return await message
					.reply({
						embeds: embedArray,
					})
					.catch((error) => {
						if (error.httpStatus == 404) {
							console.log('Message already deleted');
						}
						else {
							throw new Error(error);
						}
					});
			}
			else {

				await shareStory(partnerProfileData);
			}
		}

		const botReply = await message
			.reply({
				embeds: embedArray,
			})
			.catch((error) => {
				if (error.httpStatus == 404) {
					console.log('Message already deleted');
				}
				else {
					throw new Error(error);
				}
			});

		await condition.decreaseHealth(message, profileData, botReply);

		profileData = await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { injuryArray: userInjuryArray } },
				{ new: true },
			)
			.catch((error) => {
				throw new Error(error);
			});

		if (checkValidity.isPassedOut(message, profileData)) {

			await levels.decreaseLevel(message, profileData);
		}


		async function shareStory(partnerProfileData) {

			const partnerExperiencePoints = Loottable(41, 20);

			partnerProfileData = await profileModel
				.findOneAndUpdate(
					{ userId: partnerProfileData.userId, serverId: message.guild.id },
					{ $inc: { experience: +partnerExperiencePoints } },
					{ new: true },
				)
				.catch((error) => {
					throw new Error(error);
				});

			embed.description = `*${partnerProfileData.name} comes running to the old wooden trunk at the ruins where ${profileData.name} sits, ready to tell an exciting story from long ago. Their eyes are sparkling as the ${profileData.species} recounts great adventures and the lessons to be learned from them.*`;
			embed.footer.text = `${embedFooterStatsText}\n+${partnerExperiencePoints} XP for ${partnerProfileData.name} (${partnerProfileData.experience}/${partnerProfileData.levels * 50})`;

			if (partnerProfileData.experience >= partnerProfileData.levels * 50) {

				partnerProfileData = await profileModel
					.findOneAndUpdate(
						{ userId: partnerProfileData.userId, serverId: message.guild.id },
						{
							$inc: {
								experience: -(partnerProfileData.levels * 50),
								levels: +1,
							},
						},
						{ new: true },
					)
					.catch((error) => {
						throw new Error(error);
					});

				embedArray.push(embed, {
					color: partnerProfileData.color,
					author: { name: partnerProfileData.name, icon_url: partnerProfileData.avatarURL },
					title: `${partnerProfileData.name} just leveled up! They are now level ${partnerProfileData.levels}.`,
				});
			}
			else {

				embedArray.push(embed);
			}

			if (partnerProfileData.injuryArray[2] > 0) {

				const getsInfectedChance = weightedTable({ 0: 3, 1: 7 });
				if (getsInfectedChance == 0) {

					healthPoints = Loottable(5, 3);

					if (profileData.health - healthPoints < 0) {

						healthPoints = profileData.health;
					}

					profileData = await profileModel
						.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{ $inc: { health: -healthPoints } },
							{ new: true },
						)
						.catch((error) => {
							throw new Error(error);
						});

					userInjuryArray[2] = userInjuryArray[2] + 1;

					embedArray.push({
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*Suddenly, ${profileData.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${partnerProfileData.name}, who was coughing as well. That was probably not the best idea!*`,
						footer: { text: `-${healthPoints} HP (from cold)` },
					});
				}
			}

			return;
		}

		async function noSharing() {

			embed.description = `*${profileData.name} sits on an old wooden trunk at the ruins, ready to tell a story to any willing listener. But to ${profileData.pronounArray[2]} disappointment, no one seems to be around.*`;
			embed.footer.text = '';

			profileData = await profileModel
				.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{
						$inc: {
							thirst: +thirstPoints,
							hunger: +hungerPoints,
							energy: +energyPoints,
						},
						$set: { currentRegion: 'ruins' },
					},
					{ new: true },
				)
				.catch((error) => {
					throw new Error(error);
				});

			return embedArray.push(embed);
		}

		function Loottable(max, min) {

			return Math.floor(Math.random() * max) + min;
		}

		function weightedTable(values) {

			const table = [];

			for (const i in values) {

				for (let j = 0; j < values[i]; j++) {

					table.push(i);
				}
			}

			return table[Math.floor(Math.random() * table.length)];
		}
	},
};