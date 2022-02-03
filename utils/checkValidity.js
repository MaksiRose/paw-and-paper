const profileModel = require('../models/profileModel');
const maps = require('./maps');
const executeResting = require('./executeResting');
const config = require('../config.json');

module.exports = {

	async isPassedOut(message, profileData) {

		if (profileData.energy <= 0 || profileData.health <= 0 || profileData.hunger <= 0 || profileData.thirst <= 0) {

			await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} lies on the ground near the pack borders, barely awake.* "Healer!" *${profileData.pronounArray[0]} screech${(profileData.pronounArray[5] == 'singular') ? 'es' : ''} with ${profileData.pronounArray[2]} last energy. Without help, ${profileData.pronounArray[0]} will not be able to continue.*`,
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			return true;
		}

		return false;
	},

	async hasCooldown(message, profileData, callerNameArray) {

		const commandName = message.content.slice(config.prefix.length).trim().split(/ +/).shift().toLowerCase();

		if (profileData.hasCooldown == true && callerNameArray.includes(commandName)) {

			await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} is so eager to get things done today that ${profileData.pronounArray[0]} ${(profileData.pronounArray[5] == 'singular') ? 'is' : 'are'} somersaulting. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} should probably take a few seconds to calm down.*`,
					}],
				})
				.then(reply => {
					setTimeout(async function() {

						await reply
							.delete()
							.catch((error) => {
								if (error.httpStatus !== 404) {
									throw new Error(error);
								}
							});
					}, 10000);
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			return true;
		}

		return false;
	},

	async hasQuest(message, profileData) {

		if (profileData.hasQuest == true) {

			let description = `${profileData.name} got a quest!`;

			if (profileData.rank == 'Youngling') {
				description = `*${profileData.name} lifts ${profileData.pronounArray[2]} head to investigate the sound of a faint cry. Almost sure that it was someone in need of help, ${profileData.pronounArray[0]} dashed from where ${profileData.pronounArray[0]} were standing and bolted for the sound. Soon ${profileData.name} came along to the intimidating mouth of a dark cave covered by a boulder. The cries for help still ricocheting through ${profileData.pronounArray[2]} brain. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} must help them...*`;
			}

			if (profileData.rank == 'Apprentice') {

				if (maps.speciesMap.get(profileData.species).habitat == 'warm') {

					description = `*The ${profileData.species} wanders through the peaceful shrubland, carefully surveying the undergrowth around ${profileData.pronounArray[1]}. To ${profileData.pronounArray[2]} left are thick bushes at the bottom of a lone tree. Suddenly ${profileData.name} sees something pink that seems to glisten between the shrubs. Could this be a particularly precious plant? Curious, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'trots' : 'trot')} over to it, but even a closer look doesn't reveal what it is. Determined, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'pushes' : 'push')} into the shrubs but ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} disappointed. It was just an ordinary dog rose. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'tries' : 'try')} to climb back out, but ${profileData.pronounArray[2]} paw won't move. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} stuck under a bulky root! Now ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'has' : 'have')} to gather all ${profileData.pronounArray[2]} strength in order not to have to stay here forever.*`;
				}

				if (maps.speciesMap.get(profileData.species).habitat == 'cold') {

					description = `*The ${profileData.species} wanders through the peaceful forest, carefully surveying the undergrowth around ${profileData.pronounArray[1]}. To ${profileData.pronounArray[2]} left is a long, thick tree trunk overgrown with sodden moss. Suddenly ${profileData.name} sees something pink that seems to glisten under the trunk. Could this be a particularly precious plant? Curious, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'trots' : 'trot')} over to it, but even a closer look doesn't reveal what it is. Determined, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'squeezes' : 'squeeze')} down but ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} disappointed. It was just an ordinary dog rose. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'tries' : 'try')} to climb back out, but the opening is too narrow. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} stuck! Now ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'has' : 'have')} to gather all ${profileData.pronounArray[2]} strength in order not to have to stay here forever.*`;
				}

				if (maps.speciesMap.get(profileData.species).habitat == 'water') {

					description = `*The ${profileData.species} swims through the peaceful river, carefully surveying the algae around ${profileData.pronounArray[1]}. In front of ${profileData.pronounArray[1]} is a thick strainer, which through the leaves is barely passable even underneath. Suddenly ${profileData.name} sees something pink that seems to glisten at the bottom of the fallen trunk. Could this be a particularly precious plant? Curious, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'swims' : 'swim')} over to it, but even a closer look doesn't reveal what it is. Determined, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'pushes' : 'push')} underneath but ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} disappointed. It was just an ordinary dog rose. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'tries' : 'try')} to climb back out, but ${profileData.pronounArray[2]} fin won't move. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} stuck! Now ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'has' : 'have')} to gather all ${profileData.pronounArray[2]} strength in order not to have to stay here forever.*`;
				}
			}

			if (profileData.rank == 'Healer' || profileData.rank == 'Hunter') {

				if (maps.speciesMap.get(profileData.species).habitat == 'warm') {

					description = `*It is a quiet morning in the savanna. Only the rustling of the scarce bushes and trees breaks the silence. ${profileData.name} meanders between the trees, looking for food for ${profileData.pronounArray[2]} pack. But suddenly, the ${profileData.species} hears a motor. Frightened, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'looks' : 'look')} into the distance: indeed, there is a jeep in front of ${profileData.pronounArray[1]}, and it is heading straight for ${profileData.pronounArray[1]}! Now every second counts.*`;
				}

				if (maps.speciesMap.get(profileData.species).habitat == 'cold') {

					description = `*It is a quiet morning in the taiga. Only the chirping of birds in the trees breaks the silence. ${profileData.name} meanders over the sand, looking for food for ${profileData.pronounArray[2]} pack. But suddenly, the ${profileData.species} hears a motor. Frightened, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'looks' : 'look')} into the distance: indeed, there is a jeep in front of ${profileData.pronounArray[1]}, and it is heading straight for ${profileData.pronounArray[1]}! Now every second counts.*`;
				}

				if (maps.speciesMap.get(profileData.species).habitat == 'water') {

					description = `*It is a quiet morning in the coral reef. Only once in a while a fish passes by. ${profileData.name} floats through the water, looking for food for ${profileData.pronounArray[2]} pack. But suddenly, the ${profileData.species} hears a motor. Frightened, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'looks' : 'look')} to the surface: indeed, there is a motorboat in front of ${profileData.pronounArray[1]}, and it is heading straight for ${profileData.pronounArray[1]}! Now every second counts.*`;
				}
			}

			if (profileData.rank == 'Elderly') {

				if (maps.speciesMap.get(profileData.species).habitat == 'warm') {

					description = `*Something is off, the ${profileData.speices} senses it. In the desert, it was strangely quiet, not this peaceful silence, but as if ${profileData.pronounArray[0]} were all alone. ${profileData.name} looks around and can't see a soul far and wide. Then it dawns on ${profileData.pronounArray[1]}. A glance over ${profileData.pronounArray[2]} shoulder confirms ${profileData.pronounArray[2]} fear, a big sandstorm is approaching and coming ${profileData.pronounArray[2]} way. If ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'doesn\'t' : 'don\'t')} hurry now, ${profileData.pronounArray[0]} may never find ${profileData.pronounArray[2]} way back.*`;
				}

				if (maps.speciesMap.get(profileData.species).habitat == 'cold') {

					description = `*Something is off, the ${profileData.speices} senses it. In the tundra, it was strangely quiet, not this peaceful silence, but as if ${profileData.pronounArray[0]} were all alone. ${profileData.name} looks around and can't see a soul far and wide. Then it dawns on ${profileData.pronounArray[1]}. A glance over ${profileData.pronounArray[2]} shoulder confirms ${profileData.pronounArray[2]} fear, a big snowstorm is approaching and coming ${profileData.pronounArray[2]} way. If ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'doesn\'t' : 'don\'t')} hurry now, ${profileData.pronounArray[0]} may never find ${profileData.pronounArray[2]} way back.*`;
				}

				if (maps.speciesMap.get(profileData.species).habitat == 'water') {

					description = `*Something is off, the ${profileData.speices} senses it. In the ocean, it was strangely quiet, not this peaceful silence, but as if ${profileData.pronounArray[0]} were all alone. ${profileData.name} looks around and can't see a soul far and wide. Then it dawns on ${profileData.pronounArray[1]}. A glance over ${profileData.pronounArray[2]} shoulder confirms ${profileData.pronounArray[2]} fear, a big landslide is approaching and coming ${profileData.pronounArray[2]} way. If ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'doesn\'t' : 'don\'t')} hurry now, ${profileData.pronounArray[0]} may never find ${profileData.pronounArray[2]} way back.*`;
				}
			}

			await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: description,
						footer: { text: 'Type \'rp quest\' to continue!' },
					}],
				})
				.then(reply => {
					setTimeout(async function() {

						await reply
							.delete()
							.catch((error) => {
								if (error.httpStatus !== 404) {
									throw new Error(error);
								}
							});
					}, 10000);
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			return true;
		}

		return false;
	},

	async isResting(message, profileData, embedArray) {

		if (profileData.isResting == true) {

			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { isResting: false } },
			);

			executeResting.stopResting(message.author.id);

			embedArray.unshift({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} opens ${profileData.pronounArray[2]} eyes, blinking at the bright sun. After a long stretch, ${profileData.pronounArray[0]} leave${(profileData.pronounArray[5] == 'singular') ? 's' : ''} ${profileData.pronounArray[2]} den to continue ${profileData.pronounArray[2]} day.*`,
				footer: { text: `Current energy: ${profileData.energy}` },
			});
		}

		return profileData;
	},

	async isInvalid(message, profileData, embedArray, callerNameArray) {

		if (await module.exports.isPassedOut(message, profileData)) {

			return true;
		}

		if (await module.exports.hasCooldown(message, profileData, callerNameArray)) {

			return true;
		}

		if (await module.exports.hasQuest(message, profileData)) {

			return true;
		}

		await module.exports.isResting(message, profileData, embedArray);

		return false;
	},

};