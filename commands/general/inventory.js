const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const arrays = require('../../utils/arrays');
const config = require('../../config.json');

module.exports = {
	name: 'inventory',
	aliases: ['storage'],
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.hasCooldown(message, profileData)) {

			return;
		}

		const species = arrays.species();

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

		for (let i = 0; i < arrays.commonPlantNamesArray.length; i++) {

			if (serverData.commonPlantsArray[i] > 0) {

				embed.fields.push({ name: `${arrays.commonPlantNamesArray[i]}: ${serverData.commonPlantsArray[i]}`, value: `${arrays.commonPlantDescriptionsArray[i]}`, inline: true });
				foodSelectMenu.components[0].options.push({ label: arrays.commonPlantNamesArray[i], value: arrays.commonPlantNamesArray[i], description: `${serverData.commonPlantsArray[i]}` });
			}
		}

		embedArray.push(embed);
		const componentArray = [inventorySelectMenu];

		if (profileData.hunger < profileData.maxHunger && serverData.commonPlantsArray.reduce((a, b) => a + b) > 0) {

			componentArray.push(foodSelectMenu);
		}

		const botReply = await message
			.reply({
				embeds: embedArray,
				components: componentArray,
			})
			.catch((error) => {
				if (error.httpStatus == 404) {
					console.log('Message already deleted');
				}
				else {
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
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
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
							if (error.httpStatus == 404) {
								console.log('Message already deleted');
							}
							else {
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

						for (let i = 0; i < arrays.commonPlantNamesArray.length; i++) {

							if (serverData.commonPlantsArray[i] > 0) {

								embed.fields.push({ name: `${arrays.commonPlantNamesArray[i]}: ${serverData.commonPlantsArray[i]}`, value: `${arrays.commonPlantDescriptionsArray[i]}`, inline: true });
								foodSelectMenu.components[0].options.push({ label: arrays.commonPlantNamesArray[i], value: arrays.commonPlantNamesArray[i], description: `${serverData.commonPlantsArray[i]}` });
							}
						}

						embedArray.splice(-1, 1, embed);

						if (profileData.hunger < profileData.maxHunger && serverData.commonPlantsArray.reduce((a, b) => a + b) > 0) {

							messageComponentArray.push(foodSelectMenu);
						}

						await interaction.message
							.edit({
								embeds: embedArray,
								components: messageComponentArray,
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

					if (interaction.values[0] == 'inventory_page2') {

						embed = {
							color: config.default_color,
							author: { name: interaction.guild.name, icon_url: interaction.guild.iconURL() },
							title: `Inventory of ${interaction.guild.name} - Page 2`,
							fields: [],
						};

						for (let i = 0; i < arrays.uncommonPlantNamesArray.length; i++) {

							if (serverData.uncommonPlantsArray[i] > 0) {

								embed.fields.push({ name: `${arrays.uncommonPlantNamesArray[i]}: ${serverData.uncommonPlantsArray[i]}`, value: `${arrays.uncommonPlantDescriptionsArray[i]}`, inline: true });
								foodSelectMenu.components[0].options.push({ label: arrays.uncommonPlantNamesArray[i], value: arrays.uncommonPlantNamesArray[i], description: `${serverData.uncommonPlantsArray[i]}` });
							}
						}

						for (let i = 0; i < arrays.rarePlantNamesArray.length; i++) {

							if (serverData.rarePlantsArray[i] > 0) {

								embed.fields.push({ name: `${arrays.rarePlantNamesArray[i]}: ${serverData.rarePlantsArray[i]}`, value: `${arrays.rarePlantDescriptionsArray[i]}`, inline: true });
								foodSelectMenu.components[0].options.push({ label: arrays.rarePlantNamesArray[i], value: arrays.rarePlantNamesArray[i], description: `${serverData.rarePlantsArray[i]}` });
							}
						}

						embedArray.splice(-1, 1, embed);

						if (profileData.hunger < profileData.maxHunger && (serverData.uncommonPlantsArray.reduce((a, b) => a + b) + serverData.rarePlantsArray.reduce((a, b) => a + b)) > 0) {

							messageComponentArray.push(foodSelectMenu);
						}

						await interaction.message
							.edit({
								embeds: embedArray,
								components: messageComponentArray,
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

					if (interaction.values[0] == 'inventory_page3') {

						embed = {
							color: config.default_color,
							author: { name: interaction.guild.name, icon_url: interaction.guild.iconURL() },
							title: `Inventory of ${interaction.guild.name} - Page 3`,
							fields: [],
						};

						for (let i = 0; i < species.nameArray.length; i++) {

							if (serverData.meatArray[i] > 0) {

								if (embed.fields.length > 25 || foodSelectMenu.components[0].options.length > 25) {

									// In case there are exactly 25 meat options, only once a 26th option is detected, it would set the arrays back to 24 and add the Page Switcher.
									// Otherwise, if there are exactly 25 meat options, it would split it up onto two pages unnecessarily
									embed.fields.length = 24;
									foodSelectMenu.components[0].options.length = 24;

									embed.title = `Inventory of ${interaction.guild.name} - Page 3.1`;
									foodSelectMenu.components[0].options.push({ label: 'Show more meat options', value: 'inventory_meat_page', description: 'You are currently on page 1', emoji: '📋' });
									break;
								}

								embed.fields.push({ name: `${species.nameArray[i]}:`, value: `${serverData.meatArray[i]}`, inline: true });
								foodSelectMenu.components[0].options.push({ label: species.nameArray[i], value: species.nameArray[i], description: `${serverData.meatArray[i]}` });
							}
						}

						embedArray.splice(-1, 1, embed);

						if (profileData.hunger < profileData.maxHunger && serverData.meatArray.reduce((a, b) => a + b) > 0) {

							messageComponentArray.push(foodSelectMenu);
						}

						await interaction.message
							.edit({
								embeds: embedArray,
								components: messageComponentArray,
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
				}

				if (interaction.customId == 'eat-options') {

					if (interaction.values[0] == 'inventory_meat_page') {

						let serverMeatOptionsAmount = 0;

						for (let i = 0; i < serverData.meatArray.length; i++) {

							if (serverData.meatArray[i] > 0) {

								serverMeatOptionsAmount++;
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

						for (let i = 0 + (currentPage * 24); i < 24 + (currentPage * 24) && i < species.nameArray.length; i++) {

							if (serverData.meatArray[i] > 0) {

								embed.fields.push({ name: `${species.nameArray[i]}:`, value: `${serverData.meatArray[i]}`, inline: true });
								foodSelectMenu.components[0].options.push({ label: species.nameArray[i], value: species.nameArray[i], description: `${serverData.meatArray[i]}` });
							}
						}

						foodSelectMenu.components[0].options.push({ label: 'Show more meat options', value: 'inventory_meat_page', description: 'You are currently on page 1', emoji: '📋' });
						embedArray.splice(-1, 1, embed);

						if (profileData.hunger < profileData.maxHunger && serverData.meatArray.reduce((a, b) => a + b) > 0) {

							messageComponentArray.push(foodSelectMenu);
						}

						await interaction.message
							.edit({
								embeds: embedArray,
								components: messageComponentArray,
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

