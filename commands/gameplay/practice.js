// @ts-check
const { decreaseThirst, decreaseHunger, decreaseEnergy, decreaseHealth } = require('../../utils/checkCondition');
const { generateRandomNumber, generateRandomNumberWithException } = require('../../utils/randomizers');
const { profileModel } = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('./attack');
const { pronoun, pronounAndPlural } = require('../../utils/getPronouns');
const { checkLevelUp } = require('../../utils/levelHandling');
const { MessageActionRow, MessageButton } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const { coloredButtonsAdvice } = require('../../utils/adviceMessages');
const practicingCooldownAccountsMap = new Map();

module.exports.name = 'practice';
module.exports.aliases = ['train'];

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

	if (profileData.rank === 'Youngling') {

		await message
			.reply({
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*The Elderly shakes their head as they see ${profileData.name} approaching.*\n"At your age, you shouldn't prepare for fights. Go play with your friends instead!"`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	profileData = await startCooldown(message, profileData);
	const messageContent = remindOfAttack(message);

	if (practicingCooldownAccountsMap.has('nr' + message.author.id + message.guild.id) && Date.now() - practicingCooldownAccountsMap.get('nr' + message.author.id + message.guild.id) < 300000) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					title: 'You can only practice every 5 minutes!',
					description: `You can practice again <t:${Math.floor((practicingCooldownAccountsMap.get('nr' + message.author.id + message.guild.id) + 300000) / 1000)}:R>.`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*A very experienced Elderly approaches ${profileData.name}.* "I've seen that you have not performed well in fights lately. Do you want to practice with me for a bit to strengthen your skills?"`,
				footer: { text: 'You will be presented three buttons: Attack, dodge and defend. Your opponent chooses one of them, and you have to choose which button is the correct response. The footer will provide hints as to which button you should click. This is a memory game, so try to remember which button to click in which situation.' },
			}],
			components: [ new MessageActionRow({
				components: [ new MessageButton({
					customId: 'practice-accept',
					label: 'Accept',
					emoji: '⚔️',
					style: 'PRIMARY',
				}), new MessageButton({
					customId: 'practice-decline',
					label: 'Decline',
					emoji: '💨',
					style: 'PRIMARY',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	let filter = (/** @type {{ customId: string; user: { id: string; }; }} */ i) => (i.customId === 'practice-accept' || i.customId === 'practice-decline') && i.user.id == message.author.id;

	const shouldContinue = await botReply
		.awaitMessageComponent({ filter, time: 15_000 })
		.then(async interaction => {

			if (interaction.customId === 'practice-decline') {

				return Promise.reject();
			}

			return true;
		})
		.catch(async () => {

			botReply = await botReply
				.edit({
					embeds: [...embedArray, {
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*After a bit of thinking, ${profileData.name} decides that now is not a good time to practice ${pronoun(profileData, 2)} fighting skills. Politely, ${pronounAndPlural(profileData, 0, 'decline')} the Elderlies offer.*`,
					}],
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});

			return false;
		});

	if (shouldContinue === false) {

		return;
	}

	/* This is done so that later, these buttons aren't copied over. */
	botReply.components = [];

	practicingCooldownAccountsMap.set('nr' + message.author.id + message.guild.id, Date.now());

	const thirstPoints = await decreaseThirst(profileData);
	const hungerPoints = await decreaseHunger(profileData);
	const energyPoints = function(energy) { return (profileData.energy - energy < 0) ? profileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(profileData));
	const experiencePoints = generateRandomNumber(5, 1);

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

	const embed = {
		color: profileData.color,
		author: { name: profileData.name, icon_url: profileData.avatarURL },
		description: '',
		footer: { text: '' },
	};

	let embedFooterStatsText = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

	if (hungerPoints >= 1) {

		embedFooterStatsText += `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
	}

	if (thirstPoints >= 1) {

		embedFooterStatsText += `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
	}

	let totalCycles = 0;
	let cycleKind = '';
	let winLoseRatio = 0;

	await interactionCollector();

	async function interactionCollector() {

		const fightComponents = new MessageActionRow({
			components: [ new MessageButton({
				customId: 'practice-attack',
				label: 'Attack',
				emoji: '⏫',
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'practice-defend',
				label: 'Defend',
				emoji: '⏺️',
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'practice-dodge',
				label: 'Dodge',
				emoji: '↪️',
				style: 'SECONDARY',
			})].sort(() => Math.random() - 0.5),
		});

		const newCycleArray = ['attack', 'dodge', 'defend'];
		cycleKind = newCycleArray[generateRandomNumberWithException(newCycleArray.length, 0, newCycleArray.indexOf(cycleKind))];

		if (cycleKind === 'attack') {

			embed.description = `⏫ *The Elderly gets ready to attack. ${profileData.name} must think quickly about how ${pronounAndPlural(profileData, 0, 'want')} to react.*`;
			embed.footer.text = 'Tip: Dodging an attack surprises the opponent and puts you in the perfect position for a counterattack.';
		}

		if (cycleKind === 'dodge') {

			embed.description = `↪️ *Looks like the Elderly is preparing a maneuver for ${profileData.name}'s next move. The ${profileData.species} must think quickly about how ${pronounAndPlural(profileData, 0, 'want')} to react.*`;
			embed.footer.text = 'Tip: Defending a maneuver blocks it effectively, which prevents your opponent from hurting you.';
		}

		if (cycleKind === 'defend') {

			embed.description = `⏺️ *The Elderly gets into position to oppose an attack. ${profileData.name} must think quickly about how ${pronounAndPlural(profileData, 0, 'want')} to react.*`;
			embed.footer.text = 'Tip: Attacks come with a lot of force, making them difficult to defend against.';
		}

		botReply = await botReply
			.edit({
				embeds: [...embedArray, embed],
				components: [...botReply.components.length > 0 ? [botReply.components[botReply.components.length - 1]] : [], fightComponents],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
				return botReply;
			});

		/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
		if (cycleKind === 'defend') { /** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === 'practice-attack')]).style = 'PRIMARY'; }
		if (cycleKind === 'dodge') { /** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === 'practice-defend')]).style = 'PRIMARY'; }
		if (cycleKind === 'attack') { /** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === 'practice-dodge')]).style = 'PRIMARY'; }

		filter = i => (i.customId === 'practice-attack' || i.customId === 'practice-defend' || i.customId === 'practice-dodge') && i.user.id == message.author.id;

		await botReply
			.awaitMessageComponent({ filter, time: profileData.rank === 'Elderly' ? 3_000 : profileData.rank === 'Hunter' || profileData.rank === 'Healer' ? 4_000 : 5_000 })
			.then(async interaction => {

				/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
				/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === interaction.customId)]).style = 'DANGER';

				if ((interaction.customId === 'practice-attack' && cycleKind === 'dodge') || (interaction.customId === 'practice-defend' && cycleKind === 'attack') || (interaction.customId === 'practice-dodge' && cycleKind === 'defend')) {

					return Promise.reject();
				}

				if ((interaction.customId === 'practice-attack' && cycleKind === 'defend') || (interaction.customId === 'practice-defend' && cycleKind === 'dodge') || (interaction.customId === 'practice-dodge' && cycleKind === 'attack')) {

					/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
					/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === interaction.customId)]).style = 'SUCCESS';

					winLoseRatio += 1;
				}
			})
			.catch(() => {

				winLoseRatio -= 1;
			});

		/* Here we change the buttons customId's so that they will always stay unique, as well as disabling the buttons. */
		for (const button of botReply.components[botReply.components.length - 1].components) {

			button.customId += totalCycles;
		}

		botReply.components = disableAllComponents(botReply.components);


		totalCycles += 1;

		if (totalCycles < 3) {

			return await interactionCollector();
		}

		if (winLoseRatio > 0) {

			embed.description = `*The Elderly pants as they heave themselves to their feet.* "You're much stronger than I anticipated, ${profileData.name}. There's nothing I can teach you at this point!"`;
		}
		else if (winLoseRatio < 0) {

			embed.description = `*With a worried look, the Elderly gives ${profileData.name} a sign to stop.* "It doesn't seem like you are very concentrated right now. Maybe we should continue training later."`;
		}
		else if (winLoseRatio === 0) {

			embed.description = `*The two packmates fight for a while, before ${profileData.name} finally gives up.* "The training was good, but there is room for improvement. Please continue practicing," *the Elderly says.*`;
		}

		embed.footer.text = embedFooterStatsText;

		botReply = await botReply
			.edit({
				embeds: [...embedArray, embed],
				components: [botReply.components[botReply.components.length - 1]],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
				return botReply;
			});

		botReply = await decreaseHealth(profileData, botReply, { ...profileData.injuryObject });
		botReply = await checkLevelUp(message, botReply, profileData, serverData);
		await isPassedOut(message, profileData, true);

		await coloredButtonsAdvice(message, profileData);

		return;
	}
};