// @ts-check
const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { generateRandomNumber, generateWinChance } = require('../../utils/randomizers');
const { speciesMap } = require('../../utils/itemsInfo');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isPassedOut, hasCooldown, isResting } = require('../../utils/checkValidity');
const { createCommandCollector } = require('../../utils/commandCollector');
const { remindOfAttack } = require('./attack');
const { pronoun, pronounAndPlural, upperCasePronounAndPlural, upperCasePronoun } = require('../../utils/getPronouns');
const { apprenticeAdvice, hunterhealerAdvice, elderlyAdvice } = require('../../utils/adviceMessages');
const disableAllComponents = require('../../utils/disableAllComponents');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');

module.exports.name = 'quest';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	const profileData = characterData?.profiles?.[message.guild.id];

	if (await hasNotCompletedAccount(message, characterData)) {

		return;
	}

	if (await isPassedOut(message, userData, false)) {

		return;
	}

	if (await hasCooldown(message, userData, [module.exports.name])) {

		return;
	}

	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	await isResting(message, userData, embedArray);

	if (profileData.hasQuest === false) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: '#9d9e51',
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'You have no open quests at the moment :(',
					footer: { text: `Go ${profileData.rank === 'Youngling' ? 'playing' : 'exploring'} to get quests!` },
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/** @type {import('discord.js').Message} */
	let botReply;
	const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('quest') && i.user.id === message.author.id;

	if (argumentsArray[0] === 'start') {

		botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: 'Loading...',
				}],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });

		return await startQuest();
	}

	botReply = await module.exports.introduceQuest(message, userData, embedArray, '');

	await botReply
		.awaitMessageComponent({ filter, time: 30_000 })
		.then(async () => await startQuest())
		.catch(async () => {

			await botReply
				.edit({ components: disableAllComponents(botReply.components) })
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
			return;
		});
	return;

	/**
	 * Starts the quest game.
	 * @returns {Promise<void>}
	 */
	async function startQuest() {

		/* This is done so that later, these buttons aren't copied over. */
		botReply.components = [];

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: message.author.id },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[characterData._id].profiles[message.guild.id].hasQuest = false;
			},
		));

		let hitEmoji = '';
		let missEmoji = '';
		let hitValue = 1;
		let missValue = 1;

		if (profileData.rank === 'Youngling') {

			hitEmoji = '🪨';
			missEmoji = '⚡';
		}

		if (profileData.rank === 'Apprentice') {

			hitEmoji = '🪵';
			missEmoji = '⚡';
		}

		if (profileData.rank === 'Hunter' || profileData.rank === 'Healer') {

			hitEmoji = '💨';
			missEmoji = '💂';
		}

		if (profileData.rank === 'Elderly') {

			hitEmoji = '💨';

			if (speciesMap.get(characterData.species).habitat === 'warm') {

				missEmoji = '🏜️';
			}

			if (speciesMap.get(characterData.species).habitat === 'cold') {

				missEmoji = '🌨️';
			}

			if (speciesMap.get(characterData.species).habitat === 'water') {

				missEmoji = '⛰️';
			}
		}

		await startNewRound();

		async function startNewRound() {

			const buttonTextOrColor = generateRandomNumber(2, 0) === 0 ? 'color' : 'text';
			const buttonColorKind = generateRandomNumber(3, 0) === 0 ? 'green' : generateRandomNumber(2, 0) === 0 ? 'blue' : 'red';
			let embedFooterText = `Click the ${(buttonTextOrColor === 'color' ? `${buttonColorKind} button` : `button labeled as ${buttonColorKind}`)} to `;

			if (profileData.rank === 'Youngling') {

				embedFooterText += 'push the rock!';
			}

			if (profileData.rank === 'Apprentice') {

				if (speciesMap.get(characterData.species).habitat === 'warm') {

					embedFooterText += 'push the root!';
				}

				if (speciesMap.get(characterData.species).habitat === 'cold' || speciesMap.get(characterData.species).habitat === 'water') {

					embedFooterText += 'push the tree!';
				}
			}

			if (profileData.rank === 'Hunter' || profileData.rank === 'Healer') {

				if (speciesMap.get(characterData.species).habitat === 'warm' || speciesMap.get(characterData.species).habitat === 'cold') {

					embedFooterText += 'run from the humans!';
				}

				if (speciesMap.get(characterData.species).habitat === 'water') {

					embedFooterText += 'swim from the humans!';
				}
			}

			if (profileData.rank === 'Elderly') {

				if (speciesMap.get(characterData.species).habitat === 'warm') {

					embedFooterText += 'run from the sandstorm!';
				}

				if (speciesMap.get(characterData.species).habitat === 'cold') {

					embedFooterText += 'run from the snowstorm!';
				}

				if (speciesMap.get(characterData.species).habitat === 'water') {

					embedFooterText += 'swim from the underwater landslide!';
				}
			}

			embedFooterText += ' But watch out for your energy bar.\nSometimes you will lose energy even if you chose right, depending on how many levels you have.';

			const questButtons = [
				[ new MessageButton({
					label: 'Blue',
					customId: 'quest-bluetext-redcolor',
					style: 'DANGER',
				}), new MessageButton({
					label: 'Red',
					customId: 'quest-redtext-bluecolor',
					style: 'PRIMARY',
				}), new MessageButton({
					label: 'Green',
					customId: 'quest-greentext-greencolor',
					style: 'SUCCESS',
				})],
				[new MessageButton({
					label: 'Green',
					customId: 'quest-greentext-redcolor',
					style: 'DANGER',
				}), new MessageButton({
					label: 'Blue',
					customId: 'quest-bluetext-bluecolor',
					style: 'PRIMARY',
				}), new MessageButton({
					label: 'Red',
					customId: 'quest-redtext-greencolor',
					style: 'SUCCESS',
				})],
				[ new MessageButton({
					label: 'Red',
					customId: 'quest-redtext-redcolor',
					style: 'DANGER',
				}), new MessageButton({
					label: 'Green',
					customId: 'quest-greentext-bluecolor',
					style: 'PRIMARY',
				}), new MessageButton({
					label: 'Blue',
					customId: 'quest-bluetext-greencolor',
					style: 'SUCCESS',
				})],
			][generateRandomNumber(3, 0)].sort(() => Math.random() - 0.5);

			botReply = await botReply
				.edit({
					content: null,
					embeds: [...embedArray, {
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						description: `${drawProgressbar(hitValue, hitEmoji)}\n${drawProgressbar(missValue, missEmoji)}`,
						footer: { text: embedFooterText },
					}],
					components: [...botReply.components.length > 0 ? [botReply.components[botReply.components.length - 1]] : [], new MessageActionRow({
						components: questButtons,
					})],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});

			const { customId } = await botReply
				.awaitMessageComponent({ filter, time: 5_000 })
				.catch(() => { return { customId: '' }; });

			const winChance = generateWinChance(profileData.levels, profileData.rank === 'Elderly' ? 35 : (profileData.rank === 'Hunter' || profileData.rank === 'Healer') ? 20 : profileData.rank === 'Apprentice' ? 10 : 2);
			const randomNumber = generateRandomNumber(100, 0);

			if (customId !== '') {

				/* The button the user chose will get the "radio button"-emoji. */
				/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === customId)]).setEmoji('🔘');
			}

			if (randomNumber <= winChance) {

				/* The correct button will get the "checkbox"-emoji. */
				/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId.includes(`${buttonColorKind}${buttonTextOrColor}`))]).setEmoji('☑️');
			}

			if (customId === '' || !customId.includes(`${buttonColorKind}${buttonTextOrColor}`) || randomNumber > winChance) {

				++missValue;
			}
			else {
				++hitValue;
			}

			/* Here we change the buttons customId's so that they will always stay unique, as well as disabling the buttons. */
			for (const button of botReply.components[botReply.components.length - 1].components) {

				button.customId += missValue + '-' + hitValue;
			}

			botReply.components = disableAllComponents(botReply.components);


			if (hitValue >= 10) {

				if (profileData.unlockedRanks < 3) {

					await profileModel.findOneAndUpdate(
						{ userId: message.author.id },
						(/** @type {import('../../typedef').ProfileSchema} */ p) => {
							p.characters[characterData._id].profiles[message.guild.id].unlockedRanks += 1;
						},
					);
				}

				const embed = new MessageEmbed({
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					footer: { text: 'Type \'rp rank\' to rank up.' },
				});

				if (profileData.rank === 'Youngling') {

					embed.description = `*A large thump erupts into the forest, sending flocks of crows fleeing to the sky. ${characterData.name} collapses, panting and yearning for breath after the difficult task of pushing the giant boulder. Another ${characterData.species} runs out of the cave, jumping around ${characterData.name} with relief. Suddenly, an Elderly shows up behind the two.*\n"Well done, Youngling, you have proven to be worthy of the Apprentice status. If you ever choose to rank up, just come to me," *the proud elder says with a raspy voice.*`;
				}

				if (profileData.rank === 'Apprentice') {

					if (speciesMap.get(characterData.species).habitat === 'warm') {

						embed.description = `*After fighting with the trunk for a while, the Apprentice now slips out with slightly ruffled fur. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the tree trunk.*\n"Oh, looks like you've already solved the problem, ${characterData.name}! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`;
					}

					if (speciesMap.get(characterData.species).habitat === 'cold') {

						embed.description = `*After fighting with the root for a while, the Apprentice now slips out with slightly ruffled fur. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem, ${characterData.name}! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`;
					}

					if (speciesMap.get(characterData.species).habitat === 'water') {

						embed.description = `*After fighting with the trunk for a while, the Apprentice now slips out. Just at this moment, a worried Elderly comes swimming.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem, ${characterData.name}! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`;
					}
				}

				if (profileData.rank === 'Hunter' || profileData.rank === 'Healer') {

					if (speciesMap.get(characterData.species).habitat === 'warm' || speciesMap.get(characterData.species).habitat === 'cold') {

						embed.description = `*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${characterData.species} runs to the pack, the other ${profileData.rank} in ${pronoun(characterData, 2)} mouth. An Elderly is already coming towards ${pronoun(characterData, 1)}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${characterData.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`;
					}

					if (speciesMap.get(characterData.species).habitat === 'water') {

						embed.description = `*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${characterData.species} swims to the pack, the other ${profileData.rank} in ${pronoun(characterData, 2)} mouth. An Elderly is already swimming towards ${pronoun(characterData, 1)}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${characterData.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`;
					}
				}

				if (profileData.rank === 'Elderly') {

					if (speciesMap.get(characterData.species).habitat === 'warm' || speciesMap.get(characterData.species).habitat === 'cold') {

						embed.description = `*The ${characterData.species} runs for a while before the situation seems to clear up. ${characterData.name} gasps in exhaustion. That was close. Full of adrenaline, ${pronounAndPlural(characterData, 0, 'goes', 'go')} back to the pack, another pack member in ${pronoun(characterData, 2)} mouth. ${upperCasePronounAndPlural(characterData, 0, 'feel')} strangely stronger than before.*`;
					}

					if (speciesMap.get(characterData.species).habitat === 'water') {

						embed.description = `*The ${characterData.species} runs for a while before the situation seems to clear up. ${characterData.name} gasps in exhaustion. That was close. Full of adrenaline, ${pronounAndPlural(characterData, 0, 'swim')} back to the pack, another pack member in ${pronoun(characterData, 2)} mouth. ${upperCasePronounAndPlural(characterData, 0, 'feel')} strangely stronger than before.*`;
					}

					let maxHealthPoints = 0;
					let maxEnergyPoints = 0;
					let maxHungerPoints = 0;
					let maxThirstPoints = 0;

					const random = Math.floor(Math.random() * 4);

					if (random === 0) {
						maxHealthPoints = 10;
						embed.footer.text = '+10 maximum health\n\n';
					}
					else if (random === 1) {
						maxEnergyPoints = 10;
						embed.footer.text = '+10 maximum energy\n\n';
					}
					else if (random === 2) {
						maxHungerPoints = 10;
						embed.footer.text = '+10 maximum hunger\n\n';
					}
					else {
						maxThirstPoints = 10;
						embed.footer.text = '+10 maximum thirst\n\n';
					}

					await profileModel.findOneAndUpdate(
						{ userId: message.author.id },
						(/** @type {import('../../typedef').ProfileSchema} */ p) => {
							p.characters[characterData._id].profiles[message.guild.id].maxHealth += maxHealthPoints;
							p.characters[characterData._id].profiles[message.guild.id].maxEnergy += maxEnergyPoints;
							p.characters[characterData._id].profiles[message.guild.id].maxHunger += maxHungerPoints;
							p.characters[characterData._id].profiles[message.guild.id].maxThirst += maxThirstPoints;
						},
					);
				}

				await botReply
					.edit({
						embeds: [...embedArray, embed],
						components: [botReply.components[botReply.components.length - 1]],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});


				if (profileData.rank === 'Youngling') {

					await apprenticeAdvice(message);
				}

				if (profileData.rank === 'Apprentice') {

					await hunterhealerAdvice(message);
				}

				if (profileData.rank === 'Hunter' || profileData.rank === 'Healer') {

					await elderlyAdvice(message);
				}

				return;
			}
			else if (missValue >= 10) {

				const embed = new MessageEmbed({
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
				});

				if (profileData.rank === 'Youngling') {

					embed.description = `"I can't... I can't do it," *${characterData.name} heaves, ${pronoun(characterData, 2)} chest struggling to fall and rise.\nSuddenly the boulder shakes and falls away from the cave entrance.*\n"You are too weak for a task like this. Come back to camp, Youngling." *The Elderly turns around and slowly walks back towards camp, not dwelling long by the exhausted ${characterData.species}.*`;
				}

				if (profileData.rank === 'Apprentice') {

					if (speciesMap.get(characterData.species).habitat === 'warm') {

						embed.description = `*No matter how long the ${characterData.species} pulls and tugs, ${pronoun(characterData, 0)} just can't break the Apprentice free. They both lie there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's them!" *the Elderly shouts. The other two run to the Apprentice and bite away the root.*\n"Thanks for trying, ${characterData.name}. But thank goodness we found you!" *the Elderly says.*`;
					}

					if (speciesMap.get(characterData.species).habitat === 'cold') {

						embed.description = `*No matter how long the ${characterData.species} pulls and tugs, ${pronoun(characterData, 0)} just can't break the Apprentice free. They both lie there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's them!" *the Elderly shouts. The other two run to the Apprentice and pull them out from under the log with their mouths.*\n"Thanks for trying, ${characterData.name}. But thank goodness we found you!" *the Elderly says.*`;
					}

					if (speciesMap.get(characterData.species).habitat === 'water') {

						embed.description = `*No matter how long the ${characterData.species} pulls and tugs, ${pronoun(characterData, 0)} just can't break the Apprentice free. They both lie there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's them!" *the Elderly shouts. The other two run to the Apprentice and push them away from the log with their heads.*\n"Thanks for trying, ${characterData.name}. But thank goodness we found you!" *the Elderly says.*`;
					}
				}

				if (profileData.rank === 'Hunter' || profileData.rank === 'Healer') {

					if (speciesMap.get(characterData.species).habitat === 'warm' || speciesMap.get(characterData.species).habitat === 'cold') {

						embed.description = `*It almost looks like the humans are catching up to the other ${profileData.rank} when suddenly two larger ${characterData.species}s come running from the side. They pick both of them up and run sideways as fast as lightning. Before ${pronounAndPlural(characterData, 0, 'know')} what has happened to ${pronoun(characterData, 1)}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`;
					}

					if (speciesMap.get(characterData.species).habitat === 'water') {

						embed.description = `*It almost looks like the humans are catching up to the other ${profileData.rank} when suddenly two larger ${characterData.species}s come swimming from the side. They push them both away with their head and swim sideways as fast as lightning. Before ${pronounAndPlural(characterData, 0, 'know')} what has happened to ${pronoun(characterData, 1)}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`;
					}
				}

				if (profileData.rank === 'Elderly') {

					if (speciesMap.get(characterData.species).habitat === 'warm' || speciesMap.get(characterData.species).habitat === 'cold') {

						embed.description = `*The ${characterData.species} gasps as ${pronounAndPlural(characterData, 0, 'drop')} down to the ground, defeated. ${upperCasePronounAndPlural(characterData, 0, '\'s', '\'re')} just not fast enough... Suddenly a bunch of Elderlies come running and lift the pack members by their necks. Another ${characterData.species} has ${characterData.name} in their mouth and runs as fast as they can. Everyone is saved!*`;
					}

					if (speciesMap.get(characterData.species).habitat === 'water') {

						embed.description = `*The ${characterData.species} gasps as ${pronounAndPlural(characterData, 0, 'stop')} swimming, defeated. ${upperCasePronounAndPlural(characterData, 0, '\'s', '\'re')} just not fast enough... Suddenly a bunch of Elderlies come running and thrust the pack members from the side. Another ${characterData.species} pushes into ${characterData.name} with their head and swims as fast as they can. Everyone is saved!*`;
					}
				}

				await botReply
					.edit({
						embeds: [...embedArray, embed],
						components: [botReply.components[botReply.components.length - 1]],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});

				return;
			}
			else {

				return await startNewRound();
			}
		}

		/**
		 * Draws a progress bar with 10 emojis based on a default emoji and a replacement emoji that is drawn in between based on its index.
		 * @param {number} index - The position where the replacement emoji should be drawn.
		 * @param {string} replacement - The replacement emoji.
		 * @returns {string} 10 emojis.
		 */
		function drawProgressbar(index, replacement) {

			const barEmoji = '◻️';
			return barEmoji.repeat(index - 1) + replacement + barEmoji.repeat(10 - index);
		}
	}
};

