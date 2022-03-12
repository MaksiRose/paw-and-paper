const serverModel = require('../models/serverModel');
const profileModel = require('../models/profileModel');
const config = require('../config.json');
const errorHandling = require('../utils/errorHandling');
const pjson = require('../package.json');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');
const { execute } = require('./messageCreate');

module.exports = {
	name: 'interactionCreate',
	once: false,
	async execute(client, interaction) {

		await interaction
			.deferUpdate()
			.catch(async (error) => {
				return await errorHandling.output(interaction.message, error);
			});

		// there are DM interactions and dont have referenced messages, so thet get processed before everything else
		if (interaction.customId == 'ticket') {

			return await interaction.message
				.delete()
				.catch(async (error) => {
					if (error.httpStatus !== 404) {
						return await errorHandling.output(interaction.message, error);
					}
				});
		}

		if (interaction.customId.includes('delete-account')) {

			const guildId = interaction.customId.split('-').pop();

			const serverData = await serverModel.findOne({
				serverId: guildId,
			});

			await profileModel.findOneAndDelete({
				userId: interaction.user.id,
				serverId: guildId,
			});

			const accountDeletionValues = serverData.accountsToDelete.get(`${interaction.user.id}`);
			const user = await client.users.fetch(interaction.user.id);
			const botReply = await user.dmChannel.messages.fetch(accountDeletionValues.privateMessageId);

			await botReply
				.edit({
					embeds: [{
						color: config.default_color,
						author: { name: `${interaction.guild.name}`, icon_url: interaction.guild.iconURL() },
						title: 'Your account was deleted permanently!',
						description: '',
					}],
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			await serverData.accountsToDelete.delete(`${interaction.user.id}`);
			await serverData.save();

			return;
		}

		if (!interaction.message.reference && !interaction.message.reference.messageId) {

			return;
		}

		const referencedMessage = await interaction.channel.messages
			.fetch(interaction.message.reference.messageId)
			.catch(async (error) => {
				return await errorHandling.output(interaction.message, error);
			});

		if (referencedMessage && referencedMessage.author.id != interaction.user.id) {

			return;
		}

		let profileData = await profileModel.findOne(
			{ userId: interaction.user.id, serverId: interaction.guild.id },
		);

		if (interaction.isSelectMenu()) {

			console.log(`\x1b[32m${referencedMessage.author.tag}\x1b[0m successfully selected \x1b[33m${interaction.values[0]} \x1b[0mfrom the menu \x1b[33m${interaction.customId} \x1b[0min \x1b[32m${referencedMessage.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);


			if (interaction.values[0] == 'help_page1') {

				return await interaction.message
					.edit({
						embeds: [{
							color: config.default_color,
							title: 'Page 1: Character Creation',
							description: '__Remember that the brackets -> [] don\'t need to be typed out. Replace the content with what you want, and leave the brackets out.__',
							fields: [
								{ name: '**rp name [name]**', value: '__START YOUR ADVENTURE!__ Name your character.' },
								{ name: '**rp species [species]**', value: 'Specify the species of your character. If you don\'t specify a species, it will give you an overview of the available ones.' },
								{ name: '**rp profile (@user)**', value: 'Look up all the available info about a character.' },
								{ name: '**rp desc [description text]**', value: 'Give a more detailed description of your character.' },
								{ name: '**rp pronouns**', value: 'Display the pronouns you are using during roleplay.' },
								{ name: '**rp picture [attachment of the desired image]**', value: 'Choose a picture for your character.' },
								{ name: '**rp color [hex code]**', value: 'Enter a valid hex code to give your messages and profile that color!' },
								{ name: '**rp delete**', value: 'Delete your account and reset your data permanently.' },
							],
						}],
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] == 'help_page2') {

				return await interaction.message
					.edit({
						embeds: [{
							color: config.default_color,
							title: 'Page 2: General Commands',
							fields: [
								{ name: '**rp inventory**', value: 'This is a collection of all the things your pack has gathered, listed up.' },
								{ name: '**rp store**', value: 'Take items you have gathered for your pack, and put them in the pack inventory.' },
								{ name: '**rp say [text]**', value: 'Talk to your fellow packmates! Gives 1 experience point each time.' },
								{ name: '**rp go (region)**', value: 'Go to a specific region in your pack!' },
								{ name: '**rp rest**', value: 'Zzz... get some sleep and fill up your energy meter.' },
								{ name: '**rp eat (item)**', value: 'Yummy! Take the appropriate food for your species out of the packs food pile and fill up your hunger meter.' },
								{ name: '**rp drink**', value: 'Refreshing! Drink some water and fill up your thirst meter.' },
								{ name: '**rp playfight [@user]**', value: 'Playfully fight with another packmate!' },
								{ name: '**rp rank**', value: 'Once you successfully finished a quest, you can move up a rank!' },
								{ name: '**rp ticket [text]**', value: 'Report a bug, give feedback, suggest a feature!' },
							],
						}],
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] == 'help_page3') {

				const maksi = await client.users
					.fetch(config.maksi)
					.catch(async (error) => {
						return await errorHandling.output(interaction.message, error);
					});
				const ezra = await client.users
					.fetch(config.ezra)
					.catch(async (error) => {
						return await errorHandling.output(interaction.message, error);
					});
				const ren = await client.users
					.fetch(config.ren)
					.catch(async (error) => {
						return await errorHandling.output(interaction.message, error);
					});
				const jags = await client.users
					.fetch(config.jags)
					.catch(async (error) => {
						return await errorHandling.output(interaction.message, error);
					});
				const elliott = await client.users
					.fetch(config.eliott)
					.catch(async (error) => {
						return await errorHandling.output(interaction.message, error);
					});

				await interaction.message
					.edit({
						embeds: [{
							color: config.default_color,
							title: 'Page 3: Role-specific Commands',
							fields: [
								{ name: '**rp play (@user)**', value: 'Playing is fun! But exhausting. Costs energy, but brings XP. Additionally, you can mention someone to play with them! __Only available to Younglings and Apprentices.__' },
								{ name: '**rp explore**', value: 'Go out into the wild! Find different animals and herbs. Costs energy, but gives XP. __Not available to Younglings.__' },
								{ name: '**rp heal @user**', value: 'Heal your packmates! Costs energy, but gives XP. __Only available to Apprentices, Healers and Elderlies.__' },
								{ name: '**rp share (@user)**', value: 'Storytime! So interesting, but tiring too. Mention someone to share a story or anecdote. Costs energy, but gives XP to the other person. __Only available to Elderlies.__' },
								{ name: '**rp quest**', value: 'Get quests by playing (as Youngling) and exploring. Start them with this command. If you are successful, you can move up a rank.' },
								{ name: '\n**__CREDITS:__**', value: `This bot was made with love by ${maksi.tag}. Special thanks goes out to ${ezra.tag}, ${ren.tag} and ${elliott.tag}, who did a lot of the custom bot responses, and ${jags.tag} who did the profile picture. Thank you also to everyone who tested the bot and gave feedback.\nThis bot was originally created for a Discord server called [Rushing River Pack](https://disboard.org/server/854522091328110595). If you are otherkin, therian, or supporter of those, you are welcome to join.` },
								{ name: '\n**__OTHER:__**', value: `If you want to support me, you can donate [here](https://streamlabs.com/maksirose/tip)! :)\nYou can find the GitHub repository for this project [here](https://github.com/MaksiRose/paw-and-paper)\nThe bot is currently running on version ${pjson.version}.` },
							],
						}],
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			const plantNamesArray = [...commonPlantsMap.keys(), ...uncommonPlantsMap.keys(), ...rarePlantsMap.keys(), ...speciesMap.keys() ].sort();

			if (interaction.customId == 'eat-options' && plantNamesArray.some(elem => elem == interaction.values[0])) {

				interaction.message
					.delete()
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				referencedMessage.content = `${config.prefix}eat ${interaction.values[0]}`;

				return await execute(client, referencedMessage);
			}
		}

		if (interaction.isButton()) {

			console.log(`\x1b[32m${referencedMessage.author.tag}\x1b[0m successfully clicked the button \x1b[33m${interaction.customId} \x1b[0min \x1b[32m${referencedMessage.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);


			if (interaction.customId == 'report') {

				interaction.message
					.edit({
						components: [],
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				const maksi = await client.users.fetch(config.maksi, false);
				return await maksi
					.send({
						content: `https://discord.com/channels/${interaction.guild.id}/${interaction.message.channel.id}/${interaction.message.id}`,
						embeds: interaction.message.embeds,
						components: [{
							type: 'ACTION_ROW',
							components: [{
								type: 'BUTTON',
								customId: 'ticket',
								label: 'Resolve',
								style: 'SUCCESS',
							}],
						}],
					})
					.catch(async (error) => {
						return await errorHandling.output(interaction.message, error);
					});
			}

			if (interaction.customId == 'profile-refresh') {

				const components = [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: 'profile-refresh',
						emoji: { name: '🔁' },
						style: 'SECONDARY',
					}, {
						type: 'BUTTON',
						customId: 'profile-store',
						label: 'Store food away',
						style: 'SECONDARY',
					}],
				}];

				if (referencedMessage.mentions.users.size > 0) {

					profileData = await profileModel.findOne({
						userId: referencedMessage.mentions.users.first().id,
						serverId: referencedMessage.guild.id,
					});

					components[0].components.pop();
				}
				else if (Object.values(profileData.inventoryObject).map(itemType => Object.values(itemType)).flat().filter(amount => amount > 0).length == 0) {

					components[0].components.pop();
				}

				let injuryText = (Object.values(profileData.injuryObject).every(item => item == 0)) ? 'none' : '';

				for (const [injuryKey, injuryAmount] of Object.entries(profileData.injuryObject)) {

					if (injuryAmount > 0) {

						const injuryName = injuryKey.charAt(0).toUpperCase() + injuryKey.slice(1);
						injuryText += `${injuryAmount} ${(injuryAmount > 1) ? injuryName.slice(0, -1) : injuryName}\n`;
					}
				}

				const description = (profileData.description == '') ? '' : `*${profileData.description}*`;
				const user = await client.users
					.fetch(profileData.userId)
					.catch(async (error) => {
						return await errorHandling.output(interaction.message, error);
					});

				await interaction.message
					.edit({
						embeds: [{
							color: profileData.color,
							title: `Profile - ${user.tag}`,
							author: { name: profileData.name, icon_url: profileData.avatarURL },
							description: description,
							thumbnail: { url: profileData.avatarURL },
							fields: [
								{ name: '**🦑 Species**', value: profileData.species.charAt(0).toUpperCase() + profileData.species.slice(1), inline: true },
								{ name: '**🏷️ Rank**', value: profileData.rank, inline: true },
								{ name: '**🍂 Pronouns**', value: `${profileData.pronounArray[0]}/${profileData.pronounArray[1]} (${profileData.pronounArray[2]}/${profileData.pronounArray[3]}/${profileData.pronounArray[4]})` },
								{ name: '**🗺️ Region**', value: profileData.currentRegion },
								{ name: '**🚩 Levels**', value: `\`${profileData.levels}\``, inline: true },
								{ name: '**✨ XP**', value: `\`${profileData.experience}/${profileData.levels * 50}\``, inline: true },
								{ name: '**Condition**', value: `❤️ Health: \`${profileData.health}/${profileData.maxHealth}\`\n⚡ Energy: \`${profileData.energy}/${profileData.maxEnergy}\`\n🍗 Hunger: \`${profileData.hunger}/${profileData.maxHunger}\`\n🥤 Thirst: \`${profileData.thirst}/${profileData.maxThirst}\`` },
								{ name: '**🩹 Injuries/Illnesses**', value: injuryText },
							],
							footer: { text: profileData.hasQuest == true ? 'There is one open quest!' : null },
						}],
						components: components,
					})
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.customId == 'stats-refresh') {

				let injuryText = (Object.values(profileData.injuryObject).every(item => item == 0)) ? null : '';

				for (const [injuryKey, injuryAmount] of Object.entries(profileData.injuryObject)) {

					if (injuryAmount > 0) {

						if (typeof injuryAmount === 'number') {

							injuryText += `, ${injuryAmount} ${(injuryAmount < 2) ? injuryKey.slice(0, -1) : injuryKey}`;
						}
						else {

							injuryText += `${injuryKey}: yes\n`;
						}
					}
				}

				const components = [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: 'stats-refresh',
						emoji: { name: '🔁' },
						style: 'SECONDARY',
					}, {
						type: 'BUTTON',
						customId: 'profile-store',
						label: 'Store food away',
						style: 'SECONDARY',
					}],
				}];

				if (Object.values(profileData.inventoryObject).map(itemType => Object.values(itemType)).flat().filter(amount => amount > 0).length == 0) {

					components[0].components.pop();
				}

				await interaction.message
					.edit({
						content: `🚩 Levels: \`${profileData.levels}\` - ✨ XP: \`${profileData.experience}/${profileData.levels * 50}\`\n❤️ Health: \`${profileData.health}/${profileData.maxHealth}\` - ⚡ Energy: \`${profileData.energy}/${profileData.maxEnergy}\`\n🍗 Hunger: \`${profileData.hunger}/${profileData.maxHunger}\` - 🥤 Thirst: \`${profileData.thirst}/${profileData.maxThirst}\`${(injuryText == null) ? '' : `🩹 Injuries/Illnesses: ${injuryText.slice(2)}`}`,
						components: components,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.customId == 'profile-store') {

				interaction.message
					.delete()
					.catch(async (error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				referencedMessage.content = `${config.prefix}store`;

				return await execute(client, referencedMessage);
			}
		}
	},
};
