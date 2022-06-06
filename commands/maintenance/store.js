// @ts-check
const profileModel = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const startCooldown = require('../../utils/startCooldown');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../../utils/itemsInfo');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { createCommandCollector } = require('../../utils/commandCollector');
const { remindOfAttack } = require('../gameplay/attack');
const { pronoun, upperCasePronounAndPlural } = require('../../utils/getPronouns');
const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const sendNoDM = require('../../utils/sendNoDM');

module.exports.name = 'store';

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

	if (await sendNoDM(message)) {

		return;
	}

	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	let profileData = characterData?.profiles?.[message.guild.id];

	if (await hasNotCompletedAccount(message, characterData)) {

		return;
	}

	if (await isInvalid(message, userData, embedArray, [module.exports.name])) {

		return;
	}

	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	const userInventory = {
		commonPlants: { ...profileData.inventory.commonPlants },
		uncommonPlants: { ...profileData.inventory.uncommonPlants },
		rarePlants: { ...profileData.inventory.rarePlants },
		meat: { ...profileData.inventory.meat },
		materials: { ...profileData.inventory.materials },
	};

	const serverInventory = {
		commonPlants: { ...serverData.inventory.commonPlants },
		uncommonPlants: { ...serverData.inventory.uncommonPlants },
		rarePlants: { ...serverData.inventory.rarePlants },
		meat: { ...serverData.inventory.meat },
		materials: { ...serverData.inventory.materials },
	};

	const inventoryMap = new Map([
		['commonPlants', [...commonPlantsMap.keys()].sort()],
		['uncommonPlants', [...uncommonPlantsMap.keys()].sort()],
		['rarePlants', [...rarePlantsMap.keys()].sort()],
		['meat', [...speciesMap.keys()].sort()],
	]);

	const itemSelectMenu = new MessageActionRow().addComponents(
		[ new MessageSelectMenu({
			customId: 'store-options',
			placeholder: 'Select an item to store away',
			options: [],
		})],
	);

	for (const [itemType, itemsArray] of inventoryMap) {

		for (const itemName of itemsArray) {

			if (profileData.inventory[itemType][itemName] > 0) {

				/** @type {import('discord.js').MessageSelectMenuOptions} */ (itemSelectMenu.components[0]).options.push({ label: itemName, value: itemName, description: `${profileData.inventory[itemType][itemName]}` });
			}
		}
	}

	const storeAllButton = new MessageActionRow({
		components: [ new MessageButton({
			customId: 'store-all',
			label: 'Store everything',
			style: 'SUCCESS',
		})],
	});

	if (/** @type {import('discord.js').MessageSelectMenuOptions} */ (itemSelectMenu.components[0]).options.length === 0) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} goes to the food den to store food away, but ${pronoun(characterData, 2)} mouth is empty...*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (argumentsArray[0] === 'all' || argumentsArray[0] === 'everything') {

		let footerText = '';
		let maximumAmount = 0;

		for (const [itemType, itemsArray] of inventoryMap) {

			for (const itemName of itemsArray) {

				if (profileData.inventory[itemType][itemName] > 0) {

					maximumAmount = profileData.inventory[itemType][itemName];

					footerText += `+${maximumAmount} ${itemName} for ${message.guild.name}\n`;
					userInventory[itemType][itemName] -= maximumAmount;
					serverInventory[itemType][itemName] += maximumAmount;
				}
			}
		}

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].inventory = userInventory;
			},
		));
		characterData = userData.characters[userData.currentCharacter[message.guild.id]];
		profileData = characterData.profiles[message.guild.id];

		await serverModel.findOneAndUpdate(
			{ serverId: message.guild.id },
			(/** @type {import('../../typedef').ServerSchema} */ s) => {
				s.inventory = serverInventory;
			},
		);

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} wanders to the food den, ready to store away ${pronoun(characterData, 2)} findings. ${upperCasePronounAndPlural(characterData, 0, 'circle')} the food pile…*`,
					footer: { text: footerText },
				}],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	const botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*${characterData.name} wanders to the food den, ready to store away ${pronoun(characterData, 2)} findings. ${upperCasePronounAndPlural(characterData, 0, 'circle')} the food pile…*`,
			}],
			components: [.../** @type {import('discord.js').MessageSelectMenuOptions} */ (itemSelectMenu.components[0]).options.length > 25 ? [] : [itemSelectMenu], storeAllButton],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild.id, botReply);
	interactionCollector(null, null);

	/**
	 *
	 * @param {string | null} chosenFood
	 * @param {string | null} foodCategory
	 * @returns
	 */
	async function interactionCollector(chosenFood, foodCategory) {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.user.id == message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} } */
		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 30_000 })
			.catch(() => { return null;});

		if (interaction == null) {

			return await botReply
				.edit({
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		if (interaction.isSelectMenu()) {

			if (interaction.customId === 'store-options') {

				/** @type {string} */
				chosenFood = interaction.values[0];
				let maximumAmount = 0;

				for (const [itemType, itemsArray] of inventoryMap) {

					if (itemsArray.includes(chosenFood)) {

						foodCategory = itemType;
						maximumAmount = profileData.inventory[itemType][chosenFood];
					}
				}

				const amountSelectMenu = new MessageActionRow().addComponents(
					[ new MessageSelectMenu({
						customId: 'store-amount',
						placeholder: 'Select the amount to store away',
						options: [],
					})],
				);

				for (let i = 0; i < maximumAmount; i++) {

					/** @type {import('discord.js').MessageSelectMenuOptions} */ (amountSelectMenu.components[0]).options.push({ label: `${i + 1}`, value: `${i + 1}` });
				}

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						components: [itemSelectMenu, amountSelectMenu],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});

				return await interactionCollector(chosenFood, foodCategory);
			}

			if (interaction.customId === 'store-amount') {

				const chosenAmount = parseInt(interaction.values[0], 10);
				userInventory[foodCategory][chosenFood] -= chosenAmount;
				serverInventory[foodCategory][chosenFood] += chosenAmount;

				userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
					{ uuid: userData.uuid },
					(/** @type {import('../../typedef').ProfileSchema} */ p) => {
						p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].inventory = userInventory;
					},
				));
				characterData = userData.characters[userData.currentCharacter[message.guild.id]];
				profileData = characterData.profiles[message.guild.id];

				await serverModel.findOneAndUpdate(
					{ serverId: message.guild.id },
					(/** @type {import('../../typedef').ServerSchema} */ s) => {
						s.inventory = serverInventory;
					},
				);

				/** @type {import('discord.js').MessageSelectMenuOptions} */ (itemSelectMenu.components[0]).options = [];
				for (const [itemType, itemsArray] of inventoryMap) {

					for (const itemName of itemsArray) {

						if (profileData.inventory[itemType][itemName] > 0) {

							/** @type {import('discord.js').MessageSelectMenuOptions} */ (itemSelectMenu.components[0]).options.push({ label: itemName, value: itemName, description: `${profileData.inventory[itemType][itemName]}` });
						}
					}
				}

				let footerText = interaction.message.embeds[interaction.message.embeds.length - 1].footer?.text ?? '';
				footerText += `\n+${chosenAmount} ${chosenFood} for ${message.guild.name}`;
				interaction.message.embeds[interaction.message.embeds.length - 1].footer = { text: footerText };

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: interaction.message.embeds,
						components: /** @type {import('discord.js').MessageSelectMenuOptions} */ (itemSelectMenu.components[0]).options.length === 0 ? disableAllComponents(/** @type {import('discord.js').Message} */ (interaction.message).components) : [itemSelectMenu, storeAllButton],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});

				/** @type {import('discord.js').MessageSelectMenuOptions} */ (itemSelectMenu.components[0]).options.length > 0 && await interactionCollector(null, null);
				return;
			}
		}

		if (interaction.isButton() && interaction.customId === 'store-all') {

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: userData.uuid }));
			characterData = userData.characters[userData.currentCharacter[message.guild.id]];
			profileData = characterData.profiles[message.guild.id];

			let footerText = interaction.message.embeds[interaction.message.embeds.length - 1].footer?.text ?? '';
			let maximumAmount = 0;

			for (const [itemType, itemsArray] of inventoryMap) {

				for (const itemName of itemsArray) {

					if (profileData.inventory[itemType][itemName] > 0) {

						maximumAmount = profileData.inventory[itemType][itemName];

						footerText += `+${maximumAmount} ${itemName} for ${message.guild.name}\n`;
						userInventory[itemType][itemName] -= maximumAmount;
						serverInventory[itemType][itemName] += maximumAmount;
					}
				}
			}

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ uuid: userData.uuid },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].inventory = userInventory;
				},
			));
			characterData = userData.characters[userData.currentCharacter[message.guild.id]];
			profileData = characterData.profiles[message.guild.id];

			await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				(/** @type {import('../../typedef').ServerSchema} */ s) => {
					s.inventory = serverInventory;
				},
			);

			interaction.message.embeds[interaction.message.embeds.length - 1].footer = { text: footerText };
			await /** @type {import('discord.js').Message} */ (interaction.message)
				.edit({
					embeds: interaction.message.embeds,
					components: disableAllComponents(/** @type {import('discord.js').Message} */ (interaction.message).components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			return;
		}
	}
};