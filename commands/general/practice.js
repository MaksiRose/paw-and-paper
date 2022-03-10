const { decreaseThirst, decreaseHunger, decreaseEnergy } = require('../../utils/checkCondition');
const { generateRandomNumber, generateRandomNumberWithException } = require('../../utils/randomizers');
const profileModel = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { createCommandCollector } = require('../../utils/commandCollector');
const practicingCooldownAccountsMap = new Map();

module.exports = {
	name: 'practice',
	aliases: ['train'],
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		if (practicingCooldownAccountsMap.has('nr' + message.author.id + message.guild.id) && Date.now() - practicingCooldownAccountsMap.get('nr' + message.author.id + message.guild.id) < 300000) {

			return await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						title: 'You can only practice every 5 minutes!',
						description: `You can practice again <t:${Math.floor((practicingCooldownAccountsMap.get('nr' + message.author.id + message.guild.id) + 300000) / 1000)}:R>.`,
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		embedArray.push({
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: `*A very experienced Elderly approaches ${profileData.name}.* "I've seen that you have not performed well in fights lately. Do you want to practice with me for a bit to strengthen your skills?"`,
		});

		let botReply = await message
			.reply({
				embeds: embedArray,
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: 'practice-accept',
						label: 'Accept',
						emoji: { name: '⚔️' },
						style: 'PRIMARY',
					}, {
						type: 'BUTTON',
						customId: 'practice-decline',
						label: 'Decline',
						emoji: { name: '💨' },
						style: 'PRIMARY',
					}],
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		createCommandCollector(message.author.id, message.guild.id, botReply);

		let filter = async (i) => {

			if (!i.message.reference || !i.message.reference.messageId) {

				return false;
			}

			const userMessage = await i.channel.messages
				.fetch(i.message.reference.messageId)
				.catch((error) => {
					throw new Error(error);
				});

			return i.user.id == message.author.id && userMessage.id == message.id && (i.customId === 'practice-accept' || i.customId === 'practice-decline');
		};

		const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 30000 });
		collector.on('end', async (collected) => {

			if (!collected.size || collected.first().customId == 'practice-decline') {

				embedArray.splice(-1, 1, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*After a bit of thinking, ${profileData.name} decides that now is not a good time to practice ${profileData.pronounArray[2]} fighting skills. Politely, ${profileData.pronounArray[0]} decline${profileData.pronounArray[5] == 'singular' ? 's' : ''} the Elderlies offer.*`,
				});

				botReply = await botReply
					.edit({
						embeds: embedArray,
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				return;
			}

			practicingCooldownAccountsMap.set('nr' + message.author.id + message.guild.id, Date.now());

			const thirstPoints = await decreaseThirst(profileData);
			const hungerPoints = await decreaseHunger(profileData);
			const extraLostEnergyPoints = await decreaseEnergy(profileData);
			let energyPoints = generateRandomNumber(5, 1) + extraLostEnergyPoints;
			const experiencePoints = generateRandomNumber(5, 1);

			if (profileData.energy - energyPoints < 0) {

				energyPoints = profileData.energy;
			}

			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$inc: {
						experience: +experiencePoints,
						energy: -energyPoints,
						hunger: -hungerPoints,
						thirst: -thirstPoints,
					},
				},
			);

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

			const fightComponents = {
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					customId: 'practice-attack',
					label: 'Attack',
					emoji: { name: '⏫' },
					style: 'PRIMARY',
				}, {
					type: 'BUTTON',
					customId: 'practice-defend',
					label: 'Defend',
					emoji: { name: '⏺️' },
					style: 'PRIMARY',
				}, {
					type: 'BUTTON',
					customId: 'practice-dodge',
					label: 'Dodge',
					emoji: { name: '↪️' },
					style: 'PRIMARY',
				}],
			};

			let totalCycles = 0;
			let cycleKind = '';
			let winLoseRatio = 0;

			await interactionCollector();

			async function interactionCollector() {

				const newCycleArray = ['attack', 'dodge', 'defend'];
				cycleKind = newCycleArray[generateRandomNumberWithException(newCycleArray.length, 0, newCycleArray.indexOf(cycleKind))];

				if (cycleKind == 'attack') {

					embed.description = `⏫ *The Elderly gets ready to attack. ${profileData.name} must think quickly about how ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'wants' : 'want')} to react.*`;
					embed.footer.text = 'Tip: Dodging an attack surprises the opponent and puts you in the perfect position for a counterattack.';
				}

				if (cycleKind == 'dodge') {

					embed.description = `↪️ *Looks like the Elderly is preparing a maneuver for ${profileData.name}'s next move. The ${profileData.species} must think quickly about how ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'wants' : 'want')} to react.*`;
					embed.footer.text = 'Tip: Defending a maneuver blocks it effectively, which prevents your opponent from hurting you.';
				}

				if (cycleKind == 'defend') {

					embed.description = `⏺️ *The Elderly gets into position to oppose an attack. ${profileData.name} must think quickly about how ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'wants' : 'want')} to react.*`;
					embed.footer.text = 'Tip: Attacks come with a lot of force, making them difficult to defend against.';
				}

				embedArray.splice(-1, 1, embed);
				botReply = await botReply
					.edit({
						embeds: embedArray,
						components: [fightComponents],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				filter = async (i) => {

					if (!i.message.reference || !i.message.reference.messageId) {

						return false;
					}

					const userMessage = await i.channel.messages
						.fetch(i.message.reference.messageId)
						.catch((error) => {
							throw new Error(error);
						});

					return userMessage.id == message.id && (i.customId == 'practice-attack' || i.customId == 'practice-defend' || i.customId == 'practice-dodge') && i.user.id == message.author.id;
				};

				const collector1 = message.channel.createMessageComponentCollector({ filter, max: 1, time: 5000 });
				collector1.on('end', async (newCollected) => {

					totalCycles += 1;

					if (!newCollected.size || (newCollected.first().customId == 'practice-attack' && cycleKind == 'dodge') || (newCollected.first().customId == 'practice-defend' && cycleKind == 'attack') || (newCollected.first().customId == 'practice-dodge' && cycleKind == 'defend')) {

						winLoseRatio -= 1;
					}

					if (newCollected.size > 0 && ((newCollected.first().customId == 'practice-attack' && cycleKind == 'defend') || (newCollected.first().customId == 'practice-defend' && cycleKind == 'dodge') || (newCollected.first().customId == 'practice-dodge' && cycleKind == 'attack'))) {

						winLoseRatio += 1;
					}

					if (totalCycles < 3) {

						return await interactionCollector();
					}

					if (winLoseRatio > 0) {

						embed.description = `*The Elderly pants as they heave themselves to their feet.* "You're much stronger than I anticipated, ${profileData.name}. There's nothing I can teach you at this point!"`;
					}
					else if (winLoseRatio < 0) {

						embed.description = `*With a worried look, the Elderly gives ${profileData.name} a sign to stop.* "It doesn't seem like you are very concentrated right now. Maybe we should continue training later."`;
					}
					else if (winLoseRatio == 0) {

						embed.description = `*The two packmates fight for a while, before ${profileData.name} finally gives up.* "The training was good, but there is room for improvement. Please continue practicing," *the Elderly says.*`;
					}

					embed.footer.text = embedFooterStatsText;

					embedArray.splice(-1, 1, embed);
					botReply = await botReply
						.edit({
							embeds: embedArray,
							components: [],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				});
			}
		});
	},
};