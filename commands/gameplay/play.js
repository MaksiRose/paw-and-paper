const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const config = require('../../config.json');
const { generateRandomNumber, pullFromWeightedTable } = require('../../utils/randomizers');
const { pickRandomCommonPlant } = require('../../utils/pickRandomPlant');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { decreaseThirst, decreaseHunger, decreaseEnergy, decreaseHealth } = require('../../utils/checkCondition');
const { checkLevelUp } = require('../../utils/levelHandling');
const { introduceQuest } = require('./quest');
const { execute } = require('../../events/messageCreate');
const { remindOfAttack } = require('./attack');
const { pronoun, pronounAndPlural, upperCasePronounAndPlural } = require('../../utils/getPronouns');
const { restAdvice, drinkAdvice, eatAdvice } = require('../../utils/adviceMessages');

module.exports = {
	name: 'play',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);
		const messageContent = remindOfAttack(message);

		if ([...Object.values(profileData.inventoryObject).map(type => Object.values(type))].filter(value => value > 0).length > 25) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} approaches the prairie, ${pronoun(profileData, 2)} mouth filled with various things. As eager as ${pronounAndPlural(profileData, 0, 'is', 'are')} to go playing, ${pronounAndPlural(profileData, 0, 'decide')} to store some things away first.*`,
				footer: { text: 'You can only hold up to 25 items in your personal inventory. Type "rp store" to put things into the pack inventory!' },
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

		if (profileData.rank == 'Healer' || profileData.rank == 'Hunter' || profileData.rank == 'Elderly') {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*A packmate turns their head sideways as they see ${profileData.name} running towards the playground.* "Aren't you a little too old to play, ${profileData.rank}?" *they ask.*`,
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
				description: `*${profileData.name} plays with ${pronoun(profileData, 4)}. The rest of the pack looks away in embarrassment.*`,
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
		const extraLostEnergyPoints = await decreaseEnergy(profileData);
		let energyPoints = generateRandomNumber(5, 1) + extraLostEnergyPoints;
		let experiencePoints = 0;

		if (profileData.energy - energyPoints < 0) {

			energyPoints = profileData.energy;
		}

		if (profileData.rank == 'Youngling') {

			experiencePoints = generateRandomNumber(9, 1);
		}

		if (profileData.rank == 'Apprentice') {

			experiencePoints = generateRandomNumber(11, 5);
		}

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{
				$inc: {
					experience: +experiencePoints,
					energy: -energyPoints,
					hunger: -hungerPoints,
					thirst: -thirstPoints,
				},
			},
		);

		let embedFooterStatsText = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

		if (hungerPoints >= 1) {

			embedFooterStatsText += `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
		}

		if (thirstPoints >= 1) {

			embedFooterStatsText += `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
		}

		if (profileData.currentRegion != 'prairie') {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$set: { currentRegion: 'prairie' },
				},
			);

			embedFooterStatsText += '\nYou are now at the prairie';
		}

		let healthPoints = 0;
		const userInjuryObject = { ...profileData.injuryObject };

		const embed = {
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: '',
			footer: { text: '' },
			image: { url: '' },
		};

		let botReply;

		if (!message.mentions.users.size) {

			const allPrairieProfilesArray = (await profileModel
				.find({
					serverId: message.guild.id,
					currentRegion: 'prairie',
				}))
				.filter(user => user.userId != profileData.userId && user.injuryObject.cold == false)
				.map(user => user.userId);

			const getsQuestChance = generateRandomNumber(3, 0);
			if (getsQuestChance === 0 && profileData.unlockedRanks === 0 && profileData.rank === 'Youngling' && profileData.levels > 1) {

				await findQuest();
			}
			else if (allPrairieProfilesArray.length > 0) {

				const allPrairieProfilesArrayRandomIndex = generateRandomNumber(allPrairieProfilesArray.length, 0);

				const partnerProfileData = await profileModel.findOne({
					userId: allPrairieProfilesArray[allPrairieProfilesArrayRandomIndex],
					serverId: message.guild.id,
				});

				const playTogetherChance = pullFromWeightedTable({ 0: 3, 1: 7 });
				if (playTogetherChance == 1 && partnerProfileData.energy > 0 && partnerProfileData.health > 0 && partnerProfileData.hunger > 0 && partnerProfileData.thirst > 0) {

					await playTogether(partnerProfileData);
				}
				else {

					await findPlant();
				}
			}
			else {

				await findPlant();
			}
		}
		else {

			const partnerProfileData = await profileModel.findOne({
				userId: message.mentions.users.first().id,
				serverId: message.guild.id,
			});

			if (!partnerProfileData || partnerProfileData.name == '' || partnerProfileData.species == '' || partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0) {

				await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{
						$inc: {
							experience: -experiencePoints,
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

			await playTogether(partnerProfileData);
		}

		botReply = await decreaseHealth(message, profileData, botReply, userInjuryObject);
		await checkLevelUp(message, botReply, profileData, serverData);
		await isPassedOut(message, profileData, true);

		await restAdvice(message, profileData);
		await drinkAdvice(message, profileData);
		await eatAdvice(message, profileData);


		async function findQuest() {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { hasQuest: true } },
			);

			botReply = await introduceQuest(message, profileData, embedArray, embedFooterStatsText);

			const filter = i => i.customId === 'quest-start' && i.user.id === message.author.id;

			botReply
				.awaitMessageComponent({ filter, time: 30000 })
				.then(async interaction => {

					await interaction.message
						.delete()
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					message.content = `${config.prefix}quest start`;

					return await execute(client, message);
				})
				.catch(async () => {
					return await botReply
						.edit({ components: [] })
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				});

			return botReply;
		}

		async function findPlant() {

			const findSomethingChance = pullFromWeightedTable({ 0: 90, 1: 10 + profileData.saplingObject.waterCycles });
			if (findSomethingChance == 0) {

				embed.description = `*${profileData.name} bounces around camp, watching the busy hustle and blurs of hunters and healers at work. ${upperCasePronounAndPlural(profileData, 0, 'splashes', 'splash')} into the stream that split the pack in half, chasing the minnows with ${pronoun(profileData, 2)} eyes.*`;
				embed.footer.text = embedFooterStatsText;

				embedArray.push(embed);

				return botReply = await message
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

			const getHurtChance = pullFromWeightedTable({ 0: 10, 1: 90 + profileData.saplingObject.waterCycles });
			if (getHurtChance == 0 && profileData.rank != 'Youngling') {

				healthPoints = generateRandomNumber(5, 3);

				if (profileData.health - healthPoints < 0) {

					healthPoints = profileData.health;
				}

				profileData = await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{ $inc: { health: -healthPoints } },
				);

				switch (true) {

					case (pullFromWeightedTable({ 0: 1, 1: 1 }) == 0 && userInjuryObject.cold == false):

						userInjuryObject.cold = true;

						embed.description = `*${profileData.name} tumbles around camp, weaving through dens and packmates at work. ${upperCasePronounAndPlural(profileData, 0, 'pause')} for a moment, having a sneezing and coughing fit. It looks like ${profileData.name} has caught a cold.*`;
						embed.footer.text = `-${healthPoints} HP (from cold)\n${embedFooterStatsText}`;

						break;

					default:

						userInjuryObject.wounds += 1;

						embed.description = `*${profileData.name} strays from camp, playing near the pack borders. ${upperCasePronounAndPlural(profileData, 0, 'hop')} on rocks and pebbles, trying to keep ${pronoun(profileData, 2)} balance, but the rock ahead of ${pronoun(profileData, 1)} is steeper and more jagged. ${upperCasePronounAndPlural(profileData, 0, 'land')} with an oomph and a gash slicing through ${pronoun(profileData, 2)} feet from the sharp edges.*`;
						embed.footer.text = `-${healthPoints} HP (from wound)\n${embedFooterStatsText}`;
				}

				embedArray.push(embed);

				return botReply = await message
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

			const foundItem = await pickRandomCommonPlant();

			const userInventory = {
				commonPlants: { ...profileData.inventoryObject.commonPlants },
				uncommonPlants: { ...profileData.inventoryObject.uncommonPlants },
				rarePlants: { ...profileData.inventoryObject.rarePlants },
				meat: { ...profileData.inventoryObject.meat },
			};

			for (const itemCategory of Object.keys(userInventory)) {

				if (Object.hasOwn(userInventory[itemCategory], foundItem)) {

					userInventory[itemCategory][foundItem] += 1;
				}
			}

			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { inventoryObject: userInventory } },
			);

			embed.description = `*${profileData.name} bounds across the den territory, chasing a bee that is just out of reach. Without looking, the ${profileData.species} crashes into a Hunter, loses sight of the bee, and scurries away into the forest. On ${pronoun(profileData, 2)} way back to the pack border, ${profileData.name} sees something special on the ground. It's a ${foundItem}!*`;
			embed.footer.text = `${embedFooterStatsText}\n\n+1 ${foundItem}`;

			embedArray.push(embed);

			return botReply = await message
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

		async function playTogether(partnerProfileData) {

			let partnerHealthPoints = generateRandomNumber(5, 1);

			if (partnerProfileData.health + partnerHealthPoints > partnerProfileData.maxHealth) {

				partnerHealthPoints = partnerHealthPoints - ((partnerProfileData.health + partnerHealthPoints) - partnerProfileData.maxHealth);
			}

			partnerProfileData = await profileModel.findOneAndUpdate(
				{ userId: partnerProfileData.userId, serverId: message.guild.id },
				{ $inc: { health: partnerHealthPoints } },
			);

			if (partnerHealthPoints >= 1) {

				embedFooterStatsText += `\n\n+${partnerHealthPoints} HP for ${partnerProfileData.name} (${partnerProfileData.health}/${partnerProfileData.maxHealth})`;
			}

			const whoWinsChance = pullFromWeightedTable({ 0: 1, 1: 1 });
			if (whoWinsChance == 0) {

				embed.description = `*${profileData.name} trails behind ${partnerProfileData.name}'s rear end, preparing for a play attack. The ${profileData.species} launches forward, landing on top of ${partnerProfileData.name}.* "I got you, ${partnerProfileData.name}!" *${pronounAndPlural(profileData, 0, 'say')}. Both creatures bounce away from each other, laughing.*`;
				embed.image.url = 'https://external-preview.redd.it/iUqJpDGv2YSDitYREfnTvsUkl9GG6oPMCRogvilkIrg.gif?s=9b0ea7faad7624ec00b5f8975e2cf3636f689e27';
			}
			else {

				embed.description = `*${profileData.name} trails behind ${partnerProfileData.name}'s rear end, preparing for a play attack. Right when the ${profileData.species} launches forward, ${partnerProfileData.name} dashes sideways, followed by a precise jump right on top of ${profileData.name}.* "I got you, ${profileData.name}!" *${pronounAndPlural(profileData, 0, 'say')}. Both creatures bounce away from each other, laughing.*`;
				embed.image.url = 'https://i.pinimg.com/originals/7e/e4/01/7ee4017f0152c7b7c573a3dfe2c6673f.gif';
			}

			embed.footer.text = embedFooterStatsText;

			embedArray.push(embed);

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

			return botReply = await message
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
	},
};