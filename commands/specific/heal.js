const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const profileModel = require('../../models/profileSchema');
const config = require('../../config.json');
const arrays = require('../../utils/arrays');

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

			return await message.reply({ embeds: embedArray });
		}

		let allHurtProfilesArray = await profileModel.find({
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

			const user = await client.users.fetch(allHurtProfilesArray[i]);

			const userProfileData = await profileModel.findOne({
				userId: user.id,
				serverId: message.guild.id,
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

			await botReply.edit({
				components: [],
			});
			return client.off('messageCreate', removeHealComponents);
		});

		await interactionCollector();

		async function interactionCollector() {

			async function filter(i) {

				if (!i.message.reference || !i.message.reference.messageId) {

					return false;
				}

				const userMessage = await i.channel.messages.fetch(i.message.reference.messageId);
				return userMessage.id == message.id && i.user.id == message.author.id;
			}

			const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 60000 });
			collector.on('end', async (collected) => {

				if (!collected.size) {

					return await botReply.edit({
						components: [],
					});
				}

				const interaction = collected.first();

				if (allHurtProfilesArray.includes(interaction.values[0])) {

					const partnerProfileData = await profileModel.findOne({
						userId: interaction.values[0],
						serverId: message.guild.id,
					});

					if (partnerProfileData.name === '' || partnerProfileData.species === '') {

						embedArray.length = embedArrayOriginalLength;
						embedArray.push({
							color: config.default_color,
							author: { name: message.guild.name, icon_url: message.guild.iconURL() },
							title: 'The mentioned user has no account or the account was not completed!',
						});

						allHurtProfilesArray.splice(allHurtProfilesArray.indexOf(interaction.values[0]), 1);

						botReply = await interaction.message.edit({ embeds: embedArray });
					}
					else {
						chosenUser = await client.users.fetch(interaction.values[0]);
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

						const user = await client.users.fetch(allHurtProfilesArray[i]);

						const userProfileData = await profileModel.findOne({
							userId: user.id,
							serverId: message.guild.id,
						});

						userSelectMenu.components[0].options.push({ label: userProfileData.name, value: user.id });
					}

					userSelectMenu.components[0].options.push({ lavel: 'Show more user options', value: 'heal_user_page', description: `You are currently on page ${currentUserPage + 1}`, emoji: '📋' });

					const componentArray = interaction.message.components;
					await componentArray.splice(0, 1, userSelectMenu);

					botReply = await interaction.message.edit({ components: componentArray });
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

					botReply = await interaction.message.edit({ embeds: embedArray, components: componentArray });
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

					botReply = await interaction.message.edit({ embeds: embedArray, components: componentArray });
				}

				// TO DO: Fix MaksiRose/paw-and-paper#3
				if (arrays.commonPlantNamesArray.includes(interaction.values[0]) || arrays.uncommonPlantNamesArray.includes(interaction.values[0]) || arrays.rarePlantNamesArray.includes(interaction.values[0]) || interaction.values[0] == 'water') {
					condition.depleteThirst(message, profileData);
					condition.depleteHunger(message, profileData);
					condition.depleteEnergy(message, profileData);
					let gethurtlater;
					const playerhurtkind = [...profileData.injuryArray];
					let total_HP = 0;

					let total_energy = Loottable(5, 1) + extraLostEnergyPoints;
					if (profileData.energy - total_energy < 0) total_energy = total_energy - (total_energy - profileData.energy);

					let total_XP = 0;
					if (profileData.rank == 'Apprentice') {
						total_XP = Loottable(11, 5);
					}
					if (profileData.rank == 'Healer') {
						total_XP = Loottable(21, 10);
					}
					if (profileData.rank == 'Elderly') {
						total_XP = Loottable(41, 20);
					}

					const stats_profileData = await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{
							$inc: {
								energy: -total_energy,
								experience: +total_XP,
							},
						},
						{ upsert: true, new: true },
					);

					let footertext = `+${total_XP} XP (${stats_profileData.experience}/${stats_profileData.levels * 50})\n-${total_energy} energy (${stats_profileData.energy}/${stats_profileData.maxEnergy})`;
					if (hungerPoints >= 1) footertext = footertext + `\n-${hungerPoints} hunger (${stats_profileData.hunger}/${stats_profileData.maxHunger})`;
					if (thirstPoints >= 1) footertext = footertext + `\n-${thirstPoints} thirst (${stats_profileData.thirst}/${stats_profileData.maxThirst})`;


					if (interaction.values[0] == 'water') {

						if (tagged_profileData.thirst > 0) {

							if (profileData.userId == tagged_profileData.userId) {

								embed.setDescription(`*${profileData.name} thinks about just drinking some water, but that won't help with ${profileData.pronounArray[2]} issues...*"`);

							}
							else {

								embed.setDescription(`*${tagged_profileData.name} looks at ${profileData.name} with indignation.* "Being hydrated is really not my biggest problem right now!"`);

							}

							embed.setFooter(`${footertext}`);

						}
						else {

							const tagged_thist = Loottable(10, 1);

							final_profileData = await profileModel.findOneAndUpdate(
								{ userId: tagged_profileData.userId, serverId: tagged_profileData.serverId },
								{ $inc: { thirst: +tagged_thist } },
								{ upsert: true, new: true },
							);

							embed.setDescription(`*${profileData.name} takes ${tagged_profileData.name}'s body, drags it over to the river, and positions ${tagged_profileData.pronounArray[2]} head right over the water. The ${tagged_profileData.species} sticks ${tagged_profileData.pronounArray[2]} tongue out and slowly starts drinking. Immediately you can observe how the newfound energy flows through ${tagged_profileData.pronounArray[2]} body.*`);
							embed.setFooter(`${footertext}\n\n+${tagged_thirst} for ${tagged_profileData.name} (${tagged_profileData.thirst + tagged_thirst}/${tagged_profileData.maxThirst})`);

						}

						bot_reply = await bot_reply.edit({ embeds: embedArray, components: [] });

					}
					else {
						let arrayposition;
						let dataitem = [];
						let plantedible = [];
						let plantwounds = [];
						let plantinfections = [];
						let plantcolds = [];
						let plantstrains = [];
						let plantpoison = [];
						let plantenergy = [];

						if (arrays.commonPlantNamesArray.includes(interaction.values[0])) {
							arrayposition = arrays.commonPlantNamesArray.findIndex((usearg) => usearg == interaction.values[0]);
							dataitem = [...serverData.commonPlantsArray];
							plantedible = [...arrays.commonPlantEdibalityArray];
							plantwounds = [...arrays.commonPlantHealsWoundsArray];
							plantinfections = [...arrays.commonPlantHealsInfectionsArray];
							plantcolds = [...arrays.commonPlantHealsColdsArray];
							plantstrains = [...arrays.commonPlantHealsStrainsArray];
							plantpoison = [...arrays.commonPlantHealsPoisonArray];
							plantenergy = [...arrays.commonPlantGivesEnergyArray];
						}
						else if (arrays.uncommonPlantNamesArray.includes(interaction.values[0])) {
							arrayposition = arrays.uncommonPlantNamesArray.findIndex((usearg) => usearg == interaction.values[0]);
							dataitem = [...serverData.uncommonPlantsArray];
							plantedible = [...arrays.uncommonPlantEdibalityArray];
							plantwounds = [...arrays.uncommonPlantHealsWoundsArray];
							plantinfections = [...arrays.uncommonPlantHealsInfectionsArray];
							plantcolds = [...arrays.uncommonPlantHealsColdsArray];
							plantstrains = [...arrays.uncommonPlantHealsStrainsArray];
							plantpoison = [...arrays.uncommonPlantHealsPoisonArray];
							plantenergy = [...arrays.uncommonPlantGivesEnergyArray];
						}
						else if (arrays.rarePlantNamesArray.includes(interaction.values[0])) {
							arrayposition = arrays.rarePlantNamesArray.findIndex((usearg) => usearg == interaction.values[0]);
							dataitem = [...serverData.rarePlantsArray];
							plantedible = [...arrays.rarePlantEdibalityArray];
							plantwounds = [...arrays.rarePlantHealsWoundsArray];
							plantinfections = [...arrays.rarePlantHealsInfectionsArray];
							plantcolds = [...arrays.rarePlantHealsColdsArray];
							plantstrains = [...arrays.rarePlantHealsStrainsArray];
							plantpoison = [...arrays.rarePlantHealsPoisonArray];
							plantenergy = [...arrays.rarePlantGivesEnergyArray];
						}
						else {
							return console.log(`Using an item failed! Selected herb: ${interaction.values[0]}`);
						}
						await HERB_USE(arrayposition, dataitem, plantedible, plantwounds, plantinfections, plantcolds, plantstrains, plantpoison, plantenergy, tagged_profileData, interaction.values[0]);
					}

					async function HERB_USE(arrayposition, dataitem, plantedible, plantwounds, plantinfections, plantcolds, plantstrains, plantpoison, plantenergy, tagged_profileData, useitem) {
						const specieskind = species.nameArray.findIndex((speciesarg) => speciesarg == profileData.species);
						let tagged_HP = 0;
						let tagged_energy = 0;
						let tagged_hunger = 0;
						let successful = 0;
						const tagged_playerhurtkind = [...tagged_profileData.injuryArray];
						let injurytext = '';
						let statstext = '';
						let hptext = '';

						dataitem[arrayposition] = dataitem[arrayposition] - 1;

						if (plantedible[arrayposition] == 'e') {
							if (tagged_profileData.hunger <= 0) successful = 1;
							if (species.diedArray[specieskind] == 'carnivore') { tagged_hunger = 1; }
							else if (species.diedArray[specieskind] == 'herbivore' || species.diedArray[specieskind] == 'omnivore') { tagged_hunger = 5; }
							if (tagged_profileData.hunger + tagged_hunger > 100) { tagged_hunger = tagged_hunger - ((tagged_profileData.hunger + tagged_hunger) - 100); }
							if (tagged_hunger >= 1) { statstext = statstext + `\n+${tagged_hunger} hunger for ${tagged_profileData.name} (${tagged_profileData.hunger + tagged_hunger}/${tagged_profileData.maxHunger})`; }
							if (tagged_profileData.hunger <= 0) { successful = 1; }
						}
						if (tagged_profileData.health <= 0) {
							successful = 1;
							tagged_HP = Loottable(10, 1);
							hptext = `\n+${tagged_HP} HP for ${tagged_profileData.name} (${tagged_profileData.health + tagged_HP}/${tagged_profileData.maxHealth})`;
						}
						if (plantwounds[arrayposition] == true && tagged_playerhurtkind[0] > 0) {
							successful = 1;
							injurytext = injurytext + `\n-1 wound for ${tagged_profileData.name}`;
							tagged_playerhurtkind[0] = tagged_playerhurtkind[0] - 1;

							tagged_HP = Loottable(10, 1);
							if (tagged_profileData.health + tagged_HP > 100) tagged_HP = tagged_HP - ((tagged_profileData.health + tagged_HP) - 100);
							hptext = `\n+${tagged_HP} HP for ${tagged_profileData.name} (${tagged_profileData.health + tagged_HP}/${tagged_profileData.maxHealth})`;
						}
						if (plantinfections[arrayposition] == true && tagged_playerhurtkind[1] > 0) {
							successful = 1;
							injurytext = injurytext + `\n-1 infection for ${tagged_profileData.name}`;
							tagged_playerhurtkind[1] = tagged_playerhurtkind[1] - 1;

							tagged_HP = Loottable(10, 1);
							if (tagged_profileData.health + tagged_HP > 100) tagged_HP = tagged_HP - ((tagged_profileData.health + tagged_HP) - 100);
							hptext = `\n+${tagged_HP} HP for ${tagged_profileData.name} (${tagged_profileData.health + tagged_HP}/${tagged_profileData.maxHealth})`;
						}
						if (plantcolds[arrayposition] == true && tagged_playerhurtkind[2] > 0) {
							successful = 1;
							injurytext = injurytext + `\ncold healed for ${tagged_profileData.name}`;
							tagged_playerhurtkind[2] = tagged_playerhurtkind[2] - 1;

							tagged_HP = Loottable(10, 1);
							if (tagged_profileData.health + tagged_HP > 100) tagged_HP = tagged_HP - ((tagged_profileData.health + tagged_HP) - 100);
							hptext = `\n+${tagged_HP} HP for ${tagged_profileData.name} (${tagged_profileData.health + tagged_HP}/${tagged_profileData.maxHealth})`;
						}
						if (plantstrains[arrayposition] == true && tagged_playerhurtkind[3] > 0) {
							successful = 1;
							injurytext = injurytext + `\n-1 strain for ${tagged_profileData.name}`;
							tagged_playerhurtkind[3] = tagged_playerhurtkind[3] - 1;

							tagged_HP = Loottable(10, 1);
							if (tagged_profileData.health + tagged_HP > 100) tagged_HP = tagged_HP - ((tagged_profileData.health + tagged_HP) - 100);
							hptext = `\n+${tagged_HP} HP for ${tagged_profileData.name} (${tagged_profileData.health + tagged_HP}/${tagged_profileData.maxHealth})`;
						}
						if (plantpoison[arrayposition] == true && tagged_playerhurtkind[4] > 0) {
							successful = 1;
							injurytext = injurytext + `\npoison healed for ${tagged_profileData.name}`;
							tagged_playerhurtkind[4] = tagged_playerhurtkind[4] - 1;

							tagged_HP = Loottable(10, 1);
							if (tagged_profileData.health + tagged_HP > 100) tagged_HP = tagged_HP - ((tagged_profileData.health + tagged_HP) - 100);
							hptext = `\n+${tagged_HP} HP for ${tagged_profileData.name} (${tagged_profileData.health + tagged_HP}/${tagged_profileData.maxHealth})`;
						}
						if (plantenergy[arrayposition] == true) {
							if (tagged_profileData.energy <= 0) successful = 1;
							tagged_energy = 30;
							if (tagged_profileData.energy + tagged_energy > 100) { tagged_energy = tagged_energy - ((tagged_profileData.energy + tagged_energy) - 100); }
							if (tagged_energy >= 1) { statstext = statstext + `\n+${tagged_energy} energy for ${tagged_profileData.name} (${tagged_profileData.energy + tagged_energy}/${tagged_profileData.maxEnergy})`; }
						}

						if (successful == 1 && tagged_profileData.userId == profileData.userId) {
							const level_boost = (profileData.levels - 1) * 5;
							if (Loottable(100 + level_boost, 1) <= 60) successful = 2;
						}

						await serverModel.findOneAndUpdate(
							{ serverId: message.guild.id },
							{ $set: { commonPlantsArray: dataitem } },
							{ upsert: true, new: true },
						);

						if (successful == 1) {
							final_profileData = await profileModel.findOneAndUpdate(
								{ userId: tagged_profileData.userId, serverId: tagged_profileData.serverId },
								{
									$set: { injuryArray: tagged_playerhurtkind },
									$inc: {
										health: +tagged_HP,
										energy: +tagged_energy,
										hunger: +tagged_hunger,
									},
								},
								{ upsert: true, new: true },
							);
							if (tagged_profileData.userId == profileData.userId) {
								if (profileData.pronounArray[5] == 'singular') {
									embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, the ${profileData.species} can apply it correctly. Immediately you can see the effect. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} feels much better!*`);
								}
								else if (profileData.pronounArray[5] == 'plural') {
									embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, the ${profileData.species} can apply it correctly. Immediately you can see the effect. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} feel much better!*`);
								}
							}
							else if (profileData.pronounArray[5] == 'singular') {
								if (tagged_profileData.pronounArray[5] == 'singular') {
									embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, ${profileData.pronounArray[0]} gives it to ${tagged_profileData.name}. Immediately you can see the effect. ${tagged_profileData.pronounArray[0].charAt(0).toUpperCase()}${tagged_profileData.pronounArray[0].slice(1)} feels much better!*`);
								}
								else if (tagged_profileData.pronounArray == 'plural') {
									embed.setDescription(`*${profileData.name} takes a ${useitem}. After a  bit of preparation, ${profileData.pronounArray[0]} gives it to ${tagged_profileData.name}. Immediately you can see the effect. ${tagged_profileData.pronounArray[0].charAt(0).toUpperCase()}${tagged_profileData.pronounArray[0].slice(1)} feel much better!*`);
								}
							}
							else if (profileData.pronounArray[5] == 'plural') {
								if (tagged_profileData.pronounArray[5] == 'singular') {
									embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, ${profileData.pronounArray[0]} give it to ${tagged_profileData.name}. Immediately you can see the effect. ${tagged_profileData.pronounArray[0].charAt(0).toUpperCase()}${tagged_profileData.pronounArray[0].slice(1)} feels much better!*`);
								}
								else if (tagged_profileData.pronounArray == 'plural') {
									embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, ${profileData.pronounArray[0]} give it to ${tagged_profileData.name}. Immediately you can see the effect. ${tagged_profileData.pronounArray[0].charAt(0).toUpperCase()}${tagged_profileData.pronounArray[0].slice(1)} feel much better!*`);
								}
							}
							embed.setFooter(`${footertext}\n${statstext} ${hptext} ${injurytext}\n\n-1 ${useitem} for ${message.guild.name}`);
							embedArray.splice(-2, 2, embed);
							bot_reply = await bot_reply.edit({ embeds: embedArray, components: [] });
						}
						else {
							final_profileData = await profileModel.findOne({ userId: tagged_profileData.userId, serverId: tagged_profileData.serverId });
							if (successful == 2) {
								if (profileData.pronounArray[5] == 'singular') {
									embed.setDescription(`*${profileData.name} holds the ${useitem} in ${profileData.pronounArray[2]} mouth, trying to find a way to apply it. After a few attempts, the herb breaks into little pieces, rendering it useless. Guess ${profileData.pronounArray[0]} has to try again...*`);
								}
								else if (profileData.pronounArray[5] == 'plural') {
									embed.setDescription(`*${profileData.name} holds the ${useitem} in ${profileData.pronounArray[2]} mouth, trying to find a way to apply it. After a few attempts, the herb breaks into little pieces, rendering it useless. Guess ${profileData.pronounArray[0]} have to try again...*`);
								}
							}
							else if (profileData.pronounArray[5] == 'singular') {
								embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, ${profileData.pronounArray[0]} gives it to ${tagged_profileData.name}. But no matter how long they wait, it does not seem to help. Looks like ${profileData.name} chose the wrong herb!*`);
							}
							else if (profileData.pronounArray[5] == 'plural') {
								embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, ${profileData.pronounArray[0]} give it to ${tagged_profileData.name}. But no matter how long they wait, it does not seem to help. Looks like ${profileData.name} chose the wrong herb!*`);
							}
							embed.setFooter(`${footertext}\n\n-1 ${useitem} for ${message.guild.name}`);
							embedArray.splice(-2, 2, embed);
							bot_reply = await bot_reply.edit({ embeds: embedArray, components: [] });
						}
						if (tagged_profileData.injuryArray[2] == 1 && tagged_profileData.userId != profileData.userId && profileData.injuryArray[2] == 0 && Loottable(10, 1 <= 3)) {
							gethurtlater = 1;
							total_HP = Loottable(5, 3);

							if (profileData.health - total_HP < 0) total_HP = total_HP - (total_HP - profileData.health);

							await profileModel.findOneAndUpdate(
								{ userId: message.author.id, serverId: message.guild.id },
								{ $inc: { health: -total_HP } },
								{ upsert: true, new: true },
							);

							playerhurtkind[2] = playerhurtkind[2] + 1;

							embed2.setDescription(`*Suddenly, ${profileData.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${tagged_profileData.name}, who was coughing as well. That was probably not the best idea!*`);
							embed2.setFooter(`-${total_HP} HP (from cold)`);

							await embedArray.push(embed2);
							await bot_reply.edit({ embeds: embedArray });
						}
					}

					await damage.unhealedDamage(message, final_profileData, bot_reply);
					total_HP = total_HP + extra_lost_HP;

					if (gethurtlater == 1) {
						await profileModel.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{ $set: { injuryArray: playerhurtkind } },
							{ upsert: true, new: true },
						);
					}

					await levels.levelCheck(message, profileData, total_XP, bot_reply);

					if (stats_profileData.energy === 0 || stats_profileData.maxHealth - total_HP === 0 || stats_profileData.hunger === 0 || stats_profileData.thirst === 0) {
						passedout.passedOut(message, profileData);

						let newlevel = profileData.levels;
						newlevel = Math.round(newlevel - (newlevel / 10));

						arrays.species(profileData);
						const profile_inventory = [[], [], [], []];
						for (let i = 0; i < arrays.commonPlantNamesArray.length; i++) profile_inventory[0].push(0);
						for (let i = 0; i < arrays.uncommonPlantNamesArray.length; i++) profile_inventory[1].push(0);
						for (let i = 0; i < arrays.rarePlantNamesArray.length; i++) profile_inventory[2].push(0);
						for (let i = 0; i < species.nameArray.length; i++) profile_inventory[3].push(0);

						await profileModel.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{
								$set: {
									levels: newlevel,
									experience: 0,
									inventoryArray: profile_inventory,
								},
							},
							{ upsert: true, new: true },
						);
					}

					await client.off('interactionCreate', heal_interaction);
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

			const partnerProfileData = await profileModel.findOne({
				userId: healUser.id,
				serverId: message.guild.id,
			});

			let healUserConditionText = '';

			healUserConditionText += (partnerProfileData.health <= 0) ? '\nHealth: 0' : '';
			healUserConditionText += (partnerProfileData.energy <= 0) ? '\nEnergy: 0' : '';
			healUserConditionText += (partnerProfileData.hunger <= 0) ? '\nHunger: 0' : '';
			healUserConditionText += (partnerProfileData.thirst <= 0) ? '\nThirst: 0' : '';
			healUserConditionText += (partnerProfileData.injuryArray[0] >= 1) ? `\nWounds: ${partnerProfileData.injuryArray[0]}` : '';
			healUserConditionText += (partnerProfileData.injuryArray[1] >= 1) ? `\nInfections: ${partnerProfileData.injuryArray[0]}` : '';
			healUserConditionText += (partnerProfileData.injuryArray[2] >= 1) ? '\nCold: yes' : '';
			healUserConditionText += (partnerProfileData.injuryArray[3] >= 1) ? `\nSprains: ${partnerProfileData.injuryArray[0]}` : '';
			healUserConditionText += (partnerProfileData.injuryArray[4] >= 1) ? '\nPoison: yes' : '';

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

			if (partnerProfileData.userId == profileData.userId) {

				embed.description = `*${profileData.name} pushes aside the leaves acting as the entrance to the healer’s den. With tired eyes they inspect the rows of herbs, hoping to find one that can ease their pain.*`;
				embed.footer.text = `${partnerProfileData.name}'s stats/illnesses/injuries:${healUserConditionText}`;
			}
			else if (partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0) {

				embed.description = `*${profileData.name} runs towards the pack borders, where ${partnerProfileData.name} lies, only barely conscious. The ${profileData.rank.toLowerCase()} immediately looks for the right herbs to help the ${partnerProfileData.species}.*`;
				embed.footer.text = `${partnerProfileData.name}'s stats/illnesses/injuries:${healUserConditionText}`;
			}
			else if (partnerProfileData.injuryArray.some((element) => element > 0)) {

				embed.description = `*${partnerProfileData.name} enters the medicine den with tired eyes.* "Please help me!" *${partnerProfileData.pronounArray[0]} say${(partnerProfileData.pronounArray[5] == 'singular') ? 's' : ''}, ${partnerProfileData.pronounArray[2]} face contorted in pain. ${profileData.name} looks up with worry.* "I'll see what I can do for you."`;
				embed.footer.text = `${partnerProfileData.name}'s stats/illnesses/injuries:${healUserConditionText}`;
			}
			else {

				embed.description = `*${profileData.name} approaches ${partnerProfileData.name}, desperately searching for someone to help.*\n"Do you have any injuries or illnesses you know of?" *the ${profileData.species} asks.\n${partnerProfileData.name} shakes ${partnerProfileData.pronounArray[2]} head.* "Not that I know of, no."\n*Disappointed, ${profileData.name} goes back to the medicine den.*`;

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
	},
};