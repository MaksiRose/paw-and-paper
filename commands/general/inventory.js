const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const maps = require('../../utils/maps');
const config = require('../../config.json');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'inventory',
	aliases: ['storage'],
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.hasCooldown(message, profileData, [module.exports.name].concat(module.exports.aliases))) {

			return;
		}

		profileData = await startCooldown(message, profileData);

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

		const foodSelectMenu = {
			type: 'ACTION_ROW',
			components: [{
				type: 'SELECT_MENU',
				customId: 'eat-options',
				placeholder: 'Select an item to eat',
				options: [],
			}],
		};

		let embed = {
			color: config.default_color,
			author: { name: message.guild.name, icon_url: message.guild.iconURL() },
			title: `Inventory of ${message.guild.name} - Page 1`,
			fields: [],
		};

		for (const [commonPlantName, commonPlantObject] of maps.commonPlantMap) {

			if (serverData.inventoryObject.commonPlants[commonPlantName] > 0) {

				embed.fields.push({ name: `${commonPlantName}: ${serverData.inventoryObject.commonPlants[commonPlantName]}`, value: commonPlantObject.description, inline: true });
				foodSelectMenu.components[0].options.push({ label: commonPlantName, value: commonPlantName, description: `${serverData.inventoryObject.commonPlants[commonPlantName]}` });
			}
		}

		embedArray.push(embed);
		const componentArray = [inventorySelectMenu];

		if (profileData.hunger < profileData.maxHunger && foodSelectMenu.components[0].options.length > 0) {

			componentArray.push(foodSelectMenu);
		}

		const botReply = await message
			.reply({
				embeds: embedArray,
				components: componentArray,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		let currentPage = 0;


		client.on('messageCreate', async function removeInventoryComponents(newMessage) {

			if (!botReply || newMessage.author.id != message.author.id || !newMessage.content.toLowerCase().startsWith(config.prefix)) {

				return;
			}

			await botReply
				.edit({
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			return client.off('messageCreate', removeInventoryComponents);
		});

		await interactionCollector();

		async function interactionCollector() {

			async function filter(i) {

				if (!i.message.reference || !i.message.reference.messageId) {

					return false;
				}

				const userMessage = await i.channel.messages
					.fetch(i.message.reference.messageId)
					.catch((error) => {
						throw new Error(error);
					});

				return userMessage.id == message.id && i.user.id == message.author.id;
			}

			const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 120000 });
			collector.on('end', async (collected) => {

				if (!collected.size) {

					return await botReply
						.edit({
							components: [],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}

				const interaction = collected.first();
				const messageComponentArray = [];
				foodSelectMenu.components[0].options = [];

				if (interaction.customId == 'inventory-page') {

					for (const row of interaction.message.components) {

						if (row.components[0].customId == interaction.customId) {

							messageComponentArray.push(row);
						}
					}

					if (interaction.values[0] == 'inventory_page1') {

						embed = {
							color: config.default_color,
							author: { name: interaction.guild.name, icon_url: interaction.guild.iconURL() },
							title: `Inventory of ${interaction.guild.name} - Page 1`,
							fields: [],
						};

						for (const [commonPlantName, commonPlantObject] of maps.commonPlantMap) {

							if (serverData.inventoryObject.commonPlants[commonPlantName] > 0) {

								embed.fields.push({ name: `${commonPlantName}: ${serverData.inventoryObject.commonPlants[commonPlantName]}`, value: commonPlantObject.description, inline: true });
								foodSelectMenu.components[0].options.push({ label: commonPlantName, value: commonPlantName, description: `${serverData.inventoryObject.commonPlants[commonPlantName]}` });
							}
						}

						embedArray.splice(-1, 1, embed);

						if (profileData.hunger < profileData.maxHunger && foodSelectMenu.components[0].options.length > 0) {

							messageComponentArray.push(foodSelectMenu);
						}

						await interaction.message
							.edit({
								embeds: embedArray,
								components: messageComponentArray,
							})
							.catch((error) => {
								if (error.httpStatus !== 404) {
									throw new Error(error);
								}
							});
					}

					if (interaction.values[0] == 'inventory_page2') {

						embed = {
							color: config.default_color,
							author: { name: interaction.guild.name, icon_url: interaction.guild.iconURL() },
							title: `Inventory of ${interaction.guild.name} - Page 2`,
							fields: [],
						};

						for (const [uncommonPlantName, uncommonPlantObject] of maps.uncommonPlantMap) {

							if (serverData.inventoryObject.uncommonPlants[uncommonPlantName] > 0) {

								embed.fields.push({ name: `${uncommonPlantName}: ${serverData.inventoryObject.uncommonPlants[uncommonPlantName]}`, value: uncommonPlantObject.description, inline: true });
								foodSelectMenu.components[0].options.push({ label: uncommonPlantName, value: uncommonPlantName, description: `${serverData.inventoryObject.uncommonPlants[uncommonPlantName]}` });
							}
						}

						for (const [rarePlantName, rarePlantObject] of maps.rarePlantMap) {

							if (serverData.inventoryObject.rarePlants[rarePlantName] > 0) {

								embed.fields.push({ name: `${rarePlantName}: ${serverData.inventoryObject.rarePlants[rarePlantName]}`, value: rarePlantObject.description, inline: true });
								foodSelectMenu.components[0].options.push({ label: rarePlantName, value: rarePlantName, description: `${serverData.inventoryObject.rarePlants[rarePlantName]}` });
							}
						}

						embedArray.splice(-1, 1, embed);

						if (profileData.hunger < profileData.maxHunger && foodSelectMenu.components[0].options.length > 0) {

							messageComponentArray.push(foodSelectMenu);
						}

						await interaction.message
							.edit({
								embeds: embedArray,
								components: messageComponentArray,
							})
							.catch((error) => {
								if (error.httpStatus !== 404) {
									throw new Error(error);
								}
							});
					}

					if (interaction.values[0] == 'inventory_page3') {

						embed = {
							color: config.default_color,
							author: { name: interaction.guild.name, icon_url: interaction.guild.iconURL() },
							title: `Inventory of ${interaction.guild.name} - Page 3`,
							fields: [],
						};

						for (const [speciesName] of maps.speciesMap) {

							if (serverData.inventoryObject.meat[speciesName] > 0) {

								embed.fields.push({ name: `${speciesName}:`, value: `${serverData.inventoryObject.meat[speciesName]}`, inline: true });
								foodSelectMenu.components[0].options.push({ label: speciesName, value: speciesName, description: `${serverData.inventoryObject.meat[speciesName]}` });
							}
						}

						if (embed.fields.length > 25 || foodSelectMenu.components[0].options.length > 25) {

							embed.fields.length = 24;
							foodSelectMenu.components[0].options.length = 24;

							embed.title = `Inventory of ${interaction.guild.name} - Page 3.1`;
							foodSelectMenu.components[0].options.push({ label: 'Show more meat options', value: 'inventory_meat_page', description: 'You are currently on page 1', emoji: '📋' });
						}

						embedArray.splice(-1, 1, embed);

						if (profileData.hunger < profileData.maxHunger && foodSelectMenu.components[0].options.length > 0) {

							messageComponentArray.push(foodSelectMenu);
						}

						await interaction.message
							.edit({
								embeds: embedArray,
								components: messageComponentArray,
							})
							.catch((error) => {
								if (error.httpStatus !== 404) {
									throw new Error(error);
								}
							});
					}
				}

				if (interaction.customId == 'eat-options') {

					if (interaction.values[0] == 'inventory_meat_page') {

						let serverMeatOptionsAmount = 0;

						for (const meatAmount of Object.keys(serverData.inventoryObject.meat)) {

							if (meatAmount > 0) {

								serverMeatOptionsAmount += 1;
							}
						}

						const pagesAmount = Math.ceil(serverMeatOptionsAmount / 24);

						currentPage++;
						if (currentPage >= pagesAmount) {

							currentPage = 0;
						}

						embed = {
							color: config.default_color,
							author: { name: interaction.guild.name, icon_url: interaction.guild.iconURL() },
							title: `Inventory of ${interaction.guild.name} - Page 3.${currentPage + 1}`,
							fields: [],
						};

						for (const [speciesName] of maps.speciesMap) {

							if (serverData.inventoryObject.meat[speciesName] > 0) {

								embed.fields.push({ name: `${speciesName}:`, value: `${serverData.inventoryObject.meat[speciesName]}`, inline: true });
								foodSelectMenu.components[0].options.push({ label: speciesName, value: speciesName, description: `${serverData.inventoryObject.meat[speciesName]}` });
							}
						}

						embed.fields.splice(0, pagesAmount * 24);
						foodSelectMenu.components[0].options.splice(0, pagesAmount * 24);

						// this is length > 24 rather than length > 25 because a page switcher is now a definite part
						if (embed.fields.length > 24 || foodSelectMenu.components[0].options.length > 24) {

							embed.fields.length = 24;
							foodSelectMenu.components[0].options.length = 24;
						}

						foodSelectMenu.components[0].options.push({ label: 'Show more meat options', value: 'inventory_meat_page', description: 'You are currently on page 1', emoji: '📋' });
						embedArray.splice(-1, 1, embed);

						if (profileData.hunger < profileData.maxHunger && foodSelectMenu.components[0].options.length > 0) {

							messageComponentArray.push(foodSelectMenu);
						}

						await interaction.message
							.edit({
								embeds: embedArray,
								components: messageComponentArray,
							})
							.catch((error) => {
								if (error.httpStatus !== 404) {
									throw new Error(error);
								}
							});
					}

					/* Normally, here it would call eat.js if the chosen food was available
					That part of the code was moved to interactionCreate.js
					This is due to a node.js error of circular dependency
					Since eat.js calls inventory.js if an incorrect food or no food is given
					This cannot only be fixed in version 16.3.1 by removing the circular dependency */
				}

				return await interactionCollector();
			});
		}
	},
};

