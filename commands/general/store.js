const arrays = require('../../utils/arrays');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const profileModel = require('../../models/profileSchema');
const serverModel = require('../../models/serverSchema');
const config = require('../../config.json');

module.exports = {
	name: 'store',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isInvalid(message, profileData, embedArray)) {

			return;
		}

		const species = arrays.species(profileData);

		const userInventory = [...profileData.inventoryArray];
		const serverInventory = [[...serverData.commonPlantsArray], [...serverData.uncommonPlantsArray], [...serverData.rarePlantsArray], [...serverData.meatArray]];
		const allItemNamesArray = [[...arrays.commonPlantNamesArray], [...arrays.uncommonPlantNamesArray], [...arrays.rarePlantNamesArray], [...species.nameArray]];

		const itemSelectMenu = {
			type: 'ACTION_ROW',
			components: [{
				type: 'SELECT_MENU',
				customId: 'store-options',
				placeholder: 'Select an item to store away',
				options: [],
			}],
		};

		for (let i = 0; i < allItemNamesArray.length; i++) {

			for (let j = 0; j < allItemNamesArray[i].length; j++) {

				if (profileData.inventoryArray[i][j] > 0) {

					itemSelectMenu.components[0].options.push({ label: allItemNamesArray[i][j], value: allItemNamesArray[i][j], description: `${profileData.inventoryArray[i][j]}` });
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
			return await message.reply({ embeds: embedArray });
		}

		embedArray.push({
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: `*${profileData.name} wanders to the food den, ready to store away ${profileData.pronounArray[2]} findings. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'circles' : 'circle')} the food pile…*`,
			footer: { text: '' },
		});
		let componentArray = [itemSelectMenu, storeAllButton];

		if (itemSelectMenu.components[0].options.length > 25) {
			componentArray = [storeAllButton];
		}

		const botReply = await message.reply({ embeds: embedArray, components: componentArray });

		client.on('messageCreate', async function removeStoreComponents(newMessage) {

			if (!botReply || newMessage.author.id != message.author.id || !newMessage.content.toLowerCase().startsWith(config.PREFIX)) {

				return;
			}

			await botReply.edit({
				components: [],
			});
			return client.off('messageCreate', removeStoreComponents);
		});

		await interactionCollector(null, null, null);

		async function interactionCollector(chosenFood, foodCategoryIndex, foodNameIndex) {

			const filter = async (i) => {

				if (!i.message.reference || !i.message.reference.messageId) {

					return false;
				}

				const userMessage = await i.channel.messages.fetch(i.message.reference.messageId);
				return userMessage.id == message.id && i.user.id == message.author.id;
			};

			const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 30000 });
			collector.on('end', async (collected) => {

				if (!collected.size) {

					return await botReply.edit({
						components: [],
					});
				}

				const interaction = collected.first();

				if (interaction.isSelectMenu()) {

					if (interaction.customId == 'store-options' && allItemNamesArray.some(nest => nest.some(elem => elem == interaction.values[0]))) {

						chosenFood = interaction.values[0];
						let maximumAmount = 0;

						for (let i = 0; i < allItemNamesArray.length; i++) {

							if (allItemNamesArray[i].includes(chosenFood)) {
								foodCategoryIndex = i;
								foodNameIndex = allItemNamesArray[i].indexOf(chosenFood);
								maximumAmount = profileData.inventoryArray[i][foodNameIndex];
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
						await interaction.message.edit({ components: componentArray });

						return await interactionCollector(chosenFood, foodCategoryIndex, foodNameIndex);
					}

					if (interaction.customId == 'store-amount') {

						const chosenAmount = interaction.values[0];
						userInventory[foodCategoryIndex][foodNameIndex] -= chosenAmount;
						serverInventory[foodCategoryIndex][foodNameIndex] += chosenAmount;

						profileData = await profileModel.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{ $set: { inventoryArray: userInventory } },
							{ upsert: true, new: true },
						);

						await serverModel.findOneAndUpdate(
							{ serverId: message.guild.id },
							{
								$set: {
									commonPlantsArray: serverInventory[0],
									uncommonPlantsArray: serverInventory[1],
									rarePlantsArray: serverInventory[2],
									meatArray: serverInventory[3],
								},
							},
							{ upsert: true, new: true },
						);

						itemSelectMenu.components[0].options = [];
						for (let i = 0; i < allItemNamesArray.length; i++) {

							for (let j = 0; j < allItemNamesArray[i].length; j++) {

								if (profileData.inventoryArray[i][j] > 0) {

									itemSelectMenu.components[0].options.push({ label: allItemNamesArray[i][j], value: allItemNamesArray[i][j], description: `${profileData.inventoryArray[i][j]}` });
								}
							}
						}

						embedArray[embedArray.length - 1].footer.text += `+${chosenAmount} ${chosenFood} for ${message.guild.name}\n`;
						componentArray = [itemSelectMenu, storeAllButton];

						if (itemSelectMenu.components[0].options.length == 0) {

							await interaction.message.edit({ embeds: embedArray, components: [] });
							return;
						}

						await interaction.message.edit({ embeds: embedArray, components: componentArray });
						return await interactionCollector(null, null, null);
					}
				}

				if (interaction.isButton() && interaction.customId == 'store-all') {

					profileData = await profileModel.findOne({ userId: message.author.id, serverId: message.guild.id });

					let footerText = embedArray[embedArray.length - 1].footer.text;
					let maximumAmount = 0;

					for (let i = 0; i < allItemNamesArray.length; i++) {

						for (let j = 0; j < allItemNamesArray[i].length; j++) {

							if (profileData.inventoryArray[i][j] > 0) {

								foodCategoryIndex = i;
								foodNameIndex = j;
								maximumAmount = profileData.inventoryArray[i][j];

								footerText += `+${maximumAmount} ${allItemNamesArray[i][j]} for ${message.guild.name}\n`;
								userInventory[foodCategoryIndex][foodNameIndex] -= maximumAmount;
								serverInventory[foodCategoryIndex][foodNameIndex] += maximumAmount;
							}
						}
					}

					await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $set: { inventoryArray: userInventory } },
						{ upsert: true, new: true },
					);

					await serverModel.findOneAndUpdate(
						{ serverId: message.guild.id },
						{
							$set: {
								commonPlantsArray: serverInventory[0],
								uncommonPlantsArray: serverInventory[1],
								rarePlantsArray: serverInventory[2],
								meatArray: serverInventory[3],
							},
						},
						{ upsert: true, new: true },
					);

					embedArray[embedArray.length - 1].footer.text = footerText;
					await interaction.message.edit({ embeds: embedArray, components: [] });
					return;
				}
			});
		}
	},
};