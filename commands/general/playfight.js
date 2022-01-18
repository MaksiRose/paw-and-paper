const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const startCooldown = require('../../utils/startCooldown');
const config = require('../../config.json');
const profileModel = require('../../models/profileSchema');

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
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
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
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
						throw new Error(error);
					}
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
				if (error.httpStatus == 404) {
					console.log('Message already deleted');
				}
				else {
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

		/* to do:
		experience points & hurtchance have to be added
		text has to be updated:
			-challenge text
			-its your turn text
			-you won text
			-hurt text (sprain, cold)
			-draw text
			-game didnt start text
			-game was abandoned text
		*/

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
					if (error.httpStatus == 404) {
						console.log('Message already deleted');
					}
					else {
						throw new Error(error);
					}
				});

			return client.off('messageCreate', removePlayfightComponents);
		});

		await newRound((Math.floor(Math.random() * 2) == 0) ? true : false);

		async function newRound(isPartner) {

			const currentProfileData = (isPartner == true) ? partnerProfileData : profileData;
			const otherProfileData = (isPartner == true) ? profileData : partnerProfileData;

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
							if (error.httpStatus == 404) {
								console.log('Message already deleted');
							}
							else {
								throw new Error(error);
							}
						});

					embedArray.splice(-1, 1);

					if (!collected.size) {

						if (isEmptyBoard) {

							// text for when the match didnt start
							embedArray.push({
								color: config.default_color,
								title: 'The match was cancelled due to inactivity.',
							});
						}
						else {

							console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): hasCooldown changed from \x1b[33m${profileData.hasCooldown} \x1b[0mto \x1b[33mfalse \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
							profileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.author.id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
									{ new: true },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							console.log(`\x1b[32m\x1b[0m${message.mentions.users.first().tag} (${message.mentions.users.first().id}): hasCooldown changed from \x1b[33m${partnerProfileData.hasCooldown} \x1b[0mto \x1b[33mfalse \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
							partnerProfileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.mentions.users.first().id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
									{ new: true },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							// text for when the match was abandoned
							embedArray.push({
								color: config.default_color,
								title: 'The match was cancelled due to inactivity.',
							});
						}

						await botReply
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

						return resolve();
					}

					if (isEmptyBoard) {

						console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): hasCooldown changed from \x1b[33m${profileData.hasCooldown} \x1b[0mto \x1b[33mtrue \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
						profileData = await profileModel
							.findOneAndUpdate(
								{ userId: message.author.id, serverId: message.guild.id },
								{ $set: { hasCooldown: true } },
								{ new: true },
							)
							.catch(async (error) => {
								throw new Error(error);
							});

						console.log(`\x1b[32m\x1b[0m${message.mentions.users.first().tag} (${message.mentions.users.first().id}): hasCooldown changed from \x1b[33m${partnerProfileData.hasCooldown} \x1b[0mto \x1b[33mtrue \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
						partnerProfileData = await profileModel
							.findOneAndUpdate(
								{ userId: message.mentions.users.first().id, serverId: message.guild.id },
								{ $set: { hasCooldown: true } },
								{ new: true },
							)
							.catch(async (error) => {
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

							console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): hasCooldown changed from \x1b[33m${profileData.hasCooldown} \x1b[0mto \x1b[33mfalse \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
							profileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.author.id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
									{ new: true },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							console.log(`\x1b[32m\x1b[0m${message.mentions.users.first().tag} (${message.mentions.users.first().id}): hasCooldown changed from \x1b[33m${partnerProfileData.hasCooldown} \x1b[0mto \x1b[33mfalse \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
							partnerProfileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.mentions.users.first().id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
									{ new: true },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							embedArray.push({
								color: profileData.color,
								author: { name: profileData.name, icon_url: profileData.avatarURL },
								description: `${currentProfileData.name}, you won!`,
							});

							await message
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

							return resolve();
						}

						if (isDraw()) {

							console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): hasCooldown changed from \x1b[33m${profileData.hasCooldown} \x1b[0mto \x1b[33mfalse \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
							profileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.author.id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
									{ new: true },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							console.log(`\x1b[32m\x1b[0m${message.mentions.users.first().tag} (${message.mentions.users.first().id}): hasCooldown changed from \x1b[33m${partnerProfileData.hasCooldown} \x1b[0mto \x1b[33mfalse \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
							partnerProfileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.mentions.users.first().id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
									{ new: true },
								)
								.catch(async (error) => {
									throw new Error(error);
								});

							embedArray.push({
								color: config.default_color,
								description: 'It\'s a draw!',
							});

							await message
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
							if (error.httpStatus == 404) {
								console.log('Message already deleted');
							}
							else {
								throw new Error(error);
							}
						});

					await newRound(!isPartner);

					return resolve();

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
	},
};