// @ts-check
const { default_color, prefix } = require('../../config.json');
const startCooldown = require('../../utils/startCooldown');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../../utils/itemsInfo');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { hasCooldown } = require('../../utils/checkValidity');
const { createCommandCollector } = require('../../utils/commandCollector');
const { remindOfAttack } = require('../gameplay/attack');
const { generateRandomNumber } = require('../../utils/randomizers');
const blockEntrance = require('../../utils/blockEntrance');
const { execute } = require('../../events/messageCreate');

module.exports.name = 'inventory';
module.exports.aliases = ['storage', 'i'];

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

	if (await hasCooldown(message, profileData, [module.exports.name].concat(module.exports.aliases))) {

		return;
	}

	profileData = await startCooldown(message, profileData);
	const messageContent = remindOfAttack(message);

	if ((profileData.rank !== 'Youngling' && serverData.blockedEntranceObject.den === null && generateRandomNumber(20, 0) === 0) || serverData.blockedEntranceObject.den === 'food den') {

		await blockEntrance(message, messageContent, profileData, serverData, 'food den');
		return;
	}

	/** @type {Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions} */
	const inventorySelectMenu = {
		type: 'ACTION_ROW',
		components: [{
			type: 'SELECT_MENU',
			customId: 'inventory-page',
			placeholder: 'Select a page',
			options: [
				{ label: 'Page 1', value: 'inventory_page1', description: 'common herbs', emoji: '🌱' },
				{ label: 'Page 2', value: 'inventory_page2', description: 'uncommon & rare herbs', emoji: '🍀' },
				{ label: 'Page 3', value: 'inventory_page3', description: 'meat', emoji: '🥩' },
			],
		}],
	};

	/** @type {Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions} */
	const foodSelectMenu = {
		type: 'ACTION_ROW',
		components: [{
			type: 'SELECT_MENU',
			customId: 'eat-options',
			placeholder: 'Select an item to eat',
			options: [],
		}],
	};

	/** @type {import('discord.js').MessageEmbedOptions} */
	let embed = {
		color: /** @type {`#${string}`} */ (default_color),
		author: { name: message.guild.name, icon_url: message.guild.iconURL() },
		title: `Inventory of ${message.guild.name} - Page 1`,
		fields: [],
	};

	for (const [commonPlantName, commonPlantObject] of [...commonPlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

		if (serverData.inventoryObject.commonPlants[commonPlantName] > 0) {

			embed.fields.push({ name: `${commonPlantName}: ${serverData.inventoryObject.commonPlants[commonPlantName]}`, value: commonPlantObject.description, inline: true });
			/** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.push({ label: commonPlantName, value: commonPlantName, description: `${serverData.inventoryObject.commonPlants[commonPlantName]}` });
		}
	}

	const botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, embed],
			components: [inventorySelectMenu, ...profileData.hunger < profileData.maxHunger && /** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.length > 0 ? [foodSelectMenu] : []],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	let currentPage = 0;


	createCommandCollector(message.author.id, message.guild.id, botReply);
	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.user.id == message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} } */
		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 120000 })
			.catch(() => { return null; });

		if (interaction === null) {

			return await botReply
				.edit({
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		/** @type {Array<(Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions) | import('discord.js').MessageActionRow>} */
		const messageComponentArray = [];
		/** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options = [];

		if (interaction.isSelectMenu() && interaction.customId === 'inventory-page') {

			for (const row of /** @type {import('discord.js').Message} */ (interaction.message).components) {

				if (row.components[0].customId == interaction.customId) {

					messageComponentArray.push(row);
				}
			}

			if (interaction.values[0] == 'inventory_page1') {

				embed = {
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: interaction.guild.name, icon_url: interaction.guild.iconURL() },
					title: `Inventory of ${interaction.guild.name} - Page 1`,
					fields: [],
				};

				for (const [commonPlantName, commonPlantObject] of [...commonPlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

					if (serverData.inventoryObject.commonPlants[commonPlantName] > 0) {

						embed.fields.push({ name: `${commonPlantName}: ${serverData.inventoryObject.commonPlants[commonPlantName]}`, value: commonPlantObject.description, inline: true });
						/** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.push({ label: commonPlantName, value: commonPlantName, description: `${serverData.inventoryObject.commonPlants[commonPlantName]}` });
					}
				}

				if (profileData.hunger < profileData.maxHunger && /** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.length > 0) {

					messageComponentArray.push(foodSelectMenu);
				}

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: [...embedArray, embed],
						components: messageComponentArray,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}

			if (interaction.values[0] === 'inventory_page2') {

				embed = {
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: interaction.guild.name, icon_url: interaction.guild.iconURL() },
					title: `Inventory of ${interaction.guild.name} - Page 2`,
					fields: [],
				};

				for (const [uncommonPlantName, uncommonPlantObject] of [...uncommonPlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

					if (serverData.inventoryObject.uncommonPlants[uncommonPlantName] > 0) {

						embed.fields.push({ name: `${uncommonPlantName}: ${serverData.inventoryObject.uncommonPlants[uncommonPlantName]}`, value: uncommonPlantObject.description, inline: true });
						/** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.push({ label: uncommonPlantName, value: uncommonPlantName, description: `${serverData.inventoryObject.uncommonPlants[uncommonPlantName]}` });
					}
				}

				for (const [rarePlantName, rarePlantObject] of [...rarePlantsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

					if (serverData.inventoryObject.rarePlants[rarePlantName] > 0) {

						embed.fields.push({ name: `${rarePlantName}: ${serverData.inventoryObject.rarePlants[rarePlantName]}`, value: rarePlantObject.description, inline: true });
						/** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.push({ label: rarePlantName, value: rarePlantName, description: `${serverData.inventoryObject.rarePlants[rarePlantName]}` });
					}
				}

				embedArray.splice(-1, 1, embed);

				if (profileData.hunger < profileData.maxHunger && /** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.length > 0) {

					messageComponentArray.push(foodSelectMenu);
				}

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: embedArray,
						components: messageComponentArray,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}

			if (interaction.values[0] === 'inventory_page3') {

				embed = {
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: interaction.guild.name, icon_url: interaction.guild.iconURL() },
					title: `Inventory of ${interaction.guild.name} - Page 3`,
					fields: [],
				};

				for (const [speciesName] of [...speciesMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

					if (serverData.inventoryObject.meat[speciesName] > 0) {

						embed.fields.push({ name: `${speciesName}:`, value: `${serverData.inventoryObject.meat[speciesName]}`, inline: true });
						/** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.push({ label: speciesName, value: speciesName, description: `${serverData.inventoryObject.meat[speciesName]}` });
					}
				}

				if (embed.fields.length > 25 || /** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.length > 25) {

					embed.fields.length = 24;
					/** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.length = 24;

					embed.title = `Inventory of ${interaction.guild.name} - Page 3.1`;
					/** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.push({ label: 'Show more meat options', value: 'inventory_meat_page', description: 'You are currently on page 1', emoji: '📋' });
				}

				embedArray.splice(-1, 1, embed);

				if (profileData.hunger < profileData.maxHunger && /** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.length > 0) {

					messageComponentArray.push(foodSelectMenu);
				}

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: embedArray,
						components: messageComponentArray,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}
		}

		if (interaction.isSelectMenu() && interaction.customId === 'eat-options') {

			if (interaction.values[0] === 'inventory_meat_page') {

				let serverMeatOptionsAmount = 0;

				for (const meatAmount of Object.values(serverData.inventoryObject.meat)) {

					if (meatAmount > 0) {

						serverMeatOptionsAmount += 1;
					}
				}

				const pagesAmount = Math.ceil(serverMeatOptionsAmount / 24);

				currentPage += 1;
				if (currentPage >= pagesAmount) {

					currentPage = 0;
				}

				embed = {
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: interaction.guild.name, icon_url: interaction.guild.iconURL() },
					title: `Inventory of ${interaction.guild.name} - Page 3.${currentPage + 1}`,
					fields: [],
				};

				for (const [speciesName] of speciesMap) {

					if (serverData.inventoryObject.meat[speciesName] > 0) {

						embed.fields.push({ name: `${speciesName}:`, value: `${serverData.inventoryObject.meat[speciesName]}`, inline: true });
						/** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.push({ label: speciesName, value: speciesName, description: `${serverData.inventoryObject.meat[speciesName]}` });
					}
				}

				embed.fields.splice(0, pagesAmount * 24);
				/** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.splice(0, pagesAmount * 24);

				// this is length > 24 rather than length > 25 because a page switcher is now a definite part
				if (embed.fields.length > 24 || /** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.length > 24) {

					embed.fields.length = 24;
					/** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.length = 24;
				}

				/** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.push({ label: 'Show more meat options', value: 'inventory_meat_page', description: 'You are currently on page 1', emoji: '📋' });
				embedArray.splice(-1, 1, embed);

				if (profileData.hunger < profileData.maxHunger && /** @type {import('discord.js').MessageSelectMenuOptions} */ (foodSelectMenu.components[0]).options.length > 0) {

					messageComponentArray.push(foodSelectMenu);
				}

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: embedArray,
						components: messageComponentArray,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}

			const plantNamesArray = [...commonPlantsMap.keys(), ...uncommonPlantsMap.keys(), ...rarePlantsMap.keys(), ...speciesMap.keys() ].sort();

			if (interaction.customId === 'eat-options' && plantNamesArray.some(elem => elem === interaction.values[0])) {

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.delete()
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				message.content = `${prefix}eat ${interaction.values[0]}`;

				return await execute(client, message);
			}
		}

		return await interactionCollector();
	}
};