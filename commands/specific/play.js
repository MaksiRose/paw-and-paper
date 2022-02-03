const profileModel = require('../../models/profileModel');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const levels = require('../../utils/levels');
const items = require('../../utils/items');
const condition = require('../../utils/condition');
const startCooldown = require('../../utils/startCooldown');
const config = require('../../config.json');

module.exports = {
	name: 'play',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		if ([...Object.values(profileData.inventoryObject).map(type => Object.values(type))].filter(value => value > 0).length > 25) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} approaches the prairie, ${profileData.pronounArray[2]} mouth filled with various things. As eager as ${profileData.pronounArray[0]} ${(profileData.pronounArray[5] == 'singular') ? 'is' : 'are'} to go playing, ${profileData.pronounArray[0]} decide${(profileData.pronounArray[5] == 'singular') ? 's' : ''} to store some things away first.*`,
				footer: { text: 'You can only hold up to 25 items in your personal inventory. Type "rp store" to put things into the pack inventory!' },
			});

			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (profileData.rank == 'Healer' || profileData.rank == 'Hunter' || profileData.rank == 'Elderly') {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*A packmate turns their head sideways as they see ${profileData.name} running towards the playground.* "Aren't you a little too old to play, ${profileData.rank}?" *they ask.*`,
			});

			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (message.mentions.users.size > 0 && message.mentions.users.first().id == message.author.id) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} plays with ${profileData.pronounArray[4]}. The rest of the pack looks away in embarrassment.*`,
			});

			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		const thirstPoints = await condition.decreaseThirst(profileData);
		const hungerPoints = await condition.decreaseHunger(profileData);
		const extraLostEnergyPoints = await condition.decreaseEnergy(profileData);
		let energyPoints = Loottable(5, 1) + extraLostEnergyPoints;
		let experiencePoints = 0;

		if (profileData.energy - energyPoints < 0) {

			energyPoints = profileData.energy;
		}

		if (profileData.rank == 'Youngling') {

			experiencePoints = Loottable(9, 1);
		}

		if (profileData.rank == 'Apprentice') {

			experiencePoints = Loottable(11, 5);
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

		let embedFooterStatsText = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

		if (hungerPoints >= 1) {

			embedFooterStatsText += `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
		}

		if (thirstPoints >= 1) {

			embedFooterStatsText += `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
		}

		if (profileData.currentRegion != 'prairie') {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$set: { currentRegion: 'prairie' },
				},
			);

			embedFooterStatsText += '\nYou are now at the prairie';
		}

		let healthPoints = 0;
		const userInjuryObject = { ...profileData.injuryObject };

		const embed = {
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: '',
			footer: { text: '' },
			image: { url: '' },
		};

		if (!message.mentions.users.size) {

			let allPrairieProfilesArray = await profileModel.find({
				serverId: message.guild.id,
				currentRegion: 'prairie',
			});

			allPrairieProfilesArray = allPrairieProfilesArray.map(doc => doc.userId);
			const allPrairieProfilesArrayUserIndex = allPrairieProfilesArray.indexOf(`${profileData.userId}`);

			if (allPrairieProfilesArrayUserIndex > -1) {

				allPrairieProfilesArray.splice(allPrairieProfilesArrayUserIndex, 1);
			}

			const getsQuestChance = weightedTable({ 0: 19, 1: 1 });
			if (getsQuestChance == 1 && profileData.unlockedRanks == 0 && profileData.rank == 'Youngling' && profileData.levels > 1) {

				await findQuest();
			}
			else if (allPrairieProfilesArray.length > 0) {

				const allPrairieProfilesArrayRandomIndex = Loottable(allPrairieProfilesArray.length, 0);

				const partnerProfileData = await profileModel.findOne({
					userId: allPrairieProfilesArray[allPrairieProfilesArrayRandomIndex],
					serverId: message.guild.id,
				});

				const playTogetherChance = weightedTable({ 0: 3, 1: 7 });
				if (playTogetherChance == 1 && partnerProfileData.energy > 0 && partnerProfileData.health > 0 && partnerProfileData.hunger > 0 && partnerProfileData.thirst > 0) {

					await playTogether(partnerProfileData);
				}
				else {

					await findSomething();
				}
			}
			else {

				await findSomething();
			}
		}
		else {

			const partnerProfileData = await profileModel.findOne({
				userId: message.mentions.users.first().id,
				serverId: message.guild.id,
			});

			if (!partnerProfileData || partnerProfileData.name == '' || partnerProfileData.species == '' || partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0) {

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

				embedArray.push({
					color: config.error_color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'The mentioned user has no account or is passed out :(',
				});

				return await message
					.reply({
						embeds: embedArray,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			await playTogether(partnerProfileData);
		}

		const botReply = await message
			.reply({
				embeds: embedArray,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		await condition.decreaseHealth(message, profileData, botReply);
		await levels.levelCheck(message, profileData, botReply);

		if (await checkValidity.isPassedOut(message, profileData)) {

			await levels.decreaseLevel(message, profileData);
		}


		async function findQuest() {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { hasQuest: true } },
			);

			embed.description = `*${profileData.name} lifts ${profileData.pronounArray[2]} head to investigate the sound of a faint cry. Almost sure that it was someone in need of help, ${profileData.pronounArray[0]} dashes from where ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} standing and bolts for the sound. Soon ${profileData.name} comes along to the intimidating mouth of a dark cave covered by a boulder. The cries for help still ricocheting through ${profileData.pronounArray[2]} brain. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} must help them...*`;
			embed.footer.text = `Type 'rp quest' to continue!\n\n${embedFooterStatsText}`;

			embedArray.push(embed);
		}

		async function findSomething() {

			const betterLuckValue = (profileData.levels - 1) * 2;

			const findSomethingChance = weightedTable({ 0: 90, 1: 10 + betterLuckValue });
			if (findSomethingChance == 0) {

				embed.description = `*${profileData.name} bounces around camp, watching the busy hustle and blurs of hunters and healers at work. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} splash${(profileData.pronounArray[5] == 'singular') ? 'es' : ''} into the stream that split the pack in half, chasing the minnows with ${profileData.pronounArray[2]} eyes.*`;
				embed.footer.text = embedFooterStatsText;

				return embedArray.push(embed);
			}

			const getHurtChance = weightedTable({ 0: 10, 1: 90 + betterLuckValue });
			if (getHurtChance == 0 && profileData.rank != 'Youngling') {

				healthPoints = Loottable(5, 3);

				if (profileData.health - healthPoints < 0) {

					healthPoints = profileData.health;
				}

				profileData = await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{ $inc: { health: -healthPoints } },
				);

				switch (true) {

					case (weightedTable({ 0: 7, 1: 13 }) == 0 && userInjuryObject.cold == false):

						userInjuryObject.cold = true;

						embed.description = `*${profileData.name} tumbles around camp, weaving through dens and packmates at work. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} pause${(profileData.pronounArray[5] == 'singular') ? 's' : ''} for a moment, having a sneezing and coughing fit. It looks like ${profileData.name} has caught a cold.*`;
						embed.footer.text = `-${healthPoints} HP (from cold)\n${embedFooterStatsText}`;

						break;

					default:

						userInjuryObject.wounds += 1;

						embed.description = `*${profileData.name} strays from camp, playing near the pack borders. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} hop${(profileData.pronounArray[5] == 'singular') ? 's' : ''} on rocks and pebbles, trying to keep ${profileData.pronounArray[2]} balance, but the rock ahead of ${profileData.pronounArray[1]} is steeper and more jagged. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} land${(profileData.pronounArray[5] == 'singular') ? 's' : ''} with an oomph and a gash slicing through ${profileData.pronounArray[2]} feet from the sharp edges.*`;
						embed.footer.text = `-${healthPoints} HP (from wound)\n${embedFooterStatsText}`;
				}

				return embedArray.push(embed);
			}

			const foundItem = await items.randomCommonPlant(message, profileData);

			embed.description = `*${profileData.name} bounds across the den territory, chasing a bee that is just out of reach. Without looking, the ${profileData.species} crashes into a Hunter, loses sight of the bee, and scurries away into the forest. On ${profileData.pronounArray[2]} way back to the pack border, ${profileData.name} sees something special on the ground. It's a ${foundItem}!*`;
			embed.footer.text = `${embedFooterStatsText}\n\n+1 ${foundItem} for ${message.guild.name}`;

			return embedArray.push(embed);
		}

		async function playTogether(partnerProfileData) {

			let partnerHealthPoints = Loottable(5, 1);

			if (partnerProfileData.health + partnerHealthPoints > partnerProfileData.maxHealth) {

				partnerHealthPoints = partnerHealthPoints - ((partnerProfileData.health + partnerHealthPoints) - partnerProfileData.maxHealth);
			}

			partnerProfileData = await profileModel.findOneAndUpdate(
				{ userId: partnerProfileData.userId, serverId: message.guild.id },
				{ $inc: { health: partnerHealthPoints } },
			);

			if (partnerHealthPoints >= 1) {

				embedFooterStatsText += `\n\n+${partnerHealthPoints} HP for ${partnerProfileData.name} (${partnerProfileData.health}/${partnerProfileData.maxHealth})`;
			}

			const whoWinsChance = weightedTable({ 0: 1, 1: 1 });
			if (whoWinsChance == 0) {

				embed.description = `*${profileData.name} trails behind ${partnerProfileData.name}'s rear end, preparing for a play attack. The ${profileData.species} launches forward, landing on top of ${partnerProfileData.name}.* "I got you, ${partnerProfileData.name}!" *${profileData.pronounArray[0]} say${(profileData.pronounArray[5] == 'singular') ? 's' : ''}. Both creatures bounce away from each other, laughing.*`;
				embed.image.url = 'https://external-preview.redd.it/iUqJpDGv2YSDitYREfnTvsUkl9GG6oPMCRogvilkIrg.gif?s=9b0ea7faad7624ec00b5f8975e2cf3636f689e27';
			}
			else {

				embed.description = `*${profileData.name} trails behind ${partnerProfileData.name}'s rear end, preparing for a play attack. Right when the ${profileData.species} launches forward, ${partnerProfileData.name} dashes sideways, followed by a precise jump right on top of ${profileData.name}.* "I got you, ${profileData.name}!" *${partnerProfileData.pronounArray[0]} say${(partnerProfileData.pronounArray[5] == 'singular') ? 's' : ''}. Both creatures bounce away from each other, laughing.*`;
				embed.image.url = 'https://i.pinimg.com/originals/7e/e4/01/7ee4017f0152c7b7c573a3dfe2c6673f.gif';
			}

			embed.footer.text = embedFooterStatsText;

			embedArray.push(embed);

			if (partnerProfileData.injuryObject.cold == true && profileData.injuryObject.cold == false) {

				const getsInfectedChance = weightedTable({ 0: 3, 1: 7 });
				if (getsInfectedChance == 0) {

					healthPoints = Loottable(5, 3);

					if (profileData.health - healthPoints < 0) {

						healthPoints = profileData.health;
					}

					profileData = await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $inc: { health: -healthPoints } },
					);

					userInjuryObject.cold = true;

					embedArray.push({
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*Suddenly, ${profileData.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${partnerProfileData.name}, who was coughing as well. That was probably not the best idea!*`,
						footer: { text: `-${healthPoints} HP (from cold)` },
					});
				}
			}

			return;
		}

		function Loottable(max, min) {

			return Math.floor(Math.random() * max) + min;
		}

		function weightedTable(values) {

			const table = [];

			for (const i in values) {

				for (let j = 0; j < values[i]; j++) {

					table.push(i);
				}
			}

			return table[Math.floor(Math.random() * table.length)];
		}
	},
};