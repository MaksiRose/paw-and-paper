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