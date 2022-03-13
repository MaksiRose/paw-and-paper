const serverModel = require('../../models/serverModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { generateRandomNumberWithException, pullFromWeightedTable } = require('../../utils/randomizers');
const startCooldown = require('../../utils/startCooldown');
const serverMap = new Map();


module.exports = {
	name: 'attack',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name].concat(module.exports.aliases))) {

			return;
		}

		if (!serverMap.has('nr' + message.guild.id) || serverMap.get('nr' + message.guild.id).startsTimestamp != null) {

			// text that there is no attack
		}

		if (serverMap.get('nr' + message.guild.id).humans <= 0) {

			// text that there all humans are in a fight right now
		}

		profileData = await startCooldown(message, profileData);

		serverMap.get('nr' + message.guild.id).humans -= 1;
		serverMap.get('nr' + message.guild.id).currentFights += 1;

		let
			winPoints = 0,
			botReply;
		const embed = {
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: '',
			footer: { text: null },
		};

		await fightCycle(0, '');

		async function fightCycle(totalCycles, cycleKind) {

			const newCycleArray = ['attack', 'dodge', 'defend'];
			cycleKind = newCycleArray[generateRandomNumberWithException(newCycleArray.length, 0, newCycleArray.indexOf(cycleKind))];

			if (cycleKind == 'attack') {

				embed.description = `⏫ *The human gets ready to attack. ${profileData.name} must think quickly about how ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'wants' : 'want')} to react.*`;
			}

			if (cycleKind == 'dodge') {

				embed.description = `↪️ *Looks like the human is preparing a maneuver for ${profileData.name}'s next move. The ${profileData.species} must think quickly about how ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'wants' : 'want')} to react.*`;
			}

			if (cycleKind == 'defend') {

				embed.description = `⏺️ *The human gets into position to oppose an attack. ${profileData.name} must think quickly about how ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'wants' : 'want')} to react.*`;
			}

			const fightButtons = [{
				type: 'BUTTON',
				customId: 'fight-attack',
				label: 'Attack',
				emoji: { name: '⏫' },
				style: 'PRIMARY',
			}, {
				type: 'BUTTON',
				customId: 'fight-defend',
				label: 'Defend',
				emoji: { name: '⏺️' },
				style: 'PRIMARY',
			}, {
				type: 'BUTTON',
				customId: 'fight-dodge',
				label: 'Dodge',
				emoji: { name: '↪️' },
				style: 'PRIMARY',
			}].sort(() => Math.random() - 0.5);

			embedArray.splice(-1, 1, embed);

			if (totalCycles == 0) {

				botReply = await botReply
					.reply({
						embeds: embedArray,
						components: [{
							type: 'ACTION_ROW',
							components: fightButtons,
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}
			else {

				botReply = await botReply
					.edit({
						embeds: embedArray,
						components: [{
							type: 'ACTION_ROW',
							components: fightButtons,
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			const filter = i => (i.customId == 'fight-attack' || i.customId == 'fight-defend' || i.customId == 'fight-dodge') && i.user.id == message.author.id;

			const { customId } = await botReply
				.awaitMessageComponent({ filter, time: 3000 })
				.catch(() => { return { customId: null }; });

			if (customId == null || (customId == 'fight-attack' && cycleKind == 'dodge') || (customId == 'fight-defend' && cycleKind == 'attack') || (customId == 'fight-dodge' && cycleKind == 'defend')) {

				winPoints -= 1;
			}

			if ((customId == 'fight-attack' && cycleKind == 'defend') || (customId == 'fight-defend' && cycleKind == 'dodge') || (customId == 'fight-dodge' && cycleKind == 'attack')) {

				winPoints += 1;
			}

			totalCycles += 1;

			if (totalCycles < 5) {

				return await fightCycle(totalCycles, cycleKind);
			}

			if (winPoints < 0) {

				winPoints = 0;
			}

			winPoints = pullFromWeightedTable({ 0: 8 - winPoints, 1: 8, 2: winPoints });

			if (winPoints == 2) {

				// they leave
				// win-text
			}
			else {

				// take 1-2 things out of inventory
				// neutral-text

				if (winPoints == 0) {

					// get wound or sprain 50/50
					// loose-text
				}

				serverMap.get('nr' + message.guild.id).humans += 1;
			}

			embedArray.splice(-1, 1, embed);
			return botReply = await botReply
				.edit({
					embeds: embedArray,
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		serverMap.get('nr' + message.guild.id).currentFights -= 1;

		if (serverMap.get('nr' + message.guild.id).humans <= 0 && serverMap.get('nr' + message.guild.id).currentFights <= 0) {

			// text that event ended

			clearTimeout(serverMap.get('nr' + message.guild.id).endingTimeout);
			serverMap.delete('nr' + message.guild.id);

			serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { nextPossibleAttack: Date.now() + 86400000 } },
			);
		}
		else if (serverMap.get('nr' + message.guild.id).endingTimeout == null && serverMap.get('nr' + message.guild.id).currentFights <= 0) {

			remainingHumans(message);
		}
	},
	startAttack(message, serverData) {

		serverMap.set('nr' + message.guild.id, { startsTimestamp: Date.now() + 60000, humans: serverData.activeUsersArray.length, endingTimeout: null, currentFights: 0 });
		setTimeout(async function() {

			serverData = serverModel.findOne({ serverId: message.guild.id });

			if (serverData.activeUsersArray.length > serverMap.get('nr' + message.guild.id).humans) {

				serverMap.get('nr' + message.guild.id).humans = serverData.activeUsersArray.length;
			}

			// change from content to embed, and add mentions of active users to content
			await message.channel
				.send({
					content: `${serverMap.get('nr' + message.guild.id).humans} humans are attacking the pack! You have 5 minutes to defeat them. Type 'rp attack' to attack.`,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			serverMap.get('nr' + message.guild.id).startsTimestamp = null;
			serverMap.get('nr' + message.guild.id).endingTimeout = setTimeout(async function() {

				serverMap.get('nr' + message.guild.id).endingTimeout = null;
				if (serverMap.get('nr' + message.guild.id).currentFights <= 0) {

					remainingHumans(message);
				}
			}, 300000);
		}, 60000);
	},
	remindOfAttack(message) {

		if (serverMap.has('nr' + message.guild.id) && serverMap.get('nr' + message.guild.id).startsTimestamp != null) {

			return `Humans will attack in ${Math.floor((serverMap.get('nr' + message.guild.id).startsTimestamp - Date.now()) / 1000)} seconds!`;
		}
		else if (serverMap.has('nr' + message.guild.id) && serverMap.get('nr' + message.guild.id).startsTimestamp == null) {

			return 'Humans are attacking the pack! Type `rp attack` to attack.';
		}

		return null;
	},
};

function remainingHumans(message) {

	// for each remaining humans, take 2-3 things out of the inventory

	// text that event ended and that the remaining humans stole stuff

	serverMap.delete('nr' + message.guild.id);

	serverModel.findOneAndUpdate(
		{ serverId: message.guild.id },
		{ $set: { nextPossibleAttack: Date.now() + 86400000 } },
	);
}