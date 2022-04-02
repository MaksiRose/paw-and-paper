const profileModel = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const startCooldown = require('../../utils/startCooldown');
const { generateRandomNumber, pullFromWeightedTable } = require('../../utils/randomizers');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../../utils/itemsInfo');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { decreaseThirst, decreaseHunger, decreaseHealth, decreaseEnergy } = require('../../utils/checkCondition');
const { checkLevelUp } = require('../../utils/levelHandling');
const { createCommandCollector } = require('../../utils/commandCollector');
const { remindOfAttack } = require('../gameplay/attack');
const { pronoun, upperCasePronounAndPlural, pronounAndPlural } = require('../../utils/getPronouns');
const blockEntrance = require('../../utils/blockEntrance');

module.exports = {
	name: 'heal',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);
		const messageContent = remindOfAttack(message);

		if (profileData.rank === 'Youngling' || profileData.rank === 'Hunter') {

			return await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, {
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*A healer rushes into the medicine den in fury.*\n"${profileData.name}, you are not trained to heal yourself, and especially not to heal others! I don't ever wanna see you again in here without supervision!"\n*${profileData.name} lowers ${pronoun(profileData, 2)} head and leaves in shame.*`,
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if ((serverData.blockedEntranceObject.den === null && generateRandomNumber(20, 0) === 0) || serverData.blockedEntranceObject.den === 'medicine den') {

			return await blockEntrance(message, messageContent, profileData, 'medicine den');
		}

		let
			allHurtProfilesList = null,
			currentUserPage = 0,
			userSelectMenu = await getUserSelectMenu(),
			chosenUser = message.mentions.users.size > 0 ? message.mentions.users.first() : allHurtProfilesList.length == 1 ? await client.users.fetch(allHurtProfilesList[0]).catch((error) => { throw new Error(error); }) : null,
			botReply = null,
			chosenProfileData = null;

		if (chosenUser === null) {

			botReply = await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, {
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} sits in front of the medicine den, looking if anyone needs help with injuries or illnesses.*`,
					}],
					components: allHurtProfilesList.length > 0 ? [userSelectMenu] : [],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}
		else {

			const { embeds: woundEmbeds, components: woundComponents } = await getWoundList(chosenUser) ?? { embeds: undefined, components: undefined };

			botReply = await message
				.reply({
					content: messageContent,
					embeds: woundEmbeds,
					components: woundComponents,
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}


		if (userSelectMenu.components[0].options.length === 0) {

			return;
		}

		createCommandCollector(message.author.id, message.guild.id, botReply);
		interactionCollector();

		async function interactionCollector() {

			const filter = i => i.user.id === message.author.id;

			const interaction = await botReply
				.awaitMessageComponent({ filter, time: 60000 })
				.catch(() => { return null; });

			if (interaction === null) {

				await botReply
					.edit({
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				return;
			}

			if (interaction.isButton()) {

				const { embeds: woundEmbeds } = await getWoundList(chosenUser);

				if (interaction.customId === 'healpage-1') {

					const { embed, selectMenu } = getFirstHealPage();

					woundEmbeds.splice(-1, 1, embed);

					interaction.message.components.length = 2;
					const componentArray = interaction.message.components;

					botReply = await interaction.message
						.edit({
							embeds: woundEmbeds,
							components: selectMenu.components[0].options.length > 0 ? [...componentArray, selectMenu] : componentArray,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}

				if (interaction.customId === 'healpage-2') {

					const embed = {
						color: profileData.color,
						title: `Inventory of ${message.guild.name} - Page 2`,
						fields: [],
						footer: { text: 'Choose one of the herbs above to heal the player with it!' },
					};

					const selectMenu = {
						type: 'ACTION_ROW',
						components: [{
							type: 'SELECT_MENU',
							customId: 'heal-options-2',
							placeholder: 'Select an item',
							options: [],
						}],
					};

					embed.fields.push({ name: 'water', value: 'Found lots and lots of in the river that flows through the pack!', inline: true });
					selectMenu.components[0].options.push({ label: 'water', value: 'water' });

					for (const [uncommonPlantName, uncommonPlantObject] of [...uncommonPlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

						if (serverData.inventoryObject.uncommonPlants[uncommonPlantName] > 0) {

							embed.fields.push({ name: `${uncommonPlantName}: ${serverData.inventoryObject.uncommonPlants[uncommonPlantName]}`, value: uncommonPlantObject.description, inline: true });
							selectMenu.components[0].options.push({ label: uncommonPlantName, value: uncommonPlantName, description: `${serverData.inventoryObject.uncommonPlants[uncommonPlantName]}` });
						}
					}

					for (const [rarePlantName, rarePlantObject] of [...rarePlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

						if (serverData.inventoryObject.rarePlants[rarePlantName] > 0) {

							embed.fields.push({ name: `${rarePlantName}: ${serverData.inventoryObject.rarePlants[rarePlantName]}`, value: rarePlantObject.description, inline: true });
							selectMenu.components[0].options.push({ label: rarePlantName, value: rarePlantName, description: `${serverData.inventoryObject.rarePlants[rarePlantName]}` });
						}
					}

					woundEmbeds.splice(-1, 1, embed);

					interaction.message.components.length = 2;
					const componentArray = interaction.message.components;

					botReply = await interaction.message
						.edit({
							embeds: woundEmbeds,
							components: [...componentArray, selectMenu],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}
			}

			if (interaction.isSelectMenu()) {

				if (interaction.values[0] === 'heal_user_page') {

					const pagesAmount = Math.ceil(allHurtProfilesList.length / 24);

					currentUserPage++;
					if (currentUserPage >= pagesAmount) {

						currentUserPage = 0;
					}

					userSelectMenu = await getUserSelectMenu();

					const componentArray = interaction.message.components;
					await componentArray.splice(0, 1);

					if (allHurtProfilesList.length > 0) { componentArray.unshift(userSelectMenu); }

					botReply = await interaction.message
						.edit({ components: componentArray })
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}

				userSelectMenu = await getUserSelectMenu();

				if (allHurtProfilesList.includes(interaction.values[0])) {

					chosenProfileData = await profileModel.findOne({
						userId: interaction.values[0],
						serverId: message.guild.id,
					});

					chosenUser = await client.users
						.fetch(interaction.values[0])
						.catch((error) => {
							throw new Error(error);
						});

					const { embeds: woundEmbeds, components: woundComponents } = await getWoundList(chosenUser);

					botReply = await botReply
						.edit({
							embeds: woundEmbeds,
							components: woundComponents,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}

				if (commonPlantsMap.has(interaction.values[0]) || uncommonPlantsMap.has(interaction.values[0]) || rarePlantsMap.has(interaction.values[0]) || interaction.values[0] === 'water') {

					if (allHurtProfilesList.includes(chosenProfileData.userId) === false) {

						botReply = await interaction.message
							.edit({
								embeds: [...embedArray, {
									color: profileData.color,
									title: `${chosenProfileData.name} doesn't need to be healed anymore. Please select another user to heal if available.`,
								}],
								components: userSelectMenu.components[0].options.length > 0 ? [userSelectMenu] : [],
							})
							.catch((error) => {
								if (error.httpStatus !== 404) {
									throw new Error(error);
								}
							});

						return userSelectMenu.components[0].options.length > 0 ? await interactionCollector() : null;
					}

					chosenProfileData = await profileModel.findOne({
						userId: chosenProfileData.userId,
						serverId: chosenProfileData.serverId,
					});

					const userCondition = botReply.embeds[botReply.embeds.length - 2].footer.text.toLowerCase();
					let userHasChangedCondition = false;

					let healthPoints = 0;
					let userInjuryObject = { ...profileData.injuryObject };

					const embed = {
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: '',
						footer: { text: '' },
					};

					if (interaction.values[0] === 'water') {

						if (chosenProfileData.thirst > 0) {

							if (userCondition.includes('thirst')) {

								userHasChangedCondition = true;
							}

							if (profileData.userId === chosenProfileData.userId) {

								embed.description = `*${profileData.name} thinks about just drinking some water, but that won't help with ${pronoun(profileData, 2)} issues...*"`;

							}
							else {

								embed.description = `*${chosenProfileData.name} looks at ${profileData.name} with indignation.* "Being hydrated is really not my biggest problem right now!"`;

							}

							embed.footer.text = await decreaseStats(false);

						}
						else {

							const embedFooterStatsText = await decreaseStats(true);
							const chosenUserThirstPoints = generateRandomNumber(10, 1);

							chosenProfileData = await profileModel.findOneAndUpdate(
								{ userId: chosenProfileData.userId, serverId: chosenProfileData.serverId },
								{ $inc: { thirst: +chosenUserThirstPoints } },
							);

							embed.description = `*${profileData.name} takes ${chosenProfileData.name}'s body, drags it over to the river, and positions ${pronoun(chosenProfileData, 2)} head right over the water. The ${chosenProfileData.species} sticks ${pronoun(chosenProfileData, 2)} tongue out and slowly starts drinking. Immediately you can observe how the newfound energy flows through ${pronoun(chosenProfileData, 2)} body.*`;
							embed.footer.text = `${embedFooterStatsText}\n\n+${chosenUserThirstPoints} thirst for ${chosenProfileData.name} (${chosenProfileData.thirst}/${chosenProfileData.maxThirst})`;

						}
					}
					else {

						const plantMap = new Map([...commonPlantsMap, ...uncommonPlantsMap, ...rarePlantsMap]);

						if (commonPlantsMap.has(interaction.values[0])) {

							serverData.inventoryObject.commonPlants[interaction.values[0]] -= 1;
						}

						if (uncommonPlantsMap.has(interaction.values[0])) {

							serverData.inventoryObject.uncommonPlants[interaction.values[0]] -= 1;
						}

						if (rarePlantsMap.has(interaction.values[0])) {

							serverData.inventoryObject.rarePlants[interaction.values[0]] -= 1;
						}

						const chosenUserInjuryObject = { ...chosenProfileData.injuryObject };
						let chosenUserEnergyPoints = 0;
						let chosenUserHungerPoints = 0;
						let isSuccessful = false;
						let embedFooterChosenUserStatsText = '';
						let embedFooterChosenUserInjuryText = '';

						if (plantMap.get(interaction.values[0]).edibality === 'e') {

							if (chosenProfileData.hunger <= 0) {

								isSuccessful = true;
							}
							else if (userCondition.includes('hunger')) {

								userHasChangedCondition = true;
							}

							if (speciesMap.get(profileData.species).diet === 'carnivore') {

								chosenUserHungerPoints = 1;
							}

							if (speciesMap.get(profileData.species).diet === 'herbivore' || speciesMap.get(profileData.species).diet === 'omnivore') {

								chosenUserHungerPoints = 5;
							}

							if (chosenProfileData.hunger + chosenUserHungerPoints > chosenProfileData.maxHunger) {

								chosenUserHungerPoints -= (chosenProfileData.hunger + chosenUserHungerPoints) - chosenProfileData.maxHunger;
							}

							if (chosenUserHungerPoints > 0) {

								embedFooterChosenUserStatsText += `\n+${chosenUserHungerPoints} hunger for ${chosenProfileData.name} (${chosenProfileData.hunger + chosenUserHungerPoints}/${chosenProfileData.maxHunger})`;
							}
						}

						if (chosenProfileData.health <= 0) {

							isSuccessful = true;
						}
						else if (userCondition.includes('health')) {

							userHasChangedCondition = true;
						}

						if (plantMap.get(interaction.values[0]).healsWounds === true) {

							if (chosenUserInjuryObject.wounds > 0) {

								isSuccessful = true;
								embedFooterChosenUserInjuryText += `\n-1 wound for ${chosenProfileData.name}`;
								chosenUserInjuryObject.wounds -= 1;
							}
							else if (userCondition.includes('wounds')) {

								userHasChangedCondition = true;
							}
						}

						if (plantMap.get(interaction.values[0]).healsInfections === true) {

							if (chosenUserInjuryObject.infections > 0) {

								isSuccessful = true;
								embedFooterChosenUserInjuryText += `\n-1 infection for ${chosenProfileData.name}`;
								chosenUserInjuryObject.infections -= 1;
							}
							else if (userCondition.includes('infections')) {

								userHasChangedCondition = true;
							}
						}

						if (plantMap.get(interaction.values[0]).healsColds === true) {

							if (chosenUserInjuryObject.cold == true) {

								isSuccessful = true;
								embedFooterChosenUserInjuryText += `\ncold healed for ${chosenProfileData.name}`;
								chosenUserInjuryObject.cold = false;
							}
							else if (userCondition.includes('cold')) {

								userHasChangedCondition = true;
							}
						}

						if (plantMap.get(interaction.values[0]).healsSprains === true) {

							if (chosenUserInjuryObject.sprains > 0) {

								isSuccessful = true;
								embedFooterChosenUserInjuryText += `\n-1 sprain for ${chosenProfileData.name}`;
								chosenUserInjuryObject.sprains -= 1;
							}
							else if (userCondition.includes('sprains')) {

								userHasChangedCondition = true;
							}
						}

						if (plantMap.get(interaction.values[0]).healsPoison === true) {

							if (chosenUserInjuryObject.poison == true) {

								isSuccessful = true;
								embedFooterChosenUserInjuryText += `\npoison healed for ${chosenProfileData.name}`;
								chosenUserInjuryObject.poison = false;
							}
							else if (userCondition.includes('poison')) {

								userHasChangedCondition = true;
							}
						}

						if (plantMap.get(interaction.values[0]).givesEnergy === true) {

							if (chosenProfileData.energy <= 0) {

								isSuccessful = true;
							}

							chosenUserEnergyPoints = 30;

							if (chosenProfileData.energy + chosenUserEnergyPoints > chosenProfileData.maxEnergy) {

								chosenUserEnergyPoints -= (chosenProfileData.energy + chosenUserEnergyPoints) - chosenProfileData.maxEnergy;
							}

							if (chosenUserEnergyPoints >= 1) {

								embedFooterChosenUserStatsText += `\n+${chosenUserEnergyPoints} energy for ${chosenProfileData.name} (${chosenProfileData.energy + chosenUserEnergyPoints}/${chosenProfileData.maxEnergy})`;
							}
						}


						serverData = await serverModel.findOneAndUpdate(
							{ serverId: message.guild.id },
							{ $set: { inventoryObject: serverData.inventoryObject } },
						);

						if (isSuccessful === true && chosenProfileData.userId === profileData.userId && pullFromWeightedTable({ 0: 60, 1: 40 + profileData.saplingObject.waterCycles }) === 0) {

							isSuccessful = false;
						}
						else if (isSuccessful === false && userHasChangedCondition === true) {

							botReply = await interaction.message
								.edit({
									embeds: [...embedArray, {
										color: profileData.color,
										title: `${chosenProfileData.name}'s stats/illnesses/injuries changed before you healed them. Please try again.`,
									}],
									components: userSelectMenu.components[0].options.length > 0 ? [userSelectMenu] : [],
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});

							return userSelectMenu.components[0].options.length > 0 ? await interactionCollector() : null;
						}

						if (isSuccessful === true && chosenProfileData.userId !== profileData.userId && profileData.rank === 'Apprentice' && pullFromWeightedTable({ 0: 40, 1: 60 + profileData.saplingObject.waterCycles }) === 0) {

							isSuccessful = false;
						}

						const embedFooterStatsText = await decreaseStats(isSuccessful);
						const chosenItemName = interaction.values[0];

						if (isSuccessful === true) {

							let chosenUserHealthPoints = generateRandomNumber(10, 6);
							if (chosenProfileData.health + chosenUserHealthPoints > chosenProfileData.maxHealth) {

								chosenUserHealthPoints -= (chosenProfileData.health + chosenUserHealthPoints) - chosenProfileData.maxHealth;
							}

							chosenProfileData = await profileModel.findOneAndUpdate(
								{ userId: chosenProfileData.userId, serverId: chosenProfileData.serverId },
								{
									$inc: {
										hunger: +chosenUserHungerPoints,
										energy: +chosenUserEnergyPoints,
										health: +chosenUserHealthPoints,
									},
									$set: { injuryObject: chosenUserInjuryObject },
								},
							);

							if (chosenProfileData.userId === profileData.userId) {

								userInjuryObject = chosenUserInjuryObject;

								profileData = await profileModel.findOne({
									userId: message.author.id,
									serverId: message.guild.id,
								});

								embed.description = `*${profileData.name} takes a ${chosenItemName}. After a bit of preparation, the ${profileData.species} can apply it correctly. Immediately you can see the effect. ${upperCasePronounAndPlural(profileData, 0, 'feel')} much better!*`;
							}
							else {

								embed.description = `*${profileData.name} takes a ${chosenItemName}. After a  bit of preparation, ${pronounAndPlural(profileData, 0, 'give')} it to ${chosenProfileData.name}. Immediately you can see the effect. ${upperCasePronounAndPlural(chosenProfileData, 0, 'feel')} much better!*`;
							}

							embed.footer.text = `${embedFooterStatsText}\n${embedFooterChosenUserStatsText}\n+${chosenUserHealthPoints} HP for ${chosenProfileData.name} (${chosenProfileData.health}/${chosenProfileData.maxHealth})${embedFooterChosenUserInjuryText}\n\n-1 ${chosenItemName} for ${message.guild.name}`;
						}
						else {

							if (chosenProfileData.userId === profileData.userId) {

								embed.description = `*${profileData.name} holds the ${chosenItemName} in ${pronoun(profileData, 2)} mouth, trying to find a way to apply it. After a few attempts, the herb breaks into little pieces, rendering it useless. Guess ${pronounAndPlural(profileData, 0, 'has', 'have')} to try again...*`;
							}
							else {

								embed.description = `*${profileData.name} takes a ${chosenItemName}. After a bit of preparation, ${pronounAndPlural(profileData, 0, 'give')} it to ${chosenProfileData.name}. But no matter how long they wait, it does not seem to help. Looks like ${profileData.name} has to try again...*`;
							}

							embed.footer.text = `${embedFooterStatsText}\n\n-1 ${chosenItemName} for ${message.guild.name}`;
						}
					}

					embedArray.push(embed);

					if (chosenProfileData.injuryObject.cold === true && chosenProfileData.userId !== profileData.userId && profileData.injuryObject.cold === false && generateRandomNumber(10, 1 <= 3)) {

						healthPoints = generateRandomNumber(5, 3);

						if (profileData.health - healthPoints < 0) {

							healthPoints = profileData.health;
						}

						profileData = await profileModel.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{ $inc: { health: -healthPoints } },
						);

						userInjuryObject.cold = true;

						await embedArray.push({
							color: profileData.color,
							description: `*Suddenly, ${profileData.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${chosenProfileData.name}, who was coughing as well. That was probably not the best idea!*`,
							footer: { text: `-${healthPoints} HP (from cold)` },
						});
					}

					interaction.message
						.delete()
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					const content = (chosenProfileData.userId != profileData.userId ? `<@!${chosenProfileData.userId}>\n` : '') + (messageContent === null ? '' : messageContent);

					botReply = await message
						.reply({
							content: content === '' ? null : content,
							embeds: embedArray,
							failIfNotExists: false,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					botReply = await decreaseHealth(message, profileData, botReply, userInjuryObject);
					botReply = await checkLevelUp(message, botReply, profileData, serverData);
					await isPassedOut(message, profileData, true);

					return;
				}
			}

			await interactionCollector();
		}

		async function decreaseStats(isSuccessful) {

			const experiencePoints = isSuccessful === false ? 0 : profileData.rank == 'Elderly' ? generateRandomNumber(41, 20) : profileData.rank == 'Healer' ? generateRandomNumber(21, 10) : generateRandomNumber(11, 5);
			const energyPoints = function(energy) { return (profileData.energy - energy < 0) ? profileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(profileData));
			const hungerPoints = await decreaseHunger(profileData);
			const thirstPoints = await decreaseThirst(profileData);

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

			let footerStats = `-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

			if (experiencePoints > 0) {

				footerStats = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n` + footerStats;
			}

			if (hungerPoints >= 1) {

				footerStats += `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
			}

			if (thirstPoints >= 1) {

				footerStats += `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
			}

			return footerStats;
		}

		/**
		 * updates allHurtProfilesArray, then iterates through it to find users who need to be healed
		 * @returns {object} selectMenu - object for message component
		 */
		async function getUserSelectMenu() {

			allHurtProfilesList = (await profileModel.find({
				serverId: message.guild.id,
				$or: [
					{ energy: 0 },
					{ health: 0 },
					{ hunger: 0 },
					{ thirst: 0 },
					{
						injuryObject: {
							$or: [
								{ wounds: { $gt: 0 } },
								{ infections: { $gt: 0 } },
								{ cold: true },
								{ sprains: { $gt: 0 } },
								{ poison: true },
							],
						},
					},
				],
			})).map(user => user.userId);

			const selectMenu = {
				type: 'ACTION_ROW',
				components: [{
					type: 'SELECT_MENU',
					customId: 'heal-user-options',
					placeholder: 'Select a user to heal',
					options: [],
				}],
			};

			for (let i = currentUserPage * 24; i < allHurtProfilesList.length; i++) {

				const userProfileData = await profileModel.findOne({
					userId: allHurtProfilesList[i],
					serverId: message.guild.id,
				});

				if (selectMenu.components[0].options.length > 25) {

					// In case there are exactly 25 user options, only once a 26th option is detected, it would set the array back to 24 and add the Page Switcher.
					// Otherwise, if there are exactly 25 user options, it would split it up onto two pages unnecessarily
					selectMenu.components[0].options.length = 24;
					selectMenu.components[0].options.push({ lavel: 'Show more user options', value: 'heal_user_page', description: 'You are currently on page 1', emoji: '📋' });
				}

				selectMenu.components[0].options.push({ label: userProfileData.name, value: allHurtProfilesList[i] });
			}

			return selectMenu;
		}


		async function getWoundList(healUser) {

			const pageButtons = {
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'healpage-1',
					label: 'Page 1',
					emoji: { name: '🌱' },
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'healpage-2',
					label: 'Page 2',
					emoji: { name: '🍀' },
					style: 'SECONDARY',
				}],
			};

			chosenProfileData = await profileModel.findOne({
				userId: healUser.id,
				serverId: message.guild.id,
			});

			let healUserConditionText = '';

			healUserConditionText += (chosenProfileData.health <= 0) ? '\nHealth: 0' : '';
			healUserConditionText += (chosenProfileData.energy <= 0) ? '\nEnergy: 0' : '';
			healUserConditionText += (chosenProfileData.hunger <= 0) ? '\nHunger: 0' : '';
			healUserConditionText += (chosenProfileData.thirst <= 0) ? '\nThirst: 0' : '';
			healUserConditionText += (chosenProfileData.injuryObject.wounds > 0) ? `\nWounds: ${chosenProfileData.injuryObject.wounds}` : '';
			healUserConditionText += (chosenProfileData.injuryObject.infections > 0) ? `\nInfections: ${chosenProfileData.injuryObject.infections}` : '';
			healUserConditionText += (chosenProfileData.injuryObject.cold == true) ? '\nCold: yes' : '';
			healUserConditionText += (chosenProfileData.injuryObject.sprains > 0) ? `\nSprains: ${chosenProfileData.injuryObject.sprains}` : '';
			healUserConditionText += (chosenProfileData.injuryObject.poison == true) ? '\nPoison: yes' : '';

			const embed = {
				color: profileData.color,
				description: '',
				footer: { text: '' },
			};

			if (chosenProfileData.userId === profileData.userId) {

				embed.description = `*${profileData.name} pushes aside the leaves acting as the entrance to the healer's den. With tired eyes ${pronounAndPlural(profileData, 0, 'inspect')} the rows of herbs, hoping to find one that can ease ${pronoun(profileData, 2)} pain.*`;
				embed.footer.text = `${chosenProfileData.name}'s stats/illnesses/injuries:${healUserConditionText}`;
			}
			else if (chosenProfileData.energy <= 0 || chosenProfileData.health <= 0 || chosenProfileData.hunger <= 0 || chosenProfileData.thirst <= 0) {

				embed.description = `*${profileData.name} runs towards the pack borders, where ${chosenProfileData.name} lies, only barely conscious. The ${profileData.rank} immediately looks for the right herbs to help the ${chosenProfileData.species}.*`;
				embed.footer.text = `${chosenProfileData.name}'s stats/illnesses/injuries:${healUserConditionText}`;
			}
			else if (Object.values(chosenProfileData.injuryObject).some(element => element > 0)) {

				embed.description = `*${chosenProfileData.name} enters the medicine den with tired eyes.* "Please help me!" *${pronounAndPlural(chosenProfileData, 0, 'say')}, ${pronoun(chosenProfileData, 2)} face contorted in pain. ${profileData.name} looks up with worry.* "I'll see what I can do for you."`;
				embed.footer.text = `${chosenProfileData.name}'s stats/illnesses/injuries:${healUserConditionText}`;
			}
			else {

				embed.description = `*${profileData.name} approaches ${chosenProfileData.name}, desperately searching for someone to help.*\n"Do you have any injuries or illnesses you know of?" *the ${profileData.species} asks.\n${chosenProfileData.name} shakes ${pronoun(chosenProfileData, 2)} head.* "Not that I know of, no."\n*Disappointed, ${profileData.name} goes back to the medicine den.*`;

				return { embeds: [...embedArray, embed], components: allHurtProfilesList.length > 0 ? [userSelectMenu] : [] };
			}

			const { embed: embed2, selectMenu } = getFirstHealPage();

			if (embed2.fields.length === 0) { pageButtons.components[0].disabled = true; }

			const
				embeds = [...embedArray, embed, ...allHurtProfilesList.length > 0 ? [embed2] : []],
				components = [...allHurtProfilesList.length > 0 ? [userSelectMenu, pageButtons, ...selectMenu !== null ? [selectMenu] : []] : []];

			return { embeds, components };
		}

		function getFirstHealPage() {

			const embed = {
				color: profileData.color,
				title: `Inventory of ${message.guild.name} - Page 1`,
				fields: [],
				footer: { text: 'Choose one of the herbs above to heal the player with it!' },
			};

			let selectMenu = {
				type: 'ACTION_ROW',
				components: [{
					type: 'SELECT_MENU',
					customId: 'heal-options-1',
					placeholder: 'Select an item',
					options: [],
				}],
			};

			for (const [commonPlantName, commonPlantObject] of [...commonPlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

				if (serverData.inventoryObject.commonPlants[commonPlantName] > 0) {

					embed.fields.push({ name: `${commonPlantName}: ${serverData.inventoryObject.commonPlants[commonPlantName]}`, value: commonPlantObject.description, inline: true });
					selectMenu.components[0].options.push({ label: commonPlantName, value: commonPlantName, description: `${serverData.inventoryObject.commonPlants[commonPlantName]}` });
				}
			}

			if (selectMenu.components[0].options.length === 0) { selectMenu = null; }

			return { embed, selectMenu };
		}
	},
};
