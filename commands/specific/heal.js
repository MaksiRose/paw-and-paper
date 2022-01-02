const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const profileModel = require('../../models/profileSchema');
const serverModel = require('../../models/serverSchema');
const config = require('../../config.json');
const arrays = require('../../utils/arrays');
const condition = require('../../utils/condition');
const levels = require('../../utils/levels');

module.exports = {
	name: 'heal',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isInvalid(message, profileData, embedArray)) {

			return;
		}

		if (profileData.rank === 'Youngling' || profileData.rank === 'Hunter') {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*A healer rushes into the medicine den in fury.*\n"${profileData.name}, you are not trained to heal yourself, and especially not to heal others! I don't ever wanna see you again in here without supervision!"\n*${profileData.name} lowers ${profileData.pronounArray[2]} head and leaves in shame.*`,
			});

			return await message
				.reply({
					embeds: embedArray,
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

		let allHurtProfilesArray = await profileModel
			.find({
				$and: [{
					serverId: message.guild.id,
					$or: [
						{ energy: 0 },
						{ health: 0 },
						{ hunger: 0 },
						{ thirst: 0 },
						{ injuryArray: { $gte: 1 } },
					],
				}],
			})
			.catch((error) => {
				throw new Error(error);
			});

		allHurtProfilesArray = allHurtProfilesArray.map(doc => doc.userId);

		const userSelectMenu = {
			type: 'ACTION_ROW',
			components: [{
				type: 'SELECT_MENU',
				customId: 'heal-user-options',
				placeholder: 'Select a user to heal',
				options: [],
			}],
		};

		for (let i = 0; i < allHurtProfilesArray.length; i++) {

			const user = await client.users
				.fetch(allHurtProfilesArray[i])
				.catch((error) => {
					throw new Error(error);
				});

			const userProfileData = await profileModel
				.findOne({
					userId: user.id,
					serverId: message.guild.id,
				})
				.catch((error) => {
					throw new Error(error);
				});

			if (userSelectMenu.components[0].options.length > 25) {

				// In case there are exactly 25 user options, only once a 26th option is detected, it would set the array back to 24 and add the Page Switcher.
				// Otherwise, if there are exactly 25 user options, it would split it up onto two pages unnecessarily
				userSelectMenu.components[0].options.length = 24;
				userSelectMenu.components[0].options.push({ lavel: 'Show more user options', value: 'heal_user_page', description: 'You are currently on page 1', emoji: '📋' });
			}

			userSelectMenu.components[0].options.push({ label: userProfileData.name, value: user.id });
		}

		const embedArrayOriginalLength = embedArray.length;
		let currentUserPage = 0;
		let botReply;
		let chosenProfileData;
		let chosenUser = (!message.mentions.users.size) ? null : message.mentions.users.first();

		if (!chosenUser) {

			await getUserList();
		}
		else {

			await getWoundList(chosenUser);
		}


		client.on('messageCreate', async function removeHealComponents(newMessage) {

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

			return client.off('messageCreate', removeHealComponents);
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

			const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 60000 });
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

				if (allHurtProfilesArray.includes(interaction.values[0])) {

					chosenProfileData = await profileModel
						.findOne({
							userId: interaction.values[0],
							serverId: message.guild.id,
						})
						.catch((error) => {
							throw new Error(error);
						});

					if (chosenProfileData.name === '' || chosenProfileData.species === '') {

						embedArray.length = embedArrayOriginalLength;
						embedArray.push({
							color: config.default_color,
							author: { name: message.guild.name, icon_url: message.guild.iconURL() },
							title: 'The mentioned user has no account or the account was not completed!',
						});

						allHurtProfilesArray.splice(allHurtProfilesArray.indexOf(interaction.values[0]), 1);

						botReply = await interaction.message
							.edit({
								embeds: embedArray,
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
					else {
						chosenUser = await client.users
							.fetch(interaction.values[0])
							.catch((error) => {
								throw new Error(error);
							});

						getWoundList(chosenUser);
					}
				}

				if (interaction.values[0] == 'heal_user_page') {

					const pagesAmount = Math.ceil(allHurtProfilesArray.length / 24);

					currentUserPage++;
					if (currentUserPage >= pagesAmount) {

						currentUserPage = 0;
					}

					userSelectMenu.components[0].options.length = 0;

					for (let i = 0 + (currentUserPage * 24); i < 24 + (currentUserPage * 24) && i < allHurtProfilesArray.length; i++) {

						const user = await client.users
							.fetch(allHurtProfilesArray[i])
							.catch((error) => {
								throw new Error(error);
							});

						const userProfileData = await profileModel
							.findOne({
								userId: user.id,
								serverId: message.guild.id,
							})
							.catch((error) => {
								throw new Error(error);
							});

						userSelectMenu.components[0].options.push({ label: userProfileData.name, value: user.id });
					}

					userSelectMenu.components[0].options.push({ lavel: 'Show more user options', value: 'heal_user_page', description: `You are currently on page ${currentUserPage + 1}`, emoji: '📋' });

					const componentArray = interaction.message.components;
					await componentArray.splice(0, 1, userSelectMenu);

					botReply = await interaction.message
						.edit({
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
				}

				if (interaction.values[0] == 'heal-page1') {

					const embed = {
						color: profileData.color,
						title: `Inventory of ${message.guild.name} - Page 1`,
						fields: [],
						footer: { text: 'Choose one of the herbs above to heal the player with it!' },
					};

					const selectMenu = {
						type: 'ACTION_ROW',
						components: [{
							type: 'SELECT_MENU',
							customId: 'heal-options1',
							placeholder: 'Select an item',
							options: [],
						}],
					};

					for (let i = 0; i < arrays.commonPlantNamesArray.length; i++) {

						if (serverData.commonPlantsArray[i] > 0) {

							embed.fields.push({ name: `${arrays.commonPlantNamesArray[i]}: ${serverData.commonPlantsArray[i]}`, value: `${arrays.commonPlantDescriptionsArray[i]}`, inline: true });
							selectMenu.components[0].options.push({ label: arrays.commonPlantNamesArray[i], value: arrays.commonPlantNamesArray[i], description: `${serverData.commonPlantsArray[i]}` });
						}
					}

					embedArray.length = embedArrayOriginalLength + 1;
					embedArray.push(embed);

					interaction.message.components.length = 2;
					const componentArray = interaction.message.components;
					await componentArray.push(selectMenu);

					botReply = await interaction.message
						.edit({
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
				}

				if (interaction.values[0] == 'heal-page2') {

					const embed = {
						color: profileData.color,
						title: `Inventory of ${message.guild.name} - Page 2`,
						fields: [],
						footer: { text: 'Choose one of the herbs above to heal the player with it!' },
					};

					const selectMenu = {
						type: 'ACTION_ROW',
						components: [{
							type: 'SELECT_MENU',
							customId: 'heal-options2',
							placeholder: 'Select an item',
							options: [],
						}],
					};

					for (let i = 0; i < arrays.uncommonPlantNamesArray.length; i++) {

						if (serverData.uncommonPlantsArray[i] > 0) {

							embed.fields.push({ name: `${arrays.uncommonPlantNamesArray[i]}: ${serverData.uncommonPlantsArray[i]}`, value: `${arrays.uncommonPlantDescriptionsArray[i]}`, inline: true });
							selectMenu.components[0].options.push({ label: arrays.uncommonPlantNamesArray[i], value: arrays.uncommonPlantNamesArray[i], description: `${serverData.uncommonPlantsArray[i]}` });
						}
					}

					for (let i = 0; i < arrays.rarePlantNamesArray.length; i++) {

						if (serverData.rarePlantsArray[i] > 0) {

							embed.fields.push({ name: `${arrays.rarePlantNamesArray[i]}: ${serverData.rarePlantsArray[i]}`, value: `${arrays.rarePlantDescriptionsArray[i]}`, inline: true });
							selectMenu.components[0].options.push({ label: arrays.rarePlantNamesArray[i], value: arrays.rarePlantNamesArray[i], description: `${serverData.rarePlantsArray[i]}` });
						}
					}

					embed.fields.push({ name: 'water', value: 'Found lots and lots of in the river that flows through the pack!', inline: true });
					selectMenu.components[0].options.push({ label: 'water', value: 'water' });

					embedArray.length = embedArrayOriginalLength + 1;
					embedArray.push(embed);

					interaction.message.components.length = 2;
					const componentArray = interaction.message.components;
					await componentArray.push(selectMenu);

					botReply = await interaction.message
						.edit({
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
				}

				if (arrays.commonPlantNamesArray.includes(interaction.values[0]) || arrays.uncommonPlantNamesArray.includes(interaction.values[0]) || arrays.rarePlantNamesArray.includes(interaction.values[0]) || interaction.values[0] == 'water') {

					const thirstPoints = await condition.decreaseThirst(profileData);
					const hungerPoints = await condition.decreaseHunger(profileData);
					const extraLostEnergyPoints = await condition.decreaseEnergy(profileData);
					let energyPoints = Loottable(5, 1) + extraLostEnergyPoints;
					let experiencePoints = 0;

					if (profileData.energy - energyPoints < 0) {

						energyPoints = profileData.energy;
					}

					if (profileData.rank == 'Apprentice') {

						experiencePoints = Loottable(11, 5);
					}

					if (profileData.rank == 'Healer') {

						experiencePoints = Loottable(21, 10);
					}

					if (profileData.rank == 'Elderly') {

						experiencePoints = Loottable(41, 20);
					}

					profileData = await profileModel
						.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{
								$inc: {
									thirst: -thirstPoints,
									hunger: -hungerPoints,
									energy: -energyPoints,
									experience: +experiencePoints,
								},
							},
							{ upsert: true, new: true },
						)
						.catch((error) => {
							throw new Error(error);
						});

					let embedFooterStatsText = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

					if (hungerPoints >= 1) {

						embedFooterStatsText = embedFooterStatsText + `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
					}

					if (thirstPoints >= 1) {

						embedFooterStatsText = embedFooterStatsText + `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
					}

					let healthPoints = 0;
					const userInjuryArray = [...profileData.injuryArray];

					const embed = {
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: '',
						footer: { text: '' },
					};

					if (interaction.values[0] == 'water') {

						if (chosenProfileData.thirst > 0) {

							if (profileData.userId == chosenProfileData.userId) {

								embed.description = `*${profileData.name} thinks about just drinking some water, but that won't help with ${profileData.pronounArray[2]} issues...*"`;

							}
							else {

								embed.description = `*${chosenProfileData.name} looks at ${profileData.name} with indignation.* "Being hydrated is really not my biggest problem right now!"`;

							}

							embed.footer.text = embedFooterStatsText;

						}
						else {

							const chosenUserThirstPoints = Loottable(10, 1);

							chosenProfileData = await profileModel
								.findOneAndUpdate(
									{ userId: chosenProfileData.userId, serverId: chosenProfileData.serverId },
									{ $inc: { thirst: +chosenUserThirstPoints } },
									{ upsert: true, new: true },
								)
								.catch((error) => {
									throw new Error(error);
								});

							embed.description = `*${profileData.name} takes ${chosenProfileData.name}'s body, drags it over to the river, and positions ${chosenProfileData.pronounArray[2]} head right over the water. The ${chosenProfileData.species} sticks ${chosenProfileData.pronounArray[2]} tongue out and slowly starts drinking. Immediately you can observe how the newfound energy flows through ${chosenProfileData.pronounArray[2]} body.*`;
							embed.footer.text = `${embedFooterStatsText}\n\n+${chosenUserThirstPoints} water for ${chosenProfileData.name} (${chosenProfileData.thirst}/${chosenProfileData.maxThirst})`;

						}

						botReply = await interaction.message
							.edit({
								embeds: embedArray,
								components: [],
							})
							.catch((error) => {
								throw new Error(error);
							});

					}
					else {
						const serverPlantInventory = [[...serverData.commonPlantsArray], [...serverData.uncommonPlantsArray], [...serverData.rarePlantsArray]];
						let serverPlantInventoryIndex = -1;
						let plantNamesArrayIndex = -1;
						const plantEdibalityArray = [[...arrays.commonPlantEdibalityArray], [...arrays.uncommonPlantEdibalityArray], [...arrays.rarePlantEdibalityArray]];
						const plantHealsWoundsArray = [[...arrays.commonPlantHealsWoundsArray], [...arrays.uncommonPlantHealsWoundsArray], [...arrays.rarePlantHealsWoundsArray]];
						const plantHealsInfectionsArray = [[...arrays.commonPlantHealsInfectionsArray], [...arrays.uncommonPlantHealsInfectionsArray], [...arrays.rarePlantHealsInfectionsArray]];
						const plantHealsColdsArray = [[...arrays.commonPlantHealsColdsArray], [...arrays.uncommonPlantHealsColdsArray], [...arrays.rarePlantHealsColdsArray]];
						const plantHealsStrainsArray = [[...arrays.commonPlantHealsStrainsArray], [...arrays.uncommonPlantHealsStrainsArray], [...arrays.rarePlantHealsStrainsArray]];
						const plantHealsPoisonArray = [[...arrays.commonPlantHealsPoisonArray], [...arrays.uncommonPlantHealsPoisonArray], [...arrays.rarePlantHealsPoisonArray]];
						const plantGivesEnergyArray = [[...arrays.commonPlantGivesEnergyArray], [...arrays.uncommonPlantGivesEnergyArray], [...arrays.rarePlantGivesEnergyArray]];

						if (arrays.commonPlantNamesArray.includes(interaction.values[0])) {

							serverPlantInventoryIndex = 0;
							plantNamesArrayIndex = arrays.commonPlantNamesArray.findIndex((usearg) => usearg == interaction.values[0]);
						}

						if (arrays.uncommonPlantNamesArray.includes(interaction.values[0])) {

							serverPlantInventoryIndex = 1;
							plantNamesArrayIndex = arrays.uncommonPlantNamesArray.findIndex((usearg) => usearg == interaction.values[0]);
						}

						if (arrays.rarePlantNamesArray.includes(interaction.values[0])) {

							serverPlantInventoryIndex = 2;
							plantNamesArrayIndex = arrays.rarePlantNamesArray.findIndex((usearg) => usearg == interaction.values[0]);
						}

						--serverPlantInventory[serverPlantInventoryIndex][plantNamesArrayIndex];

						const species = arrays.species(chosenProfileData);
						const speciesNameArrayIndex = species.nameArray.findIndex((index) => index == chosenProfileData.species);
						const chosenUserInjuryArray = [...chosenProfileData.injuryArray];
						let chosenUserEnergyPoints = 0;
						let chosenUserHungerPoints = 0;
						let isSuccessful = false;
						let embedFooterChosenUserStatsText = '';
						let embedFooterChosenUserInjuryText = '';

						if (plantEdibalityArray[serverPlantInventoryIndex][plantNamesArrayIndex] == 'e') {

							if (chosenProfileData.hunger <= 0) {

								isSuccessful = true;
							}

							if (species.dietArray[speciesNameArrayIndex] == 'carnivore') {

								chosenUserHungerPoints = 1;
							}

							if (species.dietArray[speciesNameArrayIndex] == 'herbivore' || species.dietArray[speciesNameArrayIndex] == 'omnivore') {

								chosenUserHungerPoints = 5;
							}

							if (chosenProfileData.hunger + chosenUserHungerPoints > chosenProfileData.maxHunger) {

								chosenUserHungerPoints -= (chosenProfileData.hunger + chosenUserHungerPoints) - chosenProfileData.maxHunger;
							}

							if (chosenUserHungerPoints > 0) {

								embedFooterChosenUserStatsText += `\n+${chosenUserHungerPoints} hunger for ${chosenProfileData.name} (${chosenProfileData.hunger + chosenUserHungerPoints}/${chosenProfileData.maxHunger})`;
							}
						}

						if (chosenProfileData.health <= 0) {

							isSuccessful = true;
						}

						if (plantHealsWoundsArray[serverPlantInventoryIndex][plantNamesArrayIndex] == true && chosenUserInjuryArray[0] > 0) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\n-1 wound for ${chosenProfileData.name}`;
							--chosenUserInjuryArray[0];
						}

						if (plantHealsInfectionsArray[serverPlantInventoryIndex][plantNamesArrayIndex] == true && chosenUserInjuryArray[1] > 0) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\n-1 infection for ${chosenProfileData.name}`;
							--chosenUserInjuryArray[1];
						}

						if (plantHealsColdsArray[serverPlantInventoryIndex][plantNamesArrayIndex] == true && chosenUserInjuryArray[2] > 0) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\ncold healed for ${chosenProfileData.name}`;
							--chosenUserInjuryArray[2];
						}

						if (plantHealsStrainsArray[serverPlantInventoryIndex][plantNamesArrayIndex] == true && chosenUserInjuryArray[3] > 0) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\n-1 strain for ${chosenProfileData.name}`;
							--chosenUserInjuryArray[3];
						}

						if (plantHealsPoisonArray[serverPlantInventoryIndex][plantNamesArrayIndex] == true && chosenUserInjuryArray[4] > 0) {

							isSuccessful = true;
							embedFooterChosenUserInjuryText += `\npoison healed for ${chosenProfileData.name}`;
							--chosenUserInjuryArray[4];
						}

						if (plantGivesEnergyArray[serverPlantInventoryIndex][plantNamesArrayIndex] == true) {

							if (chosenProfileData.energy <= 0) {

								isSuccessful = true;
							}

							chosenUserEnergyPoints = 30;

							if (chosenProfileData.energy + chosenUserEnergyPoints > chosenProfileData.maxEnergy) {

								chosenUserEnergyPoints -= (chosenProfileData.energy + chosenUserEnergyPoints) - chosenProfileData.maxEnergy;
							}

							if (chosenUserEnergyPoints >= 1) {

								embedFooterChosenUserStatsText += `\n+${chosenUserEnergyPoints} energy for ${chosenProfileData.name} (${chosenProfileData.energy + chosenUserEnergyPoints}/${chosenProfileData.maxEnergy})`;
							}
						}

						await serverModel
							.findOneAndUpdate(
								{ serverId: message.guild.id },
								{
									$set: {
										commonPlantsArray: serverPlantInventory[0],
										uncommonPlantsArray: serverPlantInventory[1],
										rarePlantsArray: serverPlantInventory[2],
									},
								},
								{ upsert: true, new: true },
							)
							.catch((error) => {
								throw new Error(error);
							});

						if (isSuccessful == 1 && chosenProfileData.userId == profileData.userId && Loottable(100 + ((profileData.levels - 1) * 5), 1) <= 60) {

							isSuccessful = false;
						}

						const chosenItemName = interaction.values[0];

						if (isSuccessful == 1) {

							let chosenUserHealthPoints = Loottable(10, 6);
							if (chosenProfileData.health + chosenUserHealthPoints > chosenProfileData.maxHealth) {

								chosenUserHealthPoints -= (chosenProfileData.health + chosenUserHealthPoints) - chosenProfileData.maxHealth;
							}

							chosenProfileData = await profileModel
								.findOneAndUpdate(
									{ userId: chosenProfileData.userId, serverId: chosenProfileData.serverId },
									{
										$set: { injuryArray: chosenUserInjuryArray },
										$inc: {
											health: +chosenUserHealthPoints,
											energy: +chosenUserEnergyPoints,
											hunger: +chosenUserHungerPoints,
										},
									},
									{ upsert: true, new: true },
								)
								.catch((error) => {
									throw new Error(error);
								});

							if (chosenProfileData.userId == profileData.userId) {

								embed.description = `*${profileData.name} takes a ${chosenItemName}. After a bit of preparation, the ${profileData.species} can apply it correctly. Immediately you can see the effect. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} feel${(profileData.pronounArray[5] == 'singular') ? 's' : ''} much better!*`;
							}
							else {

								embed.description = `*${profileData.name} takes a ${chosenItemName}. After a  bit of preparation, ${profileData.pronounArray[0]} give${(profileData.pronounArray[5] == 'singular') ? 's' : ''} it to ${chosenProfileData.name}. Immediately you can see the effect. ${chosenProfileData.pronounArray[0].charAt(0).toUpperCase()}${chosenProfileData.pronounArray[0].slice(1)} feel${(chosenProfileData.pronounArray[5] == 'singular') ? 's' : ''} much better!*`;
							}

							embed.footer.text = `${embedFooterStatsText}\n${embedFooterChosenUserStatsText}\n + ${chosenUserHealthPoints} HP for ${chosenProfileData.name}(${chosenProfileData.health} / ${chosenProfileData.maxHealth})${embedFooterChosenUserInjuryText}\n\n-1 ${chosenItemName} for ${message.guild.name}`;
						}
						else {
							chosenProfileData = await profileModel
								.findOne({
									userId: chosenProfileData.userId,
									serverId: chosenProfileData.serverId,
								})
								.catch((error) => {
									throw new Error(error);
								});

							if (chosenProfileData.userId == profileData.userId) {

								embed.description = `*${profileData.name} holds the ${chosenItemName} in ${profileData.pronounArray[2]} mouth, trying to find a way to apply it. After a few attempts, the herb breaks into little pieces, rendering it useless. Guess ${profileData.pronounArray[0]} ${(profileData.pronounArray[5] == 'singular') ? 'has' : 'have'} to try again...*`;
							}
							else {

								embed.description = `*${profileData.name} takes a ${chosenItemName}. After a bit of preparation, ${profileData.pronounArray[0]} give${(profileData.pronounArray[5] == 'singular') ? 's' : ''} it to ${chosenProfileData.name}. But no matter how long they wait, it does not seem to help. Looks like ${profileData.name} chose the wrong herb!*`;
							}

							embed.footer.text = `${embedFooterStatsText}\n\n-1 ${chosenItemName} for ${message.guild.name}`;
						}
					}

					embedArray.length = embedArrayOriginalLength;
					embedArray.push(embed);

					if (chosenProfileData.injuryArray[2] > 0 && chosenProfileData.userId != profileData.userId && profileData.injuryArray[2] < 1 && Loottable(10, 1 <= 3)) {

						healthPoints = Loottable(5, 3);

						if (profileData.health - healthPoints < 0) {

							healthPoints = profileData.health;
						}

						profileData = await profileModel
							.findOneAndUpdate(
								{ userId: message.author.id, serverId: message.guild.id },
								{ $inc: { health: -healthPoints } },
								{ upsert: true, new: true },
							)
							.catch((error) => {
								throw new Error(error);
							});

						++userInjuryArray[2];

						await embedArray.push({
							color: profileData.color,
							description: `*Suddenly, ${profileData.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${chosenProfileData.name}, who was coughing as well. That was probably not the best idea!*`,
							footer: { text: `-${healthPoints} HP (from cold)` },
						});
					}

					botReply = await interaction.message
						.edit({
							embeds: embedArray,
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

					await condition.decreaseHealth(message, profileData, botReply);

					profileData = await profileModel
						.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{ $set: { injuryArray: userInjuryArray } },
							{ upsert: true, new: true },
						)
						.catch((error) => {
							throw new Error(error);
						});

					await levels.levelCheck(message, profileData, botReply);

					if (await checkValidity.isPassedOut(message, profileData)) {

						await levels.decreaseLevel(message, profileData);
					}

					return;
				}

				await interactionCollector();
			});
		}


		async function getUserList() {

			const componentArray = [];

			if (allHurtProfilesArray > 0) {

				componentArray.push(userSelectMenu);
			}

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} sits in front of the medicine den, looking if anyone needs help with injuries or illnesses.*`,
			});

			botReply = await message.reply({ embeds: embedArray, components: componentArray });
		}

		async function getWoundList(healUser) {

			chosenProfileData = await profileModel.findOne({
				userId: healUser.id,
				serverId: message.guild.id,
			});

			let healUserConditionText = '';

			healUserConditionText += (chosenProfileData.health <= 0) ? '\nHealth: 0' : '';
			healUserConditionText += (chosenProfileData.energy <= 0) ? '\nEnergy: 0' : '';
			healUserConditionText += (chosenProfileData.hunger <= 0) ? '\nHunger: 0' : '';
			healUserConditionText += (chosenProfileData.thirst <= 0) ? '\nThirst: 0' : '';
			healUserConditionText += (chosenProfileData.injuryArray[0] >= 1) ? `\nWounds: ${chosenProfileData.injuryArray[0]}` : '';
			healUserConditionText += (chosenProfileData.injuryArray[1] >= 1) ? `\nInfections: ${chosenProfileData.injuryArray[0]}` : '';
			healUserConditionText += (chosenProfileData.injuryArray[2] >= 1) ? '\nCold: yes' : '';
			healUserConditionText += (chosenProfileData.injuryArray[3] >= 1) ? `\nSprains: ${chosenProfileData.injuryArray[0]}` : '';
			healUserConditionText += (chosenProfileData.injuryArray[4] >= 1) ? '\nPoison: yes' : '';

			const inventoryPageSelectMenu = {
				type: 'ACTION_ROW',
				components: [{
					type: 'SELECT_MENU',
					customId: 'heal-pages',
					placeholder: 'Select an inventory page',
					options: [
						{ label: 'Page 1', value: 'heal-page1', description: 'common herbs', emoji: '🌱' },
						{ label: 'Page 2', value: 'heal-page2', description: 'uncommon & rare herbs', emoji: '🍀' },
					],
				}],
			};

			const embed = {
				color: profileData.color,
				description: '',
				footer: { text: '' },
			};

			if (chosenProfileData.userId == profileData.userId) {

				embed.description = `*${profileData.name} pushes aside the leaves acting as the entrance to the healer’s den. With tired eyes they inspect the rows of herbs, hoping to find one that can ease their pain.*`;
				embed.footer.text = `${chosenProfileData.name}'s stats/illnesses/injuries:${healUserConditionText}`;
			}
			else if (chosenProfileData.energy <= 0 || chosenProfileData.health <= 0 || chosenProfileData.hunger <= 0 || chosenProfileData.thirst <= 0) {

				embed.description = `*${profileData.name} runs towards the pack borders, where ${chosenProfileData.name} lies, only barely conscious. The ${profileData.rank.toLowerCase()} immediately looks for the right herbs to help the ${chosenProfileData.species}.*`;
				embed.footer.text = `${chosenProfileData.name}'s stats/illnesses/injuries:${healUserConditionText}`;
			}
			else if (chosenProfileData.injuryArray.some((element) => element > 0)) {

				embed.description = `*${chosenProfileData.name} enters the medicine den with tired eyes.* "Please help me!" *${chosenProfileData.pronounArray[0]} say${(chosenProfileData.pronounArray[5] == 'singular') ? 's' : ''}, ${chosenProfileData.pronounArray[2]} face contorted in pain. ${profileData.name} looks up with worry.* "I'll see what I can do for you."`;
				embed.footer.text = `${chosenProfileData.name}'s stats/illnesses/injuries:${healUserConditionText}`;
			}
			else {

				embed.description = `*${profileData.name} approaches ${chosenProfileData.name}, desperately searching for someone to help.*\n"Do you have any injuries or illnesses you know of?" *the ${profileData.species} asks.\n${chosenProfileData.name} shakes ${chosenProfileData.pronounArray[2]} head.* "Not that I know of, no."\n*Disappointed, ${profileData.name} goes back to the medicine den.*`;

				embedArray.push(embed);

				return botReply = await message.reply({ embeds: embedArray, components: [userSelectMenu] });
			}

			embedArray.length = embedArrayOriginalLength;
			embedArray.push(embed);

			if (!botReply) {

				return botReply = await message.reply({ embeds: embedArray, components: [userSelectMenu, inventoryPageSelectMenu] });
			}
			else {

				return botReply = await botReply.edit({ embeds: embedArray, components: [userSelectMenu, inventoryPageSelectMenu] });
			}
		}

		function Loottable(max, min) {

			return Math.floor(Math.random() * max) + min;
		}
	},
};