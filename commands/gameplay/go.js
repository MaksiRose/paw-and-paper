// @ts-check
const { profileModel } = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { createCommandCollector } = require('../../utils/commandCollector');
const { prefix } = require('../../config.json');
const { execute } = require('../../events/messageCreate');
const { remindOfAttack } = require('./attack');
const { pronoun, pronounAndPlural } = require('../../utils/getPronouns');

module.exports.name = 'go';
module.exports.aliases = ['region'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData, serverData, embedArray) => {

	if (await hasNotCompletedAccount(message, profileData)) {

		return;
	}

	if (await isInvalid(message, profileData, embedArray, [module.exports.name].concat(module.exports.aliases))) {

		return;
	}

	profileData = await startCooldown(message, profileData);
	const messageContent = remindOfAttack(message);

	profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({
		userId: message.author.id,
		serverId: message.guild.id,
	}));

	const chosenRegion = argumentsArray.join(' ').toLowerCase();

	/** @type {Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions} */
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

	/** @type {Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions} */
	const sleepingDenButtons = {
		type: 'ACTION_ROW',
		components: [{
			type: 'BUTTON',
			customId: 'execute-rest',
			label: 'Rest',
			style: 'PRIMARY',
		}],
	};

	/** @type {Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions} */
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

	/** @type {Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions} */
	const medicineDenButtons = {
		type: 'ACTION_ROW',
		components: [{
			type: 'BUTTON',
			customId: 'execute-heal',
			label: 'Heal',
			style: 'PRIMARY',
		}],
	};

	/** @type {Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions} */
	const lakeButtons = {
		type: 'ACTION_ROW',
		components: [{
			type: 'BUTTON',
			customId: 'execute-drink',
			label: 'Drink',
			style: 'PRIMARY',
		}],
	};

	/** @type {Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions} */
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

	let botReply;

	if (chosenRegion === 'sleeping dens') {

		await sleepingDen();
		botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, embed],
				components: [sleepingDenButtons],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}
	else if (chosenRegion === 'food den') {

		await foodDen();
		botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, embed],
				components: [foodDenButtons],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}
	else if (chosenRegion === 'medicine den') {

		await medicineDen();
		botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, embed],
				components: profileData.rank === 'Youngling' || profileData.rank === 'Hunter' ? [] : [medicineDenButtons],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}
	else if (chosenRegion === 'ruins') {

		await ruins();
		botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, embed],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}
	else if (chosenRegion === 'lake') {

		await lake();
		botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, embed],
				components: [lakeButtons],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}
	else if (chosenRegion === 'prairie') {

		await prairie();
		botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, embed],
				components: profileData.rank === 'Youngling' || profileData.rank === 'Apprentice' ? [prairieButtons] : [],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}
	else {

		botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, embed],
				components: [travelSelectMenu],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}


	createCommandCollector(message.author.id, message.guild.id, botReply);
	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.user.id == message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} } */
		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 120000 })
			.catch(() => { return null; });


		if (interaction === null) {

			return await botReply
				.edit({
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		if (interaction.isSelectMenu()) {

			if (interaction.values[0] === 'sleeping_dens') {

				await sleepingDen();
				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: embedArray,
						components: [travelSelectMenu, sleepingDenButtons],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}

			if (interaction.values[0] === 'food_den') {

				await foodDen();
				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: embedArray,
						components: [travelSelectMenu, foodDenButtons],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}

			if (interaction.values[0] === 'medicine_den') {

				await medicineDen();
				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: embedArray,
						components: [travelSelectMenu, ...profileData.rank === 'Youngling' || profileData.rank === 'Hunter' ? [] : [medicineDenButtons]],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}

			if (interaction.values[0] === 'ruins') {

				await ruins();
				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: embedArray,
						components: [travelSelectMenu],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}

			if (interaction.values[0] === 'lake') {

				await lake();
				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: embedArray,
						components: [travelSelectMenu, lakeButtons],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}

			if (interaction.values[0] == 'prairie') {

				await prairie();

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.edit({
						embeds: embedArray,
						components: [travelSelectMenu, ...profileData.rank === 'Youngling' || profileData.rank === 'Apprentice' ? [prairieButtons] : []],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}
		}

		if (interaction.isButton()) {

			if (interaction.customId.includes('execute')) {

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.delete()
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				message.content = `${prefix}${interaction.customId.split('-').pop()}`;

				return await execute(client, message);
			}
		}

		return await interactionCollector();
	}

	async function sleepingDen() {

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { currentRegion: 'sleeping dens' } },
		);

		embed.description = `*${profileData.name} slowly trots to the sleeping dens, tired from all the hard work ${pronoun(profileData, 0)} did. For a moment, the ${profileData.species} thinks about if ${pronounAndPlural(profileData, 0, 'want')} to rest or just a break.*`;
		embed.fields = [];
	}

	async function foodDen() {

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { currentRegion: 'food den' } },
		);

		embed.description = `*${profileData.name} runs to the food den. Maybe ${pronoun(profileData, 0)} will eat something, or put ${pronoun(profileData, 2)} food onto the pile.*`;
		embed.fields = [];

		const allFoodDenProfilesArray = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find({
			serverId: message.guild.id,
			currentRegion: 'food den',
		})).map(user => user.userId);

		for (let i = 0; i < allFoodDenProfilesArray.length; i++) {

			allFoodDenProfilesArray[i] = `<@${allFoodDenProfilesArray[i]}>`;
		}

		if (allFoodDenProfilesArray.length > 0) {

			embed.fields.push({ name: 'Packmates at the food den:', value: allFoodDenProfilesArray.join('\n') });
		}
	}

	async function medicineDen() {

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { currentRegion: 'medicine den' } },
		);

		embed.description = `*${profileData.name} rushes over to the medicine den. Nearby are a mix of packmates, some with illnesses and injuries, others trying to heal them.*`;
		embed.fields = [];

		const allMedicineDenProfilesArray = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find({
			serverId: message.guild.id,
			currentRegion: 'medicine den',
		})).map(user => user.userId);

		for (let i = 0; i < allMedicineDenProfilesArray.length; i++) {

			allMedicineDenProfilesArray[i] = `<@${allMedicineDenProfilesArray[i]}>`;
		}

		if (allMedicineDenProfilesArray.length > 0) {

			embed.fields.push({ name: 'Packmates at the medicine den:', value: allMedicineDenProfilesArray.join('\n'), inline: true });
		}

		const allHealerProfilesArray = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find({
			serverId: message.guild.id,
			rank: { $nin: ['Youngling', 'Hunter'] },
		})).map(user => user.userId);

		for (let i = 0; i < allHealerProfilesArray.length; i++) {

			allHealerProfilesArray[i] = `<@${allHealerProfilesArray[i]}>`;
		}

		if (allHealerProfilesArray.length > 0) {

			embed.fields.push({ name: 'Packmates that can heal:', value: allHealerProfilesArray.join('\n'), inline: true });
		}
	}

	async function ruins() {

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { currentRegion: 'ruins' } },
		);

		embed.description = `*${profileData.name} walks up to the ruins, carefully stepping over broken bricks. Hopefully, ${pronoun(profileData, 0)} will find someone to talk with.*`;
		embed.fields = [];

		const allRuinProfilesArray = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find({
			serverId: message.guild.id,
			currentRegion: 'ruins',
		})).map(user => user.userId);

		for (let i = 0; i < allRuinProfilesArray.length; i++) {

			allRuinProfilesArray[i] = `<@${allRuinProfilesArray[i]}>`;
		}

		if (allRuinProfilesArray.length > 0) {

			embed.fields.push({ name: 'Packmates at the ruins:', value: allRuinProfilesArray.join('\n') });
		}
	}

	async function lake() {

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { currentRegion: 'lake' } },
		);

		embed.description = `*${profileData.name} looks at ${pronoun(profileData, 2)} reflection as ${pronounAndPlural(profileData, 0, 'passes', 'pass')} the lake. Suddenly the ${profileData.species} remembers how long ${pronounAndPlural(profileData, 0, 'has', 'have')}n't drunk anything.*`;
		embed.fields = [];
	}

	async function prairie() {

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { currentRegion: 'prairie' } },
		);

		embed.description = `*${profileData.name} approaches the prairie, watching younger packmates testing their strength in playful fights. Maybe the ${profileData.species} could play with them!*`;
		embed.fields = [];

		const allPrairieProfilesArray = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find({
			serverId: message.guild.id,
			currentRegion: 'prairie',
		})).map(user => user.userId);

		for (let i = 0; i < allPrairieProfilesArray.length; i++) {

			allPrairieProfilesArray[i] = `<@${allPrairieProfilesArray[i]}>`;
		}

		if (allPrairieProfilesArray.length > 0) {

			embed.fields.push({ name: 'Packmates at the prairie:', value: allPrairieProfilesArray.join('\n') });
		}
	}
};