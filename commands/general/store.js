const maps = require('../../utils/maps');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const profileModel = require('../../models/profileSchema');
const serverModel = require('../../models/serverSchema');
const config = require('../../config.json');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'store',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);

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
		const inventoryMaps = {
			commonPlants: new Map(maps.commonPlantMap),
			uncommonPlants: new Map(maps.uncommonPlantMap),
			rarePlants: new Map(maps.rarePlantMap),
			meat: new Map(maps.speciesMap),
		};

		const itemSelectMenu = {
			type: 'ACTION_ROW',
			components: [{
				type: 'SELECT_MENU',
				customId: 'store-options',
				placeholder: 'Select an item to store away',
				options: [],
			}],
		};

		for (const [mapName, mapEntries] of Object.entries(inventoryMaps)) {

			for (const [itemName] of mapEntries) {

				if (profileData.inventoryObject[mapName][itemName] > 0) {

					itemSelectMenu.components[0].options.push({ label: itemName, value: itemName, description: `${profileData.inventoryObject[mapName][itemName]}` });
				}
			}
		}

		const storeAllButton = {
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'store-all',
				label: 'Store everything',
				style: 'SUCCESS',
			}],
		};

		if (itemSelectMenu.components[0].options.length == 0) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} goes to the food den to store food away, but ${profileData.pronounArray[2]} mouth is empty...*`,
			});

			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					throw new Error(error);
				});
		}

		embedArray.push({
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: `*${profileData.name} wanders to the food den, ready to store away ${profileData.pronounArray[2]} findings. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'circles' : 'circle')} the food pile…*`,
			footer: { text: '' },
		});

		let componentArray = [itemSelectMenu, storeAllButton];

		if (itemSelectMenu.components[0].options.length > 25) {
			componentArray = [storeAllButton];
		}

		const botReply = await message
			.reply({
				embeds: embedArray,
				components: componentArray,
			})
			.catch((error) => {
				throw new Error(error);
			});

		client.on('messageCreate', async function removeStoreComponents(newMessage) {

			if (!botReply || newMessage.author.id != message.author.id || !newMessage.content.toLowerCase().startsWith(config.prefix)) {

				return;
			}

			await botReply
				.edit({
					components: [],
				})
				.catch((error) => {
					throw new Error(error);
				});

			return client.off('messageCreate', removeStoreComponents);
		});

		await interactionCollector(null, null);

		async function interactionCollector(chosenFood, foodCategory) {

			const filter = async (i) => {

				if (!i.message.reference || !i.message.reference.messageId) {

					return false;
				}

				const userMessage = await i.channel.messages
					.fetch(i.message.reference.messageId)
					.catch((error) => {
						throw new Error(error);
					});

				return userMessage.id == message.id && i.user.id == message.author.id;
			};

			const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 30000 });
			collector.on('end', async (collected) => {

				if (!collected.size) {

					return await botReply
						.edit({
							components: [],
						})
						.catch((error) => {
							throw new Error(error);
						});
				}

				const interaction = collected.first();

				if (interaction.isSelectMenu()) {

					if (interaction.customId == 'store-options') {

						chosenFood = interaction.values[0];
						let maximumAmount = 0;

						for (const [mapName, mapEntries] of Object.entries(inventoryMaps)) {

							if (inventoryMaps[mapEntries].has(chosenFood)) {
								foodCategory = mapName;
								maximumAmount = profileData.inventoryObject[mapEntries][chosenFood];
							}
						}

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

							amountSelectMenu.components[0].options.push({ label: `${i + 1}`, value: `${i + 1}` });
						}

						componentArray.splice(1, 1, amountSelectMenu);
						await interaction.message
							.edit({
								components: componentArray,
							})
							.catch((error) => {
								throw new Error(error);
							});

						return await interactionCollector(chosenFood, foodCategory);
					}

					if (interaction.customId == 'store-amount') {

						const chosenAmount = interaction.values[0];
						userInventory[foodCategory][chosenFood] -= chosenAmount;
						serverInventory[foodCategory][chosenFood] += chosenAmount;

						(profileData.inventoryObject != userInventory) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): inventoryObject changed from \x1b[33m${JSON.stringify(profileData.inventoryObject)} \x1b[0mto \x1b[33m${JSON.stringify(userInventory)} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
						profileData = await profileModel
							.findOneAndUpdate(
								{ userId: message.author.id, serverId: message.guild.id },
								{ $set: { inventoryObject: userInventory } },
								{ new: true },
							)
							.catch((error) => {
								throw new Error(error);
							});

						(serverData.inventoryObject[foodCategory] != serverInventory[foodCategory]) && console.log(`\x1b[32m\x1b[0m${message.guild.name} (${message.guild.id}): inventoryObject.${foodCategory} changed from \x1b[33m${JSON.stringify(serverData.inventoryObject[foodCategory])} \x1b[0mto \x1b[33m${JSON.stringify(serverInventory[foodCategory])} \x1b[0mthrough \x1b[32m${message.author.tag} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
						await serverModel
							.findOneAndUpdate(
								{ serverId: message.guild.id },
								{
									$set: {
										inventoryObject: serverInventory,
									},
								},
								{ new: true },
							)
							.catch((error) => {
								throw new Error(error);
							});

						itemSelectMenu.components[0].options = [];
						for (const [mapName, mapEntries] of Object.entries(inventoryMaps)) {

							for (const [itemName] of mapEntries) {

								if (profileData.inventoryObject[mapName][itemName] > 0) {

									itemSelectMenu.components[0].options.push({ label: itemName, value: itemName, description: `${profileData.inventoryObject[mapName][itemName]}` });
								}
							}
						}

						embedArray[embedArray.length - 1].footer.text += `+${chosenAmount} ${chosenFood} for ${message.guild.name}\n`;
						componentArray = [itemSelectMenu, storeAllButton];

						if (itemSelectMenu.components[0].options.length == 0) {

							await interaction.message
								.edit({
									embeds: embedArray,
									components: [],
								})
								.catch((error) => {
									throw new Error(error);
								});

							return;
						}

						await interaction.message
							.edit({
								embeds: embedArray,
								components: componentArray,
							})
							.catch((error) => {
								throw new Error(error);
							});

						return await interactionCollector(null, null);
					}
				}

				if (interaction.isButton() && interaction.customId == 'store-all') {

					profileData = await profileModel
						.findOne({
							userId: message.author.id,
							serverId: message.guild.id,
						})
						.catch((error) => {
							throw new Error(error);
						});

					let footerText = embedArray[embedArray.length - 1].footer.text;
					let maximumAmount = 0;

					for (const [mapName, mapEntries] of Object.entries(inventoryMaps)) {

						for (const [itemName] of mapEntries) {

							if (profileData.inventoryObject[mapName][itemName] > 0) {

								maximumAmount = profileData.inventoryObject[mapName][itemName];

								footerText += `+${maximumAmount} ${inventoryMaps[mapName][itemName]} for ${message.guild.name}\n`;
								userInventory[mapName][itemName] -= maximumAmount;
								serverInventory[mapName][itemName] += maximumAmount;
							}
						}
					}

					(profileData.inventoryObject != userInventory) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): inventoryObject changed from \x1b[33m${JSON.stringify(profileData.inventoryObject)} \x1b[0mto \x1b[33m${JSON.stringify(userInventory)} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
					await profileModel
						.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{ $set: { inventoryObject: userInventory } },
							{ new: true },
						)
						.catch((error) => {
							throw new Error(error);
						});

					(serverData.inventoryObject != serverInventory) && console.log(`\x1b[32m\x1b[0m${message.guild.name} (${message.guild.id}): inventoryObject changed from \x1b[33m${JSON.stringify(serverData.inventoryObject)} \x1b[0mto \x1b[33m${JSON.stringify(serverInventory)} \x1b[0mthrough \x1b[32m${message.author.tag} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
					await serverModel
						.findOneAndUpdate(
							{ serverId: message.guild.id },
							{
								$set: {
									inventoryObject: serverInventory,
								},
							},
							{ new: true },
						)
						.catch((error) => {
							throw new Error(error);
						});

					embedArray[embedArray.length - 1].footer.text = footerText;
					await interaction.message
						.edit({
							embeds: embedArray,
							components: [],
						})
						.catch((error) => {
							throw new Error(error);
						});

					return;
				}
			});
		}
	},
};