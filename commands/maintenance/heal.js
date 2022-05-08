// @ts-check
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
const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const { addFriendshipPoints } = require('../../utils/friendshipHandling');

module.exports.name = 'heal';

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

	const characterData = userData.characters[userData.currentCharacter[message.guild.id]];
	const profileData = characterData.profiles[message.guild.id];

	if (await hasNotCompletedAccount(message, characterData)) {

		return;
	}

	if (await isInvalid(message, userData, embedArray, [module.exports.name])) {

		return;
	}

	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	if (profileData.rank === 'Youngling' || profileData.rank === 'Hunter') {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*A healer rushes into the medicine den in fury.*\n"${characterData.name}, you are not trained to heal yourself, and especially not to heal others! I don't ever wanna see you again in here without supervision!"\n*${characterData.name} lowers ${pronoun(characterData, 2)} head and leaves in shame.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if ((serverData.blockedEntrance.den === null && generateRandomNumber(20, 0) === 0) || serverData.blockedEntrance.den === 'medicine den') {

		await blockEntrance(message, messageContent, characterData, serverData, 'medicine den');
		return;
	}

	let
		/** @type {Object<string, import('../../typedef').Character>} */
		allHurtCharactersList = {},
		currentUserPage = 0,
		userSelectMenu = await getUserSelectMenu(),
		chosenUserData = message.mentions.users.size > 0 ?
			/** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: message.mentions.users.first().id })) :
			Object.keys(allHurtCharactersList).length === 1 ?
			/** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: Object.keys(allHurtCharactersList)[0] })) : null,
		chosenCharacterData = chosenUserData !== null ? chosenUserData.characters[Object.values(allHurtCharactersList)[0].name] : null,
		chosenProfileData = chosenCharacterData !== null ? chosenCharacterData.profiles[message.guild.id] : null,
		/** @type {import('discord.js').Message} */
		botReply = null;

	if (chosenUserData === null) {

		botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} sits in front of the medicine den, looking if anyone needs help with injuries or illnesses.*`,
				}],
				components: Object.keys(allHurtCharactersList).length > 0 ? [userSelectMenu] : [],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}
	else {

		const { embeds: woundEmbeds, components: woundComponents } = await getWoundList(chosenUserData, chosenCharacterData.name) ?? { embeds: undefined, components: undefined };

		botReply = await message
			.reply({
				content: messageContent,
				embeds: woundEmbeds,
				components: woundComponents,
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}


	if (/** @type {import('discord.js').MessageSelectMenuOptions} */ (userSelectMenu.components[0]).options.length === 0) {

		return;
	}

	createCommandCollector(message.author.id, message.guild.id, botReply);
	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.user.id === message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} } */
		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 60_000 })
			.catch(() => { return null; });

		if (interaction === null) {

			await botReply
				.edit({
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			return;
		}

		if (interaction.isButton()) {

			const { embeds: woundEmbeds } = await getWoundList(chosenUserData, characterData.name);

			if (interaction.customId === 'healpage-1') {

				const { embed, selectMenu } = getFirstHealPage();

				woundEmbeds.splice(-1, 1, embed);

				interaction.message.components.length = 2;
				const componentArray = /** @type {import('discord.js').Message} */ (interaction.message).components;

				botReply = await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: woundEmbeds,
						components: /** @type {import('discord.js').MessageSelectMenuOptions} */ (selectMenu.components[0]).options.length > 0 ? [...componentArray, selectMenu] : componentArray,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return /** @type {import('discord.js').Message} */ (interaction.message);
					});
			}

			if (interaction.customId === 'healpage-2') {

				const embed = {
					color: characterData.color,
					title: `Inventory of ${message.guild.name} - Page 2`,
					fields: [],
					footer: { text: 'Choose one of the herbs above to heal the player with it!' },
				};

				const selectMenu = new MessageActionRow({
					components: [ new MessageSelectMenu({
						customId: 'heal-options-2',
						placeholder: 'Select an item',
						options: [],
					})],
				});

				embed.fields.push({ name: 'water', value: 'Found lots and lots of in the river that flows through the pack!', inline: true });
				/** @type {import('discord.js').MessageSelectMenuOptions} */ (selectMenu.components[0]).options.push({ label: 'water', value: 'water' });

				for (const [uncommonPlantName, uncommonPlantObject] of [...uncommonPlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

					if (serverData.inventory.uncommonPlants[uncommonPlantName] > 0) {

						embed.fields.push({ name: `${uncommonPlantName}: ${serverData.inventory.uncommonPlants[uncommonPlantName]}`, value: uncommonPlantObject.description, inline: true });
						/** @type {import('discord.js').MessageSelectMenuOptions} */ (selectMenu.components[0]).options.push({ label: uncommonPlantName, value: uncommonPlantName, description: `${serverData.inventory.uncommonPlants[uncommonPlantName]}` });
					}
				}

				for (const [rarePlantName, rarePlantObject] of [...rarePlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

					if (serverData.inventory.rarePlants[rarePlantName] > 0) {

						embed.fields.push({ name: `${rarePlantName}: ${serverData.inventory.rarePlants[rarePlantName]}`, value: rarePlantObject.description, inline: true });
						/** @type {import('discord.js').MessageSelectMenuOptions} */ (selectMenu.components[0]).options.push({ label: rarePlantName, value: rarePlantName, description: `${serverData.inventory.rarePlants[rarePlantName]}` });
					}
				}

				woundEmbeds.splice(-1, 1, embed);

				interaction.message.components.length = 2;
				const componentArray = /** @type {import('discord.js').Message} */ (interaction.message).components;

				botReply = await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: woundEmbeds,
						components: [...componentArray, selectMenu],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return /** @type {import('discord.js').Message} */ (interaction.message);
					});
			}
		}

		if (interaction.isSelectMenu()) {

			if (interaction.values[0] === 'heal_user_page') {

				const pagesAmount = Math.ceil(Object.keys(allHurtCharactersList).length / 24);

				currentUserPage++;
				if (currentUserPage >= pagesAmount) {

					currentUserPage = 0;
				}

				userSelectMenu = await getUserSelectMenu();

				/** @type {Array<Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions>} */
				const componentArray = /** @type {import('discord.js').Message} */ (interaction.message).components;
				componentArray.splice(0, 1);

				if (Object.keys(allHurtCharactersList).length > 0) { componentArray.unshift(userSelectMenu); }

				botReply = await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({ components: componentArray })
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return /** @type {import('discord.js').Message} */ (interaction.message);
					});
			}

			userSelectMenu = await getUserSelectMenu();

			if (Object.keys(allHurtCharactersList).includes(interaction.values[0].split(' ')[0])) {

				chosenUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: interaction.values[0].split(' ')[0] }));
				chosenCharacterData = chosenUserData.characters[interaction.values[0].split(' ').slice(1).join(' ')];
				chosenProfileData = chosenCharacterData.profiles[message.guild.id];

				const { embeds: woundEmbeds, components: woundComponents } = await getWoundList(chosenUserData, chosenCharacterData.name);

				botReply = await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: woundEmbeds,
						components: woundComponents,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return /** @type {import('discord.js').Message} */ (interaction.message);
					});
			}

			if (commonPlantsMap.has(interaction.values[0]) || uncommonPlantsMap.has(interaction.values[0]) || rarePlantsMap.has(interaction.values[0]) || interaction.values[0] === 'water') {

				if (Object.keys(allHurtCharactersList).includes(chosenUserData.userId) === false) {

					botReply = await /** @type {import('discord.js').Message} */ (interaction.message)
						.edit({
							embeds: [...embedArray, {
								color: characterData.color,
								title: `${chosenCharacterData.name} doesn't need to be healed anymore. Please select another user to heal if available.`,
							}],
							components: /** @type {import('discord.js').MessageSelectMenuOptions} */ (userSelectMenu.components[0]).options.length > 0 ? [userSelectMenu] : [],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
							return /** @type {import('discord.js').Message} */ (interaction.message);
						});

					return /** @type {import('discord.js').MessageSelectMenuOptions} */ (userSelectMenu.components[0]).options.length > 0 ? await interactionCollector() : null;
				}

				chosenUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: chosenUserData.userId }));
				chosenCharacterData = chosenUserData.characters[chosenCharacterData.name];
				chosenProfileData = chosenCharacterData.profiles[message.guild.id];

				const userCondition = botReply.embeds[botReply.embeds.length - 2].footer.text.toLowerCase();
				let userHasChangedCondition = false;

				let healthPoints = 0;
				let userInjuryObject = { ...profileData.injuries };

				const embed = {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: '',
					footer: { text: '' },
				};

				let isSuccessful = false;

				if (interaction.values[0] === 'water') {

					if (chosenProfileData.thirst > 0) {

						if (userCondition.includes('thirst')) {

							userHasChangedCondition = true;
						}
					}
					else {

						isSuccessful = true;
					}

					if (isSuccessful === false && userHasChangedCondition === true) {

						botReply = await /** @type {import('discord.js').Message} */ (interaction.message)
							.edit({
								embeds: [...embedArray, {
									color: characterData.color,
									title: `${chosenCharacterData.name}'s stats/illnesses/injuries changed before you healed them. Please try again.`,
								}],
								components: /** @type {import('discord.js').MessageSelectMenuOptions} */ (userSelectMenu.components[0]).options.length > 0 ? [userSelectMenu] : [],
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
								return /** @type {import('discord.js').Message} */ (interaction.message);
							});

						return /** @type {import('discord.js').MessageSelectMenuOptions} */ (userSelectMenu.components[0]).options.length > 0 ? await interactionCollector() : null;
					}

					if (isSuccessful === true && profileData.rank === 'Apprentice' && pullFromWeightedTable({ 0: 30, 1: 70 + profileData.sapling.waterCycles }) === 0) {

						isSuccessful = false;
					}

					if (isSuccessful === true) {

						const embedFooterStatsText = await decreaseStats(true);
						const chosenUserThirstPoints = generateRandomNumber(10, 6);

						chosenUserData = (/** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
							{ uuid: chosenUserData.uuid },
							(/** @type {import('../../typedef').ProfileSchema} */ cP) => {
								cP.characters[cP.currentCharacter[message.guild.id]].profiles[message.guild.id].thirst += chosenUserThirstPoints;
							},
						)));
						chosenCharacterData = chosenUserData.characters[chosenCharacterData.name];
						chosenProfileData = chosenCharacterData.profiles[message.guild.id];

						embed.description = `*${characterData.name} takes ${chosenCharacterData.name}'s body, drags it over to the river, and positions ${pronoun(chosenCharacterData, 2)} head right over the water. The ${chosenCharacterData.species} sticks ${pronoun(chosenCharacterData, 2)} tongue out and slowly starts drinking. Immediately you can observe how the newfound energy flows through ${pronoun(chosenCharacterData, 2)} body.*`;
						embed.footer.text = `${embedFooterStatsText}\n\n+${chosenUserThirstPoints} thirst for ${chosenCharacterData.name} (${chosenProfileData.thirst}/${chosenProfileData.maxThirst})`;
					}
					else {

						if (userData.userId === chosenUserData.userId) {

							embed.description = `*${characterData.name} thinks about just drinking some water, but that won't help with ${pronoun(characterData, 2)} issues...*"`;
						}
						else if (chosenProfileData.thirst > 0) {

							embed.description = `*${chosenCharacterData.name} looks at ${characterData.name} with indignation.* "Being hydrated is really not my biggest problem right now!"`;
						}
						else {

							embed.description = `*${characterData.name} takes ${chosenCharacterData.name}'s body and tries to drag it over to the river. The ${characterData.species} attempts to position the ${chosenCharacterData.species}'s head right over the water, but every attempt fails miserably. ${upperCasePronounAndPlural(characterData, 0, 'need')} to concentrate and try again.*`;
						}

						embed.footer.text = await decreaseStats(false);
					}
				}
				else {

					const plantMap = new Map([...commonPlantsMap, ...uncommonPlantsMap, ...rarePlantsMap]);

					if (commonPlantsMap.has(interaction.values[0])) {

						serverData.inventory.commonPlants[interaction.values[0]] -= 1;
					}

					if (uncommonPlantsMap.has(interaction.values[0])) {

						serverData.inventory.uncommonPlants[interaction.values[0]] -= 1;
					}

					if (rarePlantsMap.has(interaction.values[0])) {

						serverData.inventory.rarePlants[interaction.values[0]] -= 1;
					}

					const chosenUserInjuryObject = { ...chosenProfileData.injuries };
					let chosenUserEnergyPoints = 0;
					let chosenUserHungerPoints = 0;
					let embedFooterChosenUserStatsText = '';
					let embedFooterChosenUserInjuryText = '';

					if (plantMap.get(interaction.values[0]).edibality === 'e') {

						if (chosenProfileData.hunger <= 0) {

							isSuccessful = true;
						}
						else if (userCondition.includes('hunger')) {

							userHasChangedCondition = true;
						}

						if (speciesMap.get(chosenCharacterData.species).diet === 'carnivore') {

							chosenUserHungerPoints = 1;
						}

						if (speciesMap.get(chosenCharacterData.species).diet === 'herbivore' || speciesMap.get(chosenCharacterData.species).diet === 'omnivore') {

							chosenUserHungerPoints = 5;
						}

						if (chosenProfileData.hunger + chosenUserHungerPoints > chosenProfileData.maxHunger) {

							chosenUserHungerPoints -= (chosenProfileData.hunger + chosenUserHungerPoints) - chosenProfileData.maxHunger;
						}

						if (chosenUserHungerPoints > 0) {

							embedFooterChosenUserStatsText += `\n+${chosenUserHungerPoints} hunger for ${chosenCharacterData.name} (${chosenProfileData.hunger + chosenUserHungerPoints}/${chosenProfileData.maxHunger})`;
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
							embedFooterChosenUserInjuryText += `\n-1 wound for ${chosenCharacterData.name}`;
							chosenUserInjuryObject.wounds -= 1;
						}
						else if (userCondition.includes('wounds')) {

							userHasChangedCondition = true;
						}
					}

					if (plantMap.get(interaction.values[0]).healsInfections === true) {

						if (chosenUserInjuryObject.infections > 0) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\n-1 infection for ${chosenCharacterData.name}`;
							chosenUserInjuryObject.infections -= 1;
						}
						else if (userCondition.includes('infections')) {

							userHasChangedCondition = true;
						}
					}

					if (plantMap.get(interaction.values[0]).healsColds === true) {

						if (chosenUserInjuryObject.cold == true) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\ncold healed for ${chosenCharacterData.name}`;
							chosenUserInjuryObject.cold = false;
						}
						else if (userCondition.includes('cold')) {

							userHasChangedCondition = true;
						}
					}

					if (plantMap.get(interaction.values[0]).healsSprains === true) {

						if (chosenUserInjuryObject.sprains > 0) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\n-1 sprain for ${chosenCharacterData.name}`;
							chosenUserInjuryObject.sprains -= 1;
						}
						else if (userCondition.includes('sprains')) {

							userHasChangedCondition = true;
						}
					}

					if (plantMap.get(interaction.values[0]).healsPoison === true) {

						if (chosenUserInjuryObject.poison == true) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\npoison healed for ${chosenCharacterData.name}`;
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

							embedFooterChosenUserStatsText += `\n+${chosenUserEnergyPoints} energy for ${chosenCharacterData.name} (${chosenProfileData.energy + chosenUserEnergyPoints}/${chosenProfileData.maxEnergy})`;
						}
					}


					serverData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
						{ serverId: message.guild.id },
						(/** @type {import('../../typedef').ServerSchema} */ s) => {
							s.inventory = serverData.inventory;
						},
					));

					if (isSuccessful === true && chosenUserData.userId === userData.userId && pullFromWeightedTable({ 0: 75, 1: 25 + profileData.sapling.waterCycles }) === 0) {

						isSuccessful = false;
					}
					else if (isSuccessful === false && userHasChangedCondition === true) {

						botReply = await /** @type {import('discord.js').Message} */ (interaction.message)
							.edit({
								embeds: [...embedArray, {
									color: characterData.color,
									title: `${chosenCharacterData.name}'s stats/illnesses/injuries changed before you healed them. Please try again.`,
								}],
								components: /** @type {import('discord.js').MessageSelectMenuOptions} */ (userSelectMenu.components[0]).options.length > 0 ? [userSelectMenu] : [],
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
								return /** @type {import('discord.js').Message} */ (interaction.message);
							});

						return /** @type {import('discord.js').MessageSelectMenuOptions} */ (userSelectMenu.components[0]).options.length > 0 ? await interactionCollector() : null;
					}

					if (isSuccessful === true && chosenUserData.userId !== userData.userId && profileData.rank === 'Apprentice' && pullFromWeightedTable({ 0: 35, 1: 65 + profileData.sapling.waterCycles }) === 0) {

						isSuccessful = false;
					}

					const embedFooterStatsText = await decreaseStats(isSuccessful);
					const chosenItemName = interaction.values[0];

					if (isSuccessful === true) {

						let chosenUserHealthPoints = generateRandomNumber(10, 6);
						if (chosenProfileData.health + chosenUserHealthPoints > chosenProfileData.maxHealth) {

							chosenUserHealthPoints -= (chosenProfileData.health + chosenUserHealthPoints) - chosenProfileData.maxHealth;
						}

						chosenUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
							{ userId: chosenUserData.uuid },
							(/** @type {import('../../typedef').ProfileSchema} */ cP) => {
								cP.characters[cP.currentCharacter[message.guild.id]].profiles[message.guild.id].hunger += chosenUserHungerPoints;
								cP.characters[cP.currentCharacter[message.guild.id]].profiles[message.guild.id].energy += chosenUserEnergyPoints;
								cP.characters[cP.currentCharacter[message.guild.id]].profiles[message.guild.id].health += chosenUserHealthPoints;
								cP.characters[cP.currentCharacter[message.guild.id]].profiles[message.guild.id].injuries = chosenUserInjuryObject;
							},
						));
						chosenCharacterData = chosenUserData.characters[chosenCharacterData.name];
						chosenProfileData = chosenCharacterData.profiles[message.guild.id];

						if (chosenUserData.userId === userData.userId) {

							userInjuryObject = chosenUserInjuryObject;

							userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({
								userId: message.author.id,
								serverId: message.guild.id,
							}));

							embed.description = `*${characterData.name} takes a ${chosenItemName}. After a bit of preparation, the ${characterData.species} can apply it correctly. Immediately you can see the effect. ${upperCasePronounAndPlural(characterData, 0, 'feel')} much better!*`;
						}
						else {

							embed.description = `*${characterData.name} takes a ${chosenItemName}. After a  bit of preparation, ${pronounAndPlural(characterData, 0, 'give')} it to ${chosenCharacterData.name}. Immediately you can see the effect. ${upperCasePronounAndPlural(chosenCharacterData, 0, 'feel')} much better!*`;
						}

						embed.footer.text = `${embedFooterStatsText}\n${embedFooterChosenUserStatsText}\n+${chosenUserHealthPoints} HP for ${chosenCharacterData.name} (${chosenProfileData.health}/${chosenProfileData.maxHealth})${embedFooterChosenUserInjuryText}\n\n-1 ${chosenItemName} for ${message.guild.name}`;
					}
					else {

						if (chosenUserData.userId === userData.userId) {

							embed.description = `*${characterData.name} holds the ${chosenItemName} in ${pronoun(characterData, 2)} mouth, trying to find a way to apply it. After a few attempts, the herb breaks into little pieces, rendering it useless. Guess ${pronounAndPlural(characterData, 0, 'has', 'have')} to try again...*`;
						}
						else {

							embed.description = `*${characterData.name} takes a ${chosenItemName}. After a bit of preparation, ${pronounAndPlural(characterData, 0, 'give')} it to ${chosenCharacterData.name}. But no matter how long they wait, it does not seem to help. Looks like ${characterData.name} has to try again...*`;
						}

						embed.footer.text = `${embedFooterStatsText}\n\n-1 ${chosenItemName} for ${message.guild.name}`;
					}
				}

				/** @type {import('discord.js').MessageEmbedOptions} */
				let extraEmbed = null;

				if (chosenProfileData.injuries.cold === true && chosenUserData.userId !== userData.userId && profileData.injuries.cold === false && pullFromWeightedTable({ 0: 3, 1: 7 }) === 0) {

					healthPoints = generateRandomNumber(5, 3);

					if (profileData.health - healthPoints < 0) {

						healthPoints = profileData.health;
					}

					userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
						{ uuid: userData.uuid },
						(/** @type {import('../../typedef').ProfileSchema} */ p) => {
							p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].health -= healthPoints;
						},
					));

					userInjuryObject.cold = true;

					extraEmbed = {
						color: characterData.color,
						description: `*Suddenly, ${characterData.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${chosenCharacterData.name}, who was coughing as well. That was probably not the best idea!*`,
						footer: { text: `-${healthPoints} HP (from cold)` },
					};
				}

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.delete()
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				const content = chosenUserData.userId !== userData.userId && isSuccessful === true ? `<@!${chosenUserData.userId}>\n` : '' + (messageContent ?? '');

				botReply = await message
					.reply({
						content: content === '' ? null : content,
						embeds: [...embedArray, embed, ...extraEmbed === null ? [] : [extraEmbed]],
						failIfNotExists: false,
					})
					.catch((error) => { throw new Error(error); });

				botReply = await decreaseHealth(userData, botReply, userInjuryObject);
				botReply = await checkLevelUp(message, botReply, userData, serverData);
				await isPassedOut(message, userData, true);

				if (chosenUserData.userId !== userData.userId) { await addFriendshipPoints(message, userData, chosenUserData); }

				return;
			}
		}

		await interactionCollector();
	}

	/**
	 *
	 * @param {boolean} isSuccessful
	 * @returns {Promise<string>} footerStats
	 */
	async function decreaseStats(isSuccessful) {

		const experiencePoints = isSuccessful === false ? 0 : profileData.rank == 'Elderly' ? generateRandomNumber(41, 20) : profileData.rank == 'Healer' ? generateRandomNumber(21, 10) : generateRandomNumber(11, 5);
		const energyPoints = function(energy) { return (profileData.energy - energy < 0) ? profileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(profileData));
		const hungerPoints = await decreaseHunger(profileData);
		const thirstPoints = await decreaseThirst(profileData);

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: message.author.id },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].experience += experiencePoints;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].energy -= energyPoints;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].hunger -= hungerPoints;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].thirst -= thirstPoints;
			},
		));

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
	 * Updates `allHurtProfilesList`, then iterates through it to update the select menu and returns it.
	 * @returns {Promise<import('discord.js').MessageActionRow>}
	 */
	async function getUserSelectMenu() {

		allHurtCharactersList = {};

		const allHurtUsersList = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find(
			(/** @type {import('../../typedef').ProfileSchema} */ u) => {
				const thisServerProfiles = Object.values(u.characters).filter(c => c.profiles[message.guild.id] !== undefined).map(c => c.profiles[message.guild.id]);
				return thisServerProfiles.filter(p => {
					return p.energy === 0 || p.health === 0 || p.hunger === 0 || p.thirst === 0 || Object.values(p.injuries).filter(i => i > 0).length > 0;
				}).length > 0;
			}));

		for (const u of Object.values(allHurtUsersList)) {

			for (const c of Object.values(u.characters)) {

				const p = c.profiles[message.guild.id];
				if (p !== undefined && (p.energy === 0 || p.health === 0 || p.hunger === 0 || p.thirst === 0 || Object.values(p.injuries).filter(i => i > 0).length > 0)) {

					allHurtCharactersList[u.userId] = c;
				}
			}
		}

		const selectMenu = new MessageActionRow({
			components: [ new MessageSelectMenu({
				customId: 'heal-user-options',
				placeholder: 'Select a user to heal',
				options: [],
			})],
		});

		for (const key of Object.keys(allHurtCharactersList).slice((currentUserPage * 24))) {

			if (/** @type {import('discord.js').MessageSelectMenuOptions} */ (selectMenu.components[0]).options.length > 25) {

				// In case there are exactly 25 user options, only once a 26th option is detected, it would set the array back to 24 and add the Page Switcher.
				// Otherwise, if there are exactly 25 user options, it would split it up onto two pages unnecessarily
				/** @type {import('discord.js').MessageSelectMenuOptions} */ (selectMenu.components[0]).options.length = 24;
				/** @type {import('discord.js').MessageSelectMenuOptions} */ (selectMenu.components[0]).options.push({ label: 'Show more user options', value: 'heal_user_page', description: 'You are currently on page 1', emoji: '📋' });
			}

			/** @type {import('discord.js').MessageSelectMenuOptions} */ (selectMenu.components[0]).options.push({ label: allHurtCharactersList[key].name, value: key + ' ' + allHurtCharactersList[key].name });
		}

		return selectMenu;
	}

	/**
	 * Finds all health-related problems the selected user has, and return the messages components and embeds.
	 * @param {import('../../typedef').ProfileSchema} healUserData - The user data of the user that should be scanned.
	 * @param {string} healCharacterName - The name of the character that should be scanned.
	 * @returns { Promise<{embeds: Array<import('discord.js').MessageEmbedOptions>, components: Array<import('discord.js').MessageActionRow>}> }
	 */
	async function getWoundList(healUserData, healCharacterName) {

		const pageButtons = new MessageActionRow({
			components: [ new MessageButton({
				customId: 'healpage-1',
				label: 'Page 1',
				emoji: '🌱',
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'healpage-2',
				label: 'Page 2',
				emoji: '🍀',
				style: 'SECONDARY',
			})],
		});

		chosenUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: healUserData.uuid }));
		chosenCharacterData = chosenUserData.characters[healCharacterName];
		chosenProfileData = chosenCharacterData.profiles[message.guild.id];

		let healUserConditionText = '';

		healUserConditionText += (chosenProfileData.health <= 0) ? '\nHealth: 0' : '';
		healUserConditionText += (chosenProfileData.energy <= 0) ? '\nEnergy: 0' : '';
		healUserConditionText += (chosenProfileData.hunger <= 0) ? '\nHunger: 0' : '';
		healUserConditionText += (chosenProfileData.thirst <= 0) ? '\nThirst: 0' : '';
		healUserConditionText += (chosenProfileData.injuries.wounds > 0) ? `\nWounds: ${chosenProfileData.injuries.wounds}` : '';
		healUserConditionText += (chosenProfileData.injuries.infections > 0) ? `\nInfections: ${chosenProfileData.injuries.infections}` : '';
		healUserConditionText += (chosenProfileData.injuries.cold == true) ? '\nCold: yes' : '';
		healUserConditionText += (chosenProfileData.injuries.sprains > 0) ? `\nSprains: ${chosenProfileData.injuries.sprains}` : '';
		healUserConditionText += (chosenProfileData.injuries.poison == true) ? '\nPoison: yes' : '';

		const embed = {
			color: characterData.color,
			description: '',
			footer: { text: '' },
		};

		if (chosenUserData.userId === userData.userId) {

			embed.description = `*${chosenCharacterData.name} pushes aside the leaves acting as the entrance to the healer's den. With tired eyes ${pronounAndPlural(chosenCharacterData, 0, 'inspect')} the rows of herbs, hoping to find one that can ease ${pronoun(chosenCharacterData, 2)} pain.*`;
			embed.footer.text = `${chosenCharacterData.name}'s stats/illnesses/injuries:${healUserConditionText}`;
		}
		else if (chosenProfileData.energy <= 0 || chosenProfileData.health <= 0 || chosenProfileData.hunger <= 0 || chosenProfileData.thirst <= 0) {

			embed.description = `*${characterData.name} runs towards the pack borders, where ${chosenCharacterData.name} lies, only barely conscious. The ${profileData.rank} immediately looks for the right herbs to help the ${chosenCharacterData.species}.*`;
			embed.footer.text = `${chosenCharacterData.name}'s stats/illnesses/injuries:${healUserConditionText}`;
		}
		else if (Object.values(chosenProfileData.injuries).some(element => element > 0)) {

			embed.description = `*${chosenCharacterData.name} enters the medicine den with tired eyes.* "Please help me!" *${pronounAndPlural(chosenCharacterData, 0, 'say')}, ${pronoun(chosenCharacterData, 2)} face contorted in pain. ${characterData.name} looks up with worry.* "I'll see what I can do for you."`;
			embed.footer.text = `${chosenCharacterData.name}'s stats/illnesses/injuries:${healUserConditionText}`;
		}
		else {

			embed.description = `*${characterData.name} approaches ${chosenCharacterData.name}, desperately searching for someone to help.*\n"Do you have any injuries or illnesses you know of?" *the ${characterData.species} asks.\n${chosenCharacterData.name} shakes ${pronoun(chosenCharacterData, 2)} head.* "Not that I know of, no."\n*Disappointed, ${characterData.name} goes back to the medicine den.*`;

			return { embeds: [...embedArray, embed], components: Object.keys(allHurtCharactersList).length > 0 ? [userSelectMenu] : [] };
		}

		const { embed: embed2, selectMenu } = getFirstHealPage();

		if (embed2.fields.length === 0) { pageButtons.components[0].disabled = true; }

		const
			embeds = [...embedArray, embed, ...Object.keys(allHurtCharactersList).length > 0 ? [embed2] : []],
			components = [...Object.keys(allHurtCharactersList).length > 0 ? [userSelectMenu, pageButtons, ...selectMenu !== null ? [selectMenu] : []] : []];

		return { embeds, components };
	}

	/**
	 * Iterates through the first inventory page and returns embed and component.
	 * @returns { {embed: import('discord.js').MessageEmbedOptions, selectMenu: import('discord.js').MessageActionRow} }
	 */
	function getFirstHealPage() {

		const embed = {
			color: characterData.color,
			title: `Inventory of ${message.guild.name} - Page 1`,
			fields: [],
			footer: { text: 'Choose one of the herbs above to heal the player with it!' },
		};

		let selectMenu = new MessageActionRow({
			components: [ new MessageSelectMenu({
				customId: 'heal-options-1',
				placeholder: 'Select an item',
				options: [],
			})],
		});

		for (const [commonPlantName, commonPlantObject] of [...commonPlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

			if (serverData.inventory.commonPlants[commonPlantName] > 0) {

				embed.fields.push({ name: `${commonPlantName}: ${serverData.inventory.commonPlants[commonPlantName]}`, value: commonPlantObject.description, inline: true });
				/** @type {import('discord.js').MessageSelectMenuOptions} */ (selectMenu.components[0]).options.push({ label: commonPlantName, value: commonPlantName, description: `${serverData.inventory.commonPlants[commonPlantName]}` });
			}
		}

		if (/** @type {import('discord.js').MessageSelectMenuOptions} */ (selectMenu.components[0]).options.length === 0) { selectMenu = null; }

		return { embed, selectMenu };
	}
};