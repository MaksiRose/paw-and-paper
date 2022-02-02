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
					throw new Error(error);
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
					throw new Error(error);
				});
		}

		let partnerProfileData = await profileModel
			.findOne({
				userId: message.mentions.users.first().id,
				serverId: message.guild.id,
			})
			.catch((error) => {
				throw new Error(error);
			});

		embedArray.push({
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			title: `${partnerProfileData.name}, you were challenged to a playfight by ${profileData.name}. Do you accept?`,
			footer: { text: 'You have 30 seconds to click the button before the invitation expires.' },
		});

		let botReply = await message
			.reply({
				content: `<@!${partnerProfileData.userId}>`,
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
				throw new Error(error);
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

		/* to do:
		text has to be updated:
			-challenge text
			-its your turn text
			-you won text
			-hurt text (sprain, cold)
			-draw text
			-game didnt start text
			-game was abandoned text
		*/

		const thirstPointsPlayer1 = await condition.decreaseThirst(profileData);
		const hungerPointsPlayer1 = await condition.decreaseHunger(profileData);
		const extraLostEnergyPointsPlayer1 = await condition.decreaseEnergy(profileData);
		let energyPointsPlayer1 = Loottable(5, 1) + extraLostEnergyPointsPlayer1;
		const userInjuryObjectPlayer1 = { ...profileData.injuryObject };

		if (profileData.energy - energyPointsPlayer1 < 0) {

			energyPointsPlayer1 = profileData.energy;
		}

		let embedFooterStatsTextPlayer1 = `-${energyPointsPlayer1} energy (${profileData.energy}/${profileData.maxEnergy}) for ${profileData.name}`;

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
		const userInjuryObjectPlayer2 = { ...partnerProfileData.injuryObject };

		if (partnerProfileData.energy - energyPointsPlayer2 < 0) {

			energyPointsPlayer2 = partnerProfileData.energy;
		}

		let embedFooterStatsTextPlayer2 = `-${energyPointsPlayer1} energy (${partnerProfileData.energy}/${partnerProfileData.maxEnergy}) for ${partnerProfileData.name}`;

		if (hungerPointsPlayer1 >= 1) {

			embedFooterStatsTextPlayer2 += `\n-${hungerPointsPlayer1} hunger (${partnerProfileData.hunger}/${partnerProfileData.maxHunger}) for ${partnerProfileData.name}`;
		}

		if (thirstPointsPlayer1 >= 1) {

			embedFooterStatsTextPlayer2 += `\n-${thirstPointsPlayer1} thirst (${partnerProfileData.thirst}/${partnerProfileData.maxThirst}) for ${partnerProfileData.name}`;
		}

		client.on('messageCreate', async function removePlayfightComponents(newMessage) {

			let isEmptyBoard = false;
			for (const columnArray of componentArray) {

				for (const rowArray of columnArray.components) {

					if (rowArray.emoji.name === emptyField) {

						isEmptyBoard = true;
						break;
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
					throw new Error(error);
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

					let isEmptyBoard = false;
					for (const columnArray of componentArray) {

						for (const rowArray of columnArray.components) {

							if (rowArray.emoji.name === emptyField) {

								isEmptyBoard = true;
								break;
							}
						}
					}

					await botReply
						.delete()
						.catch((error) => {
							throw new Error(error);
						});

					embedArray.splice(-1, 1);

					if (!collected.size) {

						if (isEmptyBoard) {

							// text for when the match didnt start
							embedArray.push({
								color: config.default_color,
								title: 'The match was cancelled due to inactivity.',
							});

							await botReply
								.edit({
									embeds: embedArray,
									components: [],
								})
								.catch((error) => {
									throw new Error(error);
								});
						}
						else {

							profileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.author.id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							partnerProfileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.mentions.users.first().id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							// text for when the match was abandoned
							embedArray.push({
								color: profileData.color,
								author: { name: profileData.name, icon_url: profileData.avatarURL },
								title: 'The match was cancelled due to inactivity.',
								footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
							});

							await botReply
								.edit({
									embeds: embedArray,
									components: [],
								})
								.catch((error) => {
									throw new Error(error);
								});

							await extraEmbeds();
						}

						return resolve();
					}

					if (isEmptyBoard) {

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
										hasCooldown: true,
									},
								},
							)
							.catch((error) => {
								throw new Error(error);
							});

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
										hasCooldown: true,
									},
								},
							)
							.catch((error) => {
								throw new Error(error);
							});
					}

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

							profileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.author.id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							partnerProfileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.mentions.users.first().id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							const experiencePoints = Loottable(10, 1);

							if (currentProfileData.userId === profileData.userId) {

								embedFooterStatsTextPlayer1 = `+${experiencePoints} XP (${currentProfileData.experience}/${currentProfileData.levels * 50}) for ${currentProfileData.name}\n${embedFooterStatsTextPlayer1}`;
							}
							else {

								embedFooterStatsTextPlayer2 = `+${experiencePoints} XP (${currentProfileData.experience}/${currentProfileData.levels * 50}) for ${currentProfileData.name}\n${embedFooterStatsTextPlayer2}`;
							}

							currentProfileData = await profileModel
								.findOneAndUpdate(
									{ userId: currentProfileData.userId, serverId: message.guild.id },
									{ $inc: { experience: experiencePoints } },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							let getHurtText = '';
							const betterLuckValue = (otherProfileData.levels - 1) * 2;
							const getHurtChance = weightedTable({ 0: 10, 1: 90 + betterLuckValue });
							if (getHurtChance == 0) {

								let healthPoints = Loottable(5, 3);
								const userInjuryObject = (otherProfileData.userId === profileData.userId) ? userInjuryObjectPlayer1 : userInjuryObjectPlayer2;

								if (otherProfileData.health - healthPoints < 0) {

									healthPoints = otherProfileData.health;
								}

								otherProfileData = await profileModel
									.findOneAndUpdate(
										{ userId: otherProfileData.userId, serverId: message.guild.id },
										{ $inc: { health: -healthPoints } },
									)
									.catch((error) => {
										throw new Error(error);
									});

								switch (true) {

									case (weightedTable({ 0: 1, 1: 1 }) == 0 && userInjuryObject.cold == false):

										userInjuryObject.cold = true;

										getHurtText += '';

										if (otherProfileData.userId === profileData.userId) {

											embedFooterStatsTextPlayer1 = `-${healthPoints} HP (from cold)\n${embedFooterStatsTextPlayer1}`;
										}
										else {

											embedFooterStatsTextPlayer2 = `-${healthPoints} HP (from cold)\n${embedFooterStatsTextPlayer2}`;
										}

										break;

									default:

										userInjuryObject.sprain += 1;

										getHurtText += '';

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
								description: `${currentProfileData.name}, you won!\n\n${getHurtText}`,
								footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
							});

							await message
								.reply({
									embeds: embedArray,
									components: componentArray,
								})
								.catch((error) => {
									throw new Error(error);
								});

							await extraEmbeds();

							return resolve();
						}

						if (isDraw()) {

							profileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.author.id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							partnerProfileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.mentions.users.first().id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							const experiencePoints = Loottable(5, 1);

							embedFooterStatsTextPlayer1 = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50}) for ${profileData.name}\n${embedFooterStatsTextPlayer1}`;
							embedFooterStatsTextPlayer2 = `+${experiencePoints} XP (${partnerProfileData.experience}/${partnerProfileData.levels * 50}) for ${partnerProfileData.name}\n${embedFooterStatsTextPlayer2}`;

							profileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.author.id, serverId: message.guild.id },
									{ $inc: { experience: experiencePoints } },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							partnerProfileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.mentions.users.first().id, serverId: message.guild.id },
									{ $inc: { experience: experiencePoints } },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							embedArray.push({
								color: profileData.color,
								author: { name: profileData.name, icon_url: profileData.avatarURL },
								description: 'It\'s a draw!',
								footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
							});

							await message
								.reply({
									embeds: embedArray,
									components: componentArray,
								})
								.catch((error) => {
									throw new Error(error);
								});

							await extraEmbeds();

							return resolve();
						}
					}

					embedArray.push({
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `${otherProfileData.name}, it is your turn`,
					});

					botReply = await message
						.reply({
							content: `<@!${otherProfileData.userId}>`,
							embeds: embedArray,
							components: componentArray,
						})
						.catch((error) => {
							throw new Error(error);
						});

					await newRound(!isPartner);

					return resolve();

					async function extraEmbeds() {

						await condition.decreaseHealth(message, profileData, botReply);
						await condition.decreaseHealth(message, partnerProfileData, botReply);

						profileData = await profileModel
							.findOneAndUpdate(
								{ userId: message.author.id, serverId: message.guild.id },
								{ $set: { injuryObject: userInjuryObjectPlayer1 } },
							)
							.catch((error) => {
								throw new Error(error);
							});

						partnerProfileData = await profileModel
							.findOneAndUpdate(
								{ userId: message.mentions.users.first().id, serverId: message.guild.id },
								{ $set: { injuryObject: userInjuryObjectPlayer2 } },
							)
							.catch((error) => {
								throw new Error(error);
							});

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
	},
};