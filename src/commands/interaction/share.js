// @ts-check
const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { error_color } = require('../../../config.json');
const { generateRandomNumber, pullFromWeightedTable } = require('../../utils/randomizers');
const { hasCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { decreaseThirst, decreaseHunger, decreaseEnergy, decreaseHealth } = require('../../utils/checkCondition');
const { checkLevelUp } = require('../../utils/levelHandling');
const { remindOfAttack } = require('../gameplay_primary/attack');
const { pronounAndPlural, pronoun, upperCasePronounAndPlural, upperCasePronoun } = require('../../utils/getPronouns');
const { addFriendshipPoints } = require('../../utils/friendshipHandling');
const isInGuild = require('../../utils/isInGuild');
const { restAdvice, drinkAdvice, eatAdvice } = require('../../utils/adviceMessages');
const sharingCooldownAccountsMap = new Map();

module.exports.name = 'share';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	if (!isInGuild(message)) {

		return;
	}

	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guildId]];
	let profileData = characterData?.profiles?.[message.guildId];

	if (!hasCompletedAccount(message, characterData)) {

		return;
	}

	if (await isInvalid(message, userData, embedArray, [module.exports.name])) {

		return;
	}

	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	if (sharingCooldownAccountsMap.has('nr' + message.author.id + message.guildId) && Date.now() - sharingCooldownAccountsMap.get('nr' + message.author.id + message.guildId) < 7200000) {

		await message
			.reply({
				content: messageContent,
				embeds: [{
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					title: 'You can only share every 2 hours!',
					description: `You can share again <t:${Math.floor((sharingCooldownAccountsMap.get('nr' + message.author.id + message.guildId) + 7200000) / 1000)}:R>.`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (profileData.rank !== 'Elderly') {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} is about to begin sharing a story when an elderly interrupts them.* "Oh, young ${characterData.displayedSpecies || characterData.species}, you need to have a lot more adventures before you can start advising others!"`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const firstMentionedUser = message.mentions.users.first();
	if (firstMentionedUser && firstMentionedUser.id == message.author.id) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} is very wise from all the adventures ${pronoun(characterData, 0)} had, but also a little... quaint. Sometimes ${pronounAndPlural(characterData, 0, 'sit')} down at the fireplace, mumbling to ${pronoun(characterData, 4)} a story from back in the day. Busy packmates look at ${pronoun(characterData, 1)} in confusion as they pass by.*`,
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

	userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: message.author.id },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].energy -= energyPoints;
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].hunger -= hungerPoints;
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].thirst -= thirstPoints;
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].currentRegion = 'ruins';
		},
	));
	characterData = userData.characters[userData.currentCharacter[message.guildId]];
	profileData = characterData.profiles[message.guildId];

	let embedFooterStatsText = `-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

	if (hungerPoints >= 1) {

		embedFooterStatsText += `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
	}

	if (thirstPoints >= 1) {

		embedFooterStatsText += `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
	}

	if (profileData.currentRegion != 'ruins') {

		embedFooterStatsText += '\nYou are now at the ruins';
	}

	let healthPoints = 0;
	const userInjuryObject = { ...profileData.injuries };

	const embed = {
		color: characterData.color,
		author: { name: characterData.name, icon_url: characterData.avatarURL },
		description: '',
		footer: { text: '' },
	};

	/** @type {import('../../typedef').ProfileSchema | null} */
	let partnerUserData = null;
	/** @type {import('../../typedef').Character | null} */
	let partnerCharacterData = null;
	/** @type {import('../../typedef').Profile | null} */
	let partnerProfileData = null;
	/** @type {Array<import('discord.js').MessageEmbedOptions>} */
	let extraEmbeds = [];

	if (!firstMentionedUser) {

		const allRuinUsersList = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel
			.find(
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					return Object.values(p.characters).filter(c => c.profiles[message.guildId] !== undefined && c.profiles[message.guildId].currentRegion === 'ruins' && c.profiles[message.guildId].energy > 0 && c.profiles[message.guildId].health > 0 && c.profiles[message.guildId].hunger > 0 && c.profiles[message.guildId].thirst > 0 && c.profiles[message.guildId].injuries.cold === false).length > 0;
				},
			))
			.map(user => user.userId)
			.filter(userId => userId != userData.userId);

		if (allRuinUsersList.length > 0) {

			const allRuinsProfilesArrayRandomIndex = generateRandomNumber(allRuinUsersList.length, 0);

			partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({
				userId: allRuinUsersList[allRuinsProfilesArrayRandomIndex],
			}));
			partnerCharacterData = Object.values(partnerUserData.characters).find(c => c.profiles[message.guildId] !== undefined && c.profiles[message.guildId].currentRegion === 'ruins' && c.profiles[message.guildId].energy > 0 && c.profiles[message.guildId].health > 0 && c.profiles[message.guildId].hunger > 0 && c.profiles[message.guildId].thirst > 0 && c.profiles[message.guildId].injuries.cold === false) || null;
			partnerProfileData = partnerCharacterData?.profiles?.[message.guildId] || null;

			if (partnerUserData && partnerCharacterData && partnerCharacterData.name !== '' && partnerCharacterData.species !== '' && partnerProfileData && partnerProfileData.energy > 0 && partnerProfileData.health > 0 && partnerProfileData.hunger > 0 && partnerProfileData.thirst > 0 && !partnerProfileData.hasCooldown && !partnerProfileData.isResting) {

				extraEmbeds = await shareStory();
			}
			else {

				extraEmbeds = await noSharing();
			}
		}
		else {

			extraEmbeds = await noSharing();
		}
	}
	else {

		partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: firstMentionedUser.id }));
		partnerCharacterData = partnerUserData?.characters?.[partnerUserData?.currentCharacter?.[message.guildId]];
		partnerProfileData = partnerCharacterData?.profiles?.[message.guildId];

		if (!partnerUserData || !partnerCharacterData || partnerCharacterData.name === '' || partnerCharacterData.species === '' || !partnerProfileData || partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0 || partnerProfileData.hasCooldown || partnerProfileData.isResting) {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].energy += energyPoints;
					p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].hunger += hungerPoints;
					p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].thirst += thirstPoints;
				},
			);

			await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, {
						color: /** @type {`#${string}`} */ (error_color),
						title: 'The mentioned user has no (selected) character, hasn\'t completed setting up their profile, is busy or is passed out :(',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
		else {

			extraEmbeds = await shareStory();
		}
	}

	let botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, ...extraEmbeds],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	botReply = await checkLevelUp(message, userData, serverData, botReply) || botReply;
	await decreaseHealth(userData, botReply, userInjuryObject);
	await isPassedOut(message, userData.uuid, false);

	await restAdvice(message, userData);
	await drinkAdvice(message, userData);
	await eatAdvice(message, userData);

	if (partnerUserData !== null && partnerCharacterData != undefined) { await addFriendshipPoints(message, userData, characterData._id, partnerUserData, partnerCharacterData._id); }


	/**
	 * Shares a story with a user.
	 * @returns {Promise<Array<import('discord.js').MessageEmbedOptions>>}
	 */
	async function shareStory() {

		sharingCooldownAccountsMap.set('nr' + message.author.id + message.guildId, Date.now());

		// @ts-ignore, since partnerData cant be null
		const partnerExperiencePoints = generateRandomNumber(Math.round((partnerProfileData.levels * 50) * 0.15), Math.round((partnerProfileData.levels * 50) * 0.05));

		partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			// @ts-ignore, since partnerData cant be null
			{ userId: partnerUserData.userId },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				// @ts-ignore, since partnerData cant be null and message must be in guild
				p.characters[partnerCharacterData._id].profiles[message.guildId].experience += partnerExperiencePoints;
			},
		));
		// @ts-ignore, since partnerData cant be null
		partnerCharacterData = partnerUserData.characters[partnerCharacterData._id];
		// @ts-ignore, since message must be in guild
		partnerProfileData = partnerCharacterData?.profiles?.[message.guildId];

		embed.description = `*${partnerCharacterData.name} comes running to the old wooden trunk at the ruins where ${characterData.name} sits, ready to tell an exciting story from long ago. ${upperCasePronoun(partnerCharacterData, 2)} eyes are sparkling as the ${characterData.displayedSpecies || characterData.species} recounts great adventures and the lessons to be learned from them.*`;
		// @ts-ignore, since partnerData cant be null
		embed.footer.text = `${embedFooterStatsText}\n+${partnerExperiencePoints} XP for ${partnerCharacterData.name} (${partnerProfileData.experience}/${partnerProfileData.levels * 50})`;

		/** @type {Array<import('discord.js').MessageEmbedOptions>} */
		extraEmbeds = [embed];

		// @ts-ignore, since partnerData cant be null
		if (partnerProfileData.experience >= partnerProfileData.levels * 50) {

			partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: partnerUserData.userId },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					// @ts-ignore, since partnerData cant be null and message must be in guild
					p.characters[partnerCharacterData._id].profiles[message.guildId].experience += -(p.characters[partnerCharacterData._id].profiles[message.guildId].levels * 50);
					// @ts-ignore, since partnerData cant be null and message must be in guild
					p.characters[partnerCharacterData._id].profiles[message.guildId].levels += 1;
				},
			));
			partnerCharacterData = partnerUserData.characters[partnerCharacterData._id];
			// @ts-ignore, since message must be in guild
			partnerProfileData = partnerCharacterData?.profiles?.[message.guildId];

			extraEmbeds.push({
				color: partnerCharacterData.color,
				author: { name: partnerCharacterData.name, icon_url: partnerCharacterData.avatarURL },
				// @ts-ignore, since partnerData cant be null
				title: `${partnerCharacterData.name} just leveled up! ${upperCasePronounAndPlural(partnerCharacterData, 2, 'is', 'are')} now level ${partnerProfileData.levels}.`,
			});
		}

		// @ts-ignore, since partnerData cant be null
		if (partnerProfileData.injuries.cold === true && profileData.injuries.cold === false && pullFromWeightedTable({ 0: 3, 1: 7 }) === 0) {

			healthPoints = generateRandomNumber(5, 3);

			if (profileData.health - healthPoints < 0) {

				healthPoints = profileData.health;
			}

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					// @ts-ignore, since message must be in guild
					p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].health -= healthPoints;
				},
			));

			userInjuryObject.cold = true;

			extraEmbeds.push({
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*Suddenly, ${characterData.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${partnerCharacterData.name}, who was coughing as well. That was probably not the best idea!*`,
				footer: { text: `-${healthPoints} HP (from cold)` },
			});
		}

		return extraEmbeds;
	}

	/**
	 * Sends a message that there is no one to share with.
	 * @returns {Promise<Array<import('discord.js').MessageEmbedOptions>>}
	 */
	async function noSharing() {

		embed.description = `*${characterData.name} sits on an old wooden trunk at the ruins, ready to tell a story to any willing listener. But to ${pronoun(characterData, 2)} disappointment, no one seems to be around.*`;
		embed.footer.text = '';

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: message.author.id },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				// @ts-ignore, since message must be in guild
				p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].energy += energyPoints;
				// @ts-ignore, since message must be in guild
				p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].hunger += hungerPoints;
				// @ts-ignore, since message must be in guild
				p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].thirst += thirstPoints;
			},
		));

		extraEmbeds.push(embed);
		return extraEmbeds;
	}
};