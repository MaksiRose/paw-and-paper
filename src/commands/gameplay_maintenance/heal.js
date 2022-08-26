// @ts-check
const profileModel = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const startCooldown = require('../../utils/startCooldown');
const { generateRandomNumber, pullFromWeightedTable } = require('../../utils/randomizers');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap, specialPlantsMap } = require('../../utils/itemsInfo');
const { hasCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { decreaseThirst, decreaseHunger, decreaseHealth, decreaseEnergy } = require('../../utils/checkCondition');
const { checkLevelUp } = require('../../utils/levelHandling');
const { createCommandCollector } = require('../../utils/commandCollector');
const { remindOfAttack } = require('../gameplay_primary/attack');
const { pronoun, upperCasePronounAndPlural, pronounAndPlural } = require('../../utils/getPronouns');
const { MessageActionRow, MessageSelectMenu, MessageButton, MessageEmbed } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const { addFriendshipPoints } = require('../../utils/friendshipHandling');
const isInGuild = require('../../utils/isInGuild');
const wearDownDen = require('../../utils/wearDownDen');
const { restAdvice, drinkAdvice, eatAdvice } = require('../../utils/adviceMessages').default;

module.exports.name = 'heal';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	if (!isInGuild(message)) {

		return;
	}

	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	let profileData = characterData?.profiles?.[message.guild.id];

	if (!hasCompletedAccount(message, characterData)) {

		return;
	}

	if (await isInvalid(message, userData, embedArray, [module.exports.name])) {

		return;
	}

	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	if (profileData.rank === 'Youngling') {

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

	let
		/** @type {Object<string, import('../../typedef').Quid>} */
		allHurtCharactersList = {},
		currentUserPage = 0,
		userSelectMenu = await getUserSelectMenu(message),
		chosenUserData = message.mentions.users.size > 0 ?
			/** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: message.mentions.users.first()?.id })) :
			Object.keys(allHurtCharactersList).length === 1 ?
			/** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: Object.keys(allHurtCharactersList)[0].split('_')[0] })) : null,
		chosenCharacterData = chosenUserData ? chosenUserData?.characters[
			Object.values(chosenUserData.characters).filter(c => c.profiles[message.guild.id] !== undefined).filter(c => {
				const p = c.profiles[message.guild.id];
				return p.energy === 0 || p.health === 0 || p.hunger === 0 || p.thirst === 0 || Object.values(p.injuries).filter(i => i > 0).length > 0;
			})[0]?._id || chosenUserData?.currentCharacter?.[message.guild.id] || ''
		] : null,
		chosenProfileData = chosenCharacterData != null ? chosenCharacterData?.profiles?.[message.guild.id] : null,
		/** @type {import('discord.js').Message} */
		botReply;


	if (chosenUserData == null || chosenCharacterData == null || chosenProfileData == null) {

		botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					color: characterData.color,
					description: `*${characterData.name} sits in front of the medicine den, looking if anyone needs help with injuries or illnesses.*`,
				}],
				components: Object.keys(allHurtCharactersList).length > 0 && userSelectMenu ?
					[new MessageActionRow().addComponents([userSelectMenu])] :
					[],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}
	else {

		const { embeds: woundEmbeds, components: woundComponents } = await getWoundList(chosenUserData, chosenCharacterData._id, message) ?? { embeds: undefined, components: undefined };

		botReply = await message
			.reply({
				content: messageContent,
				embeds: woundEmbeds,
				components: woundComponents,
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}


	if (!userSelectMenu) {

		return;
	}

	createCommandCollector(message.author.id, message.guild.id, botReply);
	interactionCollector(message);

	/**
	 *
	 * @param {import('discord.js').Message<true>} message
	 * @returns
	 */
	async function interactionCollector(message) {

		/** @type {import('discord.js').MessageComponentInteraction | null} } */
		const interaction = await botReply
			.awaitMessageComponent({
				filter: (i) => i.user.id === message.author.id,
				time: 120_000,
			})
			.catch(() => { return null; });

		if (interaction === null || !interaction.inCachedGuild()) {

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

			// @ts-ignore, since chosenUserData and chosenCharacterData can only be null for "heal-user-options"-select menu
			const { embeds: woundEmbeds } = await getWoundList(chosenUserData, chosenCharacterData._id, message);

			if (interaction.customId === 'healpage-1') {

				const { inventory1Embed, inventory1SelectMenu } = getFirstHealPage(message);

				woundEmbeds.splice(-1, 1, inventory1Embed);

				interaction.message.components.length = 2;
				const componentArray = interaction.message.components;

				botReply = await interaction.message
					.edit({
						embeds: woundEmbeds,
						components: inventory1SelectMenu ?
							[...componentArray, new MessageActionRow().addComponents([inventory1SelectMenu])]
							: componentArray,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return interaction.message;
					});
			}

			if (interaction.customId === 'healpage-2') {

				const embed = new MessageEmbed()
					.setColor(characterData.color)
					.setTitle(`Inventory of ${message.guild.name} - Page 2`)
					.addField('water', 'Found lots and lots of in the river that flows through the pack!', true)
					.setFooter({ text: 'Choose one of the herbs above to heal the player with it!' });

				const selectMenu = new MessageSelectMenu()
					.setCustomId('heal-options-2')
					.setPlaceholder('Select an item')
					.addOptions([{ label: 'water', value: 'water' }]);

				for (const [uncommonPlantName, uncommonPlantObject] of [...uncommonPlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

					if (serverData.inventory.uncommonPlants[uncommonPlantName] > 0) {

						embed.fields.push({ name: `${uncommonPlantName}: ${serverData.inventory.uncommonPlants[uncommonPlantName]}`, value: uncommonPlantObject.description, inline: true });
						selectMenu.addOptions([{ label: uncommonPlantName, value: uncommonPlantName, description: `${serverData.inventory.uncommonPlants[uncommonPlantName]}` }]);
					}
				}

				for (const [rarePlantName, rarePlantObject] of [...rarePlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

					if (serverData.inventory.rarePlants[rarePlantName] > 0) {

						embed.fields.push({ name: `${rarePlantName}: ${serverData.inventory.rarePlants[rarePlantName]}`, value: rarePlantObject.description, inline: true });
						selectMenu.addOptions([{ label: rarePlantName, value: rarePlantName, description: `${serverData.inventory.rarePlants[rarePlantName]}` }]);
					}
				}

				for (const [specialPlantName, specialPlantObject] of [...specialPlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

					if (serverData.inventory.specialPlants[specialPlantName] > 0) {

						embed.fields.push({ name: `${specialPlantName}: ${serverData.inventory.specialPlants[specialPlantName]}`, value: specialPlantObject.description, inline: true });
						selectMenu.addOptions({ label: specialPlantName, value: specialPlantName, description: `${serverData.inventory.specialPlants[specialPlantName]}` });
					}
				}

				woundEmbeds.splice(-1, 1, embed);

				interaction.message.components.length = 2;
				const componentArray = /** @type {import('discord.js').Message} */ (interaction.message).components;

				botReply = await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: woundEmbeds,
						components: [...componentArray, new MessageActionRow().addComponents([selectMenu])],
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

				userSelectMenu = await getUserSelectMenu(message);

				/** @type {Array<Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions>} */
				const componentArray = interaction.message.components;
				componentArray.splice(0, 1);

				if (Object.keys(allHurtCharactersList).length > 0 && userSelectMenu) { componentArray.unshift(new MessageActionRow().addComponents([userSelectMenu])); }

				botReply = await interaction.message
					.edit({ components: componentArray })
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return interaction.message;
					});
			}

			userSelectMenu = await getUserSelectMenu(message);

			/* Checking if the user input is a valid character name. If it is, it will get the character data
			and the profile data for that character. It will then get the wound list for that character and
			edit the message with the wound list. */
			if (Object.keys(allHurtCharactersList).includes(interaction.values[0])) {

				chosenUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: interaction.values[0].split('_')[0] }));
				chosenCharacterData = chosenUserData.characters[interaction.values[0].split('_')[1]];
				chosenProfileData = chosenCharacterData.profiles[message.guild.id];

				botReply = await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: (await getWoundList(chosenUserData, chosenCharacterData._id, message)).embeds,
						components: (await getWoundList(chosenUserData, chosenCharacterData._id, message)).components,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return /** @type {import('discord.js').Message} */ (interaction.message);
					});
			}

			if (commonPlantsMap.has(interaction.values[0]) || uncommonPlantsMap.has(interaction.values[0]) || rarePlantsMap.has(interaction.values[0]) || interaction.values[0] === 'water') {

				// @ts-ignore, since chosenUserData and chosenCharacterData can only be null for "heal-user-options"-select menu
				if (Object.keys(allHurtCharactersList).includes(chosenUserData.userId + '_' + chosenCharacterData._id) === false) {

					botReply = await /** @type {import('discord.js').Message} */ (interaction.message)
						.edit({
							embeds: [...embedArray, {
								color: characterData.color,
								// @ts-ignore, since chosenUserData and chosenCharacterData can only be null for "heal-user-options"-select menu
								title: `${chosenCharacterData.name} doesn't need to be healed anymore. Please select another user to heal if available.`,
							}],
							components: userSelectMenu ? [new MessageActionRow().addComponents([userSelectMenu])] : [],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
							return /** @type {import('discord.js').Message} */ (interaction.message);
						});

					return userSelectMenu ? await interactionCollector(message) : null;
				}

				// @ts-ignore, since chosenUserData and chosenCharacterData can only be null for "heal-user-options"-select menu
				chosenUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: chosenUserData.userId }));
				// @ts-ignore, since chosenUserData and chosenCharacterData can only be null for "heal-user-options"-select menu
				chosenCharacterData = chosenUserData.characters[chosenCharacterData._id];
				chosenProfileData = chosenCharacterData.profiles[message.guild.id];

				const userCondition = botReply.embeds[botReply.embeds.length - 2].footer?.text?.toLowerCase();
				let userHasChangedCondition = false;

				let healthPoints = 0;
				let userInjuryObject = { ...profileData.injuries };

				const embed = {
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					color: characterData.color,
					description: '',
					footer: { text: '' },
				};

				let isSuccessful = false;

				if (interaction.values[0] === 'water') {

					if (chosenProfileData.thirst > 0) {

						if (userCondition?.includes('thirst')) {

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
								components: userSelectMenu ? [new MessageActionRow().addComponents([userSelectMenu])] : [],
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
								return /** @type {import('discord.js').Message} */ (interaction.message);
							});

						return userSelectMenu ? await interactionCollector(message) : null;
					}

					if (isSuccessful === true && (profileData.rank === 'Apprentice' || profileData.rank === 'Hunter') && pullFromWeightedTable({ 0: profileData.rank === 'Hunter' ? 90 : 40, 1: 60 + profileData.sapling.waterCycles - await decreaseSuccessChance(message) }) === 0) {

						isSuccessful = false;
					}

					if (isSuccessful === true) {

						const embedFooterStatsText = await decreaseStats(true, message);
						const chosenUserThirstPoints = generateRandomNumber(10, 6);

						chosenUserData = (/** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
							{ uuid: chosenUserData.uuid },
							(/** @type {import('../../typedef').ProfileSchema} */ cP) => {
								// @ts-ignore, since chosenUserData and chosenCharacterData can only be null for "heal-user-options"-select menu
								cP.characters[chosenCharacterData._id].profiles[message.guild.id].thirst += chosenUserThirstPoints;
							},
						)));
						chosenCharacterData = chosenUserData.characters[chosenCharacterData._id];
						chosenProfileData = chosenCharacterData.profiles[message.guild.id];

						embed.description = `*${characterData.name} takes ${chosenCharacterData.name}'s body, drags it over to the river, and positions ${pronoun(chosenCharacterData, 2)} head right over the water. The ${chosenCharacterData.displayedSpecies || chosenCharacterData.species} sticks ${pronoun(chosenCharacterData, 2)} tongue out and slowly starts drinking. Immediately you can observe how the newfound energy flows through ${pronoun(chosenCharacterData, 2)} body.*`;
						embed.footer.text = `${embedFooterStatsText}\n\n+${chosenUserThirstPoints} thirst for ${chosenCharacterData.name} (${chosenProfileData.thirst}/${chosenProfileData.maxThirst})\n\n${await wearDownDen(serverData, 'medicine den')}`;
					}
					else {

						if (userData.userId === chosenUserData.userId) {

							embed.description = `*${characterData.name} thinks about just drinking some water, but that won't help with ${pronoun(characterData, 2)} issues...*"`;
						}
						else if (chosenProfileData.thirst > 0) {

							embed.description = `*${chosenCharacterData.name} looks at ${characterData.name} with indignation.* "Being hydrated is really not my biggest problem right now!"`;
						}
						else {

							embed.description = `*${characterData.name} takes ${chosenCharacterData.name}'s body and tries to drag it over to the river. The ${characterData.displayedSpecies || characterData.species} attempts to position the ${chosenCharacterData.displayedSpecies || chosenCharacterData.species}'s head right over the water, but every attempt fails miserably. ${upperCasePronounAndPlural(characterData, 0, 'need')} to concentrate and try again.*`;
						}

						embed.footer.text = await decreaseStats(false, message) + `\n\n${await wearDownDen(serverData, 'medicine den')}`;
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

					if (plantMap.get(interaction.values[0])?.edibality === 'e') {

						if (chosenProfileData.hunger <= 0) {

							isSuccessful = true;
						}
						else if (userCondition?.includes('hunger')) {

							userHasChangedCondition = true;
						}

						if (speciesMap.get(chosenCharacterData.species)?.diet === 'carnivore') {

							chosenUserHungerPoints = 1;
						}

						if (speciesMap.get(chosenCharacterData.species)?.diet === 'herbivore' || speciesMap.get(chosenCharacterData.species)?.diet === 'omnivore') {

							chosenUserHungerPoints = 5;
						}
					}

					if (chosenProfileData.health <= 0) {

						isSuccessful = true;
					}
					else if (userCondition?.includes('health')) {

						userHasChangedCondition = true;
					}

					if (plantMap.get(interaction.values[0])?.healsWounds === true) {

						if (chosenUserInjuryObject.wounds > 0) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\n-1 wound for ${chosenCharacterData.name}`;
							chosenUserInjuryObject.wounds -= 1;
						}
						else if (userCondition?.includes('wounds')) {

							userHasChangedCondition = true;
						}
					}

					if (plantMap.get(interaction.values[0])?.healsInfections === true) {

						if (chosenUserInjuryObject.infections > 0) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\n-1 infection for ${chosenCharacterData.name}`;
							chosenUserInjuryObject.infections -= 1;
						}
						else if (userCondition?.includes('infections')) {

							userHasChangedCondition = true;
						}
					}

					if (plantMap.get(interaction.values[0])?.healsColds === true) {

						if (chosenUserInjuryObject.cold == true) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\ncold healed for ${chosenCharacterData.name}`;
							chosenUserInjuryObject.cold = false;
						}
						else if (userCondition?.includes('cold')) {

							userHasChangedCondition = true;
						}
					}

					if (plantMap.get(interaction.values[0])?.healsSprains === true) {

						if (chosenUserInjuryObject.sprains > 0) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\n-1 sprain for ${chosenCharacterData.name}`;
							chosenUserInjuryObject.sprains -= 1;
						}
						else if (userCondition?.includes('sprains')) {

							userHasChangedCondition = true;
						}
					}

					if (plantMap.get(interaction.values[0])?.healsPoison === true) {

						if (chosenUserInjuryObject.poison == true) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\npoison healed for ${chosenCharacterData.name}`;
							chosenUserInjuryObject.poison = false;
						}
						else if (userCondition?.includes('poison')) {

							userHasChangedCondition = true;
						}
					}

					if (plantMap.get(interaction.values[0])?.givesEnergy === true) {

						if (chosenProfileData.energy <= 0) {

							isSuccessful = true;
						}

						chosenUserEnergyPoints = 30;
					}


					serverData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
						{ serverId: message.guild.id },
						(/** @type {import('../../typedef').ServerSchema} */ s) => {
							s.inventory = serverData.inventory;
						},
					));

					if (isSuccessful && chosenUserData.userId === userData.userId && pullFromWeightedTable({ 0: 75, 1: 25 + profileData.sapling.waterCycles - await decreaseSuccessChance(message) }) === 0) {

						isSuccessful = false;
					}
					else if (isSuccessful === false && userHasChangedCondition === true) {

						botReply = await /** @type {import('discord.js').Message} */ (interaction.message)
							.edit({
								embeds: [...embedArray, {
									color: characterData.color,
									title: `${chosenCharacterData.name}'s stats/illnesses/injuries changed before you healed them. Please try again.`,
								}],
								components: userSelectMenu ? [new MessageActionRow().addComponents([userSelectMenu])] : [],
							})
							.catch((error) => {
								if (error.httpStatus !== 404) { throw new Error(error); }
								return /** @type {import('discord.js').Message} */ (interaction.message);
							});

						return userSelectMenu ? await interactionCollector(message) : null;
					}

					if (isSuccessful && chosenUserData.userId !== userData.userId && (profileData.rank === 'Apprentice' || profileData.rank === 'Hunter') && pullFromWeightedTable({ 0: profileData.rank === 'Hunter' ? 90 : 40, 1: 60 + profileData.sapling.waterCycles - await decreaseSuccessChance(message) }) === 0) {

						isSuccessful = false;
					}

					const embedFooterStatsText = await decreaseStats(isSuccessful, message);
					const chosenItemName = interaction.values[0];

					if (isSuccessful === true) {

						let chosenUserHealthPoints = generateRandomNumber(10, 6);
						if (chosenProfileData.health + chosenUserHealthPoints > chosenProfileData.maxHealth) {

							chosenUserHealthPoints = chosenProfileData.maxHealth - chosenProfileData.health;
						}

						/* We do this over here rather than at the top in the if statements for edibality and givesEnergy,
						because if chosenUserData === userData, then these might not be accurate
						ie, the hunger/energy might have gone down enough in order not to decrease chosenUserHungerPoints/chosenUserEnergyPoints,
						as well as the stats not showing the correct amount based on what was lost from decreaseStats()
						in decreaseStats(), the chosenUserData, chosenCharacterData and chosenProfileData is updated to account for this */
						if (chosenProfileData.hunger + chosenUserHungerPoints > chosenProfileData.maxHunger) {

							chosenUserHungerPoints = chosenProfileData.maxHunger - chosenProfileData.hunger;
						}

						if (chosenUserHungerPoints > 0) {

							embedFooterChosenUserStatsText += `\n+${chosenUserHungerPoints} hunger for ${chosenCharacterData.name} (${chosenProfileData.hunger + chosenUserHungerPoints}/${chosenProfileData.maxHunger})`;
						}

						if (chosenProfileData.energy + chosenUserEnergyPoints > chosenProfileData.maxEnergy) {

							chosenUserEnergyPoints = chosenProfileData.maxEnergy - chosenProfileData.energy;
						}

						if (chosenUserEnergyPoints >= 1) {

							embedFooterChosenUserStatsText += `\n+${chosenUserEnergyPoints} energy for ${chosenCharacterData.name} (${chosenProfileData.energy + chosenUserEnergyPoints}/${chosenProfileData.maxEnergy})`;
						}

						chosenUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
							{ uuid: chosenUserData.uuid },
							(/** @type {import('../../typedef').ProfileSchema} */ cP) => {
								// @ts-ignore, since chosenUserData and chosenCharacterData can only be null for "heal-user-options"-select menu
								cP.characters[chosenCharacterData._id].profiles[message.guild.id].hunger += chosenUserHungerPoints;
								// @ts-ignore, since chosenUserData and chosenCharacterData can only be null for "heal-user-options"-select menu
								cP.characters[chosenCharacterData._id].profiles[message.guild.id].energy += chosenUserEnergyPoints;
								// @ts-ignore, since chosenUserData and chosenCharacterData can only be null for "heal-user-options"-select menu
								cP.characters[chosenCharacterData._id].profiles[message.guild.id].health += chosenUserHealthPoints;
								// @ts-ignore, since chosenUserData and chosenCharacterData can only be null for "heal-user-options"-select menu
								cP.characters[chosenCharacterData._id].profiles[message.guild.id].injuries = chosenUserInjuryObject;
							},
						));
						chosenCharacterData = chosenUserData.characters[chosenCharacterData._id];
						chosenProfileData = chosenCharacterData.profiles[message.guild.id];

						if (chosenUserData.userId === userData.userId) {

							userInjuryObject = chosenUserInjuryObject;

							userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: message.author.id }));

							embed.description = `*${characterData.name} takes a ${chosenItemName}. After a bit of preparation, the ${characterData.displayedSpecies || characterData.species} can apply it correctly. Immediately you can see the effect. ${upperCasePronounAndPlural(characterData, 0, 'feel')} much better!*`;
						}
						else {

							embed.description = `*${characterData.name} takes a ${chosenItemName}. After a  bit of preparation, ${pronounAndPlural(characterData, 0, 'give')} it to ${chosenCharacterData.name}. Immediately you can see the effect. ${upperCasePronounAndPlural(chosenCharacterData, 0, 'feel')} much better!*`;
						}

						embed.footer.text = `${embedFooterStatsText}\n${embedFooterChosenUserStatsText}\n+${chosenUserHealthPoints} HP for ${chosenCharacterData.name} (${chosenProfileData.health}/${chosenProfileData.maxHealth})${embedFooterChosenUserInjuryText}\n\n${await wearDownDen(serverData, 'medicine den')}\n-1 ${chosenItemName} for ${message.guild.name}`;
					}
					else {

						if (chosenUserData.userId === userData.userId) {

							embed.description = `*${characterData.name} holds the ${chosenItemName} in ${pronoun(characterData, 2)} mouth, trying to find a way to apply it. After a few attempts, the herb breaks into little pieces, rendering it useless. Guess ${pronounAndPlural(characterData, 0, 'has', 'have')} to try again...*`;
						}
						else {

							embed.description = `*${characterData.name} takes a ${chosenItemName}. After a bit of preparation, ${pronounAndPlural(characterData, 0, 'give')} it to ${chosenCharacterData.name}. But no matter how long ${pronoun(characterData, 0)} wait, it does not seem to help. Looks like ${characterData.name} has to try again...*`;
						}

						embed.footer.text = `${embedFooterStatsText}\n\n${await wearDownDen(serverData, 'medicine den')}\n-1 ${chosenItemName} for ${message.guild.name}`;
					}
				}

				/** @type {import('discord.js').MessageEmbedOptions | null} */
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
						description: `*Suddenly, ${characterData.name} starts coughing uncontrollably. Thinking back, ${pronoun(characterData, 0)} spent all day alongside ${chosenCharacterData.name}, who was coughing as well. That was probably not the best idea!*`,
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
				botReply = await checkLevelUp(message, userData, serverData, botReply) || botReply;
				await isPassedOut(message, userData.uuid, true);

				await restAdvice(message, userData);
				await drinkAdvice(message, userData);
				await eatAdvice(message, userData);

				if (chosenUserData.userId !== userData.userId) { await addFriendshipPoints(message, userData, characterData._id, chosenUserData, chosenCharacterData._id); }

				return;
			}
		}

		await interactionCollector(message);
	}

	/**
	 *
	 * @param {boolean} isSuccessful
	 * @param {import('discord.js').Message<true>} message
	 * @returns {Promise<string>} footerStats
	 */
	async function decreaseStats(isSuccessful, message) {

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
		characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
		profileData = characterData?.profiles?.[message.guild.id];

		// @ts-ignore, since chosenUserData and chosenCharacterData can only be null for "heal-user-options"-select menu
		if (chosenUserData.userId === userData.userId) {

			// @ts-ignore, since chosenUserData and chosenCharacterData can only be null for "heal-user-options"-select menu
			chosenUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: chosenUserData.userId }));
			// @ts-ignore, since chosenUserData and chosenCharacterData can only be null for "heal-user-options"-select menu
			chosenCharacterData = chosenUserData.characters[chosenCharacterData._id];
			chosenProfileData = chosenCharacterData.profiles[message.guild.id];
		}

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
	 * @param {import('discord.js').Message<true>} message
	 * @returns {Promise<import('discord.js').MessageSelectMenu | null>}
	 */
	async function getUserSelectMenu(message) {

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

					allHurtCharactersList[u.userId + '_' + c._id] = c;
				}
			}
		}

		/** @type {import('discord.js').MessageSelectMenu | null} */
		let selectMenu = new MessageSelectMenu()
			.setCustomId('heal-user-options')
			.setPlaceholder('Select a user to heal');

		for (const key of Object.keys(allHurtCharactersList).slice((currentUserPage * 24))) {

			if (selectMenu.options.length > 25) {

				// In case there are exactly 25 user options, only once a 26th option is detected, it would set the array back to 24 and add the Page Switcher.
				// Otherwise, if there are exactly 25 user options, it would split it up onto two pages unnecessarily
				selectMenu.options.length = 24;
				selectMenu.addOptions({ label: 'Show more user options', value: 'heal_user_page', description: 'You are currently on page 1', emoji: '📋' });
			}

			selectMenu.addOptions({ label: allHurtCharactersList[key].name, value: key });
		}

		if (selectMenu.options.length <= 0) { selectMenu = null; }

		return selectMenu;
	}

	/**
	 * Finds all health-related problems the selected user has, and return the messages components and embeds.
	 * @param {import('../../typedef').ProfileSchema} healUserData - The user data of the user that should be scanned.
	 * @param {string} healCharacterId - The ID of the character that should be scanned.
	 * @param {import('discord.js').Message<true>} message - The message object
	 * @returns { Promise<{embeds: Array<import('discord.js').MessageEmbed>, components: Array<import('discord.js').MessageActionRow>}> }
	 */
	async function getWoundList(healUserData, healCharacterId, message) {

		const inventoryPagesButtons = [
			new MessageButton({
				customId: 'healpage-1',
				label: 'Page 1',
				emoji: '🌱',
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'healpage-2',
				label: 'Page 2',
				emoji: '🍀',
				style: 'SECONDARY',
			}),
		];

		chosenUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: healUserData.uuid }));
		chosenCharacterData = chosenUserData?.characters[healCharacterId];
		chosenProfileData = chosenCharacterData?.profiles[message.guild.id];

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

		const characterConditionEmbed = new MessageEmbed()
			.setAuthor({ name: characterData.name, iconURL: characterData.avatarURL })
			.setColor(characterData.color);

		if (chosenUserData.userId === userData.userId) {

			characterConditionEmbed.setDescription(`*${chosenCharacterData.name} pushes aside the leaves acting as the entrance to the healer's den. With tired eyes ${pronounAndPlural(chosenCharacterData, 0, 'inspect')} the rows of herbs, hoping to find one that can ease ${pronoun(chosenCharacterData, 2)} pain.*`);
			characterConditionEmbed.setFooter({ text: `${chosenCharacterData.name}'s stats/illnesses/injuries:${healUserConditionText}` });
		}
		else if (chosenProfileData.energy <= 0 || chosenProfileData.health <= 0 || chosenProfileData.hunger <= 0 || chosenProfileData.thirst <= 0) {

			characterConditionEmbed.setDescription(`*${characterData.name} runs towards the pack borders, where ${chosenCharacterData.name} lies, only barely conscious. The ${profileData.rank} immediately looks for the right herbs to help the ${chosenCharacterData.displayedSpecies || chosenCharacterData.species}.*`);
			characterConditionEmbed.setFooter({ text: `${chosenCharacterData.name}'s stats/illnesses/injuries:${healUserConditionText}` });
		}
		else if (Object.values(chosenProfileData.injuries).some(element => element > 0)) {

			characterConditionEmbed.setDescription(`*${chosenCharacterData.name} enters the medicine den with tired eyes.* "Please help me!" *${pronounAndPlural(chosenCharacterData, 0, 'say')}, ${pronoun(chosenCharacterData, 2)} face contorted in pain. ${characterData.name} looks up with worry.* "I'll see what I can do for you."`);
			characterConditionEmbed.setFooter({ text: `${chosenCharacterData.name}'s stats/illnesses/injuries:${healUserConditionText}` });
		}
		else {

			characterConditionEmbed.setDescription(`*${characterData.name} approaches ${chosenCharacterData.name}, desperately searching for someone to help.*\n"Do you have any injuries or illnesses you know of?" *the ${characterData.displayedSpecies || characterData.species} asks.\n${chosenCharacterData.name} shakes ${pronoun(chosenCharacterData, 2)} head.* "Not that I know of, no."\n*Disappointed, ${characterData.name} goes back to the medicine den.*`);

			return { embeds: [...embedArray, characterConditionEmbed], components: Object.keys(allHurtCharactersList).length > 0 && userSelectMenu ? [new MessageActionRow().addComponents([userSelectMenu])] : [] };
		}

		const { inventory1Embed, inventory1SelectMenu } = getFirstHealPage(message);

		if (inventory1Embed.fields.length === 0) { inventoryPagesButtons[0].disabled = true; }

		const
			embeds = [...embedArray, characterConditionEmbed, ...Object.keys(allHurtCharactersList).length > 0 ? [inventory1Embed] : []],
			components = [...Object.keys(allHurtCharactersList).length > 0 ?
				[
					...(userSelectMenu ? [new MessageActionRow().addComponents([userSelectMenu])] : []),
					new MessageActionRow().addComponents(inventoryPagesButtons),
					...(inventory1SelectMenu ? [new MessageActionRow().addComponents([inventory1SelectMenu])] : []),
				]
				: [],
			];

		return { embeds, components };
	}

	/**
	 * Iterates through the first inventory page and returns embed and component.
	 * @param {import('discord.js').Message<true>} message - The message object
	 * @returns { {inventory1Embed: import('discord.js').MessageEmbed, inventory1SelectMenu: import('discord.js').MessageSelectMenu | null} }
	 */
	function getFirstHealPage(message) {

		const inventory1Embed = new MessageEmbed()
			.setColor(characterData.color)
			.setTitle(`Inventory of ${message.guild.name} - Page 1`)
			.setFooter({ text: 'Choose one of the herbs above to heal the player with it!' });

		/** @type {import('discord.js').MessageSelectMenu | null} */
		let inventory1SelectMenu = new MessageSelectMenu()
			.setCustomId('heal-options-1')
			.setPlaceholder('Select an item');

		for (const [commonPlantName, commonPlantObject] of [...commonPlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

			if (serverData.inventory.commonPlants[commonPlantName] > 0) {

				inventory1Embed.addField(`${commonPlantName}: ${serverData.inventory.commonPlants[commonPlantName]}`, commonPlantObject.description, true);
				inventory1SelectMenu.addOptions({ label: commonPlantName, value: commonPlantName, description: `${serverData.inventory.commonPlants[commonPlantName]}` });
			}
		}

		if (inventory1SelectMenu.options.length === 0) { inventory1SelectMenu = null; }

		return { inventory1Embed, inventory1SelectMenu };
	}
};

/**
 * It takes a message object and returns a number that represents the decreased success chance of a den
 * @param {import('discord.js').Message} message - The message object that was sent.
 * @returns {Promise<number>} the decreased success chance of the den.
 */
async function decreaseSuccessChance(message) {

	const serverData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOne({
		serverId: message.guild?.id,
	}));

	const denStats = serverData.dens.medicineDen.structure + serverData.dens.medicineDen.bedding + serverData.dens.medicineDen.thickness + serverData.dens.medicineDen.evenness;
	const multiplier = denStats / 400;
	return 20 - Math.round(20 * multiplier);
}