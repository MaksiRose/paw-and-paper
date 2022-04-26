// @ts-check
const { profileModel } = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { error_color, prefix } = require('../../config.json');
const { generateRandomNumber, pullFromWeightedTable } = require('../../utils/randomizers');
const { pickRandomCommonPlant } = require('../../utils/pickRandomPlant');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { decreaseThirst, decreaseHunger, decreaseEnergy, decreaseHealth } = require('../../utils/checkCondition');
const { checkLevelUp } = require('../../utils/levelHandling');
const { introduceQuest } = require('./quest');
const { execute } = require('../../events/messageCreate');
const { remindOfAttack } = require('./attack');
const { pronoun, pronounAndPlural, upperCasePronounAndPlural } = require('../../utils/getPronouns');
const { restAdvice, drinkAdvice, eatAdvice } = require('../../utils/adviceMessages');
const disableAllComponents = require('../../utils/disableAllComponents');
const { addFriendshipPoints } = require('../../utils/friendshipHandling');
const { speciesMap } = require('../../utils/itemsInfo');
const { createButtons } = require('./explore');
const { MessageActionRow, MessageButton } = require('discord.js');

module.exports.name = 'play';

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

	if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

		return;
	}

	profileData = await startCooldown(message, profileData);
	const messageContent = remindOfAttack(message);

	if (/** @type {Array<number>} */ ([].concat(...Object.values(profileData.inventoryObject).map(type => Object.values(type)))).filter(value => value > 0).length > 25) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} approaches the prairie, ${pronoun(profileData, 2)} mouth filled with various things. As eager as ${pronounAndPlural(profileData, 0, 'is', 'are')} to go playing, ${pronounAndPlural(profileData, 0, 'decide')} to store some things away first.*`,
					footer: { text: 'You can only hold up to 25 items in your personal inventory. Type "rp store" to put things into the pack inventory!' },
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (profileData.rank === 'Healer' || profileData.rank === 'Hunter' || profileData.rank === 'Elderly') {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*A packmate turns their head sideways as they see ${profileData.name} running towards the playground.* "Aren't you a little too old to play, ${profileData.rank}?" *they ask.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (message.mentions.users.size > 0 && message.mentions.users.first().id == message.author.id) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} plays with ${pronoun(profileData, 4)}. The rest of the pack looks away in embarrassment.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const thirstPoints = await decreaseThirst(profileData);
	const hungerPoints = await decreaseHunger(profileData);
	const energyPoints = function(energy) { return (profileData.energy - energy < 0) ? profileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(profileData));
	const experiencePoints = profileData.rank === 'Youngling' ? generateRandomNumber(9, 1) : generateRandomNumber(11, 5);

	profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: message.author.id, serverId: message.guild.id },
		{
			$inc: {
				experience: +experiencePoints,
				energy: -energyPoints,
				hunger: -hungerPoints,
				thirst: -thirstPoints,
			},
		},
	));

	let embedFooterStatsText = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

	if (hungerPoints >= 1) {

		embedFooterStatsText += `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
	}

	if (thirstPoints >= 1) {

		embedFooterStatsText += `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
	}

	if (profileData.currentRegion !== 'prairie') {

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{
				$set: { currentRegion: 'prairie' },
			},
		);

		embedFooterStatsText += '\nYou are now at the prairie';
	}

	const userInjuryObject = { ...profileData.injuryObject };

	const embed = {
		color: profileData.color,
		author: { name: profileData.name, icon_url: profileData.avatarURL },
		description: '',
		footer: { text: '' },
		image: { url: '' },
	};

	/** @type {import('discord.js').Message} */
	let botReply = null;

	/** @type {import('../../typedef').ProfileSchema | null} */
	let partnerProfileData = null;

	const responseTime = profileData.rank === 'Apprentice' ? 5_000 : 10_000;

	if (message.mentions.users.size === 0) {

		const allPrairieProfilesArray = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel
			.find({
				serverId: message.guild.id,
				currentRegion: 'prairie',
				energy: { $gt: 0 },
				health: { $gt: 0 },
				hunger: { $gt: 0 },
				thirst: { $gt: 0 },
			}))
			.filter(user => user.userId != profileData.userId && user.injuryObject.cold == false)
			.map(user => user.userId);

		if (generateRandomNumber(3, 0) === 0 && profileData.unlockedRanks === 0 && profileData.rank === 'Youngling' && profileData.levels > 1 && profileData.hasQuest === false) {

			botReply = await findQuest();
		}
		else if (allPrairieProfilesArray.length > 0 || profileData.rank === 'Youngling') {

			partnerProfileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({
				userId: allPrairieProfilesArray[generateRandomNumber(allPrairieProfilesArray.length, 0)],
				serverId: message.guild.id,
			}));

			const playTogetherChance = pullFromWeightedTable({ 0: 3, 1: 7 });
			if (playTogetherChance == 1 && (partnerProfileData !== null || profileData.rank === 'Youngling')) {

				botReply = await playTogether(false, partnerProfileData === null);
			}
			else {

				/* This is done to prevent getting friendship points despite not playing with them */
				partnerProfileData = null;
				botReply = await findPlantOrNothing();
			}
		}
		else {

			botReply = await findPlantOrNothing();
		}
	}
	else {

		partnerProfileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({
			userId: message.mentions.users.first().id,
			serverId: message.guild.id,
		}));

		if (!partnerProfileData || partnerProfileData.name === '' || partnerProfileData.species === '' || partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0) {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$inc: {
						experience: -experiencePoints,
						energy: +energyPoints,
						hunger: +hungerPoints,
						thirst: +thirstPoints,
					},
				},
			);

			await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, {
						color: /** @type {`#${string}`} */ (error_color),
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'The mentioned user has no account or is passed out :(',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		botReply = await playTogether(true, false);
	}

	botReply = await decreaseHealth(profileData, botReply, userInjuryObject);
	await checkLevelUp(message, botReply, profileData, serverData);
	await isPassedOut(message, profileData, true);

	if (partnerProfileData !== null) { await addFriendshipPoints(message, profileData, partnerProfileData); }

	await restAdvice(message, profileData);
	await drinkAdvice(message, profileData);
	await eatAdvice(message, profileData);


	/**
	 * Gives the user a quest.
	 * @returns {Promise<import('discord.js').Message>}
	 */
	async function findQuest() {

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { hasQuest: true } },
		);

		botReply = await introduceQuest(message, profileData, embedArray, embedFooterStatsText);

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId === 'quest-start' && i.user.id === message.author.id;

		botReply
			.awaitMessageComponent({ filter, time: 30_000 })
			.then(async interaction => {

				await /** @type {import('discord.js').Message} */ (interaction.message)
					.delete()
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				message.content = `${prefix}quest start`;

				return await execute(client, message);
			})
			.catch(async () => {

				return await botReply
					.edit({ components: disableAllComponents(botReply.components) })
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});
			});

		return botReply;
	}

	/**
	 * Gives the user a plant or nothing.
	 * @returns {Promise<import('discord.js').Message>}
	 */
	async function findPlantOrNothing() {

		const findSomethingChance = pullFromWeightedTable({ 0: 90, 1: 10 + profileData.saplingObject.waterCycles });
		if (findSomethingChance === 0 && profileData.rank !== 'Youngling') {

			embed.description = `*${profileData.name} bounces around camp, watching the busy hustle and blurs of hunters and healers at work. ${upperCasePronounAndPlural(profileData, 0, 'splashes', 'splash')} into the stream that splits the pack in half, chasing the minnows with ${pronoun(profileData, 2)} eyes.*`;
			embed.footer.text = embedFooterStatsText;

			return await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, embed],
					failIfNotExists: false,
				})
				.catch((error) => { throw new Error(error); });
		}

		const getHurtChance = pullFromWeightedTable({ 0: 10, 1: 90 + profileData.saplingObject.waterCycles });
		if (getHurtChance === 0 && profileData.rank !== 'Youngling') {

			const healthPoints = function(health) { return (profileData.health - health < 0) ? profileData.health : health; }(generateRandomNumber(5, 3));

			profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $inc: { health: -healthPoints } },
			));

			switch (true) {

				case (pullFromWeightedTable({ 0: 1, 1: 1 }) == 0 && userInjuryObject.cold == false):

					userInjuryObject.cold = true;

					embed.description = `*${profileData.name} tumbles around camp, weaving through dens and packmates at work. ${upperCasePronounAndPlural(profileData, 0, 'pause')} for a moment, having a sneezing and coughing fit. It looks like ${profileData.name} has caught a cold.*`;
					embed.footer.text = `-${healthPoints} HP (from cold)\n${embedFooterStatsText}`;

					break;

				default:

					userInjuryObject.wounds += 1;

					embed.description = `*${profileData.name} strays from camp, playing near the pack borders. ${upperCasePronounAndPlural(profileData, 0, 'hop')} on rocks and pebbles, trying to keep ${pronoun(profileData, 2)} balance, but the rock ahead of ${pronoun(profileData, 1)} is steeper and more jagged. ${upperCasePronounAndPlural(profileData, 0, 'land')} with an oomph and a gash slicing through ${pronoun(profileData, 2)} feet from the sharp edges.*`;
					embed.footer.text = `-${healthPoints} HP (from wound)\n${embedFooterStatsText}`;
			}

			return await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, embed],
					failIfNotExists: false,
				})
				.catch((error) => { throw new Error(error); });
		}

		const userHabitatEmojisArray = [
			['🌲', '🌳', '🍂', '🍁', '🍄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐁', '🦔'],
			['🌵', '🦂', '🏜️', '🎍', '🪴', '🎋', '🪨', '🌾', '🐍', '🦎', '🐫'],
			['🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🌊', '🐚', '🪨', '🪵', '🌴'],
		][
			['cold', 'warm', 'water'].indexOf(speciesMap.get(profileData.species).habitat)
		];
		const emojiToAvoid = '🏕️';
		const emojiList = ['🌱', '🌿', '☘️', '🍀', '🍃', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🍇', '🍊', '🫒', '🌰'];


		const foundItem = await pickRandomCommonPlant();

		const { emojiToFind, buttonsArray, correctButton } = createButtons(emojiList, -1, userHabitatEmojisArray, emojiToAvoid);

		embed.description = `*${profileData.name} bounds across the den territory, chasing a bee that is just out of reach. Without looking, the ${profileData.species} crashes into a Healer, loses sight of the bee, and scurries away into the ${['forest', 'shrubland', 'river'][['cold', 'warm', 'water'].indexOf(speciesMap.get(profileData.species).habitat)]}. On ${pronoun(profileData, 2)} way back to the pack border, ${profileData.name} sees something special on the ground. It's a ${foundItem}!*`;
		embed.footer.text = `You will be presented five buttons with five emojis each. Click the button with this emoji: ${emojiToFind}, but without the campsite (${emojiToAvoid}).`;

		const herbComponent = new MessageActionRow();

		for (let i = 0; i < 5; i++) {

			herbComponent.components.push(new MessageButton({ customId: `plant-${i}`, label: buttonsArray[i].join(' '), style: 'SECONDARY' }));
		}

		botReply = await message
			.reply({
				embeds: [...embedArray, embed],
				components: [herbComponent],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('plant') && i.user.id == message.author.id;

		const { customId } = await botReply
			.awaitMessageComponent({ filter, time: responseTime })
			.catch(() => { return { customId: '' }; });

		/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
		/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId.includes(`${correctButton}`))]).style = 'PRIMARY';

		if (customId !== '') {

			/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
			/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === customId)]).style = 'DANGER';
		}

		embed.footer.text = embedFooterStatsText;

		if (customId?.includes(`${correctButton}`) === true) {

			/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
			/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === customId)]).style = 'SUCCESS';

			const userInventory = {
				commonPlants: { ...profileData.inventoryObject.commonPlants },
				uncommonPlants: { ...profileData.inventoryObject.uncommonPlants },
				rarePlants: { ...profileData.inventoryObject.rarePlants },
				meat: { ...profileData.inventoryObject.meat },
			};

			for (const itemCategory of Object.keys(userInventory)) {

				// @ts-ignore
				if (Object.hasOwn(userInventory[itemCategory], foundItem)) {

					userInventory[itemCategory][foundItem] += 1;
				}
			}

			profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { inventoryObject: userInventory } },
			));

			embed.footer.text += `\n\n+1 ${foundItem}`;
		}
		else {

			embed.description = embed.description.substring(0, embed.description.length - 1) + ` But as the ${profileData.species} tries to pick it up, it just breaks into little pieces.*`;
		}

		botReply.components = disableAllComponents(botReply.components);


		botReply = await (async content => {
			botReply === null ? (botReply = await message.reply(content)) : (botReply = await botReply.edit(content));
			return botReply;
		})({
			content: messageContent,
			embeds: [...embedArray, embed],
			components: botReply.components,
			failIfNotExists: false,
		}).catch((error) => { throw new Error(error); });

		return botReply;
	}

	/**
	 * Plays with another user.
	 * @param {boolean} isMentioned
	 * @param {boolean} isSimulated
	 * @returns {Promise<import('discord.js').Message>}
	 */
	async function playTogether(isMentioned, isSimulated) {

		if (!isSimulated) {

			const partnerHealthPoints = function(health) { return (partnerProfileData.health + health > partnerProfileData.maxHealth) ? partnerProfileData.maxHealth - partnerProfileData.health : health; }(generateRandomNumber(5, 1));

			partnerProfileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: partnerProfileData.userId, serverId: message.guild.id },
				{ $inc: { health: partnerHealthPoints } },
			));

			if (partnerHealthPoints > 0) {

				embedFooterStatsText += `\n\n+${partnerHealthPoints} HP for ${partnerProfileData.name} (${partnerProfileData.health}/${partnerProfileData.maxHealth})`;
			}
		}

		let whoWinsChance = pullFromWeightedTable({ 0: 1, 1: 1 });

		const fightComponents = new MessageActionRow({
			components: [ new MessageButton({
				customId: 'play-attack',
				label: 'Attack',
				emoji: '⏫',
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'play-defend',
				label: 'Defend',
				emoji: '⏺️',
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'play-dodge',
				label: 'Dodge',
				emoji: '↪️',
				style: 'SECONDARY',
			})].sort(() => Math.random() - 0.5),
		});

		if (!isMentioned) {

			await new Promise((resolve) => {

				whoWinsChance = 1;

				const newCycleArray = ['attack', 'dodge', 'defend'];
				const cycleKind = newCycleArray[generateRandomNumber(newCycleArray.length, 0)];

				if (cycleKind === 'attack') {

					embed.description = `⏫ *${partnerProfileData?.name || 'The Elderly'} gets ready to attack. ${profileData.name} must think quickly about how ${pronounAndPlural(profileData, 0, 'want')} to react.*`;
					embed.footer.text = 'Tip: Dodging an attack surprises the opponent and puts you in the perfect position for a counterattack.';
				}

				if (cycleKind === 'dodge') {

					embed.description = `↪️ *Looks like ${partnerProfileData?.name || 'the Elderly'} is preparing a maneuver for ${profileData.name}'s next move. The ${profileData.species} must think quickly about how ${pronounAndPlural(profileData, 0, 'want')} to react.*`;
					embed.footer.text = 'Tip: Defending a maneuver blocks it effectively, which prevents your opponent from hurting you.';
				}

				if (cycleKind === 'defend') {

					embed.description = `⏺️ *${partnerProfileData?.name || 'The Elderly'} gets into position to oppose an attack. ${profileData.name} must think quickly about how ${pronounAndPlural(profileData, 0, 'want')} to react.*`;
					embed.footer.text = 'Tip: Attacks come with a lot of force, making them difficult to defend against.';
				}

				message
					.reply({
						embeds: [...embedArray, embed],
						components: [fightComponents],
						failIfNotExists: false,
					})
					.then(async response => {

						botReply = response;

						const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => (i.customId === 'play-attack' || i.customId === 'play-defend' || i.customId === 'play-dodge') && i.user.id == message.author.id;

						const { customId } = await botReply
							.awaitMessageComponent({ filter, time: responseTime })
							.catch(() => { return { customId: '' }; });

						/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
						if (cycleKind === 'defend') { /** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === 'play-attack')]).style = 'PRIMARY'; }
						if (cycleKind === 'dodge') { /** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === 'play-defend')]).style = 'PRIMARY'; }
						if (cycleKind === 'attack') { /** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === 'play-dodge')]).style = 'PRIMARY'; }

						if (customId !== '') {

							/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
							/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === customId)]).style = 'DANGER';
						}

						if ((customId === 'play-attack' && cycleKind === 'defend') || (customId === 'play-defend' && cycleKind === 'dodge') || (customId === 'play-dodge' && cycleKind === 'attack')) {

							/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
							/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === customId)]).style = 'SUCCESS';

							whoWinsChance = 0;
						}

						botReply.components = disableAllComponents(botReply.components);

						resolve();
					})
					.catch((error) => { throw new Error(error); });
			});
		}

		if (whoWinsChance === 0) {

			embed.description = `*${profileData.name} trails behind ${partnerProfileData?.name || 'an Elderly'}'s rear end, preparing for a play attack. The ${profileData.species} launches forward, landing on top of ${isSimulated ? 'them' : pronoun(partnerProfileData, 1)}.* "I got you${isSimulated ? '' : ', ' + partnerProfileData?.name}!" *${pronounAndPlural(profileData, 0, 'say')}. Both creatures bounce away from each other, laughing.*`;
			embed.image.url = 'https://external-preview.redd.it/iUqJpDGv2YSDitYREfnTvsUkl9GG6oPMCRogvilkIrg.gif?s=9b0ea7faad7624ec00b5f8975e2cf3636f689e27';
		}
		else {

			embed.description = `*${profileData.name} trails behind ${partnerProfileData?.name || 'an Elderly'}'s rear end, preparing for a play attack. Right when the ${profileData.species} launches forward, ${partnerProfileData?.name || 'the Elderly'} dashes sideways, followed by a precise jump right on top of ${profileData.name}.* "I got you, ${profileData.name}!" *${isSimulated ? 'they say' : pronounAndPlural(partnerProfileData, 0, 'say')}. Both creatures bounce away from each other, laughing.*`;
			embed.image.url = 'https://i.pinimg.com/originals/7e/e4/01/7ee4017f0152c7b7c573a3dfe2c6673f.gif';
		}

		embed.footer.text = embedFooterStatsText;

		botReply = await (async content => {
			botReply === null ? (botReply = await message.reply(content)) : (botReply = await botReply.edit(content));
			return botReply;
		})({
			content: messageContent,
			embeds: [...embedArray, embed],
			components: botReply.components || [],
			failIfNotExists: false,
		}).catch((error) => { throw new Error(error); });

		if (!isSimulated && partnerProfileData.injuryObject.cold === true && profileData.injuryObject.cold === false && pullFromWeightedTable({ 0: 3, 1: 7 }) === 0) {

			const healthPoints = function(health) { return (profileData.health - health < 0) ? profileData.health : health; }(generateRandomNumber(5, 3));

			profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $inc: { health: -healthPoints } },
			));

			userInjuryObject.cold = true;

			botReply = await botReply
				.edit({
					embeds: [...botReply.embeds, {
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*Suddenly, ${profileData.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${partnerProfileData.name}, who was coughing as well. That was probably not the best idea!*`,
						footer: { text: `-${healthPoints} HP (from cold)` },
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
		}

		return botReply;
	}
};