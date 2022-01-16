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

		if (await checkValidity.isInvalid(message, profileData, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		// if (message.mentions.users.size > 0 && message.mentions.users.first().id == message.author.id) {

		// 	embedArray.push({
		// 		color: profileData.color,
		// 		author: { name: profileData.name, icon_url: profileData.avatarURL },
		// 		description: `*${profileData.name} believes that ${profileData.pronouns[0]} ${(profileData.pronouns[5] == 'singular') ? 'is' : 'are'} so unmatched that only ${profileData.pronouns[0]} could defeat ${profileData.pronouns[4]}. But it doesn't take ${profileData.pronouns[1]} long to realize that it is more fun to fight a partner after all.*`,
		// 	});

		// 	return await message
		// 		.reply({
		// 			embeds: embedArray,
		// 		})
		// 		.catch((error) => {
		// 			if (error.httpStatus == 404) {
		// 				console.log('Message already deleted');
		// 			}
		// 			else {
		// 				throw new Error(error);
		// 			}
		// 		});
		// }

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

		const partnerProfileData = await profileModel
			.findOne({
				userId: message.mentions.users.first().id,
				serverId: message.guild.id,
			})
			.catch((error) => {
				throw new Error(error);
			});

		embedArray.push({
			color: config.default_color,
			author: { name: message.guild.name, icon_url: message.guild.iconURL() },
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

		const componentArray = [
			{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'board-1-1',
					emoji: { name: '◻️' },
					disabled: false,
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'board-1-2',
					emoji: { name: '◻️' },
					disabled: false,
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'board-1-3',
					emoji: { name: '◻️' },
					disabled: false,
					style: 'SECONDARY',
				}],
			},
			{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'board-2-1',
					emoji: { name: '◻️' },
					disabled: false,
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'board-2-2',
					emoji: { name: '◻️' },
					disabled: false,
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'board-2-3',
					emoji: { name: '◻️' },
					disabled: false,
					style: 'SECONDARY',
				}],
			},
			{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'board-3-1',
					emoji: { name: '◻️' },
					disabled: false,
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'board-3-2',
					emoji: { name: '◻️' },
					disabled: false,
					style: 'SECONDARY',
				}, {
					type: 'BUTTON',
					customId: 'board-3-3',
					emoji: { name: '◻️' },
					disabled: false,
					style: 'SECONDARY',
				}],
			},
		];

		await newRound((Math.floor(Math.random() * 2) == 0) ? true : false);

		async function newRound(isPartner) {

			const currentProfileData = (isPartner == true) ? partnerProfileData : profileData;

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

					if (!collected.size) {

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
								if (error.httpStatus == 404) {
									console.log('Message already deleted');
								}
								else {
									throw new Error(error);
								}
							});

						return resolve();
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

					if (collected.first().customId.includes('board')) {

						const column = collected.first().customId.split('-', 2).pop() - 1;
						const row = collected.first().customId.split('-').pop() - 1;

						componentArray[column].components[row].emoji.name = (isPartner == true) ? '⭕' : '❌';
						componentArray[column].components[row].disabled = true;

						if (hasWon()) {

							for (const columnArray of componentArray) {

								for (const rowArray of columnArray.components) {

									rowArray.disabled = true;
								}
							}

							embedArray.push({
								color: currentProfileData.color,
								author: { name: currentProfileData.name, icon_url: currentProfileData.avatarURL },
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
					}

					embedArray.push({
						color: currentProfileData.color,
						author: { name: currentProfileData.name, icon_url: currentProfileData.avatarURL },
						description: `${currentProfileData.name}, it is your turn`,
					});

					botReply = await message
						.reply({
							content: `<@!${currentProfileData.userId}>`,
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

						if (diagonal_1_1 !== '◻️' && ((diagonal_1_1 === diagonal_0_0 && diagonal_1_1 === diagonal_2_2) || (diagonal_1_1 === diagonal_0_2 && diagonal_1_1 === diagonal_2_0))) {

							return true;
						}

						for (const value of [0, 1, 2]) {

							const column_1 = componentArray[value].components[0].emoji.name;
							const column_2 = componentArray[value].components[1].emoji.name;
							const column_3 = componentArray[value].components[2].emoji.name;

							const row_1 = componentArray[0].components[value].emoji.name;
							const row_2 = componentArray[1].components[value].emoji.name;
							const row_3 = componentArray[2].components[value].emoji.name;

							if ((column_1 === column_2 && column_1 === column_3 && column_1 !== '◻️') || (row_1 === row_2 && row_1 === row_3 && row_1 !== '◻️')) {

								return true;
							}
						}

						return false;
					}
				});
			});
		}
	},
};