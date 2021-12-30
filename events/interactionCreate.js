const serverModel = require('../models/serverSchema');
const profileModel = require('../models/profileSchema');
const arrays = require('../utils/arrays');
const store = require('../commands/general/store');
const eat = require('../commands/general/eat');
const config = require('../config.json');

module.exports = {
	name: 'interactionCreate',
	once: false,
	async execute(client, interaction) {

		await interaction.deferUpdate();

		// this is a DM interaction and doesnt have a referenced Message, so it gets processed before everything else
		if (interaction.customId == 'ticket') {

			return interaction.message.delete();
		}

		if (!interaction.message.reference && !interaction.message.reference.messageId) {

			return;
		}

		const referencedMessage = await interaction.channel.messages.fetch(interaction.message.reference.messageId);
		if (referencedMessage && referencedMessage.author.id != interaction.user.id) {

			return;
		}

		const serverData = await serverModel.findOne(
			{ serverId: interaction.guild.id },
		);

		let profileData = await profileModel.findOneAndUpdate(
			{ userId: interaction.user.id, serverId: interaction.guild.id },
			{ $set: { hasCooldown: false } },
			{ upsert: true, new: true },
		);

		const embedArray = interaction.message.embeds;

		if (interaction.isSelectMenu()) {

			console.log(`\x1b[32m\x1b[0m${referencedMessage.author.tag} successfully selected \x1b[33m${interaction.values[0]} \x1b[0mfrom the menu \x1b[33m${interaction.customId} \x1b[0min \x1b[32m${referencedMessage.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);


			if (interaction.values[0] == 'help_page1') {

				return await interaction.message.edit({
					embeds: [{
						color: config.DEFAULT_COLOR,
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
				});
			}

			if (interaction.values[0] == 'help_page2') {

				return await interaction.message.edit({
					embeds: [{
						color: config.DEFAULT_COLOR,
						title: 'Page 2: General Commands',
						fields: [
							{ name: '**rp inventory**', value: 'This is a collection of all the things your pack has gathered, listed up.' },
							{ name: '**rp store**', value: 'Take items you have gathered for your pack, and put them in the pack inventory.' },
							{ name: '**rp say [text]**', value: 'Talk to your fellow packmates! Gives 1 experience point each time.' },
							{ name: '**rp go (region)**', value: 'Go to a specific region in your pack!' },
							{ name: '**rp rest**', value: 'Zzz... get some sleep and fill up your energy meter.' },
							{ name: '**rp eat (item)**', value: 'Yummy! Take the appropriate food for your species out of the packs food pile and fill up your hunger meter.' },
							{ name: '**rp drink**', value: 'Refreshing! Drink some water and fill up your thirst meter.' },
							{ name: '**rp rank**', value: 'Once you successfully finished a quest, you can move up a rank!' },
							{ name: '**rp ticket [text]**', value: 'Report a bug, give feedback, suggest a feature!' },
						],
					}],
				});
			}

			if (interaction.values[0] == 'help_page3') {

				const maksi = await client.users.fetch(config.MAKSI);
				const ezra = await client.users.fetch(config.EZRA);
				const ren = await client.users.fetch(config.REN);
				const jags = await client.users.fetch(config.JAGS);

				await interaction.message.edit({
					embeds: [{
						color: config.DEFAULT_COLOR,
						title: 'Page 3: Role-specific Commands',
						fields: [
							{ name: '**rp play (@user)**', value: 'Playing is fun! But exhausting. Costs energy, but brings XP. Additionally, you can mention someone to play with them! __Only available to Younglings and Apprentices.__' },
							{ name: '**rp explore**', value: 'Go out into the wild! Find different animals and herbs. Costs energy, but gives XP. __Not available to Younglings.__' },
							{ name: '**rp heal @user**', value: 'Heal your packmates! Costs energy, but gives XP. __Only available to Apprentices, Healers and Elderlies.__' },
							{ name: '**rp share (@user)**', value: 'Storytime! So interesting, but tiring too. Mention someone to share a story or anecdote. Costs energy, but gives XP to the other person. __Only available to Elderlies.__' },
							{ name: '**rp quest**', value: 'Get quests by playing and exploring. Start them with this command. If you are successful, you can move up a rank.' },
							{ name: '\n**__CREDITS:__**', value: `This bot was made with love by ${maksi.tag}. Special thanks goes out to ${ezra.tag} and ${ren.tag}, who did a lot of the custom bot responses, and ${jags.tag} who did the profile picture. Thank you also to everyone who tested the bot and gave feedback. If you want to support me, you can donate [here](https://streamlabs.com/maksirose/tip)! :)` },
						],
					}],
				});
			}

			const species = arrays.species(profileData);
			const allItemNamesArray = [[...arrays.commonPlantNamesArray], [...arrays.uncommonPlantNamesArray], [...arrays.rarePlantNamesArray], [...species.nameArray]];

			if (allItemNamesArray.some(nest => nest.some(elem => elem == interaction.values[0]))) {

				interaction.message.delete();
				interaction.message.embeds.splice(-1, 1);
				return await eat.sendMessage(client, referencedMessage, interaction.values, profileData, serverData, interaction.message.embeds);
			}
		}

		if (interaction.isButton()) {

			console.log(`\x1b[32m\x1b[0m${referencedMessage.author.tag} successfully clicked the button \x1b[33m${interaction.customId} \x1b[0min \x1b[32m${referencedMessage.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);


			if (interaction.customId == 'report') {

				interaction.message.edit({ components: [] });

				const owner = await client.users.fetch(config.MAKSI, false);
				return await owner.send({
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
				});
			}

			if (interaction.customId == 'profile-refresh') {

				if (referencedMessage.mentions.users.size > 0) {

					try {

						profileData = await profileModel.findOne({ userId: referencedMessage.mentions.users.first().id, serverId: referencedMessage.guild.id });
					}
					catch (err) {

						console.log(err);
					}
				}

				let injuryText = (profileData.injuryArray.every(item => item == 0)) ? 'none' : '';
				const injuryNameArray = ['Wound', 'Infection', 'Cold', 'Sprain', 'Poison'];

				for (let i; i < profileData.injuryArray; i++) {

					if (profileData.injuryArray[i] > 0) {

						injuryText += `${profileData.injuryArray[i]} ${injuryNameArray[i]}${(profileData.injuryArray[i] > 1) ? 's' : ''}\n`;
					}
				}

				const description = (profileData.description == '') ? '' : `*${profileData.description}*`;
				const user = await client.users.fetch(profileData.userId);

				await interaction.message.edit({
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
					}],
				});
			}

			if (interaction.customId == 'profile-store') {

				interaction.message.delete();
				await store.sendMessage(client, referencedMessage, interaction.values, profileData, serverData, embedArray);
			}
		}
	},
};
