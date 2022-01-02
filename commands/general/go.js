const profileModel = require('../../models/profileSchema');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const rest = require('./rest');
const inventory = require('./inventory');
const drink = require('./drink');
const play = require('../specific/play');
const store = require('./store');
const heal = require('../specific/heal');
const config = require('../../config.json');

module.exports = {
	name: 'go',
	aliases: ['region'],
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isInvalid(message, profileData, embedArray)) {

			return;
		}

		const chosenRegion = argumentsArray.join(' ').toLowerCase();

		const travelSelectMenu = {
			type: 'ACTION_ROW',
			components: [{
				type: 'SELECT_MENU',
				customId: 'pack-travel',
				placeholder: 'Select a region',
				options: [
					{ label: 'sleeping dens', value: 'sleeping_dens', emoji: '💤' },
					{ label: 'food den', value: 'food_den', emoji: '🍖' },
					{ label: 'medicine den', value: 'medicine_den', emoji: '🌿' },
					{ label: 'ruins', value: 'ruins', emoji: '🏛️' },
					{ label: 'lake', value: 'lake', emoji: '🌊' },
					{ label: 'prairie', value: 'prairie', emoji: '🌼' },
				],
			}],
		};

		const sleepingDenButtons = {
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'execute-rest',
				label: 'Rest',
				style: 'PRIMARY',
			}],
		};

		const foodDenButtons = {
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'execute-inventory',
				label: 'View Inventory',
				style: 'PRIMARY',
			}, {
				type: 'BUTTON',
				customId: 'execute-store',
				label: 'Store food away',
				style: 'PRIMARY',
			}],
		};

		const medicineDenButtons = {
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'execute-heal',
				label: 'Heal',
				style: 'PRIMARY',
			}],
		};

		const lakeButtons = {
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'execute-drink',
				label: 'Drink',
				style: 'PRIMARY',
			}],
		};

		const prairieButtons = {
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'execute-play',
				label: 'Play',
				style: 'PRIMARY',
			}],
		};

		const embed = {
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: `You are currently at the ${profileData.currentRegion}! Here are the regions you can go to:`,
			fields: [
				{ name: '💤 sleeping dens', value: 'A place to sleep and relax. Go here if you need to refill your energy!' },
				{ name: '🍖 food den', value: 'Inspect all the food the pack has gathered, eat some or add to it from your inventory!' },
				{ name: '🌿 medicine den', value: 'Go here if you need to be healed. Someone will come and help you.' },
				{ name: '🏛️ ruins', value: 'These old stones are a little creepy at night, but at day packmates frequently gather here to talk and meet up.' },
				{ name: '🌊 lake', value: 'Not only do some aquatic packmates live here, but it is also the primary source of fresh water, in case someone is thirsty.' },
				{ name: '🌼 prairie', value: 'This is where the Younglings go to play! Everyone else can also come here and play with them.' },
			],
		};
		embedArray.push(embed);

		let botReply;

		if (!chosenRegion) {

			botReply = await message.reply({ embeds: embedArray, components: [travelSelectMenu] });
		}

		if (chosenRegion == 'sleeping dens') {

			await sleepingDen();
			botReply = await message.reply({ embeds: embedArray, components: [sleepingDenButtons] });
		}

		if (chosenRegion == 'food den') {

			await foodDen();
			botReply = await message.reply({ embeds: embedArray, components: [foodDenButtons] });
		}

		if (chosenRegion == 'medicine den') {

			await medicineDen();
			if (profileData.rank == 'Youngling' || profileData.rank == 'Hunter') await message.reply({ embeds: [embed] });
			else botReply = await message.reply({ embeds: embedArray, components: [medicineDenButtons] });
		}

		if (chosenRegion == 'ruins') {

			await ruins();
			botReply = await message.reply({ embeds: embedArray });
		}

		if (chosenRegion == 'lake') {

			await lake();
			botReply = await message.reply({ embeds: embedArray, components: [lakeButtons] });
		}

		if (chosenRegion == 'prairie') {

			await prairie();
			if (profileData.rank == 'Youngling' || profileData.rank == 'Apprentice') botReply = await message.reply({ embeds: embedArray, components: [prairieButtons] });
			else botReply = await message.reply({ embeds: embedArray });
		}


		client.on('messageCreate', async function removeGoComponents(newMessage) {

			if (!botReply || newMessage.author.id != message.author.id || !newMessage.content.toLowerCase().startsWith(config.prefix)) {

				return;
			}

			await botReply.edit({
				components: [],
			});
			return client.off('messageCreate', removeGoComponents);
		});

		await interactionCollector();

		async function interactionCollector() {

			const filter = async (i) => {

				if (!i.message.reference || !i.message.reference.messageId) {

					return false;
				}

				const userMessage = await i.channel.messages.fetch(i.message.reference.messageId);
				return userMessage.id == message.id && i.user.id == message.author.id;
			};

			const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 30000 });
			collector.on('end', async (collected) => {

				if (!collected.size) {

					return await botReply.edit({
						components: [],
					});
				}

				const interaction = collected.first();

				if (interaction.isSelectMenu()) {

					if (interaction.values[0] == 'sleeping_dens') {

						await sleepingDen();
						await interaction.message.edit({ embeds: embedArray, components: [travelSelectMenu, sleepingDenButtons] });
					}

					if (interaction.values[0] == 'food_den') {

						await foodDen();
						await interaction.message.edit({ embeds: embedArray, components: [travelSelectMenu, foodDenButtons] });
					}

					if (interaction.values[0] == 'medicine_den') {

						await medicineDen();

						if (profileData.rank == 'Youngling' || profileData.rank == 'Hunter') {

							await interaction.message.edit({ embeds: embedArray, components: [travelSelectMenu] });
						}
						await interaction.message.edit({ embeds: embedArray, components: [travelSelectMenu, medicineDenButtons] });
					}

					if (interaction.values[0] == 'ruins') {

						await ruins();
						await interaction.message.edit({ embeds: embedArray, components: [travelSelectMenu] });
					}

					if (interaction.values[0] == 'lake') {

						await lake();
						await interaction.message.edit({ embeds: embedArray, components: [travelSelectMenu, lakeButtons] });
					}

					if (interaction.values[0] == 'prairie') {

						await prairie();

						if (profileData.rank == 'Youngling' || profileData.rank == 'Apprentice') {

							await interaction.message.edit({ embeds: embedArray, components: [travelSelectMenu, prairieButtons] });
						}
						await interaction.message.edit({ embeds: embedArray, components: [travelSelectMenu] });
					}
				}

				if (interaction.isButton()) {

					if (interaction.customId == 'execute-rest') {

						profileData = await profileModel.findOne({ userId: message.author.id, serverId: message.guild.id });
						interaction.message.delete();
						embedArray.splice(-1, 1);
						return await rest.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray);
					}

					if (interaction.customId == 'execute-inventory') {

						interaction.message.delete();
						embedArray.splice(-1, 1);
						return await inventory.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray);
					}

					if (interaction.customId == 'execute-store') {

						interaction.message.delete();
						embedArray.splice(-1, 1);
						return await store.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray);
					}

					if (interaction.customId == 'execute-heal') {

						interaction.message.delete();
						embedArray.splice(-1, 1);
						return await heal.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray);
					}

					if (interaction.customId == 'execute-drink') {

						interaction.message.delete();
						embedArray.splice(-1, 1);
						return await drink.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray);
					}

					if (interaction.customId == 'execute-play') {

						interaction.message.delete();
						embedArray.splice(-1, 1);
						return await play.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray);
					}
				}

				return await interactionCollector();
			});
		}

		async function sleepingDen() {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { currentRegion: 'sleeping dens' } },
				{ upsert: true, new: true },
			);

			embed.description = `*${profileData.name} slowly trots to the sleeping dens, tired from all the hard work ${profileData.pronounArray[0]} did. For a moment, the ${profileData.species} thinks about if ${profileData.pronounArray[0]} want to rest or just a break.*`;
			embed.fields = [];
		}

		async function foodDen() {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { currentRegion: 'food den' } },
				{ upsert: true, new: true },
			);

			embed.description = `*${profileData.name} runs to the food den. Maybe ${profileData.pronounArray[0]} will eat something, or put ${profileData.pronounArray[2]} food onto the pile.*`;
			embed.fields = [];

			let allFoodDenProfilesArray = await profileModel.find({
				serverId: message.guild.id,
				currentRegion: 'food den',
			});

			allFoodDenProfilesArray = allFoodDenProfilesArray.map(document => document.userId);

			for (let i = 0; i < allFoodDenProfilesArray.length; i++) {

				allFoodDenProfilesArray[i] = `<@${allFoodDenProfilesArray[i]}>`;
			}

			if (allFoodDenProfilesArray != '') {

				embed.fields.push({ name: 'Packmates at the food den:', value: allFoodDenProfilesArray.join('\n') });
			}
		}

		async function medicineDen() {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { currentRegion: 'medicine den' } },
				{ upsert: true, new: true },
			);

			embed.description = `*${profileData.name} rushes over to the medicine den. Nearby are a mix of packmates, some with illnesses and injuries, others trying to heal them.*`;
			embed.fields = [];

			let allMedicineDenProfilesArray = await profileModel.find({
				serverId: message.guild.id,
				currentRegion: 'medicine den',
			});

			allMedicineDenProfilesArray = allMedicineDenProfilesArray.map(document => document.userId);

			for (let i = 0; i < allMedicineDenProfilesArray.length; i++) {

				allMedicineDenProfilesArray[i] = `<@${allMedicineDenProfilesArray[i]}>`;
			}

			if (allMedicineDenProfilesArray != '') {

				embed.fields.push({ name: 'Packmates at the medicine den:', value: allMedicineDenProfilesArray.join('\n'), inline: true });
			}

			let allHealerProfilesArray = await profileModel.find({
				serverId: message.guild.id,
				rank: { $nin: ['Youngling', 'Hunter'] },
			});

			allHealerProfilesArray = allHealerProfilesArray.map(document => document.userId);

			for (let i = 0; i < allHealerProfilesArray.length; i++) {

				allHealerProfilesArray[i] = `<@${allHealerProfilesArray[i]}>`;
			}

			if (allHealerProfilesArray != '') {

				embed.fields.push({ name: 'Packmates that can heal:', value: allHealerProfilesArray.join('\n'), inline: true });
			}
		}

		async function ruins() {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { currentRegion: 'ruins' } },
				{ upsert: true, new: true },
			);

			embed.description = `*${profileData.name} walks up to the ruins, carefully stepping over broken bricks. Hopefully, ${profileData.pronounArray[0]} will find someone to talk with.*`;
			embed.fields = [];

			let allRuinProfilesArray = await profileModel.find({
				serverId: message.guild.id,
				currentRegion: 'ruins',
			});

			allRuinProfilesArray = allRuinProfilesArray.map(document => document.userId);

			for (let i = 0; i < allRuinProfilesArray.length; i++) {

				allRuinProfilesArray[i] = `<@${allRuinProfilesArray[i]}>`;
			}

			if (allRuinProfilesArray != '') {

				embed.fields.push({ name: 'Packmates at the ruins:', value: allRuinProfilesArray.join('\n') });
			}
		}

		async function lake() {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { currentRegion: 'lake' } },
				{ upsert: true, new: true },
			);

			embed.description = `*${profileData.name} looks at ${profileData.pronounArray[2]} reflection as ${profileData.pronounArray[0]} pass${(profileData.pronounArray[5] == 'singular') ? 'es' : ''} the lake. Suddenly the ${profileData.species} remembers how long ${profileData.pronounArray[0]} ha${(profileData.pronounArray[5] == 'singular') ? 's' : 've'}n't drunk anything.*`;
			embed.fields = [];
		}

		async function prairie() {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { currentRegion: 'prairie' } },
				{ upsert: true, new: true },
			);

			embed.description = `*${profileData.name} approaches the prairie, watching younger packmates testing their strength in playful fights. Maybe the ${profileData.species} could play with them!*`;
			embed.fields = [];

			let allPrairieProfilesArray = await profileModel.find({
				serverId: message.guild.id,
				currentRegion: 'prairie',
			});

			allPrairieProfilesArray = allPrairieProfilesArray.map(document => document.userId);

			for (let i = 0; i < allPrairieProfilesArray.length; i++) {

				allPrairieProfilesArray[i] = `<@${allPrairieProfilesArray[i]}>`;
			}

			if (allPrairieProfilesArray != '') {

				embed.fields.push({ name: 'Packmates at the prairie:', value: allPrairieProfilesArray.join('\n') });
			}
		}
	},
};