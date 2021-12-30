const arrays = require("../../utils/arrays");
const profileModel = require("../../models/profileSchema");
const missing = require("../../utils/checkAccountCompletion");
const levels = require("../../utils/levels");
const items = require("../../utils/items");
const condition = require("../../utils/condition");

module.exports = {
	name: "play",
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {
		await message.channel.sendTyping()
		if (!profileData || profileData.name === "") return missing.missingName(message);
		if (profileData.species === "") return missing.missingSpecies(message, profileData);
		if (profileData.hasCooldown === true) return cooldown.cooldownMessage(message, profileData);
		if (profileData.hasQuest == true) return quest.quest(message, profileData)
		if (profileData.energy <= 0 || profileData.health <= 0 || profileData.hunger <= 0 || profileData.thirst <= 0) return passedout.passedOut(message, profileData);
		if (profileData.rank === "Healer" || profileData.rank === "Hunter" || profileData.rank === "Elderly") {
			let wrong_rank_embed = new Discord.MessageEmbed()
				.setAuthor(`${profileData.name}`, `${profileData.avatarURL}`)
				.setColor(`${profileData.color}`)
				.setDescription(`*A packmate turns their head sideways as they see ${profileData.name} running towards the playground.* "Aren't you a little too old to play, ${profileData.rank}?" *they ask.*`)
			return await message.reply({ embeds: [wrong_rank_embed] });
		}
		if (profileData.isResting === true) await isresting.isResting(message, profileData, embedArray);
		await cooldown.commandCooldown(message);
		condition.depleteThirst(message, profileData);
		condition.depleteHunger(message, profileData);
		condition.depleteEnergy(message, profileData);

		function Loottable(max, min) { return Math.floor(Math.random() * max + min) }
		let total_energy = Loottable(5, 1) + extraLostEnergyPoints;
		if (profileData.energy - total_energy < 0) total_energy = total_energy - (total_energy - profileData.energy);

		let total_XP = 0;
		if (profileData.rank == "Youngling") total_XP = Loottable(9, 1);
		else if (profileData.rank == "Apprentice") total_XP = Loottable(11, 5);

		const stats_profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{
				$inc: {
					energy: -total_energy,
					experience: +total_XP,
				},
				$set: { currentRegion: 'prairie' }
			},
			{ upsert: true, new: true }
		);

		let footertext = `+${total_XP} XP (${stats_profileData.experience}/${stats_profileData.levels * 50})\n-${total_energy} energy (${stats_profileData.energy}/${stats_profileData.maxEnergy})`;
		if (hungerPoints >= 1) footertext = footertext + `\n-${hungerPoints} hunger (${stats_profileData.hunger}/${stats_profileData.maxHunger})`;
		if (thirstPoints >= 1) footertext = footertext + `\n-${thirstPoints} thirst (${stats_profileData.thirst}/${stats_profileData.maxThirst})`;

		let total_HP = 0;
		let playerhurtkind = [...profileData.injuryArray];
		let gethurtlater = 0;

		const embed1 = new Discord.MessageEmbed()
		const embed = new Discord.MessageEmbed()
			.setAuthor(`${profileData.name}`, `${profileData.avatarURL}`)
			.setColor(`${profileData.color}`)

		inventory_size = 0
		for (let i = 0; i < profileData.inventoryArray.length; i++) {
			for (let j = 0; j < profileData.inventoryArray[i].length; j++) {
				inventory_size = inventory_size + profileData.inventoryArray[i][j];
			}
		}

		if (inventory_size >= 25) {
			if (profileData.pronounArray[5] == "singular") {
				embed.setDescription(`*${profileData.name} approaches the prairie, ${profileData.pronounArray[2]} mouth filled with various things. As eager as ${profileData.pronounArray[0]} is to go playing, ${profileData.pronounArray[0]} decides to store some things away first.*`);
			} else if (profileData.pronounArray[5] == "plural") {
				embed.setDescription(`*${profileData.name} approaches the prairie, ${profileData.pronounArray[2]} mouth filled with various things. As eager as ${profileData.pronounArray[0]} are to go playing, ${profileData.pronounArray[0]} decide to store some things away first.*`);
			}
			embed.setFooter('You can only hold up to 25 items in your personal inventory. Type "rp store" to put things into the pack inventory!')
			await message.reply({ embeds: [embed] });
		} else if (!message.mentions.users.size) {
			const docs = await profileModel.find({
				serverId: message.guild.id,
				currentRegion: 'prairie'
			});

			let prairie_array_ID = docs.map(doc => doc.userId);
			prairie_array_ID.splice(prairie_array_ID.indexOf(`${profileData.userId}`), 1);

			if (Loottable(20, 1) <= 1 && profileData.hasQuest == false && profileData.rank == "Youngling") {
				QUEST();
			} else {
				if (prairie_array_ID != "") {
					let index = Loottable(prairie_array_ID.length, 0);

					let chosen_profileData = await profileModel.findOne({
						userId: prairie_array_ID[index],
						serverId: message.guild.id
					});

					if (chosen_profileData.energy <= 0 || chosen_profileData.health <= 0 || chosen_profileData.hunger <= 0 || chosen_profileData.thirst <= 0) {
						FIND_SOMETHING();
					} else if (chosen_profileData.name === "" || chosen_profileData.species === "") {
						FIND_SOMETHING();
					} else {
						if (Loottable(100, 1) >= 70) await PLAY_TOGETHER(chosen_profileData);
						else await FIND_SOMETHING();
					}
				} else await FIND_SOMETHING();
			}
		} else if (message.mentions.users.first().id === message.author.id) {
			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$inc: {
						energy: +total_energy,
						experience: -total_XP,
						hunger: +hungerPoints,
						thirst: +thirstPoints,
					},
				},
				{ upsert: true, new: true }
			);

			embed.setDescription(`*${profileData.name} plays with ${profileData.pronounArray[4]}. The rest of the pack looks away in embarrassment.*`);
		} else {
			let tagged_profileData;
			try {
				tagged_profileData = await profileModel.findOne({ userId: message.mentions.users.first().id, serverId: message.guild.id });
			} catch (err) {
				console.log(err);
			}

			if (tagged_profileData.energy <= 0 || tagged_profileData.health <= 0 || tagged_profileData.hunger <= 0 || tagged_profileData.thirst <= 0) {
				await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{
						$inc: {
							energy: +total_energy,
							experience: -total_XP,
							hunger: +hungerPoints,
							thirst: +thirstPoints,
						},
					},
					{ upsert: true, new: true }
				);

				return passedout.passedOut(message, tagged_profileData);
			} else if (tagged_profileData.name === "" || tagged_profileData.species === "" || tagged_profileData.role === "") {
				await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{
						$inc: {
							energy: +total_energy,
							experience: -total_XP,
							hunger: +hungerPoints,
							thirst: +thirstPoints,
						},
					},
					{ upsert: true, new: true }
				);

				embed.setTitle(`The mentioned user has no account or the account was not completed!`);
			} else await PLAY_TOGETHER(tagged_profileData);
		}

		async function QUEST() {
			embed.setDescription(`*${profileData.name} lifts ${profileData.pronounArray[2]} head to investigate the sound of a faint cry. Almost sure that it was someone in need of help, ${profileData.pronounArray[0]} dashes from where ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == "singular") ? 'is' : 'are')} standing and bolts for the sound. Soon ${profileData.name} comes along to the intimidating mouth of a dark cave covered by a boulder. The cries for help still ricocheting through ${profileData.pronounArray[2]} brain. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} must help them...*`);
			embed.setFooter(`Type 'rp quest' to continue!\n\n${footertext}`);

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { hasQuest: true }, },
				{ upsert: true, new: true }
			);
		}

		async function FIND_SOMETHING() {
			let level_boost = (profileData.levels - 1) * 10
			let luckyvalue = Loottable(100 + level_boost, 1)

			if (luckyvalue <= 1) {
				gethurtlater = 1;

				total_HP = Loottable(5, 3);
				if (profileData.health - total_HP < 0) total_HP = total_HP - (total_HP - profileData.health);

				await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{ $inc: { health: -total_HP }, },
					{ upsert: true, new: true }
				);

				random_hurt_kind = Loottable(100, 1);
				if (playerhurtkind[2] >= 1) random_hurt_kind = 1;

				if (random_hurt_kind <= 65) {
					playerhurtkind[0] = playerhurtkind[0] + 1;

					if (profileData.pronounArray[5] == "singular") {
						embed.setDescription(`*${profileData.name} strays from camp, playing near the pack borders. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} hops on rocks and pebbles, trying to keep ${profileData.pronounArray[2]} balance, but the rock ahead of ${profileData.pronounArray[1]} is steeper and more jagged. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} lands with an oomph and a gash slicing through ${profileData.pronounArray[2]} feet from the sharp edges.*`);
					} else if (profileData.pronounArray[5] == "plural") {
						embed.setDescription(`*${profileData.name} strays from camp, playing near the pack borders. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} hop on rocks and pebbles, trying to keep ${profileData.pronounArray[2]} balance, but the rock ahead of ${profileData.pronounArray[1]} is steeper and more jagged. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} land with an oomph and a gash slicing through ${profileData.pronounArray[2]} feet from the sharp edges.*`);
					}
					embed.setFooter(`-${total_HP} HP (from wound)\n${footertext}`);
				} else if (random_hurt_kind > 65) {
					playerhurtkind[2] = playerhurtkind[2] + 1;

					if (profileData.pronounArray[5] == "singular") {
						embed.setDescription(`*${profileData.name} tumbles around camp, weaving through dens and packmates at work. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} pauses for a moment, having a sneezing and coughing fit. It looks like ${profileData.name} has caught a cold.*`);
					} else if (profileData.pronounArray[5] == "plural") {
						embed.setDescription(`*${profileData.name} tumbles around camp, weaving through dens and packmates at work. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} pause for a moment, having a sneezing and coughing fit. It looks like ${profileData.name} has caught a cold.*`);
					}
					embed.setFooter(`-${total_HP} HP (from cold)\n${footertext}`);
				}
			} else if (luckyvalue <= 90) {
				if (profileData.pronounArray[5] == "singular") {
					embed.setDescription(`*${profileData.name} bounces around camp, watching the busy hustle and blurs of hunters and healers at work. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} splashes into the stream that split the pack in half, chasing the minnows with ${profileData.pronounArray[2]} eyes.*`);
				} else if (profileData.pronounArray[5] == "plural") {
					embed.setDescription(`*${profileData.name} bounces around camp, watching the busy hustle and blurs of hunters and healers at work. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} splash into the stream that split the pack in half, chasing the minnows with ${profileData.pronounArray[2]} eyes.*`);
				}
				embed.setFooter(`${footertext}`);
			} else {
				items.randomCommonPlant(message, profileData);

				embed.setDescription(`*${profileData.name} bounds across the den territory, chasing a bee that is just out of reach. Without looking, the ${profileData.species} crashes into a Hunter, loses sight of the bee, and scurries away into the forest. On ${profileData.pronounArray[2]} way back to the pack border, ${profileData.name} sees something special on the ground. It's a ${foundItem}!*`);
				embed.setFooter(`${footertext}\n\n+1 ${foundItem} for ${message.guild.name}`);
			}
		}

		async function PLAY_TOGETHER(friend_profileData) {
			friend_total_HP = Loottable(5, 1);
			if (friend_profileData.health + friend_total_HP > 100) friend_total_HP = friend_total_HP - ((friend_profileData.health + friend_total_HP) - 100);

			friend_profileData = await profileModel.findOneAndUpdate(
				{ userId: friend_profileData.userId, serverId: message.guild.id },
				{ $inc: { health: friend_total_HP }, },
				{ upsert: true, new: true }
			);

			if (friend_total_HP >= 1) footertext = footertext + `\n\n+${friend_total_HP} HP for ${friend_profileData.name} (${friend_profileData.health}/${friend_profileData.maxHealth})`;
			if (Loottable(2, 1) == 1) {
				if (profileData.pronounArray[5] == "singular") {
					embed.setDescription(`*${profileData.name} trails behind ${friend_profileData.name}'s rear end, preparing for a play attack. The ${profileData.species} launches forward, landing on top of ${friend_profileData.name}.* "I got you, ${friend_profileData.name}!" *${profileData.pronounArray[0]} says. Both creatures bounce away from each other, laughing.*`);
				} else if (profileData.pronounArray[5] == "plural") {
					embed.setDescription(`*${profileData.name} trails behind ${friend_profileData.name}'s rear end, preparing for a play attack. The ${profileData.species} launches forward, landing on top of ${friend_profileData.name}.* "I got you, ${friend_profileData.name}!" *${profileData.pronounArray[0]} say. Both creatures bounce away from each other, laughing.*`);
				}
				embed.setFooter(`${footertext}`);
				embed.setImage(`https://external-preview.redd.it/iUqJpDGv2YSDitYREfnTvsUkl9GG6oPMCRogvilkIrg.gif?s=9b0ea7faad7624ec00b5f8975e2cf3636f689e27`);
			} else {
				if (friend_profileData.pronounArray[5] == "singular") {
					embed.setDescription(`*${profileData.name} trails behind ${friend_profileData.name}'s rear end, preparing for a play attack. Right when the ${profileData.species} launches forward, ${friend_profileData.name} dashes sideways, followed by a precise jump right on top of ${profileData.name}.* "I got you, ${profileData.name}!" *${friend_profileData.pronounArray[0]} says. Both creatures bounce away from each other, laughing.*`);
				} else if (friend_profileData.pronounArray[5] == "plural") {
					embed.setDescription(`*${profileData.name} trails behind ${friend_profileData.name}'s rear end, preparing for a play attack. Right when the ${profileData.species} launches forward, ${friend_profileData.name} dashes sideways, followed by a precise jump right on top of ${profileData.name}.* "I got you, ${profileData.name}!" *${friend_profileData.pronounArray[0]} say. Both creatures bounce away from each other, laughing.*`);
				}
				embed.setFooter(`${footertext}`);
				embed.setImage(`https://i.pinimg.com/originals/7e/e4/01/7ee4017f0152c7b7c573a3dfe2c6673f.gif`);
			}

			if (friend_profileData.injuryArray[2] > 0) {
				let luckyvalue = Loottable(10, 1);
				if (luckyvalue <= 3) {
					gethurtlater = 2;

					total_HP = Loottable(5, 3);
					if (profileData.health - total_HP < 0) total_HP = total_HP - (total_HP - profileData.health);
					await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $inc: { health: -total_HP }, },
						{ upsert: true, new: true }
					);

					playerhurtkind[2] = playerhurtkind[2] + 1;

					embed1.setAuthor(`${profileData.name}`, `${profileData.avatarURL}`);
					embed1.setColor(`${profileData.color}`);
					embed1.setDescription(`*Suddenly, ${profileData.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${friend_profileData.name}, who was coughing as well. That was probably not the best idea!*`);
					embed1.setFooter(`-${total_HP} HP (from cold)`);
				}
			}
		}

		let bot_reply;
		if (gethurtlater == 2) {
			embedArray.push(embed, embed1);
			bot_reply = await message.reply({ embeds: embedArray });
		} else {
			embedArray.push(embed);
			bot_reply = await message.reply({ embeds: embedArray });
		}

		await damage.unhealedDamage(message, profileData, bot_reply);
		total_HP = total_HP + extra_lost_HP;

		if (gethurtlater > 0) {
			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { injuryArray: playerhurtkind }, },
				{ upsert: true, new: true }
			);
		}

		await levels.levelCheck(message, profileData, total_XP, bot_reply);

		if (stats_profileData.energy === 0 || stats_profileData.maxHealth - total_HP === 0 || stats_profileData.hunger === 0 || stats_profileData.thirst === 0) {
			passedout.passedOut(message, profileData);

			let newlevel = profileData.levels;
			newlevel = Math.round(newlevel - (newlevel / 10));

			arrays.commonPlantNames();
			arrays.uncommonPlantNames();
			arrays.rarePlantNames();
			arrays.species(profileData);
			let profile_inventory = [[], [], [], []];
			for (let i = 0; i < arrays.commonPlantNamesArray.length; i++) profile_inventory[0].push(0);
			for (let i = 0; i < arrays.uncommonPlantNamesArray.length; i++) profile_inventory[1].push(0);
			for (let i = 0; i < arrays.rarePlantNamesArray.length; i++) profile_inventory[2].push(0);
			for (let i = 0; i < species.nameArray.length; i++) profile_inventory[3].push(0);

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$set: {
						levels: newlevel,
						experience: 0,
						inventoryArray: profile_inventory,
					},
				},
				{ upsert: true, new: true }
			)
		}
	}
};