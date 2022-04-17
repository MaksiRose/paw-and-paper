// @ts-check
const { profileModel } = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const startCooldown = require('../../utils/startCooldown');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../../utils/itemsInfo');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { createCommandCollector } = require('../../utils/commandCollector');
const { remindOfAttack } = require('../gameplay/attack');
const { pronoun, upperCasePronounAndPlural } = require('../../utils/getPronouns');
const { generateRandomNumber } = require('../../utils/randomizers');
const blockEntrance = require('../../utils/blockEntrance');

module.exports.name = 'store';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData, serverData, embedArray) => {

	if (await hasNotCompletedAccount(message, profileData)) {

		return;
	}

	if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

		return;
	}

	profileData = await startCooldown(message, profileData);
	const messageContent = remindOfAttack(message);

	const userInventory = {
		commonPlants: { ...profileData.inventoryObject.commonPlants },
		uncommonPlants: { ...profileData.inventoryObject.uncommonPlants },
		rarePlants: { ...profileData.inventoryObject.rarePlants },
		meat: { ...profileData.inventoryObject.meat },
	};

	const serverInventory = {
		commonPlants: { ...serverData.inventoryObject.commonPlants },
		uncommonPlants: { ...serverData.inventoryObject.uncommonPlants },
		rarePlants: { ...serverData.inventoryObject.rarePlants },
		meat: { ...serverData.inventoryObject.meat },
	};

	const inventoryMap = new Map([
		['commonPlants', [...commonPlantsMap.keys()].sort()],
		['uncommonPlants', [...uncommonPlantsMap.keys()].sort()],
		['rarePlants', [...rarePlantsMap.keys()].sort()],
		['meat', [...speciesMap.keys()].sort()],
	]);

	/** @type {Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions} */
	const itemSelectMenu = {
		type: 'ACTION_ROW',
		components: [{
			type: 'SELECT_MENU',
			customId: 'store-options',
			placeholder: 'Select an item to store away',
			options: [],
		}],
	};

	for (const [itemType, itemsArray] of inventoryMap) {

		for (const itemName of itemsArray) {

			if (profileData.inventoryObject[itemType][itemName] > 0) {

				/** @type {import('discord.js').MessageSelectMenuOptions} */ (itemSelectMenu.components[0]).options.push({ label: itemName, value: itemName, description: `${profileData.inventoryObject[itemType][itemName]}` });
			}
		}
	}

	/** @type {Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions} */
	const storeAllButton = {
		type: 'ACTION_ROW',
		components: [{
			type: 'BUTTON',
			customId: 'store-all',
			label: 'Store everything',
			style: 'SUCCESS',
		}],
	};

	if (/** @type {import('discord.js').MessageSelectMenuOptions} */ (itemSelectMenu.components[0]).options.length === 0) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} goes to the food den to store food away, but ${pronoun(profileData, 2)} mouth is empty...*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (serverData.blockedEntranceObject.den === 'food den' || (profileData.rank !== 'Youngling' && serverData.blockedEntranceObject.den === null && generateRandomNumber(20, 0) === 0)) {

		await blockEntrance(message, messageContent, profileData, serverData, 'food den');
		return;
	}

	const botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} wanders to the food den, ready to store away ${pronoun(profileData, 2)} findings. ${upperCasePronounAndPlural(profileData, 0, 'circle')} the food pile…*`,
				footer: { text: '' },
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
			.awaitMessageComponent({ filter, time: 30000 })
			.catch(() => { return null;});

		if (interaction == null) {

			return await botReply
				.edit({
					components: [],
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
						maximumAmount = profileData.inventoryObject[itemType][chosenFood];
					}
				}

				/** @type {Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions} */
				const amountSelectMenu = {
					type: 'ACTION_ROW',
					components: [{
						type: 'SELECT_MENU',
						customId: 'store-amount',
						placeholder: 'Select the amount to store away',
						options: [],
					}],
				};

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

				profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{ $set: { inventoryObject: userInventory } },
				));

				await serverModel.findOneAndUpdate(
					{ serverId: message.guild.id },
					{ $set: { inventoryObject: serverInventory } },
				);

				/** @type {import('discord.js').MessageSelectMenuOptions} */ (itemSelectMenu.components[0]).options = [];
				for (const [itemType, itemsArray] of inventoryMap) {

					for (const itemName of itemsArray) {

						if (profileData.inventoryObject[itemType][itemName] > 0) {

							/** @type {import('discord.js').MessageSelectMenuOptions} */ (itemSelectMenu.components[0]).options.push({ label: itemName, value: itemName, description: `${profileData.inventoryObject[itemType][itemName]}` });
						}
					}
				}

				let footerText = interaction.message.embeds[interaction.message.embeds.length - 1].footer?.text ?? '';
				footerText += `+${chosenAmount} ${chosenFood} for ${message.guild.name}\n`;
				interaction.message.embeds[interaction.message.embeds.length - 1].footer = { text: footerText };

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: interaction.message.embeds,
						components: /** @type {import('discord.js').MessageSelectMenuOptions} */ (itemSelectMenu.components[0]).options.length === 0 ? [] : [itemSelectMenu, storeAllButton],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});

				/** @type {import('discord.js').MessageSelectMenuOptions} */ (itemSelectMenu.components[0]).options.length > 0 && await interactionCollector(null, null);
				return;
			}
		}

		if (interaction.isButton() && interaction.customId === 'store-all') {

			profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({
				userId: message.author.id,
				serverId: message.guild.id,
			}));

			let footerText = interaction.message.embeds[interaction.message.embeds.length - 1].footer?.text ?? '';
			let maximumAmount = 0;

			for (const [itemType, itemsArray] of inventoryMap) {

				for (const itemName of itemsArray) {

					if (profileData.inventoryObject[itemType][itemName] > 0) {

						maximumAmount = profileData.inventoryObject[itemType][itemName];

						footerText += `+${maximumAmount} ${itemName} for ${message.guild.name}\n`;
						userInventory[itemType][itemName] -= maximumAmount;
						serverInventory[itemType][itemName] += maximumAmount;
					}
				}
			}

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { inventoryObject: userInventory } },
			);

			await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { inventoryObject: serverInventory } },
			);

			interaction.message.embeds[interaction.message.embeds.length - 1].footer = { text: footerText };
			await /** @type {import('discord.js').Message} */ (interaction.message)
				.edit({
					embeds: interaction.message.embeds,
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			return;
		}
	}
};