const profileModel = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const startCooldown = require('../../utils/startCooldown');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../../utils/itemsInfo');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { createCommandCollector } = require('../../utils/commandCollector');
const { remindOfAttack } = require('../specific/attack');
const { pronoun, upperCasePronounAndPlural } = require('../../utils/getPronouns');
const { generateRandomNumber } = require('../../utils/randomizers');
const blockEntrance = require('../../utils/blockEntrance');

module.exports = {
	name: 'store',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

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
		const inventoryArray = [
			['commonPlants', [...commonPlantsMap.keys()].sort()],
			['uncommonPlants', [...uncommonPlantsMap.keys()].sort()],
			['rarePlants', [...rarePlantsMap.keys()].sort()],
			['meat', [...speciesMap.keys()].sort()],
		];

		const itemSelectMenu = {
			type: 'ACTION_ROW',
			components: [{
				type: 'SELECT_MENU',
				customId: 'store-options',
				placeholder: 'Select an item to store away',
				options: [],
			}],
		};

		for (const [itemType, itemsArray] of inventoryArray) {

			for (const itemName of itemsArray) {

				if (profileData.inventoryObject[itemType][itemName] > 0) {

					itemSelectMenu.components[0].options.push({ label: itemName, value: itemName, description: `${profileData.inventoryObject[itemType][itemName]}` });
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
				description: `*${profileData.name} goes to the food den to store food away, but ${pronoun(profileData, 2)} mouth is empty...*`,
			});

			return await message
				.reply({
					content: messageContent,
					embeds: embedArray,
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if ((profileData.rank !== 'Youngling' && serverData.blockedEntranceObject.den === null && generateRandomNumber(20, 0) === 0) || serverData.blockedEntranceObject.den === 'food den') {

			return await blockEntrance(message, messageContent, profileData, 'food den');
		}

		embedArray.push({
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: `*${profileData.name} wanders to the food den, ready to store away ${pronoun(profileData, 2)} findings. ${upperCasePronounAndPlural(profileData, 0, 'circle')} the food pile…*`,
			footer: { text: '' },
		});

		let componentArray = [itemSelectMenu, storeAllButton];

		if (itemSelectMenu.components[0].options.length > 25) {
			componentArray = [storeAllButton];
		}

		const botReply = await message
			.reply({
				content: messageContent,
				embeds: embedArray,
				components: componentArray,
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		createCommandCollector(message.author.id, message.guild.id, botReply);
		interactionCollector(null, null);

		async function interactionCollector(chosenFood, foodCategory) {

			const filter = i => i.user.id == message.author.id;

			const interaction = await botReply
				.awaitMessageComponent({ filter, time: 30000 })
				.catch(() => { return null;});

			if (interaction == null) {

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

			if (interaction.isSelectMenu()) {

				if (interaction.customId == 'store-options') {

					chosenFood = interaction.values[0];
					let maximumAmount = 0;

					for (const [itemType, itemsArray] of inventoryArray) {

						if (itemsArray.includes(chosenFood)) {

							foodCategory = itemType;
							maximumAmount = profileData.inventoryObject[itemType][chosenFood];
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
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					return await interactionCollector(chosenFood, foodCategory);
				}

				if (interaction.customId == 'store-amount') {

					const chosenAmount = parseInt(interaction.values[0], 10);
					userInventory[foodCategory][chosenFood] -= chosenAmount;
					serverInventory[foodCategory][chosenFood] += chosenAmount;

					profileData = await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $set: { inventoryObject: userInventory } },
					);

					await serverModel.findOneAndUpdate(
						{ serverId: message.guild.id },
						{
							$set: {
								inventoryObject: serverInventory,
							},
						},
					);

					itemSelectMenu.components[0].options = [];
					for (const [itemType, itemsArray] of inventoryArray) {

						for (const itemName of itemsArray) {

							if (profileData.inventoryObject[itemType][itemName] > 0) {

								itemSelectMenu.components[0].options.push({ label: itemName, value: itemName, description: `${profileData.inventoryObject[itemType][itemName]}` });
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
								if (error.httpStatus !== 404) {
									throw new Error(error);
								}
							});

						return;
					}

					await interaction.message
						.edit({
							embeds: embedArray,
							components: componentArray,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					return await interactionCollector(null, null);
				}
			}

			if (interaction.isButton() && interaction.customId == 'store-all') {

				profileData = await profileModel.findOne({
					userId: message.author.id,
					serverId: message.guild.id,
				});

				let footerText = embedArray[embedArray.length - 1].footer.text;
				let maximumAmount = 0;

				for (const [itemType, itemsArray] of inventoryArray) {

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
					{
						$set: {
							inventoryObject: serverInventory,
						},
					},
				);

				embedArray[embedArray.length - 1].footer.text = footerText;
				await interaction.message
					.edit({
						embeds: embedArray,
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				return;
			}
		}
	},
};
