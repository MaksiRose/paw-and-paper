const missing = require("../../utils/checkAccountCompletion");
const profileModel = require("../../models/profileSchema");
const serverModel = require("../../models/serverSchema");
const arrays = require("../../utils/arrays");
const condition = require("../../utils/condition");
const levels = require("../../utils/levels");

module.exports = {
	name: "heal",
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {
		await message.channel.sendTyping()
		if (!profileData || profileData.name === "") return missing.missingName(message);
		if (profileData.species === "") return missing.missingSpecies(message, profileData);
		if (profileData.energy <= 0 || profileData.health <= 0 || profileData.hunger <= 0 || profileData.thirst <= 0) return passedout.passedOut(message, profileData);
		if (profileData.hasCooldown === true) return cooldown.cooldownMessage(message, profileData);
		if (profileData.hasQuest == true) return quest.quest(message, profileData)

		if (profileData.isResting === true) await isresting.isResting(message, profileData, embedArray);
		await cooldown.commandCooldown(message);
		arrays.commonPlantNames();
		arrays.uncommonPlantNames();
		arrays.rarePlantNames();
		function Loottable(max, min) { return Math.floor(Math.random() * max + min) }
		let tagged_profileData;

		const embed = new Discord.MessageEmbed()
			.setAuthor(`${profileData.name}`, `${profileData.avatarURL}`)
			.setColor(`${profileData.color}`)
		const embed2 = new Discord.MessageEmbed()
			.setAuthor(`${profileData.name}`, `${profileData.avatarURL}`)
			.setColor(`${profileData.color}`)
		const embed3 = new Discord.MessageEmbed()
			.setColor(`${profileData.color}`)
			.setTitle(`Inventory of ${message.guild.name} - Page 1`)
			.setFooter(`Choose one of the herbs above to heal the player with it!`)
		const menu3 = new Discord.MessageSelectMenu()
			.setCustomId('heal-options1')
			.setPlaceholder('Select an item')
		for (let i = 0; i < arrays.commonPlantNamesArray.length; i++) {
			if (serverData.commonPlantsArray[i] > 0) {
				await embed3.addField(`${arrays.commonPlantNamesArray[i]}: ${serverData.commonPlantsArray[i]}`, `${arrays.commonPlantDescriptionsArray[i]}`, true);
				await menu3.addOptions({ label: arrays.commonPlantNamesArray[i], value: arrays.commonPlantNamesArray[i], description: `${serverData.commonPlantsArray[i]}` });
			}
		}
		const embed4 = new Discord.MessageEmbed()
			.setColor(`${profileData.color}`)
			.setTitle(`Inventory of ${message.guild.name} - Page 2`)
			.setFooter(`Choose one of the herbs above to heal the player with it!`)
		const menu4 = new Discord.MessageSelectMenu()
			.setCustomId('heal-options2')
			.setPlaceholder('Select an item')
		for (let i = 0; i < arrays.uncommonPlantNamesArray.length; i++) {
			if (serverData.uncommonPlantsArray[i] > 0) {
				await embed4.addField(`${arrays.uncommonPlantNamesArray[i]}: ${serverData.uncommonPlantsArray[i]}`, `${arrays.uncommonPlantDescriptionsArray[i]}`, true);
				await menu4.addOptions({ label: arrays.uncommonPlantNamesArray[i], value: arrays.uncommonPlantNamesArray[i], description: `${serverData.uncommonPlantsArray[i]}` });
			}
		}
		for (let i = 0; i < arrays.rarePlantNamesArray.length; i++) {
			if (serverData.rarePlantsArray[i] > 0) {
				await embed4.addField(`${arrays.rarePlantNamesArray[i]}: ${serverData.rarePlantsArray[i]}`, `${arrays.rarePlantDescriptionsArray[i]}`, true);
				await menu4.addOptions({ label: arrays.rarePlantNamesArray[i], value: arrays.rarePlantNamesArray[i], description: `${serverData.rarePlantsArray[i]}` });
			}
		}
		await embed4.addField('water', `Found lots and lots of in the river that flows through the pack!`, true);
		await menu4.addOptions({ label: 'water', value: 'water' });
		const row3 = new Discord.MessageActionRow().addComponents(menu3);
		const row4 = new Discord.MessageActionRow().addComponents(menu4);

		const docs = await profileModel.find({
			$and: [{
				serverId: message.guild.id,
				$or: [
					{ energy: 0 },
					{ health: 0 },
					{ hunger: 0 },
					{ thirst: 0 },
					{ injuryArray: { $gte: 1 } }
				]
			}]
		});
		let allpeople = docs.map(doc => doc.userId);
		const menu = new Discord.MessageSelectMenu()
			.setCustomId('heal-user-options')
			.setPlaceholder('Select a user to heal')
		if (allpeople.length > 25) {
			for (i = 0; i < 24; i++) {
				await client.users.fetch(allpeople[i]).then(async (user) => {
					let option_profileModel = await profileModel.findOne({ userId: user.id, serverId: message.guild.id })
					menu.addOptions({ label: option_profileModel.name, value: user.id });
				});
			}
			await menu.addOptions({ label: 'Show more user options', value: 'heal_user_page', description: 'You are currently on page 1', emoji: '📋' });
		} else {
			for (i = 0; i < allpeople.length; i++) {
				await client.users.fetch(allpeople[i]).then(async (user) => {
					let option_profileModel = await profileModel.findOne({ userId: user.id, serverId: message.guild.id })
					menu.addOptions({ label: option_profileModel.name, value: user.id });
				});
			}
		}
		let index = 0;

		const row = new Discord.MessageActionRow().addComponents(menu);

		const row2 = new Discord.MessageActionRow().addComponents(
			new Discord.MessageSelectMenu()
				.setCustomId('heal-pages')
				.setPlaceholder('Select an inventory page')
				.addOptions(
					{ label: 'Page 1', value: 'heal-page1', description: 'common herbs', emoji: '🌱' },
					{ label: 'Page 2', value: 'heal-page2', description: 'uncommon & rare herbs', emoji: '🍀' }
				)
		)
		let bot_reply;
		let final_profileData;

		if (profileData.rank === "Youngling" || profileData.rank === "Hunter") {
			embed.setDescription(`*A healer rushes into the medicine den in fury.*\n"${profileData.name}, you are not trained to heal yourself, and especially not to heal others! I don't ever wanna see you again in here without supervision!"\n*${profileData.name} lowers ${profileData.pronounArray[2]} head and leaves in shame.*`);
			embedArray.push(embed);
			return await message.reply({ embeds: embedArray });
		} else if (!message.mentions.users.size) {
			embed.setDescription(`*${profileData.name} sits in front of the medicine den, looking if anyone condition help with injuries or illnesses.*`);
			embedArray.push(embed);
			if (allpeople.length == 0) bot_reply = await message.reply({ embeds: embedArray });
			else bot_reply = await message.reply({ embeds: embedArray, components: [row] });
		} else {
			try {
				tagged_profileData = await profileModel.findOne({ userId: message.mentions.users.first().id, serverId: message.guild.id })
			} catch (err) {
				console.log(err);
			}

			if (!tagged_profileData || tagged_profileData.name === "" || tagged_profileData.species === "") {
				embed.setAuthor(message.guild.name, message.guild.iconURL());
				embed.setColor('#9d9e51');
				embed.setTitle(`The mentioned user has no account or the account was not completed!`);
				embedArray.push(embed);
				if (allpeople.length == 0) bot_reply = await message.reply({ embeds: embedArray });
				else bot_reply = await message.reply({ embeds: embedArray, components: [row] });
			} else {
				HURT_PLAYER_EMBED(tagged_profileData);
			}
		}
		async function HURT_PLAYER_EMBED(tagged_profileData) {
			let taggeduser_statstext = "";
			if (tagged_profileData.health <= 0) { taggeduser_statstext = taggeduser_statstext + `\nHealth: 0` }
			if (tagged_profileData.energy <= 0) { taggeduser_statstext = taggeduser_statstext + `\nEnergy: 0` }
			if (tagged_profileData.hunger <= 0) { taggeduser_statstext = taggeduser_statstext + `\nHunger: 0` }
			if (tagged_profileData.thirst <= 0) { taggeduser_statstext = taggeduser_statstext + `\nThirst: 0` }
			if (tagged_profileData.injuryArray[0] >= 1) { taggeduser_statstext = taggeduser_statstext + `\nWounds: ${tagged_profileData.injuryArray[0]}` }
			if (tagged_profileData.injuryArray[1] >= 1) { taggeduser_statstext = taggeduser_statstext + `\nInfections: ${tagged_profileData.injuryArray[1]}` }
			if (tagged_profileData.injuryArray[2] >= 1) { taggeduser_statstext = taggeduser_statstext + `\nCold: yes` }
			if (tagged_profileData.injuryArray[3] >= 1) { taggeduser_statstext = taggeduser_statstext + `\nSprains: ${tagged_profileData.injuryArray[3]}` }
			if (tagged_profileData.injuryArray[4] >= 1) { taggeduser_statstext = taggeduser_statstext + `\nPoison: ${tagged_profileData.injuryArray[4]}` }

			if (tagged_profileData.userId == profileData.userId) {
				embed2.setDescription(`*${profileData.name} pushes aside the leaves acting as the entrance to the healer’s den. With tired eyes they inspect the rows of herbs, hoping to find one that can ease their pain.*`);
				embed2.setFooter(`${tagged_profileData.name}'s stats/illnesses/injuries:${taggeduser_statstext}`)
			} else if (tagged_profileData.energy <= 0 || tagged_profileData.health <= 0 || tagged_profileData.hunger <= 0 || tagged_profileData.thirst <= 0) {
				embed2.setDescription(`*${profileData.name} runs towards the pack borders, where ${tagged_profileData.name} lies, only barely conscious. The ${profileData.rank.toLowerCase()} immediately looks for the right herbs to help the ${tagged_profileData.species}.*`);
				embed2.setFooter(`${tagged_profileData.name}'s stats/illnesses/injuries:${taggeduser_statstext}`)
			} else if (tagged_profileData.injuryArray[0] > 0 || tagged_profileData.injuryArray[1] > 0 || tagged_profileData.injuryArray[2] > 0 || tagged_profileData.injuryArray[3] > 0 || tagged_profileData.injuryArray[4] > 0) {
				if (tagged_profileData.pronounArray[5] == "singular") {
					embed2.setDescription(`*${tagged_profileData.name} enters the medicine den with tired eyes.* "Please help me!" *${tagged_profileData.pronounArray[0]} says, ${tagged_profileData.pronounArray[2]} face contorted in pain. ${profileData.name} looks up with worry.* "I'll see what I can do for you."`)
				} else if (tagged_profileData.pronounArray[5] == "plural") {
					embed2.setDescription(`*${tagged_profileData.name} enters the medicine den with tired eyes.* "Please help me!" *${tagged_profileData.pronounArray[0]} say, ${tagged_profileData.pronounArray[2]} face contorted in pain. ${profileData.name} looks up with worry.* "I'll see what I can do for you."`)
				}
				embed2.setFooter(`${tagged_profileData.name}'s stats/illnesses/injuries:${taggeduser_statstext}`)
			} else {
				embed2.setDescription(`*${profileData.name} approaches ${tagged_profileData.name}, desperately searching for someone to help.*\n"Do you have any injuries or illnesses you know of?" *the ${profileData.species} asks.\n${tagged_profileData.name} shakes ${tagged_profileData.pronounArray[2]} head.* "Not that I know of, no."\n*Disappointed, ${profileData.name} goes back to the medicine den.*`);
				embedArray.push(embed2);
				if (allpeople.length == 0) return bot_reply = await message.reply({ embeds: embedArray });
				else return bot_reply = await message.reply({ embeds: embedArray, components: [row] });
			}
			if (!bot_reply) {
				embedArray.push(embed2);
				return bot_reply = await message.reply({ embeds: embedArray, components: [row, row2] });
			} else {
				embedArray.splice(-1, 1, embed2);
				return await bot_reply.edit({ embeds: embedArray, components: [row, row2] })
			}
		}
		client.on('messageCreate', async function remove_heal_components(message) {
			if (!bot_reply) return;
			if (!message.channel.messages.cache.get(bot_reply.id)) return client.off('messageCreate', remove_heal_components);
			let author_message = await message.channel.messages.fetch(bot_reply.reference.messageId);
			if (message.author.id != author_message.author.id) return;
			if (!message.content.toLowerCase().startsWith(config.PREFIX)) return;
			if (!client.commands.get(message.content.slice(config.PREFIX.length).trim().split(/ +/).shift().toLowerCase())) return;

			try {
				await bot_reply.edit({ components: [] });
			} catch (err) { return; }
			client.off('messageCreate', remove_heal_components);
		});

		client.on('interactionCreate', async function heal_interaction(interaction) {
			let author_message = await interaction.channel.messages.fetch(interaction.message.reference.messageId);
			if (author_message.id != message.id) return;
			if (author_message.author.id != interaction.user.id) return;

			if (interaction.isSelectMenu()) {
				if (interaction.values[0] == 'heal_user_page') {
					index++;
					if (index >= Math.ceil(allpeople.length / 24)) index = 0;

					const menu5 = new Discord.MessageSelectMenu()
						.setCustomId('heal-user-options')
						.setPlaceholder('Select a user to heal')
					if (allpeople.length < 24 + (index * 24)) {
						for (i = 0 + (index * 24); i < allpeople.length; i++) {
							await client.users.fetch(allpeople[i]).then(async (user) => {
								let option_profileModel = await profileModel.findOne({ userId: user.id, serverId: message.guild.id })
								menu5.addOptions({ label: option_profileModel.name, value: user.id });
							});
						}
					} else {
						for (i = 0 + (index * 24); i < 24 + (index * 24); i++) {
							await client.users.fetch(allpeople[i]).then(async (user) => {
								let option_profileModel = await profileModel.findOne({ userId: user.id, serverId: message.guild.id })
								menu5.addOptions({ label: option_profileModel.name, value: user.id });
							});
						}
					}
					await menu5.addOptions({ label: 'Show more user options', value: 'heal_user_page', description: `You are currently on page ${index + 1}`, emoji: '📋' });
					const row5 = new Discord.MessageActionRow().addComponents(menu5);

					let all_components = interaction.message.components;
					await all_components.splice(0, 1, row5);
					await interaction.message.edit({ components: all_components });
				} else if (allpeople.includes(interaction.values[0])) {
					try {
						tagged_profileData = await profileModel.findOne({ userId: interaction.values[0], serverId: message.guild.id })
					} catch (err) {
						console.log(err);
					}

					if (tagged_profileData.name === "" || tagged_profileData.species === "") {
						embed.setAuthor(message.guild.name, message.guild.iconURL());
						embed.setColor('#9d9e51');
						embed.setTitle(`The mentioned user has no account or the account was not completed!`);
						embedArray.splice(-1, 1, embed);
						if (allpeople.length == 0) await bot_reply.edit({ embeds: embedArray });
						else await bot_reply.edit({ embeds: embedArray, components: [row] });
					} else {
						HURT_PLAYER_EMBED(tagged_profileData);
					}
				} else if (interaction.values[0] == 'heal-page1') {
					if (embedArray[embedArray.length - 1] == embed3 || embedArray[embedArray.length - 1] == embed4) {
						embedArray.splice(-1, 1, embed3)
					} else {
						embedArray.push(embed3)
					}
					await bot_reply.edit({ embeds: embedArray, components: [row, row2, row3] })
				} else if (interaction.values[0] == 'heal-page2') {
					if (embedArray[embedArray.length - 1] == embed3 || embedArray[embedArray.length - 1] == embed4) {
						embedArray.splice(-1, 1, embed4)
					} else {
						embedArray.push(embed4)
					}
					await bot_reply.edit({ embeds: embedArray, components: [row, row2, row4] });
				} else if (arrays.commonPlantNamesArray.includes(interaction.values[0]) || arrays.uncommonPlantNamesArray.includes(interaction.values[0]) || arrays.rarePlantNamesArray.includes(interaction.values[0]) || interaction.values[0] == 'water') {
					condition.depleteThirst(message, profileData);
					condition.depleteHunger(message, profileData);
					condition.depleteEnergy(message, profileData);
					let gethurtlater;
					let playerhurtkind = [...profileData.injuryArray];
					let total_HP = 0

					let total_energy = Loottable(5, 1) + extraLostEnergyPoints;
					if (profileData.energy - total_energy < 0) total_energy = total_energy - (total_energy - profileData.energy);

					let total_XP = 0;
					if (profileData.rank == "Apprentice") {
						total_XP = Loottable(11, 5);
					}
					if (profileData.rank == "Healer") {
						total_XP = Loottable(21, 10);
					}
					if (profileData.rank == "Elderly") {
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
						{ upsert: true, new: true }
					);

					let footertext = `+${total_XP} XP (${stats_profileData.experience}/${stats_profileData.levels * 50})\n-${total_energy} energy (${stats_profileData.energy}/${stats_profileData.maxEnergy})`;
					if (hungerPoints >= 1) footertext = footertext + `\n-${hungerPoints} hunger (${stats_profileData.hunger}/${stats_profileData.maxHunger})`;
					if (thirstPoints >= 1) footertext = footertext + `\n-${thirstPoints} thirst (${stats_profileData.thirst}/${stats_profileData.maxThirst})`;


					if (interaction.values[0] == 'water') {

						if (tagged_profileData.thirst > 0) {

							if (profileData.userId == tagged_profileData.userId) {

								embed.setDescription(`*${profileData.name} thinks about just drinking some water, but that won't help with ${profileData.pronounArray[2]} issues...*"`);

							} else {

								embed.setDescription(`*${tagged_profileData.name} looks at ${profileData.name} with indignation.* "Being hydrated is really not my biggest problem right now!"`);

							}

							embed.setFooter(`${footertext}`);

						} else {

							let tagged_thist = Loottable(10, 1);

							final_profileData = await profileModel.findOneAndUpdate(
								{ userId: tagged_profileData.userId, serverId: tagged_profileData.serverId },
								{ $inc: { thirst: +tagged_thist } },
								{ upsert: true, new: true }
							);

							embed.setDescription(`*${profileData.name} takes ${tagged_profileData.name}'s body, drags it over to the river, and positions ${tagged_profileData.pronounArray[2]} head right over the water. The ${tagged_profileData.species} sticks ${tagged_profileData.pronounArray[2]} tongue out and slowly starts drinking. Immediately you can observe how the newfound energy flows through ${tagged_profileData.pronounArray[2]} body.*`);
							embed.setFooter(`${footertext}\n\n+${tagged_thirst} for ${tagged_profileData.name} (${tagged_profileData.thirst + tagged_thirst}/${tagged_profileData.maxThirst})`);

						}

						bot_reply = await bot_reply.edit({ embeds: embedArray, components: [] });

					} else {
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
						} else if (arrays.uncommonPlantNamesArray.includes(interaction.values[0])) {
							arrayposition = arrays.uncommonPlantNamesArray.findIndex((usearg) => usearg == interaction.values[0]);
							dataitem = [...serverData.uncommonPlantsArray];
							plantedible = [...arrays.uncommonPlantEdibalityArray];
							plantwounds = [...arrays.uncommonPlantHealsWoundsArray];
							plantinfections = [...arrays.uncommonPlantHealsInfectionsArray];
							plantcolds = [...arrays.uncommonPlantHealsColdsArray];
							plantstrains = [...arrays.uncommonPlantHealsStrainsArray];
							plantpoison = [...arrays.uncommonPlantHealsPoisonArray];
							plantenergy = [...arrays.uncommonPlantGivesEnergyArray];
						} else if (arrays.rarePlantNamesArray.includes(interaction.values[0])) {
							arrayposition = arrays.rarePlantNamesArray.findIndex((usearg) => usearg == interaction.values[0]);
							dataitem = [...serverData.rarePlantsArray];
							plantedible = [...arrays.rarePlantEdibalityArray];
							plantwounds = [...arrays.rarePlantHealsWoundsArray];
							plantinfections = [...arrays.rarePlantHealsInfectionsArray];
							plantcolds = [...arrays.rarePlantHealsColdsArray];
							plantstrains = [...arrays.rarePlantHealsStrainsArray];
							plantpoison = [...arrays.rarePlantHealsPoisonArray];
							plantenergy = [...arrays.rarePlantGivesEnergyArray];
						} else {
							return console.log(`Using an item failed! Selected herb: ${interaction.values[0]}`)
						}
						await HERB_USE(arrayposition, dataitem, plantedible, plantwounds, plantinfections, plantcolds, plantstrains, plantpoison, plantenergy, tagged_profileData, interaction.values[0])
					}

					async function HERB_USE(arrayposition, dataitem, plantedible, plantwounds, plantinfections, plantcolds, plantstrains, plantpoison, plantenergy, tagged_profileData, useitem) {
						let specieskind = species.nameArray.findIndex((speciesarg) => speciesarg == profileData.species);
						let tagged_HP = 0;
						let tagged_energy = 0;
						let tagged_hunger = 0;
						let successful = 0;
						let tagged_playerhurtkind = [...tagged_profileData.injuryArray];
						let injurytext = "";
						let statstext = "";
						let hptext = "";

						dataitem[arrayposition] = dataitem[arrayposition] - 1;

						if (plantedible[arrayposition] == "e") {
							if (tagged_profileData.hunger <= 0) successful = 1;
							if (species.diedArray[specieskind] == "carnivore") { tagged_hunger = 1; } else if (species.diedArray[specieskind] == "herbivore" || species.diedArray[specieskind] == "omnivore") { tagged_hunger = 5; }
							if (tagged_profileData.hunger + tagged_hunger > 100) { tagged_hunger = tagged_hunger - ((tagged_profileData.hunger + tagged_hunger) - 100); }
							if (tagged_hunger >= 1) { statstext = statstext + `\n+${tagged_hunger} hunger for ${tagged_profileData.name} (${tagged_profileData.hunger + tagged_hunger}/${tagged_profileData.maxHunger})` }
							if (tagged_profileData.hunger <= 0) { successful = 1; }
						}
						if (tagged_profileData.health <= 0) {
							successful = 1;
							tagged_HP = Loottable(10, 1);
							hptext = `\n+${tagged_HP} HP for ${tagged_profileData.name} (${tagged_profileData.health + tagged_HP}/${tagged_profileData.maxHealth})`
						}
						if (plantwounds[arrayposition] == true && tagged_playerhurtkind[0] > 0) {
							successful = 1;
							injurytext = injurytext + `\n-1 wound for ${tagged_profileData.name}`
							tagged_playerhurtkind[0] = tagged_playerhurtkind[0] - 1;

							tagged_HP = Loottable(10, 1);
							if (tagged_profileData.health + tagged_HP > 100) tagged_HP = tagged_HP - ((tagged_profileData.health + tagged_HP) - 100);
							hptext = `\n+${tagged_HP} HP for ${tagged_profileData.name} (${tagged_profileData.health + tagged_HP}/${tagged_profileData.maxHealth})`
						}
						if (plantinfections[arrayposition] == true && tagged_playerhurtkind[1] > 0) {
							successful = 1;
							injurytext = injurytext + `\n-1 infection for ${tagged_profileData.name}`
							tagged_playerhurtkind[1] = tagged_playerhurtkind[1] - 1;

							tagged_HP = Loottable(10, 1);
							if (tagged_profileData.health + tagged_HP > 100) tagged_HP = tagged_HP - ((tagged_profileData.health + tagged_HP) - 100);
							hptext = `\n+${tagged_HP} HP for ${tagged_profileData.name} (${tagged_profileData.health + tagged_HP}/${tagged_profileData.maxHealth})`
						}
						if (plantcolds[arrayposition] == true && tagged_playerhurtkind[2] > 0) {
							successful = 1;
							injurytext = injurytext + `\ncold healed for ${tagged_profileData.name}`
							tagged_playerhurtkind[2] = tagged_playerhurtkind[2] - 1;

							tagged_HP = Loottable(10, 1);
							if (tagged_profileData.health + tagged_HP > 100) tagged_HP = tagged_HP - ((tagged_profileData.health + tagged_HP) - 100);
							hptext = `\n+${tagged_HP} HP for ${tagged_profileData.name} (${tagged_profileData.health + tagged_HP}/${tagged_profileData.maxHealth})`
						}
						if (plantstrains[arrayposition] == true && tagged_playerhurtkind[3] > 0) {
							successful = 1;
							injurytext = injurytext + `\n-1 strain for ${tagged_profileData.name}`
							tagged_playerhurtkind[3] = tagged_playerhurtkind[3] - 1;

							tagged_HP = Loottable(10, 1);
							if (tagged_profileData.health + tagged_HP > 100) tagged_HP = tagged_HP - ((tagged_profileData.health + tagged_HP) - 100);
							hptext = `\n+${tagged_HP} HP for ${tagged_profileData.name} (${tagged_profileData.health + tagged_HP}/${tagged_profileData.maxHealth})`
						}
						if (plantpoison[arrayposition] == true && tagged_playerhurtkind[4] > 0) {
							successful = 1;
							injurytext = injurytext + `\npoison healed for ${tagged_profileData.name}`
							tagged_playerhurtkind[4] = tagged_playerhurtkind[4] - 1;

							tagged_HP = Loottable(10, 1);
							if (tagged_profileData.health + tagged_HP > 100) tagged_HP = tagged_HP - ((tagged_profileData.health + tagged_HP) - 100);
							hptext = `\n+${tagged_HP} HP for ${tagged_profileData.name} (${tagged_profileData.health + tagged_HP}/${tagged_profileData.maxHealth})`
						}
						if (plantenergy[arrayposition] == true) {
							if (tagged_profileData.energy <= 0) successful = 1;
							tagged_energy = 30;
							if (tagged_profileData.energy + tagged_energy > 100) { tagged_energy = tagged_energy - ((tagged_profileData.energy + tagged_energy) - 100); }
							if (tagged_energy >= 1) { statstext = statstext + `\n+${tagged_energy} energy for ${tagged_profileData.name} (${tagged_profileData.energy + tagged_energy}/${tagged_profileData.maxEnergy})` }
						}

						if (successful == 1 && tagged_profileData.userId == profileData.userId) {
							let level_boost = (profileData.levels - 1) * 5;
							if (Loottable(100 + level_boost, 1) <= 60) successful = 2;
						}

						await serverModel.findOneAndUpdate(
							{ serverId: message.guild.id, },
							{ $set: { commonPlantsArray: dataitem, }, },
							{ upsert: true, new: true }
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
								{ upsert: true, new: true }
							);
							if (tagged_profileData.userId == profileData.userId) {
								if (profileData.pronounArray[5] == "singular") {
									embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, the ${profileData.species} can apply it correctly. Immediately you can see the effect. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} feels much better!*`);
								} else if (profileData.pronounArray[5] == "plural") {
									embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, the ${profileData.species} can apply it correctly. Immediately you can see the effect. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} feel much better!*`);
								}
							} else {
								if (profileData.pronounArray[5] == "singular") {
									if (tagged_profileData.pronounArray[5] == "singular") {
										embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, ${profileData.pronounArray[0]} gives it to ${tagged_profileData.name}. Immediately you can see the effect. ${tagged_profileData.pronounArray[0].charAt(0).toUpperCase()}${tagged_profileData.pronounArray[0].slice(1)} feels much better!*`)
									} else if (tagged_profileData.pronounArray == "plural") {
										embed.setDescription(`*${profileData.name} takes a ${useitem}. After a  bit of preparation, ${profileData.pronounArray[0]} gives it to ${tagged_profileData.name}. Immediately you can see the effect. ${tagged_profileData.pronounArray[0].charAt(0).toUpperCase()}${tagged_profileData.pronounArray[0].slice(1)} feel much better!*`)
									}
								} else if (profileData.pronounArray[5] == "plural") {
									if (tagged_profileData.pronounArray[5] == "singular") {
										embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, ${profileData.pronounArray[0]} give it to ${tagged_profileData.name}. Immediately you can see the effect. ${tagged_profileData.pronounArray[0].charAt(0).toUpperCase()}${tagged_profileData.pronounArray[0].slice(1)} feels much better!*`)
									} else if (tagged_profileData.pronounArray == "plural") {
										embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, ${profileData.pronounArray[0]} give it to ${tagged_profileData.name}. Immediately you can see the effect. ${tagged_profileData.pronounArray[0].charAt(0).toUpperCase()}${tagged_profileData.pronounArray[0].slice(1)} feel much better!*`)
									}
								}
							}
							embed.setFooter(`${footertext}\n${statstext} ${hptext} ${injurytext}\n\n-1 ${useitem} for ${message.guild.name}`)
							embedArray.splice(-2, 2, embed);
							bot_reply = await bot_reply.edit({ embeds: embedArray, components: [] });
						} else {
							final_profileData = await profileModel.findOne({ userId: tagged_profileData.userId, serverId: tagged_profileData.serverId });
							if (successful == 2) {
								if (profileData.pronounArray[5] == "singular") {
									embed.setDescription(`*${profileData.name} holds the ${useitem} in ${profileData.pronounArray[2]} mouth, trying to find a way to apply it. After a few attempts, the herb breaks into little pieces, rendering it useless. Guess ${profileData.pronounArray[0]} has to try again...*`);
								} else if (profileData.pronounArray[5] == "plural") {
									embed.setDescription(`*${profileData.name} holds the ${useitem} in ${profileData.pronounArray[2]} mouth, trying to find a way to apply it. After a few attempts, the herb breaks into little pieces, rendering it useless. Guess ${profileData.pronounArray[0]} have to try again...*`);
								}
							} else {
								if (profileData.pronounArray[5] == "singular") {
									embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, ${profileData.pronounArray[0]} gives it to ${tagged_profileData.name}. But no matter how long they wait, it does not seem to help. Looks like ${profileData.name} chose the wrong herb!*`);
								} else if (profileData.pronounArray[5] == "plural") {
									embed.setDescription(`*${profileData.name} takes a ${useitem}. After a bit of preparation, ${profileData.pronounArray[0]} give it to ${tagged_profileData.name}. But no matter how long they wait, it does not seem to help. Looks like ${profileData.name} chose the wrong herb!*`);
								}
							}
							embed.setFooter(`${footertext}\n\n-1 ${useitem} for ${message.guild.name}`)
							embedArray.splice(-2, 2, embed);
							bot_reply = await bot_reply.edit({ embeds: embedArray, components: [] });
						}
						if (tagged_profileData.injuryArray[2] == 1 && tagged_profileData.userId != profileData.userId && profileData.injuryArray[2] == 0 && Loottable(10, 1 <= 3)) {
							gethurtlater = 1;
							total_HP = Loottable(5, 3)

							if (profileData.health - total_HP < 0) total_HP = total_HP - (total_HP - profileData.health);

							await profileModel.findOneAndUpdate(
								{ userId: message.author.id, serverId: message.guild.id },
								{ $inc: { health: -total_HP }, },
								{ upsert: true, new: true }
							);

							playerhurtkind[2] = playerhurtkind[2] + 1;

							embed2.setDescription(`*Suddenly, ${profileData.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${tagged_profileData.name}, who was coughing as well. That was probably not the best idea!*`)
							embed2.setFooter(`-${total_HP} HP (from cold)`)

							await embedArray.push(embed2);
							await bot_reply.edit({ embeds: embedArray });
						}
					}

					await damage.unhealedDamage(message, final_profileData, bot_reply);
					total_HP = total_HP + extra_lost_HP;

					if (gethurtlater == 1) {
						await profileModel.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{ $set: { injuryArray: playerhurtkind }, },
							{ upsert: true, new: true }
						);
					}

					await levels.levelCheck(message, profileData, total_XP, bot_reply);

					if (stats_profileData.energy === 0 || stats_profileData.maxHealth - total_HP === 0 || stats_profileData.hunger === 0 || stats_profileData.thirst === 0) {
						passedout.passedOut(message, profileData);

						let newlevel = profileData.levels;
						newlevel = Math.round(newlevel - (newlevel / 10));

						arrays.species(profileData);
						let profile_inventory = [[], [], [], []];
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
							{ upsert: true, new: true }
						)
					}

					await client.off('interactionCreate', heal_interaction);
				} else return;
			} else return;
		});
	}
}