/**
 *
 * @param {import('discord.js').Message} message
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @param {string} footerText
 * @returns {Promise<import('discord.js').Message>}
 */
module.exports.introduceQuest = async (message, userData, embedArray, footerText) => {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	const profileData = characterData?.profiles?.[message.guild.id];

	const messageContent = remindOfAttack(message);

	const embed = new MessageEmbed({
		color: characterData.color,
		author: { name: characterData.name, icon_url: characterData.avatarURL },
		description: '',
		footer: { text: '' },
	});

	if (profileData.rank === 'Youngling') {

		embed.description = `*${characterData.name} lifts ${pronoun(characterData, 2)} head to investigate the sound of a faint cry. Almost sure that it was someone in need of help, ${pronounAndPlural(characterData, 0, 'dash')} from where ${pronounAndPlural(characterData, 0, 'is standing and bolts', 'are standing and bolt')} for the sound. Soon ${characterData.name} comes along to the intimidating mouth of a dark cave covered by a boulder. The cries for help still ricocheting through ${pronoun(characterData, 2)} brain. ${upperCasePronoun(characterData, 0)} must help them...*`;
	}

	if (profileData.rank === 'Apprentice') {

		if (speciesMap.get(characterData.species).habitat === 'warm') {

			embed.description = `*The ${characterData.species} wanders through the peaceful shrubbery, carefully surveying the undergrowth around ${pronoun(characterData, 1)}. To ${pronoun(characterData, 2)} left are thick bushes at the base of a lone tree. Suddenly, ${characterData.name} hears a pained yowl that seems to come from between the bushes. Could this be a pack member? Curious, ${pronounAndPlural(characterData, 0, 'trot')} over, and sure enough, another apprentice seems to be trapped. Now ${pronoun(characterData, 0)} must show all ${pronoun(characterData, 2)} strength and pull out ${pronoun(characterData, 2)} friend.*`;
		}

		if (speciesMap.get(characterData.species).habitat === 'cold') {

			embed.description = `*The ${characterData.species} wanders through the peaceful forest, carefully surveying the undergrowth around ${pronoun(characterData, 1)}. To ${pronoun(characterData, 2)} left is a long, thick tree trunk overgrown with sodden moss. Suddenly, ${characterData.name} hears a pained yowl that seems to come from between the bushes. Could this be a pack member? Curious, ${pronounAndPlural(characterData, 0, 'trot')} over, and sure enough, another apprentice seems to be trapped. Now ${pronoun(characterData, 0)} must show all ${pronoun(characterData, 2)} strength and pull out ${pronoun(characterData, 2)} friend.*`;
		}

		if (speciesMap.get(characterData.species).habitat === 'water') {

			embed.description = `*The ${characterData.species} swims through the peaceful river, carefully surveying the algae around ${pronoun(characterData, 1)}. In front of ${pronoun(characterData, 2)} is a thick strainer, which through the leaves is barely passable even underneath. Suddenly, ${characterData.name} hears a pained yowl that seems to come from between the bushes. Could this be a pack member? Curious, ${pronounAndPlural(characterData, 0, 'swim')} over, and sure enough, another apprentice seems to be trapped. Now ${pronoun(characterData, 0)} must show all ${pronoun(characterData, 2)} strength and pull out ${pronoun(characterData, 2)} friend.*`;
		}
	}

	if (profileData.rank === 'Healer' || profileData.rank === 'Hunter') {

		if (speciesMap.get(characterData.species).habitat === 'warm') {

			embed.description = `*It is a quiet morning in the savanna. Only the rustling of the scarce bushes and trees breaks the silence. ${characterData.name} meanders over the sand, looking for food for ${pronoun(characterData, 2)} pack. But suddenly the cat hears a motor. Frightened, ${pronounAndPlural(characterData, 0, 'look')} into the distance: indeed, a jeep is in front of ${pronoun(characterData, 1)}, and the humans inside have another ${profileData.rank} of ${pronoun(characterData, 2)} pack in their crosshairs! The sooner ${pronounAndPlural(characterData, 0, 'get')} to the rescue, the better.*`;
		}

		if (speciesMap.get(characterData.species).habitat === 'cold') {

			embed.description = `*It is a quiet morning in the taiga. Only the chirping of birds in the trees breaks the silence. ${characterData.name} meanders between the trees, looking for food for ${pronoun(characterData, 2)} pack. But suddenly the cat hears a motor. Frightened, ${pronounAndPlural(characterData, 0, 'look')} into the distance: indeed, a jeep is in front of ${pronoun(characterData, 1)}, and the humans inside have another ${profileData.rank} of ${pronoun(characterData, 2)} pack in their crosshairs! The sooner ${pronounAndPlural(characterData, 0, 'get')} to the rescue, the better.*`;
		}

		if (speciesMap.get(characterData.species).habitat === 'water') {

			embed.description = `*It is a quiet morning in the coral reef. Only once in a while a fish passes by. ${characterData.name} floats through the water, looking for food for ${pronoun(characterData, 2)} pack. But suddenly the cat hears a motor. Frightened, ${pronounAndPlural(characterData, 0, 'look')} to the surface: indeed, a motorboat is in front of ${pronoun(characterData, 1)}, and the humans inside have another ${profileData.rank} of ${pronoun(characterData, 2)} pack in their crosshairs! The sooner ${pronounAndPlural(characterData, 0, 'get')} to the rescue, the better.*`;
		}
	}

	if (profileData.rank === 'Elderly') {

		if (speciesMap.get(characterData.species).habitat === 'warm') {

			embed.description = `*Something is off, the ${characterData.species} senses it. In the desert, it was strangely quiet, not this peaceful silence, but as if ${pronoun(characterData, 0)} were all alone. ${characterData.name} looks around and can't see a soul far and wide. Then it dawns on ${pronoun(characterData, 1)}. A glance over ${pronoun(characterData, 2)} shoulder confirms ${pronoun(characterData, 2)} fear, a big sandstorm is approaching. ${characterData.name} is out of range, but other pack members might be in danger. If ${pronounAndPlural(characterData, 0, 'doesn\'t', 'don\'t')} hurry now, ${pronoun(characterData, 2)} friends may never find their way back.*`;
		}

		if (speciesMap.get(characterData.species).habitat === 'cold') {

			embed.description = `*Something is off, the ${characterData.species} senses it. In the tundra, it was strangely quiet, not this peaceful silence, but as if ${pronoun(characterData, 0)} were all alone. ${characterData.name} looks around and can't see a soul far and wide. Then it dawns on ${pronoun(characterData, 1)}. A glance over ${pronoun(characterData, 2)} shoulder confirms ${pronoun(characterData, 2)} fear, a big snowstorm is approaching. ${characterData.name} is out of range, but other pack members might be in danger. If ${pronounAndPlural(characterData, 0, 'doesn\'t', 'don\'t')} hurry now, ${pronoun(characterData, 2)} friends may never find their way back.*`;
		}

		if (speciesMap.get(characterData.species).habitat === 'water') {

			embed.description = `*Something is off, the ${characterData.species} senses it. In the ocean, it was strangely quiet, not this peaceful silence, but as if ${pronoun(characterData, 0)} were all alone. ${characterData.name} looks around and can't see a soul far and wide. Then it dawns on ${pronoun(characterData, 1)}. A glance over ${pronoun(characterData, 2)} shoulder confirms ${pronoun(characterData, 2)} fear, a big landslide is approaching. ${characterData.name} is out of range, but other pack members might be in danger. If ${pronounAndPlural(characterData, 0, 'doesn\'t', 'don\'t')} hurry now, ${pronoun(characterData, 2)} friends may never find their way back.*`;
		}
	}

	embed.footer.text = `${footerText}\n\nClick the button to continue. *Level ${profileData.rank == 'Elderly' ? '35' : (profileData.rank == 'Hunter' || profileData.rank == 'Healer') ? '20' : profileData.rank == 'Apprentice' ? '10' : '2'} is recommended for this!*\n\nTip: The button you chose will get a "radio button"-emoji, and the correct button will get a checkmark emoji. Sometimes you will lose a round even if you chose right, depending on how many levels you have, then there will be no checkmark emoji.`;


	const botReply = await message
		.reply({
			content: `<@${message.author.id}>` + (messageContent === null ? '' : messageContent),
			embeds: [...embedArray, embed],
			components: [ new MessageActionRow({
				components: [ new MessageButton({
					customId: 'quest-start',
					label: 'Start quest',
					emoji: '⭐',
					style: 'SUCCESS',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild.id, botReply);

	return botReply;
};
