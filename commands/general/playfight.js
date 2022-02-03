const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const startCooldown = require('../../utils/startCooldown');
const config = require('../../config.json');
const profileModel = require('../../models/profileModel');
const condition = require('../../utils/condition');
const levels = require('../../utils/levels');

module.exports = {
	name: 'playfight',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		if (message.mentions.users.size > 0 && message.mentions.users.first().id == message.author.id) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} believes that ${profileData.pronounArray[0]} ${(profileData.pronounArray[5] == 'singular') ? 'is' : 'are'} so unmatched that only ${profileData.pronounArray[0]} could defeat ${profileData.pronounArray[4]}. But it doesn't take ${profileData.pronounArray[1]} long to realize that it is more fun to fight a partner after all.*`,
			});

			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (!message.mentions.users.size) {

			embedArray.push({
				color: config.error_color,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: 'Please mention a user that you want to playfight with!',
			});

			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		let partnerProfileData = await profileModel.findOne({
			userId: message.mentions.users.first().id,
			serverId: message.guild.id,
		});

		if (!partnerProfileData || partnerProfileData.name == '' || partnerProfileData.species == '' || partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0) {

			embedArray.push({
				color: config.error_color,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: 'The mentioned user has no account or is passed out :(',
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

		embedArray.push({
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: `*${profileData.name} hangs around the prairie when ${partnerProfileData.name} comes by. The ${partnerProfileData.species} has things to do but ${profileData.name}'s smug expression implies ${partnerProfileData.pronounArray[0]} wouldn't be able to beat the ${profileData.species}.*`,
			footer: { text: 'You have 30 seconds to click the button before the invitation expires.' },
		});

		let botReply = await message
			.reply({
				embeds: embedArray,
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: 'playfight-confirm',
						label: 'Accept challenge',
						emoji: { name: '🎭' },
						style: 'SUCCESS',
					}],
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		const emptyField = '◻️';
		const player1Field = '⭕';
		const player2Field = '❌';

		const componentArray = [
			{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'board-1-1',
					emoji: { name: emptyField },
					disabled: false,
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'board-1-2',
					emoji: { name: emptyField },
					disabled: false,
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'board-1-3',
					emoji: { name: emptyField },
					disabled: false,
					style: 'SECONDARY',
				}],
			},
			{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'board-2-1',
					emoji: { name: emptyField },
					disabled: false,
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'board-2-2',
					emoji: { name: emptyField },
					disabled: false,
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'board-2-3',
					emoji: { name: emptyField },
					disabled: false,
					style: 'SECONDARY',
				}],
			},
			{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'board-3-1',
					emoji: { name: emptyField },
					disabled: false,
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'board-3-2',
					emoji: { name: emptyField },
					disabled: false,
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'board-3-3',
					emoji: { name: emptyField },
					disabled: false,
					style: 'SECONDARY',
				}],
			},
		];

		const userInjuryObjectPlayer1 = { ...profileData.injuryObject };
		let embedFooterStatsTextPlayer1 = '';

		const userInjuryObjectPlayer2 = { ...partnerProfileData.injuryObject };
		let embedFooterStatsTextPlayer2 = '';

		let newTurnEmbedTextArrayIndex = -1;

		client.on('messageCreate', async function removePlayfightComponents(newMessage) {

			let isEmptyBoard = true;
			forLoop: for (const columnArray of componentArray) {

				for (const rowArray of columnArray.components) {

					if (rowArray.emoji.name === player1Field || rowArray.emoji.name === player2Field) {

						isEmptyBoard = false;
						break forLoop;
					}
				}
			}

			if (!botReply || newMessage.author.id != message.author.id || !newMessage.content.toLowerCase().startsWith(config.prefix) || profileData.hasCooldown || isEmptyBoard === false) {

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

			return client.off('messageCreate', removePlayfightComponents);
		});

		await newRound((Math.floor(Math.random() * 2) == 0) ? true : false);

		async function newRound(isPartner) {

			let currentProfileData = (isPartner == true) ? partnerProfileData : profileData;
			let otherProfileData = (isPartner == true) ? profileData : partnerProfileData;

			return await new Promise((resolve) => {

				const filter = async (i) => {

					if (!i.message.reference || !i.message.reference.messageId) {

						return false;
					}

					const userMessage = await i.channel.messages
						.fetch(i.message.reference.messageId)
						.catch((error) => {
							throw new Error(error);
						});

					return userMessage.id == message.id && ((i.customId == 'playfight-confirm' && i.user.id == message.mentions.users.first().id) || (i.customId.includes('board') && i.user.id == currentProfileData.userId));
				};

				const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 30000 });
				collector.on('end', async function collectorEnd(collected) {

					let isEmptyBoard = true;
					forLoop: for (const columnArray of componentArray) {

						for (const rowArray of columnArray.components) {

							if (rowArray.emoji.name === player1Field || rowArray.emoji.name === player2Field) {

								isEmptyBoard = false;
								break forLoop;
							}
						}
					}

					embedArray.splice(-1, 1);

					if (!collected.size) {

						if (isEmptyBoard) {

							// text for when the match didnt start
							embedArray.push({
								color: config.default_color,
								author: { name: profileData.name, icon_url: profileData.avatarURL },
								description: `*${partnerProfileData.name} wouldn't give in so easily and simply passes the pleading looks of the ${profileData.species}.*`,
							});

							botReply = await botReply
								.edit({
									embeds: embedArray,
									components: [],
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});
						}
						else {

							await depleteStats();

							// text for when the match was abandoned
							embedArray.push({
								color: profileData.color,
								author: { name: profileData.name, icon_url: profileData.avatarURL },
								description: `*${currentProfileData.name} takes so long with ${currentProfileData.pronounArray[2]} decision on how to attack that ${otherProfileData.name} gets impatient and leaves.*`,
								footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
							});

							botReply = await botReply
								.edit({
									embeds: embedArray,
									components: [],
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});

							await extraEmbeds();
						}

						return resolve();
					}

					await botReply
						.delete()
						.catch((error) => {
							throw new Error(error);
						});

					if (collected.first().customId.includes('board')) {

						const column = collected.first().customId.split('-', 2).pop() - 1;
						const row = collected.first().customId.split('-').pop() - 1;

						componentArray[column].components[row].emoji.name = (isPartner == true) ? player1Field : player2Field;
						componentArray[column].components[row].disabled = true;

						if (hasWon()) {

							for (const columnArray of componentArray) {

								for (const rowArray of columnArray.components) {

									rowArray.disabled = true;
								}
							}

							await depleteStats();

							const x = (otherProfileData.levels - currentProfileData.levels < 0) ? 0 : otherProfileData.levels - currentProfileData.levels;
							const extraExperience = Math.round((40 / (1 + Math.pow(Math.E, -0.125 * x))) - 20);
							const experiencePoints = Loottable(11, 10) + extraExperience;

							if (currentProfileData.userId === profileData.userId) {

								embedFooterStatsTextPlayer1 = `+${experiencePoints} XP (${currentProfileData.experience + experiencePoints}/${currentProfileData.levels * 50}) for ${currentProfileData.name}\n${embedFooterStatsTextPlayer1}`;
							}
							else {

								embedFooterStatsTextPlayer2 = `+${experiencePoints} XP (${currentProfileData.experience + experiencePoints}/${currentProfileData.levels * 50}) for ${currentProfileData.name}\n${embedFooterStatsTextPlayer2}`;
							}

							currentProfileData = await profileModel.findOneAndUpdate(
								{ userId: currentProfileData.userId, serverId: message.guild.id },
								{ $inc: { experience: experiencePoints } },
							);

							let getHurtText = '';
							const betterLuckValue = (otherProfileData.levels - 1) * 2;
							const getHurtChance = weightedTable({ 0: 10, 1: 90 + betterLuckValue });
							if (getHurtChance == 0) {

								let healthPoints = Loottable(5, 3);
								const userInjuryObject = (otherProfileData.userId === profileData.userId) ? userInjuryObjectPlayer1 : userInjuryObjectPlayer2;

								if (otherProfileData.health - healthPoints < 0) {

									healthPoints = otherProfileData.health;
								}

								otherProfileData = await profileModel.findOneAndUpdate(
									{ userId: otherProfileData.userId, serverId: message.guild.id },
									{ $inc: { health: -healthPoints } },
								);

								switch (true) {

									case (weightedTable({ 0: 1, 1: 1 }) == 0 && userInjuryObject.cold == false):

										userInjuryObject.cold = true;

										getHurtText += `*${otherProfileData.name} has enjoyed playing with the ${currentProfileData.species} a lot, but is really tired now. After taking a short nap, ${otherProfileData.pronounArray[0]} notice${(otherProfileData.pronounArray[5] == 'singular') ? 's' : ''} ${otherProfileData.pronounArray[2]} sweaty back and sore throat. Oh no! The ${otherProfileData.species} has caught a cold while playing!*`;

										if (otherProfileData.userId === profileData.userId) {

											embedFooterStatsTextPlayer1 = `-${healthPoints} HP (from cold)\n${embedFooterStatsTextPlayer1}`;
										}
										else {

											embedFooterStatsTextPlayer2 = `-${healthPoints} HP (from cold)\n${embedFooterStatsTextPlayer2}`;
										}

										break;

									default:

										userInjuryObject.sprain += 1;

										getHurtText += `*${otherProfileData.name} tries to get up with ${currentProfileData.name}'s help, but the ${otherProfileData.species} feels a horrible pain as ${otherProfileData.pronounArray[0]} get up. Ironically, ${otherProfileData.name} got a sprain from getting up after the fight.*`;

										if (otherProfileData.userId === profileData.userId) {

											embedFooterStatsTextPlayer1 = `-${healthPoints} HP (from sprain)\n${embedFooterStatsTextPlayer1}`;
										}
										else {

											embedFooterStatsTextPlayer2 = `-${healthPoints} HP (from sprain)\n${embedFooterStatsTextPlayer2}`;
										}
								}
							}

							embedArray.push({
								color: profileData.color,
								author: { name: profileData.name, icon_url: profileData.avatarURL },
								description: `*The two animals are pressing against each other with all their might. It seems like the fight will never end this way, but ${currentProfileData.name} has one more trick up ${currentProfileData.pronounArray[2]} sleeve: ${currentProfileData.pronounArray[0]} simply moves out of the way, letting ${otherProfileData.name} crash into the ground. ${otherProfileData.pronounArray[0].charAt(0).toUpperCase() + otherProfileData.pronounArray[0].slice(1)} has a wry grin on ${otherProfileData.pronounArray[2]} face as ${otherProfileData.pronounArray[0]} looks up at the ${currentProfileData.species}. ${currentProfileData.name} wins this fight, but who knows about the next one?*\n\n${getHurtText}`,
								footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
							});

							botReply = await message
								.reply({
									embeds: embedArray,
									components: componentArray,
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});

							await extraEmbeds();

							return resolve();
						}

						if (isDraw()) {

							for (const columnArray of componentArray) {

								for (const rowArray of columnArray.components) {

									rowArray.disabled = true;
								}
							}

							await depleteStats();

							const experiencePoints = Loottable(11, 5);

							embedFooterStatsTextPlayer1 = `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50}) for ${profileData.name}\n${embedFooterStatsTextPlayer1}`;
							embedFooterStatsTextPlayer2 = `+${experiencePoints} XP (${partnerProfileData.experience + experiencePoints}/${partnerProfileData.levels * 50}) for ${partnerProfileData.name}\n${embedFooterStatsTextPlayer2}`;

							profileData = await profileModel.findOneAndUpdate(
								{ userId: message.author.id, serverId: message.guild.id },
								{ $inc: { experience: experiencePoints } },
							);

							partnerProfileData = await profileModel.findOneAndUpdate(
								{ userId: message.mentions.users.first().id, serverId: message.guild.id },
								{ $inc: { experience: experiencePoints } },
							);

							embedArray.push({
								color: profileData.color,
								author: { name: profileData.name, icon_url: profileData.avatarURL },
								description: `*The two animals wrestle with each other until ${profileData.name} falls over the ${partnerProfileData.species} and both of them land on the ground. They pant and glare at each other, but ${partnerProfileData.name} can't contain ${partnerProfileData.pronounArray[2]} laughter. The ${profileData.species} starts to giggle as well. The fight has been fun, even though no one won.*`,
								footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
							});

							botReply = await message
								.reply({
									embeds: embedArray,
									components: componentArray,
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});

							await extraEmbeds();

							return resolve();
						}
					}

					const newTurnEmbedTextArray = [
						`*${currentProfileData.name} bites into ${otherProfileData.name}, not very deep, but deep enough to hang onto the ${otherProfileData.species}. ${otherProfileData.name} needs to get the ${currentProfileData.species} off of ${otherProfileData.pronounArray[1]}.*`,
						`*${currentProfileData.name} slams into ${otherProfileData.name}, leaving the ${otherProfileData.species} disoriented. ${otherProfileData.name} needs to start an attack of ${otherProfileData.pronounArray[2]} own now.*`,
						`*${otherProfileData.name} has gotten hold of ${currentProfileData.name}, but the ${currentProfileData.species} manages to get ${otherProfileData.pronounArray[1]} off, sending the ${otherProfileData.species} slamming into the ground. ${otherProfileData.name} needs to get up and try a new strategy.*`,
					];

					newTurnEmbedTextArrayIndex = generateRandomNumber(newTurnEmbedTextArray.length - 1, 0, newTurnEmbedTextArrayIndex);

					embedArray.push({
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: newTurnEmbedTextArray[newTurnEmbedTextArrayIndex],
					});

					botReply = await message
						.reply({
							content: `<@!${otherProfileData.userId}>`,
							embeds: embedArray,
							components: componentArray,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});

					await newRound(!isPartner);

					return resolve();

					async function extraEmbeds() {

						await condition.decreaseHealth(message, profileData, botReply);
						await condition.decreaseHealth(message, partnerProfileData, botReply);

						profileData = await profileModel.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{ $set: { injuryObject: userInjuryObjectPlayer1 } },
						);

						partnerProfileData = await profileModel.findOneAndUpdate(
							{ userId: message.mentions.users.first().id, serverId: message.guild.id },
							{ $set: { injuryObject: userInjuryObjectPlayer2 } },
						);

						await levels.levelCheck(message, profileData, botReply);
						await levels.levelCheck(message, partnerProfileData, botReply);

						if (await checkValidity.isPassedOut(message, profileData)) {

							await levels.decreaseLevel(message, profileData);
						}

						if (await checkValidity.isPassedOut(message, partnerProfileData)) {

							await levels.decreaseLevel(message, partnerProfileData);
						}
					}

					function hasWon() {

						const diagonal_1_1 = componentArray[1].components[1].emoji.name;

						const diagonal_0_0 = componentArray[0].components[0].emoji.name;
						const diagonal_2_2 = componentArray[2].components[2].emoji.name;

						const diagonal_0_2 = componentArray[0].components[2].emoji.name;
						const diagonal_2_0 = componentArray[2].components[0].emoji.name;

						if (diagonal_1_1 !== emptyField && ((diagonal_1_1 === diagonal_0_0 && diagonal_1_1 === diagonal_2_2) || (diagonal_1_1 === diagonal_0_2 && diagonal_1_1 === diagonal_2_0))) {

							return true;
						}

						for (const value of [0, 1, 2]) {

							const column_1 = componentArray[value].components[0].emoji.name;
							const column_2 = componentArray[value].components[1].emoji.name;
							const column_3 = componentArray[value].components[2].emoji.name;

							const row_1 = componentArray[0].components[value].emoji.name;
							const row_2 = componentArray[1].components[value].emoji.name;
							const row_3 = componentArray[2].components[value].emoji.name;

							if ((column_1 === column_2 && column_1 === column_3 && column_1 !== emptyField) || (row_1 === row_2 && row_1 === row_3 && row_1 !== emptyField)) {

								return true;
							}
						}

						return false;
					}

					function isDraw() {

						for (const columnArray of componentArray) {

							for (const rowArray of columnArray.components) {

								if (rowArray.emoji.name === emptyField) {

									return false;
								}
							}
						}

						return true;
					}
				});
			});
		}

		function Loottable(max, min) {

			return Math.floor(Math.random() * max) + min;
		}

		function weightedTable(values) {

			const table = [];

			for (const i in values) {

				for (let j = 0; j < values[i]; j++) {

					table.push(i);
				}
			}

			return table[Math.floor(Math.random() * table.length)];
		}

		function generateRandomNumber(max, min, exception) {

			const randomNumber = Loottable(max, min);
			return (randomNumber == exception) ? generateRandomNumber(min, max, exception) : randomNumber;
		}

		async function depleteStats() {

			const thirstPointsPlayer1 = await condition.decreaseThirst(profileData);
			const hungerPointsPlayer1 = await condition.decreaseHunger(profileData);
			const extraLostEnergyPointsPlayer1 = await condition.decreaseEnergy(profileData);
			let energyPointsPlayer1 = Loottable(5, 1) + extraLostEnergyPointsPlayer1;

			if (profileData.energy - energyPointsPlayer1 < 0) {

				energyPointsPlayer1 = profileData.energy;
			}

			(energyPointsPlayer1 != 0) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): energy changed from \x1b[33m${profileData.energy} \x1b[0mto \x1b[33m${profileData.energy - energyPointsPlayer1} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			(hungerPointsPlayer1 != 0) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): hunger changed from \x1b[33m${profileData.hunger} \x1b[0mto \x1b[33m${profileData.hunger - hungerPointsPlayer1} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			(thirstPointsPlayer1 != 0) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): thirst changed from \x1b[33m${profileData.thirst} \x1b[0mto \x1b[33m${profileData.thirst - thirstPointsPlayer1} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			(profileData.region != 'prairie') && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): currentRegion changed from \x1b[33m${profileData.currentRegion} \x1b[0mto \x1b[33mprairie \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			(profileData.hasCooldown != false) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): hasCooldown changed from \x1b[33m${profileData.hasCooldown} \x1b[0mto \x1b[33mfalse \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			profileData = await profileModel
				.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{
						$inc: {
							energy: -energyPointsPlayer1,
							hunger: -hungerPointsPlayer1,
							thirst: -thirstPointsPlayer1,
						},
						$set: {
							currentRegion: 'prairie',
							hasCooldown: false,
						},
					},
					{ new: true },
				)
				.catch((error) => {
					throw new Error(error);
				});

			embedFooterStatsTextPlayer1 = `-${energyPointsPlayer1} energy (${profileData.energy}/${profileData.maxEnergy}) for ${profileData.name}`;

			if (hungerPointsPlayer1 >= 1) {

				embedFooterStatsTextPlayer1 += `\n-${hungerPointsPlayer1} hunger (${profileData.hunger}/${profileData.maxHunger}) for ${profileData.name}`;
			}

			if (thirstPointsPlayer1 >= 1) {

				embedFooterStatsTextPlayer1 += `\n-${thirstPointsPlayer1} thirst (${profileData.thirst}/${profileData.maxThirst}) for ${profileData.name}`;
			}


			const thirstPointsPlayer2 = await condition.decreaseThirst(partnerProfileData);
			const hungerPointsPlayer2 = await condition.decreaseHunger(partnerProfileData);
			const extraLostEnergyPointsPlayer2 = await condition.decreaseEnergy(partnerProfileData);
			let energyPointsPlayer2 = Loottable(5, 1) + extraLostEnergyPointsPlayer2;

			if (partnerProfileData.energy - energyPointsPlayer2 < 0) {

				energyPointsPlayer2 = partnerProfileData.energy;
			}

			(energyPointsPlayer2 != 0) && console.log(`\x1b[32m\x1b[0m${message.mentions.users.first().tag} (${message.mentions.users.first().id}): energy changed from \x1b[33m${partnerProfileData.energy} \x1b[0mto \x1b[33m${partnerProfileData.energy - energyPointsPlayer2} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			(hungerPointsPlayer2 != 0) && console.log(`\x1b[32m\x1b[0m${message.mentions.users.first().tag} (${message.mentions.users.first().id}): hunger changed from \x1b[33m${partnerProfileData.hunger} \x1b[0mto \x1b[33m${partnerProfileData.hunger - hungerPointsPlayer2} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			(thirstPointsPlayer2 != 0) && console.log(`\x1b[32m\x1b[0m${message.mentions.users.first().tag} (${message.mentions.users.first().id}): thirst changed from \x1b[33m${partnerProfileData.thirst} \x1b[0mto \x1b[33m${partnerProfileData.thirst - thirstPointsPlayer2} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			(partnerProfileData.currentRegion != 'prairie') && console.log(`\x1b[32m\x1b[0m${message.mentions.users.first().tag} (${message.mentions.users.first().id}): currentRegion changed from \x1b[33m${partnerProfileData.currentRegion} \x1b[0mto \x1b[33mprairie \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			(partnerProfileData.hasCooldown != false) && console.log(`\x1b[32m\x1b[0m${message.mentions.users.first().tag} (${message.mentions.users.first().id}): hasCooldown changed from \x1b[33m${partnerProfileData.hasCooldown} \x1b[0mto \x1b[33mfalse \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			partnerProfileData = await profileModel
				.findOneAndUpdate(
					{ userId: message.mentions.users.first().id, serverId: message.guild.id },
					{
						$inc: {
							energy: -energyPointsPlayer2,
							hunger: -hungerPointsPlayer2,
							thirst: -thirstPointsPlayer2,
						},
						$set: {
							currentRegion: 'prairie',
							hasCooldown: false,
						},
					},
					{ new: true },
				)
				.catch((error) => {
					throw new Error(error);
				});

			embedFooterStatsTextPlayer2 = `-${energyPointsPlayer2} energy (${partnerProfileData.energy}/${partnerProfileData.maxEnergy}) for ${partnerProfileData.name}`;

			if (hungerPointsPlayer2 >= 1) {

				embedFooterStatsTextPlayer2 += `\n-${hungerPointsPlayer2} hunger (${partnerProfileData.hunger}/${partnerProfileData.maxHunger}) for ${partnerProfileData.name}`;
			}

			if (thirstPointsPlayer2 >= 1) {

				embedFooterStatsTextPlayer2 += `\n-${thirstPointsPlayer2} thirst (${partnerProfileData.thirst}/${partnerProfileData.maxThirst}) for ${partnerProfileData.name}`;
			}
		}
	},
};